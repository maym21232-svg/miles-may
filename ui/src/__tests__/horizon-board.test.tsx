import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HorizonBoard, type HorizonBoardData } from "../components/HorizonBoard";
import type { PaperReport } from "../components/PaperDesk";

const board: HorizonBoardData = {
  generated_at: 1,
  prices_typical_date: "2026-10-12",
  long: [
    { symbol: "AAA", name: "Alpha", sector: "Information Technology", period: "2026-06-30", piotroski_f: 7, return_on_equity: 0.18 },
    { symbol: "BBB", name: "Beta", sector: "Health Care", period: "2026-03-31", piotroski_f: 6, return_on_equity: 0.12 },
  ],
  short: [
    { symbol: "CCC", name: "Gamma", sector: "Financials", price_date: "2026-10-12", return_20d: 0.05, return_60d: 0.1 },
  ],
};

const paper: PaperReport = {
  version: 1, status: "ready", reason: null, data_date: "2026-10-12",
  expected_date: "2026-10-12", coverage: 0.99, cash: 100_000,
  starting_cash: 100_000, positions: [], pending: [], last_decision_date: "2026-10-12",
  decisions: [], fills: [],
  method: "模拟规则",
};

afterEach(() => vi.useRealTimers());

describe("horizon board", () => {
  it("groups candidates by sector without presenting a ranking", () => {
    const onSelect = vi.fn();
    render(<HorizonBoard board={board} onSelect={onSelect} onAdvanced={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "信息技术" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "医疗保健" })).toBeInTheDocument();
    expect(screen.queryByText("综合分位")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "行业" }), { target: { value: "Health Care" } });
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /BBB Beta/ }));
    expect(onSelect).toHaveBeenCalledWith("BBB");
  });

  it("switches to short-term evidence and states the freshness limit", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    render(<HorizonBoard board={board} paper={paper} onSelect={vi.fn()} onAdvanced={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "偏短线" }));
    expect(screen.getByRole("heading", { name: "金融" })).toBeInTheDocument();
    expect(screen.getByText(/多数股票的价格截至 2026-10-12/)).toBeInTheDocument();
    expect(screen.getByText("近 20 日 +5.0%")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  });

  it("does not fill an empty short-term list with stale candidates", () => {
    render(<HorizonBoard board={{ ...board, short: [] }} onSelect={vi.fn()} onAdvanced={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "偏短线" }));
    expect(screen.getByText("短线名单暂时停用")).toBeInTheDocument();
  });

  it("hides short-term candidates when the published data is stale", () => {
    render(<HorizonBoard board={board} paper={{ ...paper, status: "paused", reason: "行情滞后" }} onSelect={vi.fn()} onAdvanced={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "偏短线" }));
    expect(screen.getByText("短线名单暂时停用")).toBeInTheDocument();
    expect(screen.queryByText("Gamma")).not.toBeInTheDocument();
  });
});
