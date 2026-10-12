import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StaticStatusView } from "../components/StaticStatusView";

vi.mock("../data", () => ({
  manifest: () => Promise.resolve({
    generated_at: 1791783593,
    snapshot_symbols: 5902,
    prices: { symbols: 5300, max_date: "2026-10-09", typical_date: "2026-09-11", typical_symbols: 5000, fresh_symbols: 50 },
  }),
}));

describe("StaticStatusView", () => {
  it("describes the hosted edition without claiming live SEC verification", async () => {
    render(<StaticStatusView pref="auto" onPref={() => {}} />);
    expect(await screen.findByText(/5,902 家美国交易所上市公司/)).toBeInTheDocument();
    expect(screen.getByText(/此静态版不提供实时 SEC 数值核验/)).toBeInTheDocument();
    expect(screen.getByText(/每日构建只会检查上游数据/)).toBeInTheDocument();
    expect(screen.queryByText(/服务端缓存 15 分钟/)).not.toBeInTheDocument();
  });
});
