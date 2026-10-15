import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const manifest = {
  schema: 2, bundle_version: 4, generated_at: 1234, bundle_built_at: 5678, mobile_shards: 256,
  prices: { symbols: 1, bars: 1, window_days: 400, max_date: "2026-10-09", shards: [] },
};

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("mobile data client", () => {
  it("loads only the matching company and price shards", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("manifest.json")) return { ok: true, json: async () => manifest };
      if (url.includes("companies-")) return {
        ok: true, json: async () => ({ AAPL: { profile: { symbol: "AAPL" }, periods: [{ period: "2025" }] } }),
      };
      if (url.includes("prices-")) return {
        ok: true, json: async () => ({ AAPL: [["2026-10-09", 250.5, "yfinance"]] }),
      };
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);
    const { mobileClient, mobileShardNumber } = await import("../data/mobile-client");
    const number = String(mobileShardNumber("AAPL", 256)).padStart(3, "0");

    expect((await mobileClient.company("AAPL"))?.periods).toEqual([{ period: "2025" }]);
    expect(await mobileClient.prices("AAPL")).toEqual([{
      date: "2026-10-09", open: null, high: null, low: null, close: 250.5,
      adj_close: null, volume: null, source: "yfinance",
    }]);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      expect.stringContaining("manifest.json"),
      expect.stringContaining(`companies-${number}.json?v=5678`),
      expect.stringContaining(`prices-${number}.json?v=5678`),
    ]);
    await mobileClient.company("AAPL");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("retries a failed shard request without a page reload", async () => {
    let attempts = 0;
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("manifest.json")) return { ok: true, json: async () => manifest };
      attempts += 1;
      if (attempts === 1) throw new Error("offline");
      return { ok: true, json: async () => ({ AAPL: { profile: { symbol: "AAPL" }, periods: [] } }) };
    });
    vi.stubGlobal("fetch", fetcher);
    const { mobileClient } = await import("../data/mobile-client");
    await expect(mobileClient.company("AAPL")).rejects.toThrow("offline");
    expect((await mobileClient.company("AAPL"))?.profile.symbol).toBe("AAPL");
    expect(attempts).toBe(2);
  });

  it("retries a failed screen request", async () => {
    let attempts = 0;
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("manifest.json")) return { ok: true, json: async () => manifest };
      attempts += 1;
      if (attempts === 1) throw new Error("offline");
      return { ok: true, json: async () => ({ foo: [{ symbol: "AAPL" }] }) };
    });
    vi.stubGlobal("fetch", fetcher);
    const { mobileClient } = await import("../data/mobile-client");
    await expect(mobileClient.screen("foo", null, 1, 10)).rejects.toThrow("offline");
    expect((await mobileClient.screen("foo", null, 1, 10)).rows).toEqual([{ symbol: "AAPL" }]);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      expect.stringContaining("manifest.json"),
      expect.stringContaining("screens.json?v=5678"),
      expect.stringContaining("screens.json?v=5678"),
    ]);
  });
});
