"""Build a US-listed static subset from the crible public snapshot."""

from pathlib import Path
import argparse
import json
import math
import time

import duckdb


ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description="Build the US-listed mobile data bundle")
parser.add_argument("--source-dir", type=Path, default=ROOT / ".source-data")
parser.add_argument("--output-dir", type=Path, default=ROOT / "ui" / "public" / "data")
args = parser.parse_args()
SOURCE = args.source_dir.resolve()
OUTPUT = args.output_dir.resolve()
EXCHANGES = "('NMS','NYQ','NCM','NGM','ASE')"
MOBILE_SHARDS = 256
NON_COMMON = (
    "symbol NOT LIKE '%-P%' "
    "AND name NOT ILIKE '% Preferred Stock%' "
    "AND name NOT ILIKE '% Preferred Share%' "
    "AND name NOT ILIKE '% PFD %' "
    "AND name NOT ILIKE '% Fund %' "
    "AND name NOT ILIKE '% Fund' "
    "AND name NOT ILIKE 'Fund %'"
)

OUTPUT.mkdir(parents=True, exist_ok=True)
db = duckdb.connect()
source_snapshot = (SOURCE / "snapshot.parquet").as_posix()
# The upstream snapshot labels Baxter as Communication Services; its SEC filing
# describes a medical technology and healthcare products business.
db.execute(
    f"COPY (SELECT * REPLACE (CASE WHEN symbol = 'BAX' THEN 'Health Care' "
    f"ELSE sector END AS sector) FROM read_parquet('{source_snapshot}') "
    f"WHERE exchange IN {EXCHANGES} AND {NON_COMMON}) "
    f"TO '{(OUTPUT / 'snapshot.parquet').as_posix()}' "
    "(FORMAT PARQUET, COMPRESSION ZSTD)"
)
db.execute(
    f"COPY (SELECT symbol, name, country, region, sector, industry, exchange, currency "
    f"FROM read_parquet('{(OUTPUT / 'snapshot.parquet').as_posix()}') "
    "QUALIFY row_number() OVER (PARTITION BY symbol ORDER BY period DESC) = 1) "
    f"TO '{(OUTPUT / 'universe.parquet').as_posix()}' "
    "(FORMAT PARQUET, COMPRESSION ZSTD)"
)
symbols = db.execute(
    f"SELECT count(DISTINCT symbol) FROM read_parquet('{(OUTPUT / 'snapshot.parquet').as_posix()}')"
).fetchone()[0]
period_rows = db.execute(
    f"SELECT count(*) FROM read_parquet('{(OUTPUT / 'snapshot.parquet').as_posix()}')"
).fetchone()[0]
generated = time.time()
source_manifest = SOURCE / "manifest.json"
if source_manifest.exists():
    generated = json.loads(source_manifest.read_text(encoding="utf-8"))["generated_at"]

price_manifest = None
price_sources = sorted(SOURCE.glob("prices-*.parquet"))
if price_sources:
    source_list = ", ".join(f"'{path.as_posix()}'" for path in price_sources)
    price_path = OUTPUT / "prices-00.parquet"
    db.execute(
        f"COPY (SELECT p.* FROM read_parquet([{source_list}]) p "
        f"JOIN read_parquet('{(OUTPUT / 'universe.parquet').as_posix()}') u USING (symbol) "
        "ORDER BY p.symbol, p.date) "
        f"TO '{price_path.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)"
    )
    count, symbols_with_prices, max_date, min_symbol, max_symbol = db.execute(
        f"SELECT count(*), count(DISTINCT symbol), max(date), min(symbol), max(symbol) "
        f"FROM read_parquet('{price_path.as_posix()}')"
    ).fetchone()
    if count:
        typical_date, typical_symbols = db.execute(
            f"SELECT last_date, count(*) AS symbols FROM "
            f"(SELECT symbol, max(date) AS last_date FROM read_parquet('{price_path.as_posix()}') GROUP BY symbol) "
            "GROUP BY last_date ORDER BY symbols DESC, last_date DESC LIMIT 1"
        ).fetchone()
        fresh_symbols = db.execute(
            f"SELECT count(*) FROM "
            f"(SELECT symbol, max(date) AS last_date FROM read_parquet('{price_path.as_posix()}') GROUP BY symbol) "
            "WHERE last_date >= ?::DATE - INTERVAL 7 DAY", [max_date]
        ).fetchone()[0]
        price_manifest = {
            "symbols": symbols_with_prices,
            "bars": count,
            "window_days": 400,
            "max_date": str(max_date)[:10],
            "typical_date": str(typical_date)[:10],
            "typical_symbols": typical_symbols,
            "fresh_symbols": fresh_symbols,
            "shards": [{
                "file": price_path.name,
                "rows": count,
                "bytes": price_path.stat().st_size,
                "min_symbol": min_symbol,
                "max_symbol": max_symbol,
            }],
        }
    else:
        price_path.unlink()
