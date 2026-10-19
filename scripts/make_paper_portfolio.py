"""Advance an auditable, close-to-next-open paper strategy from fresh EOD data."""

from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta, timezone
import json
import math
from pathlib import Path

import duckdb
import exchange_calendars


STARTING_CASH = 100_000.0
SLOT_BUDGET = 20_000.0
MAX_POSITIONS = 4
SLIPPAGE = 0.001


def previous_weekday(today: date) -> date:
    day = today - timedelta(days=1)
    while day.weekday() >= 5:
        day -= timedelta(days=1)
    return day


def session_gate(today: date) -> tuple[str, str, str]:
    calendar = exchange_calendars.get_calendar(
        "XNYS", start=today - timedelta(days=30), end=today + timedelta(days=30)
    )
    expected = calendar.date_to_session(today - timedelta(days=1), direction="previous")
    next_session = calendar.next_session(expected)
    return (expected.date().isoformat(), next_session.date().isoformat(),
            calendar.session_close(next_session).isoformat())


def empty_ledger() -> dict:
    return {
        "version": 1, "starting_cash": STARTING_CASH, "cash": STARTING_CASH,
        "last_price_date": None, "positions": [], "pending": [],
        "decisions": [], "fills": [],
    }


def load_ledger(path: Path) -> dict:
    if not path.exists():
        return empty_ledger()
    ledger = json.loads(path.read_text(encoding="utf-8"))
    required = {"version", "cash", "last_price_date", "positions", "pending", "decisions", "fills"}
    if ledger.get("version") != 1 or not required.issubset(ledger):
        raise ValueError("Unsupported paper-portfolio ledger; refusing to replace it")
    return ledger


def finite(value) -> bool:
    return isinstance(value, (int, float)) and math.isfinite(value)


def price_rows(data_dir: Path) -> dict[str, dict]:
    prices = (data_dir / "prices-00.parquet").as_posix()
    snapshot = (data_dir / "snapshot.parquet").as_posix()
    db = duckdb.connect()
    query = f"""
        WITH bars AS (
            SELECT symbol, date, open, close, volume,
                   row_number() OVER (PARTITION BY symbol ORDER BY date DESC) AS rn
            FROM read_parquet('{prices}')
            WHERE close > 0 AND isfinite(close)
        ), metrics AS (
            SELECT symbol, count(*) AS bars,
                   max(date) FILTER (WHERE rn = 1) AS price_date,
                   max(open) FILTER (WHERE rn = 1) AS open,
                   max(close) FILTER (WHERE rn = 1) AS close,
                   max(date) FILTER (WHERE rn = 2) AS previous_price_date,
                   max(volume) FILTER (WHERE rn = 1) AS volume,
                   max(close) FILTER (WHERE rn = 21) AS close_20_ago,
                   max(close) FILTER (WHERE rn = 61) AS close_60_ago,
                   avg(close) FILTER (WHERE rn <= 20) AS ma20,
                   avg(close) FILTER (WHERE rn <= 60) AS ma60,
                   avg(close * volume) FILTER (WHERE rn <= 20) AS turnover20,
                   avg(volume) FILTER (WHERE rn BETWEEN 2 AND 21) AS volume20
            FROM bars WHERE rn <= 61 GROUP BY symbol
        ), latest AS (
            SELECT * FROM read_parquet('{snapshot}')
            QUALIFY row_number() OVER (PARTITION BY symbol ORDER BY period DESC) = 1
        )
        SELECT m.*, s.name, s.sector, s.period, s.market_cap, s.piotroski_f,
               s.return_on_equity, s.free_cash_flow, s.debt_to_equity_ratio,
               s.altman_z, s.net_profit_margin
        FROM metrics m JOIN latest s USING (symbol)
    """
    cursor = db.execute(query)
    names = [column[0] for column in cursor.description]
    rows = {row[0]: dict(zip(names, row)) for row in cursor.fetchall()}
    db.close()
    return rows


