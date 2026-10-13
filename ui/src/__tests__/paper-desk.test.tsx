import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaperDesk, expectedCloseDate, type PaperReport } from "../components/PaperDesk";

const report: PaperReport = {
  version: 1, status: "ready", reason: null, data_date: "2026-10-12",
  expected_date: "2026-10-12", coverage: 0.99, cash: 95_000,
  starting_cash: 100_000, last_decision_date: "2026-10-12", method: "模拟规则",
  decisions: [], fills: [],
  positions: [{ symbol: "AAPL", name: "Apple", sector: "Information Technology", shares: 50,
    entry_price: 100, entry_date: "2026-10-09", mark_price: 102 }],
  pending: [{ side: "sell", symbol: "AAPL", name: "Apple", sector: "Information Technology",
    reason: "触及止盈", reference_close: 102, decision_date: "2026-10-12" }],
};

afterEach(() => vi.useRealTimers());

describe("paper desk", () => {
  it("shows pending simulated actions and actual holdings separately", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    render(<PaperDesk report={report} onSelect={vi.fn()} />);
    expect(screen.getByText("模拟卖出")).toBeInTheDocument();
    expect(screen.getByText("50 股")).toBeInTheDocument();
    expect(screen.getByText(/模拟资产/)).toBeInTheDocument();
    expect(screen.getByText("0.10%")).toBeInTheDocument();
    expect(screen.getByText(/不是我逐股实时判断/)).toBeInTheDocument();
  });

  it("suppresses pending orders after the calendar rolls without a new build", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T12:00:00Z"));
    render(<PaperDesk report={report} onSelect={vi.fn()} />);
    expect(screen.getByText("已暂停")).toBeInTheDocument();
    expect(screen.queryByText("模拟卖出")).not.toBeInTheDocument();
    expect(screen.getByText("50 股")).toBeInTheDocument();
    expect(screen.getByText("模拟资产暂不可估值")).toBeInTheDocument();
  });

  it("uses Friday as the previous weekday on Monday", () => {
    expect(expectedCloseDate(new Date("2026-10-12T12:00:00Z"))).toBe("2026-10-09");
  });
});