(OUTPUT / "manifest.json").write_text(
    json.dumps({
        "schema": 2,
        "bundle_version": 4,
        "mobile_shards": MOBILE_SHARDS,
        "generated_at": generated,
        "bundle_built_at": time.time(),
        "universe_rows": symbols,
        "snapshot_rows": period_rows,
        "snapshot_symbols": symbols,
        "snapshot_by_region": {"us": symbols},
        "prices": price_manifest,
        "sample": [],
        "commit": None,
    }, ensure_ascii=False), encoding="utf-8"
)
(OUTPUT / "status.json").write_text(
    json.dumps({"universe": symbols, "snapshot": True, "generated_at": generated, "by_region": {"us": symbols}}),
    encoding="utf-8",
)
(OUTPUT / "presets.json").write_text("[]", encoding="utf-8")
(OUTPUT / "providers.json").write_text("[]", encoding="utf-8")

def clean(value):
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, dict):
        return {key: clean(item) for key, item in value.items()}
    if isinstance(value, list):
        return [clean(item) for item in value]
    return value


def records(query):
    cursor = db.execute(query)
    names = [column[0] for column in cursor.description]
    return [clean(dict(zip(names, row))) for row in cursor.fetchall()]


snapshot = (OUTPUT / "snapshot.parquet").as_posix()
universe = (OUTPUT / "universe.parquet").as_posix()
columns = [
    "symbol", "name", "country", "sector", "exchange", "period",
    "composite_rank", "quality_rank", "value_rank", "momentum_rank",
    "piotroski_f", "altman_z", "beneish_m", "return_on_equity",
    "net_profit_margin", "debt_to_equity_ratio", "revenue_growth",
    "price_to_earnings_ratio", "free_cash_flow", "fcf_conversion", "market_cap",
]
screens = {}
quick_screens = json.loads((ROOT / "ui" / "src" / "quick-screens.json").read_text(encoding="utf-8"))
for screen in quick_screens:
    query = screen["query"]
    screen_rows = records(
        f"SELECT {', '.join(columns)} FROM "
        f"(SELECT * FROM read_parquet('{snapshot}') "
        "QUALIFY row_number() OVER (PARTITION BY symbol ORDER BY period DESC) = 1) "
        f"WHERE {query} ORDER BY composite_rank DESC NULLS LAST"
    )
    screens[query] = screen_rows
    print(f"{screen['label']}: {len(screen_rows)} candidates")

