// Reference quote: freshness, direct-only fetch, cache and display gating.

import { render, screen as rtl, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveQuote } from "../components/LiveQuote";
import { clearLiveQuoteCache, fetchLiveQuote, isStale } from "../data/live-quote";

const yahoo = (time = Math.floor(Date.now() / 1000)) => ({
  chart: {
    result: [
      {
        meta: {
          regularMarketPrice: 123.45,
          chartPreviousClose: 120.0,
          currency: "EUR",
          regularMarketTime: time,
        },
      },
    ],
  },
});

const ok = (payload: unknown) => ({ ok: true, json: async () => payload });

beforeEach(() => clearLiveQuoteCache());
afterEach(() => vi.unstubAllGlobals());

describe("isStale", () => {
  it("today's close is fresh; older or missing is stale", () => {
    const today = new Date("2026-07-19T10:00:00Z");
    expect(isStale("2026-07-19", today)).toBe(false);
    expect(isStale("2026-07-17", today)).toBe(true);
    expect(isStale(null, today)).toBe(true);
    expect(isStale(undefined, today)).toBe(true);
  });
});

describe("fetchLiveQuote", () => {
  it("does not send the viewed symbol through a public proxy when direct access fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("cors"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchLiveQuote("AIR.PA")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("query1.finance.yahoo.com");
  });

  it("caches per symbol — a second call within the TTL never refetches", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(yahoo()));
    vi.stubGlobal("fetch", fetchMock);
    await fetchLiveQuote("AIR.PA");
    await fetchLiveQuote("AIR.PA");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects old or missing timestamps rather than calling them live", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok(yahoo(Math.floor(Date.now() / 1000) - 3 * 86400)))
      .mockResolvedValueOnce(ok({ chart: { result: [{ meta: { regularMarketPrice: 123.45 } }] } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchLiveQuote("AIR.PA")).toBeNull();
    clearLiveQuoteCache();
    expect(await fetchLiveQuote("AIR.PA")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("LiveQuote chip", () => {
  it("renders price, signed change and both vintages when the close is stale", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(yahoo())));
    render(<LiveQuote symbol="AIR.PA" asof="2020-01-02" />);
    await waitFor(() => expect(rtl.getByRole("status")).toBeInTheDocument());
    const chip = rtl.getByRole("status");
    expect(chip).toHaveTextContent("参考报价 123.45 EUR");
    expect(chip).toHaveTextContent("+2.9% 较前收盘");
    expect(chip).toHaveTextContent("研究数据收盘 2020-01-02");
    expect(chip).toHaveTextContent(/非官方/);
  });

  it("fetches nothing when the published close is today's", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const today = new Date().toISOString().slice(0, 10);
    const { container } = render(<LiveQuote symbol="AIR.PA" asof={today} />);
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });
});
