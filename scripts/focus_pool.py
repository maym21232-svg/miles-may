"""Deterministic, sector-aware limits for the published research lists."""

FOCUS_TARGET = 400
SHORT_TARGET = 75


def balanced_limit(rows: list[dict], limit: int, sector_limit: int) -> list[dict]:
    selected = []
    overflow = []
    counts: dict[str, int] = {}
    seen: set[str] = set()
    for row in rows:
        symbol = row["symbol"]
        if symbol in seen:
            continue
        seen.add(symbol)
        sector = row.get("sector") or "Other"
        if counts.get(sector, 0) >= sector_limit:
            overflow.append(row)
            continue
        selected.append(row)
        counts[sector] = counts.get(sector, 0) + 1
        if len(selected) == limit:
            return selected
    return (selected + overflow)[:limit]
