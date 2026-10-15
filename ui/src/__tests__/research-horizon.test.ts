import { describe, expect, it } from "vitest";
import type { PriceBar } from "../data/types";
import { longHorizon, shortHorizon } from "../research-horizon";

const NOW = new Date("2026-10-12T12:00:00Z");

function bars(count: number, end = "2026-10-09", rising = true): PriceBar[] {
  const day = Date.parse(`${end}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => ({
    date: new Date(day - (count - 1 - index) * 86_400_000).toISOString().slice(0, 10),
    open: null, high: null, low: null, close: rising ? 100 + index : 200 - index,
    adj_close: null, volume: null, source: "test",
  }));
}

describe("research horizon", () => {
  it("only shows a short-term trend when the latest close is fresh and history is sufficient", () => {
    const result = shortHorizon(bars(65), NOW);
    expect(result.signal).toBe("supported");
    expect(result.asof).toBe("2026-10-09");
    expect(result.reasons).toHaveLength(3);
    expect(shortHorizon(bars(65), new Date("2026-10-15T12:00:00Z")).signal).toBe("insufficient");
    expect(shortHorizon(bars(65), new Date("2026-10-15T12:00:00Z")).reasons[0]).toContain("不足以判断当前短线状态");
    expect(shortHorizon(bars(65, "2026-09-11"), NOW).signal).toBe("insufficient");
    expect(shortHorizon(bars(30), NOW).signal).toBe("insufficient");
    expect(shortHorizon(bars(65, "2026-10-09", false), NOW).signal).toBe("mixed");
  });

  it("rejects discontinuous or missing price data", () => {
    const sparse = bars(65).map((bar, index) => ({
      ...bar,
      date: new Date(Date.parse(`${bar.date}T00:00:00Z`) - (64 - index) * 3 * 86_400_000).toISOString().slice(0, 10),
    }));
    expect(shortHorizon(sparse, NOW).reasons[0]).toContain("跨度过长");
    expect(shortHorizon([], NOW).signal).toBe("insufficient");
  });

  it("requires a dated, sufficiently complete long-term financial picture", () => {
    const latest = {
      period: "2025-12-31", piotroski_f: 7, free_cash_flow: 2_000_000,
      return_on_equity: 0.16, debt_to_equity_ratio: 0.5,
    };
    expect(longHorizon(latest, NOW).signal).toBe("supported");
    expect(longHorizon({ ...latest, altman_z: 1.2 }, NOW).signal).toBe("mixed");
    expect(longHorizon({ ...latest, period: "2024-12-31" }, NOW).signal).toBe("insufficient");
    expect(longHorizon({ period: "2025-12-31", piotroski_f: 7 }, NOW).signal).toBe("insufficient");
    expect(longHorizon({ ...latest, return_on_equity: 153, debt_to_equity_ratio: null }, NOW).signal).toBe("insufficient");
  });
});
