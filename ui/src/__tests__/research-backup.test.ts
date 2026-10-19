import { beforeEach, describe, expect, it } from "vitest";
import { createResearchBackup, mergeWatchlists, parseResearchBackup } from "../research-backup";
import { saveResearchNote } from "../research-notes";

beforeEach(() => localStorage.clear());

describe("research backup", () => {
  const apple = { symbol: "AAPL", name: "Apple Inc." };
  const microsoft = { symbol: "MSFT", name: "Microsoft Corporation" };

  it("exports notes for watched and unwatched companies", () => {
    saveResearchNote("AAPL", "核对现金流");
    saveResearchNote("MSFT", "not watched");
    const backup = createResearchBackup([apple]);
    expect(backup.watchlist).toEqual([apple]);
    expect(backup.notes).toEqual({ AAPL: "核对现金流", MSFT: "not watched" });
    expect(parseResearchBackup(JSON.stringify(backup))).toEqual(backup);
  });

  it("rejects malformed or oversized imported entries", () => {
    expect(() => parseResearchBackup('{"version":2}')).toThrow("备份格式无效");
    expect(() => parseResearchBackup(JSON.stringify({ version: 1, watchlist: [apple], notes: { "../bad": "wrong symbol" } })))
      .toThrow("备份包含无效的笔记");
    expect(() => parseResearchBackup(JSON.stringify({ version: 1, watchlist: [{ symbol: "../bad", name: "Bad" }], notes: {} })))
      .toThrow("备份包含无效的公司");
  });

  it("merges without replacing existing company names or duplicates", () => {
    expect(mergeWatchlists([apple], [{ symbol: "AAPL", name: "Changed" }, microsoft]))
      .toEqual([apple, microsoft]);
  });
});
