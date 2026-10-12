import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoverageBanner } from "../components/CoverageBanner";

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