(OUTPUT / "screens.json").write_text(json.dumps(screens, ensure_ascii=False, allow_nan=False), encoding="utf-8")
latest = (
    f"(SELECT * FROM read_parquet('{snapshot}') "
    "QUALIFY row_number() OVER (PARTITION BY symbol ORDER BY period DESC) = 1)"
)
long_candidates = records(
    "SELECT symbol, name, sector, period, piotroski_f, return_on_equity, "
    "free_cash_flow, debt_to_equity_ratio FROM " + latest + " WHERE "
    f"exchange IN {EXCHANGES} AND market_cap >= 1000000000 "
    "AND piotroski_f >= 6 AND return_on_equity BETWEEN 0.1 AND 10 AND free_cash_flow > 0 "
    "AND (altman_z IS NULL OR altman_z >= 1.81) "
    "AND try_cast(CASE WHEN length(period) = 4 THEN period || '-12-31' "
    "ELSE period END AS DATE) BETWEEN CURRENT_DATE - INTERVAL 455 DAY AND CURRENT_DATE "
    "ORDER BY sector NULLS LAST, name, symbol"
)
short_candidates = []
if price_manifest:
    short_candidates = records(
        "WITH valid AS ("
        f"SELECT symbol, CAST(date AS DATE) AS date, close, "
        "row_number() OVER (PARTITION BY symbol ORDER BY date DESC) AS rn "
        f"FROM read_parquet('{price_path.as_posix()}') WHERE close > 0 AND isfinite(close)), "
        "windowed AS (SELECT symbol, count(*) AS bars, "
        "max(CASE WHEN rn = 1 THEN date END) AS price_date, "
        "max(CASE WHEN rn = 61 THEN date END) AS oldest_date, "
        "max(CASE WHEN rn = 1 THEN close END) AS close, "
        "max(CASE WHEN rn = 21 THEN close END) AS close_20_ago, "
        "max(CASE WHEN rn = 61 THEN close END) AS close_60_ago, "
        "avg(CASE WHEN rn <= 20 THEN close END) AS average_20 "
        "FROM valid WHERE rn <= 61 GROUP BY symbol) "
        "SELECT s.symbol, s.name, s.sector, w.price_date, "
        "round(w.close / w.close_20_ago - 1, 6) AS return_20d, "
        "round(w.close / w.close_60_ago - 1, 6) AS return_60d "
        f"FROM windowed w JOIN {latest} s USING (symbol) "
        f"WHERE s.exchange IN {EXCHANGES} AND s.market_cap >= 1000000000 "
        "AND w.bars >= 61 AND w.price_date BETWEEN CURRENT_DATE - INTERVAL 7 DAY AND CURRENT_DATE "
        "AND w.oldest_date >= CURRENT_DATE - INTERVAL 150 DAY "
        "AND w.close > w.close_20_ago AND w.close > w.close_60_ago "
        "AND w.close > w.average_20 "
        "ORDER BY s.sector NULLS LAST, s.name, s.symbol"
    )
(OUTPUT / "horizon-board.json").write_text(
    json.dumps({"generated_at": generated,
                "prices_typical_date": price_manifest.get("typical_date") if price_manifest else None,
                "long": long_candidates, "short": short_candidates},
               ensure_ascii=False, allow_nan=False, default=str), encoding="utf-8",
)
print(f"Board: {len(long_candidates)} long-term, {len(short_candidates)} short-term candidates")
(OUTPUT / "overview.json").write_text(
    json.dumps(records(f"SELECT symbol, name, country, sector FROM read_parquet('{universe}') ORDER BY symbol"), ensure_ascii=False),
    encoding="utf-8",
)
schema = db.execute(f"DESCRIBE SELECT * FROM read_parquet('{snapshot}')").fetchall()
(OUTPUT / "fields.json").write_text(
    json.dumps([{"name": row[0], "type": "string" if "VARCHAR" in row[1] else "number"} for row in schema]),
    encoding="utf-8",
)
def shard_number(symbol):
    value = 0
    for char in symbol:
        value = (value * 31 + ord(char)) & 0xFFFFFFFF
    return value % MOBILE_SHARDS


def write_shards(prefix, buckets):
    for number, bucket in enumerate(buckets):
        (OUTPUT / f"{prefix}-{number:03d}.json").write_text(
            json.dumps(bucket, ensure_ascii=False, allow_nan=False, default=str, separators=(",", ":")),
            encoding="utf-8",
        )


profiles = {row["symbol"]: row for row in records(f"SELECT * FROM read_parquet('{universe}')")}
company_buckets = [{} for _ in range(MOBILE_SHARDS)]
cursor = db.execute(f"SELECT * FROM read_parquet('{snapshot}') ORDER BY symbol, period DESC")
names = [column[0] for column in cursor.description]
while rows := cursor.fetchmany(1000):
    for row in rows:
        period = clean(dict(zip(names, row)))
        symbol = period["symbol"]
        company = company_buckets[shard_number(symbol)].setdefault(
            symbol, {"profile": profiles[symbol], "periods": []}
        )
        company["periods"].append(period)
write_shards("companies", company_buckets)

price_buckets = [{} for _ in range(MOBILE_SHARDS)]
if price_manifest:
    cursor = db.execute(
        f"SELECT symbol, date, close, source FROM read_parquet('{price_path.as_posix()}') "
        "ORDER BY symbol, date"
    )
    while rows := cursor.fetchmany(10000):
        for symbol, date, close, source in rows:
            price_buckets[shard_number(symbol)].setdefault(symbol, []).append(
                [str(date)[:10], clean(close), source]
            )
write_shards("prices", price_buckets)
print(f"US-listed snapshot: {symbols} companies, {period_rows} periods, {(OUTPUT / 'snapshot.parquet').stat().st_size / 1e6:.1f} MB")
