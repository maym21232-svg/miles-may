import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaperDesk, expectedCloseDate, type PaperReport } from "../components/PaperDesk";

const report: PaperReport = {
  version: 1, status: "ready", reason: null, generated_at: "2026-10-13T10:00:00Z", data_date: "2026-10-12",
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
  it("shows separate buy and sell lanes above collapsed research details", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    render(<PaperDesk report={report} onSelect={vi.fn()} />);
    expect(screen.getByRole("region", { name: "模拟买入决定" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "模拟卖出决定" })).toHaveTextContent("AAPL");
    expect(screen.queryByRole("button", { name: "下一条模拟卖出决定" })).not.toBeInTheDocument();
    const details = screen.getByText("虚拟仓与决策依据").closest("details")!;
    expect(details.open).toBe(false);
    fireEvent.click(screen.getByText("虚拟仓与决策依据"));
    expect(details.open).toBe(true);
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
    expect(screen.getByRole("status")).toHaveTextContent("等待 2026-10-13 的行情（目前 2026-10-12）");
    expect(screen.getByRole("region", { name: "模拟卖出决定" })).not.toHaveTextContent("AAPL");
    expect(screen.getByText("50 股")).toBeInTheDocument();
    expect(screen.getByText(/模拟起始资金/)).toHaveTextContent("模拟资产暂不可估值");
  });

  it("suppresses old decisions at the conservative post-close cutoff", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T20:00:00Z"));
    render(<PaperDesk report={report} onSelect={vi.fn()} />);
    expect(screen.getByText("已暂停")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "模拟卖出决定" })).not.toHaveTextContent("AAPL");
  });

  it("pauses mismatched, expired and invalid reports even when the price date matches", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    for (const patch of [
      { expected_date: "2026-10-09" },
      { coverage: 0.94 },
      { coverage: 1.01 },
      { generated_at: "2026-10-11T23:00:00Z" },
      { generated_at: "not-a-date" },
      { generated_at: "2026-10-13T12:06:00Z" },
    ]) {
      const { unmount } = render(<PaperDesk report={{ ...report, ...patch }} onSelect={vi.fn()} />);
      expect(screen.getByText("已暂停")).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "模拟卖出决定" })).not.toHaveTextContent("AAPL");
      expect(screen.getByText(/模拟起始资金/)).toHaveTextContent("模拟资产暂不可估值");
      unmount();
    }
  });

  it("uses Friday as the previous weekday on Monday", () => {
    expect(expectedCloseDate(new Date("2026-10-12T12:00:00Z"))).toBe("2026-10-09");
    expect(expectedCloseDate(new Date("2026-10-12T20:00:00Z"))).toBe("2026-10-12");
  });

  it("enables a moving strip only when at least four orders exist", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    const orders = ["AAA", "BBB", "CCC", "DDD"].map((symbol) => ({
      side: "buy" as const, symbol, name: symbol, sector: "Technology",
      reason: "符合模拟规则", reference_close: 100, decision_date: "2026-10-12",
    }));
    render(<PaperDesk report={{ ...report, pending: orders }} onSelect={vi.fn()} />);
    const lane = screen.getByRole("region", { name: "模拟买入决定" });
    const list = within(lane).getByRole("list");
    Object.defineProperty(list, "scrollWidth", { value: 1200 });
    Object.defineProperty(list, "clientWidth", { value: 500 });
    Object.defineProperty(list, "scrollTo", { value: vi.fn() });
    vi.spyOn(list.firstElementChild!, "getBoundingClientRect").mockReturnValue({ width: 280 } as DOMRect);
    fireEvent.click(screen.getByRole("button", { name: "下一条模拟买入决定" }));
    expect(list.scrollTo).toHaveBeenCalledWith({ left: 292, behavior: "smooth" });
  });
});