def buy_reason(row: dict, price_date: str) -> str | None:
    if str(row["price_date"]) != price_date or row["bars"] < 61:
        return None
    close, old20, old60 = row["close"], row["close_20_ago"], row["close_60_ago"]
    volume, volume20 = row["volume"], row["volume20"]
    values = [close, old20, old60, volume, volume20, row["ma20"], row["ma60"],
              row["turnover20"], row["market_cap"], row["piotroski_f"],
              row["return_on_equity"], row["free_cash_flow"], row["altman_z"],
              row["net_profit_margin"]]
    if not all(finite(value) for value in values) or min(close, old20, old60, volume20) <= 0:
        return None
    period = str(row["period"])
    try:
        report_date = date.fromisoformat(period if len(period) > 4 else period + "-12-31")
    except ValueError:
        return None
    if not 0 <= (date.fromisoformat(price_date) - report_date).days <= 455:
        return None
    r20, r60 = close / old20 - 1, close / old60 - 1
    debt = row["debt_to_equity_ratio"]
    if not (row["market_cap"] >= 2_000_000_000 and close >= 10
            and row["turnover20"] >= 10_000_000
            and row["piotroski_f"] >= 7 and row["return_on_equity"] >= 0.12
            and row["free_cash_flow"] > 0 and row["altman_z"] >= 2.99
            and row["net_profit_margin"] > 0
            and (debt is None or (finite(debt) and 0 <= debt <= 1.5))
            and 0.05 <= r20 <= 0.18 and 0.08 <= r60 <= 0.35
            and close > row["ma20"] > row["ma60"]
            and 1.1 <= volume / volume20 <= 4):
        return None
    return f"财务质量 {int(row['piotroski_f'])}/9；20日趋势 {r20:+.1%}、60日 {r60:+.1%}；放量但未追涨"


def sell_reason(position: dict, row: dict, price_date: str) -> str | None:
    if str(row["price_date"]) != price_date or not finite(row["close"]):
        return None
    change = row["close"] / position["entry_price"] - 1
    if change <= -0.07:
        return "触及 7% 模拟止损线"
    if change >= 0.15:
        return "达到 15% 模拟止盈线"
    if finite(row["ma20"]) and row["close"] < row["ma20"]:
        return "收盘跌破 20 日均线"
    if (date.fromisoformat(price_date) - date.fromisoformat(position["entry_date"])).days >= 30:
        return "持有满 30 个自然日"
    return None


def fill_pending(ledger: dict, rows: dict[str, dict], price_date: str) -> None:
    pending = ledger["pending"]
    ledger["pending"] = []
    if not pending:
        return
    trading_day = date.fromisoformat(price_date)
    calendar = exchange_calendars.get_calendar(
        "XNYS", start=trading_day - timedelta(days=30), end=trading_day + timedelta(days=1)
    )
    prior_session = calendar.previous_session(trading_day).date().isoformat()
    positions = {item["symbol"]: item for item in ledger["positions"]}
    for order in sorted(pending, key=lambda item: item["side"] != "sell"):
        row = rows.get(order["symbol"])
        if (not row or order["decision_date"] != prior_session
                or order["decision_date"] != str(row.get("previous_price_date"))
                or str(row["price_date"]) != price_date):
            continue
        opening = row["open"]
        if not finite(opening) or opening <= 0:
            continue
        if order["side"] == "sell" and order["symbol"] in positions:
            position = positions.pop(order["symbol"])
            price = round(opening * (1 - SLIPPAGE), 4)
            shares = position["shares"]
            ledger["cash"] = round(ledger["cash"] + shares * price, 2)
        elif order["side"] == "buy" and order["symbol"] not in positions:
            if len(positions) >= MAX_POSITIONS or abs(opening / order["reference_close"] - 1) > 0.03:
                continue
            price = round(opening * (1 + SLIPPAGE), 4)
            shares = math.floor(min(SLOT_BUDGET, ledger["cash"]) / price)
            if shares < 1:
                continue
            ledger["cash"] = round(ledger["cash"] - shares * price, 2)
            positions[order["symbol"]] = {
                "symbol": order["symbol"], "name": order["name"], "sector": order["sector"],
                "shares": shares, "entry_price": price, "entry_date": price_date,
            }
        else:
            continue
        ledger["fills"].append({"date": price_date, "side": order["side"],
                                "symbol": order["symbol"], "shares": shares, "price": price})
    ledger["positions"] = sorted(positions.values(), key=lambda item: item["symbol"])


