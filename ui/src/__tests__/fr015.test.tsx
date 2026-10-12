// FR-015 AC-3 — the drawer explains every rank: each pillar links back to its
// component values, the peer group is named, omissions are visible.

import { fireEvent, render, screen as rtl, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyDrawer } from "../components/CompanyDrawer";

const DETAIL = {
  profile: { symbol: "AIR.PA", name: "Airbus", country: "FR", sector: "Industrials" },
  periods: [
    {
      period: "2025-12-31",
      provider: "yfinance",
      computed_at: 1760000000,
      piotroski_f: 8,
      altman_z: 3.2,
      beneish_m: -2.5,
      earnings_yield: 0.06,
      price_to_book_ratio: 1.8,
      return_6m: null,
      quality_rank: 91.5,
      value_rank: 74.0,
      momentum_rank: null,
      composite_rank: 82.75,
      rank_peer_group: "europe×Industrials",
      rank_missing_pillars: "momentum",
    },
  ],
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => DETAIL })),
  );
});

describe("FR-015 rank visibility (F9)", () => {
  it("ships composite_rank in the default grid columns", async () => {
    const { DEFAULT_COLUMNS } = await import("../App");
    expect(DEFAULT_COLUMNS).toContain("composite_rank");
  });
});

describe("FR-015 rank breakdown in the drawer", () => {
  it("shows composite + pillar ranks, their component values and the peer group", async () => {
    render(<CompanyDrawer symbol="AIR.PA" onClose={() => {}} />);
    await waitFor(() => expect(rtl.getByText("查看完整财务分析")).toBeInTheDocument());
    fireEvent.click(rtl.getByText("查看完整财务分析"));
    await waitFor(() => expect(rtl.getByText("综合分位来源")).toBeInTheDocument());

    // The composite score appears in the synthesis and the rank section.
    expect(rtl.getAllByText("综合").length).toBeGreaterThan(0);
    expect(rtl.getAllByText("82.750").length).toBeGreaterThan(0); // hero + bars + section
    // pillars link back to their component values (AC-3)
    expect(rtl.getAllByText("质量").length).toBeGreaterThan(0);
    expect(rtl.getByText("· 盈利收益率")).toBeInTheDocument();
    expect(rtl.getByText("· 市净率")).toBeInTheDocument();
    expect(rtl.getByText("· 近六个月回报")).toBeInTheDocument();
    // peer group is named — no unexplained numbers
    expect(rtl.getAllByText(/同类比较：欧洲 · 工业/).length).toBeGreaterThan(0);
    // the omitted pillar is stated, never silently imputed
    expect(rtl.getByText(/缺失 动量 项评分维度/)).toBeInTheDocument();
  });
});
