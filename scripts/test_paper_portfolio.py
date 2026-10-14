import json
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from make_paper_portfolio import advance, empty_ledger, fill_pending, previous_weekday, run


def row(day: str, close=100.0, opening=99.0, previous=None):
    return {
        "symbol": "TEST", "name": "Test Company", "sector": "Industrials",
        "price_date": day, "previous_price_date": previous or previous_weekday(date.fromisoformat(day)),
        "bars": 61, "open": opening, "close": close,
        "volume": 1_500_000, "volume20": 1_000_000,
        "close_20_ago": 92.0, "close_60_ago": 85.0,
        "ma20": 96.0, "ma60": 90.0, "turnover20": 30_000_000,
        "market_cap": 5_000_000_000, "piotroski_f": 8,
        "return_on_equity": 0.25, "free_cash_flow": 1_000_000,
        "altman_z": 4.0, "net_profit_margin": 0.2,
        "debt_to_equity_ratio": 0.5, "period": "2026-06-30",
    }


class PaperPortfolioTest(unittest.TestCase):
    def test_fresh_decision_only_once_and_next_open_fill(self):
        ledger = empty_ledger()
        advance(ledger, {"TEST": row("2026-10-12")}, "2026-10-12")
        self.assertEqual([(item["side"], item["symbol"]) for item in ledger["pending"]], [("buy", "TEST")])
        self.assertEqual(ledger["positions"], [])
        advance(ledger, {"TEST": row("2026-10-12")}, "2026-10-12")
        self.assertEqual(len(ledger["decisions"]), 1)

        advance(ledger, {"TEST": row("2026-10-13", close=103, opening=102)}, "2026-10-13")
        self.assertEqual(len(ledger["positions"]), 1)
        self.assertEqual(ledger["positions"][0]["entry_date"], "2026-10-13")
        self.assertEqual(ledger["fills"][0]["side"], "buy")
        self.assertEqual(ledger["pending"], [])

        advance(ledger, {"TEST": row("2026-10-14", close=90, opening=98)}, "2026-10-14")
        self.assertEqual(ledger["pending"][0]["side"], "sell")
        self.assertEqual(len(ledger["positions"]), 1)
        advance(ledger, {"TEST": row("2026-10-15", close=91, opening=88)}, "2026-10-15")
        self.assertEqual(ledger["positions"], [])
        self.assertEqual(ledger["fills"][-1]["side"], "sell")

    def test_expired_order_is_never_filled_late(self):
        ledger = empty_ledger()
        advance(ledger, {"TEST": row("2026-10-12")}, "2026-10-12")
        fill_pending(ledger, {"TEST": row("2026-10-14")}, "2026-10-14")
        self.assertEqual(ledger["positions"], [])
        self.assertEqual(ledger["pending"], [])

    def test_holiday_gap_fills_at_actual_next_trading_open(self):
        ledger = empty_ledger()
        advance(ledger, {"TEST": row("2026-11-25")}, "2026-11-25")
        advance(ledger, {"TEST": row("2026-11-27", previous=date(2026, 11, 25))}, "2026-11-27")
        self.assertEqual(ledger["positions"][0]["entry_date"], "2026-11-27")

    def test_missing_intermediate_trading_bar_never_backfills_order(self):
        ledger = empty_ledger()
        advance(ledger, {"TEST": row("2026-10-12")}, "2026-10-12")
        advance(ledger, {"TEST": row("2026-10-14", previous=date(2026, 10, 13))}, "2026-10-14")
        self.assertEqual(ledger["positions"], [])
        self.assertEqual(ledger["fills"], [])

    def test_large_opening_gap_cancels_buy(self):
        ledger = empty_ledger()
        advance(ledger, {"TEST": row("2026-10-12")}, "2026-10-12")
        fill_pending(ledger, {"TEST": row("2026-10-13", opening=94)}, "2026-10-13")
        self.assertEqual(ledger["positions"], [])
        self.assertEqual(ledger["cash"], 100_000)

    def test_fresh_run_persists_a_single_decision(self):
        with TemporaryDirectory() as root:
            base = Path(root)
            (base / "manifest.json").write_text(json.dumps({"prices": {
                "typical_date": "2026-10-12", "symbols": 100, "typical_symbols": 99,
            }}), encoding="utf-8")
            ledger_path = base / "ledger.json"
            report_path = base / "report.json"
            with patch("make_paper_portfolio.price_rows", return_value={"TEST": row("2026-10-12")}):
                first = run(base, ledger_path, report_path, date(2026, 10, 13))
                second = run(base, ledger_path, report_path, date(2026, 10, 13))
            self.assertEqual(first["status"], "ready")
            self.assertEqual(len(first["pending"]), 1)
            self.assertEqual(len(second["decisions"]), 1)
            self.assertEqual(len(json.loads(ledger_path.read_text(encoding="utf-8"))["decisions"]), 1)

    def test_stale_data_freezes_ledger(self):
        with TemporaryDirectory() as root:
            base = Path(root)
            data = base / "data"
            data.mkdir()
            (data / "manifest.json").write_text(json.dumps({"prices": {
                "typical_date": "2026-10-09", "symbols": 5319, "typical_symbols": 5311,
            }}), encoding="utf-8")
            ledger = base / "paper" / "ledger.json"
            output = base / "paper-portfolio.json"
            with patch("make_paper_portfolio.price_rows", side_effect=AssertionError("must not read prices")):
                report = run(data, ledger, output, date(2026, 10, 13))
            self.assertEqual(report["status"], "paused")
            self.assertEqual(report["pending"], [])
            self.assertFalse(ledger.exists())
            self.assertEqual(json.loads(output.read_text(encoding="utf-8"))["expected_date"], "2026-10-12")

    def test_stale_report_hides_existing_pending_without_mutating_ledger(self):
        with TemporaryDirectory() as root:
            base = Path(root)
            (base / "manifest.json").write_text(json.dumps({"prices": {
                "typical_date": "2026-10-09", "symbols": 100, "typical_symbols": 99,
            }}), encoding="utf-8")
            ledger_path = base / "ledger.json"
            ledger = empty_ledger()
            advance(ledger, {"TEST": row("2026-10-09")}, "2026-10-09")
            ledger_path.write_text(json.dumps(ledger), encoding="utf-8")
            report = run(base, ledger_path, base / "report.json", date(2026, 10, 13))
            self.assertEqual(report["pending"], [])
            self.assertEqual(len(json.loads(ledger_path.read_text(encoding="utf-8"))["pending"]), 1)

    def test_coverage_gate_blocks_partial_market(self):
        with TemporaryDirectory() as root:
            base = Path(root)
            (base / "manifest.json").write_text(json.dumps({"prices": {
                "typical_date": "2026-10-12", "symbols": 100, "typical_symbols": 50,
            }}), encoding="utf-8")
            with patch("make_paper_portfolio.price_rows", side_effect=AssertionError("must not read prices")):
                report = run(base, base / "ledger.json", base / "report.json", date(2026, 10, 13))
            self.assertEqual(report["status"], "paused")


if __name__ == "__main__":
    unittest.main()
