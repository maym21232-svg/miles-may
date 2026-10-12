import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

describe("service worker", () => {
  it("removes only old caches belonging to its own scope", async () => {
    const listeners = new Map<string, (event: { waitUntil: (promise: Promise<unknown>) => void }) => void>();
    const deleteCache = vi.fn().mockResolvedValue(true);
    const caches = {
      keys: vi.fn().mockResolvedValue([
        "stock-research-shell:/miles-may/:v1",
        "stock-research-shell:/miles-may/:v2",
        "stock-research-shell:/other/:v1",
        "unrelated-cache",
      ]),
      delete: deleteCache,
    };
    const self = {
      registration: { scope: "https://example.com/miles-may/" },
      addEventListener: (name: string, listener: (event: { waitUntil: (promise: Promise<unknown>) => void }) => void) => listeners.set(name, listener),
      clients: { claim: vi.fn().mockResolvedValue(undefined) },
    };
    const source = readFileSync(resolve(process.cwd(), "public", "sw.js"), "utf8");
    runInNewContext(source, { self, caches, URL });

    let work: Promise<unknown> | null = null;
    listeners.get("activate")?.({ waitUntil: (promise) => { work = promise; } });
    await work;

    expect(deleteCache).toHaveBeenCalledExactlyOnceWith("stock-research-shell:/miles-may/:v1");
  });
});