def advance(ledger: dict, rows: dict[str, dict], price_date: str,
            allowed_buys: set[str] | None = None) -> None:
    if ledger["last_price_date"] and price_date <= ledger["last_price_date"]:
        return
    fill_pending(ledger, rows, price_date)
    orders = []
    held = {position["symbol"] for position in ledger["positions"]}
    for position in ledger["positions"]:
        row = rows.get(position["symbol"])
        reason = sell_reason(position, row, price_date) if row else None
        if reason:
            orders.append({"side": "sell", "symbol": position["symbol"],
                           "name": position["name"], "sector": position["sector"],
                           "reason": reason, "reference_close": row["close"],
                           "decision_date": price_date})
    slots = MAX_POSITIONS - len(held)
    if slots > 0:
        candidates = []
        for symbol, row in rows.items():
            if symbol in held or (allowed_buys is not None and symbol not in allowed_buys):
                continue
            reason = buy_reason(row, price_date)
            if reason:
                r20 = row["close"] / row["close_20_ago"] - 1
                candidates.append((row["piotroski_f"], r20, symbol, row, reason))
        candidates.sort(key=lambda item: (-item[0], -item[1], item[2]))
        used_sectors = {position["sector"] for position in ledger["positions"]}
        for _, _, symbol, row, reason in candidates:
            if len([order for order in orders if order["side"] == "buy"]) >= slots:
                break
            if row["sector"] in used_sectors:
                continue
            used_sectors.add(row["sector"])
            orders.append({"side": "buy", "symbol": symbol, "name": row["name"],
                           "sector": row["sector"], "reason": reason,
                           "reference_close": row["close"], "decision_date": price_date})
    ledger["pending"] = orders
    ledger["decisions"].append({"date": price_date, "orders": orders})
    ledger["last_price_date"] = price_date


def run(data_dir: Path, ledger_path: Path, output: Path, today: date) -> dict:
    manifest = json.loads((data_dir / "manifest.json").read_text(encoding="utf-8"))
    prices = manifest.get("prices") or {}
    price_date = prices.get("typical_date")
    symbols = prices.get("symbols") or 0
    coverage = (prices.get("typical_symbols") or 0) / symbols if symbols else 0
    expected, next_session_date, next_close_at = session_gate(today)
    ledger = load_ledger(ledger_path)
    pool_path = data_dir / "focus-pool.json"
    allowed_buys = None
    if pool_path.exists():
        pool = json.loads(pool_path.read_text(encoding="utf-8"))
        if not isinstance(pool.get("short_symbols"), list):
            raise ValueError("Short-term research pool is invalid")
        allowed_buys = set(pool["short_symbols"])
    if not price_date or price_date != expected or coverage < 0.95:
        status = "paused"
        reason = f"行情未覆盖最近一个交易日（预期 {expected}，实际 {price_date or '未知'}）" if price_date != expected else "当日行情覆盖不足 95%"
        rows = {}
    else:
        rows = price_rows(data_dir)
        advance(ledger, rows, price_date, allowed_buys)
        status = "ready"
        reason = None
        ledger_path.parent.mkdir(parents=True, exist_ok=True)
        ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    positions = [{**position,
                  "mark_price": rows[position["symbol"]]["close"]
                  if position["symbol"] in rows and str(rows[position["symbol"]]["price_date"]) == price_date else None}
                 for position in ledger["positions"]]
    report = {
        "version": 1, "status": status, "reason": reason,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_date": price_date, "expected_date": expected,
        "next_session_date": next_session_date, "next_close_at": next_close_at,
        "coverage": round(coverage, 4), "starting_cash": ledger["starting_cash"],
        "cash": ledger["cash"], "positions": positions,
        "pending": ledger["pending"] if status == "ready" else [], "fills": ledger["fills"][-20:],
        "decisions": ledger["decisions"][-20:],
        "last_decision_date": ledger["last_price_date"],
        "method": "收盘后仅在短线观察池中按财报、流动性、20/60日趋势及放量条件筛选模拟买入；已有持仓仍独立检查卖出；次交易日开盘价加减0.1%模拟滑点成交；不含税费、分红、拆股。",
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--ledger", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--today", type=date.fromisoformat, default=datetime.now(timezone.utc).date())
    args = parser.parse_args()
    result = run(args.data_dir, args.ledger, args.output, args.today)
    print(f"模拟决策：{result['status']}，行情 {result['data_date']}，待执行 {len(result['pending'])} 笔")
