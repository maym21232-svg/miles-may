import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadWatchlist, saveWatchlist } from "../watchlist";

beforeEach(() => localStorage.clear());

describe("local watchlist", () => {
  it("persists company identity between page loads", () => {
    expect(saveWatchlist([{ symbol: "AAPL", name: "Apple Inc." }])).toBe(true);
    expect(loadWatchlist()).toEqual([{ symbol: "AAPL", name: "Apple Inc." }]);
  });

  it("ignores malformed or corrupted browser data", () => {
    localStorage.setItem("crible-us-watchlist-v1", JSON.stringify([
      { symbol: "AAPL", name: "Apple Inc." }, { symbol: "../bad", name: "Bad" }, null,
    ]));
    expect(loadWatchlist()).toEqual([{ symbol: "AAPL", name: "Apple Inc." }]);
    localStorage.setItem("crible-us-watchlist-v1", "not json");
    expect(loadWatchlist()).toEqual([]);
  });

  it("reports unavailable storage without showing a false save", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(saveWatchlist([{ symbol: "MSFT", name: "Microsoft" }])).toBe(false);
    spy.mockRestore();
  });
});
