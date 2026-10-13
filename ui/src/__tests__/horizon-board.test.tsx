import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HorizonBoard, type HorizonBoardData } from "../components/HorizonBoard";

const board: HorizonBoardData = {
  generated_at: 1,
  prices_typical_date: "2026-09-11",
  long: [
    { symbol: "AAA", name: "Alpha", sector: "Information Technology", period: "2026-06-30", piotroski_f: 7, return_on_equity: 0.18 },
    { symbol: "BBB", name: "Beta", sector: "Health Care", period: "2026-03-31", piotroski_f: 6, return_on_equity: 0.12 },
  ],
  short: [
    { symbol: "CCC", name: "Gamma", sector: "Financials", price_date: "2026-10-12", return_20d: 0.05, return_60d: 0.1 },
  ],
};

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
    render(<HorizonBoard board={board} onSelect={vi.fn()} onAdvanced={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "偏短线" }));
    expect(screen.getByRole("heading", { name: "金融" })).toBeInTheDocument();
    expect(screen.getByText(/多数股票的价格截至 2026-09-11/)).toBeInTheDocument();
    expect(screen.getByText("近 20 日 +5.0%")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  });

  it("does not fill an empty short-term list with stale candidates", () => {
    render(<HorizonBoard board={{ ...board, short: [] }} onSelect={vi.fn()} onAdvanced={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "偏短线" }));
    expect(screen.getByText("暂无可判断的短线候选")).toBeInTheDocument();
  });
});
