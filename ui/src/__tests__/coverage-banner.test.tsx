import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoverageBanner, broadPriceStale } from "../components/CoverageBanner";
import type { PaperReport } from "../components/PaperDesk";

const first = {
  schema: 2, generated_at: 1791695737, universe_rows: 6407,
  snapshot_rows: 44188, snapshot_symbols: 6407, prices: null, sample: [], commit: null,
};
const updated = {
  ...first, generated_at: first.generated_at + 86400,
  prices: { symbols: 5200, bars: 300000, window_days: 400, max_date: "2026-10-12", shards: [] },
};
const manifestMock = vi.fn();

vi.mock("../data", () => ({ manifest: () => manifestMock() }));

afterEach(() => {
  vi.clearAllMocks();
});

describe("CoverageBanner", () => {
  it("distinguishes snapshot generation from the latest close", async () => {
    manifestMock.mockResolvedValue(updated);
    render(<CoverageBanner />);
    expect(await screen.findByText(/快照生成/)).toHaveTextContent("覆盖 6,407 家美股上市公司");
    expect(screen.getByText(/最新收盘/)).toHaveTextContent("2026-10-12");
  });

  it("offers a reload after a newer snapshot appears", async () => {
    manifestMock.mockResolvedValueOnce(first).mockResolvedValue(updated);
    render(<CoverageBanner />);
    await screen.findByText(/快照生成/);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(screen.getByRole("button", { name: "有新数据，刷新页面" })).toBeInTheDocument());
  });

  it("does not mistake a handful of fresh prices for broad coverage", async () => {
    manifestMock.mockResolvedValue({
      ...updated,
      prices: { ...updated.prices, symbols: 6353, typical_date: "2026-09-11", typical_symbols: 6227, fresh_symbols: 27 },
    });
    render(<CoverageBanner />);
    expect(await screen.findByText(/多数个股收盘截至 2026-09-11/)).toHaveTextContent("个别最新 2026-10-12");
  });

  it("warns when most prices lag the expected close", async () => {
    manifestMock.mockResolvedValue({
      ...updated,
      prices: { ...updated.prices, symbols: 6353, typical_date: "2020-09-11", typical_symbols: 6227 },
    });
    render(<CoverageBanner />);
    expect(await screen.findByText(/多数价格落后预期收盘日/)).toHaveTextContent("勿当作当前行情");
    const details = screen.getByText("数据快照").closest("details")!;
    expect(details.open).toBe(false);
    expect(screen.getByText("多数行情滞后")).toBeInTheDocument();
    fireEvent.click(details.querySelector("summary")!);
    expect(details.open).toBe(true);
  });

  it("allows Friday data on Sunday but flags it after Monday close", () => {
    const prices = { ...updated.prices!, typical_date: "2026-10-09", typical_symbols: 5100 };
    expect(broadPriceStale(prices, new Date("2026-10-11T12:00:00Z"))).toBe(false);
    expect(broadPriceStale(prices, new Date("2026-10-12T20:00:00Z"))).toBe(true);
    expect(broadPriceStale({ ...prices, typical_symbols: 100 }, new Date("2026-10-12T20:00:00Z"))).toBe(false);
  });

  it("does not call holiday prices stale before the next exchange close", () => {
    const prices = { ...updated.prices!, typical_date: "2026-11-25", typical_symbols: 5100 };
    const report = { expected_date: "2026-11-25", next_session_date: "2026-11-27",
      next_close_at: "2026-11-27T18:00:00+00:00" } as PaperReport;
    expect(broadPriceStale(prices, new Date("2026-11-26T21:00:00Z"), report)).toBe(false);
    expect(broadPriceStale(prices, new Date("2026-11-27T17:59:00Z"), report)).toBe(false);
    expect(broadPriceStale(prices, new Date("2026-11-27T18:00:00Z"), report)).toBe(true);
  });

  it("offers reload when prices advance without a new financial snapshot", async () => {
    manifestMock.mockResolvedValueOnce(first).mockResolvedValue({
      ...first, prices: { ...updated.prices, max_date: "2026-10-12" },
    });
    render(<CoverageBanner />);
    await screen.findByText(/快照生成/);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(screen.getByRole("button", { name: "有新数据，刷新页面" })).toBeInTheDocument());
  });

  it("offers reload when a local data bundle is rebuilt from the same snapshot", async () => {
    manifestMock.mockResolvedValueOnce({ ...first, bundle_version: 2 })
      .mockResolvedValue({ ...first, bundle_version: 3 });
    render(<CoverageBanner />);
    await screen.findByText(/快照生成/);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(screen.getByRole("button", { name: "有新数据，刷新页面" })).toBeInTheDocument());
  });
});
