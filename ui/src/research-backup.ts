import { loadAllResearchNotes } from "./research-notes";
import type { WatchItem } from "./watchlist";

export interface ResearchBackup {
  version: 1;
  exported_at: string;
  watchlist: WatchItem[];
  notes: Record<string, string>;
}

const validSymbol = (symbol: unknown): symbol is string =>
  typeof symbol === "string" && /^[A-Z0-9.^-]{1,20}$/.test(symbol);

export function createResearchBackup(items: WatchItem[]): ResearchBackup {
  return { version: 1, exported_at: new Date().toISOString(), watchlist: items, notes: loadAllResearchNotes() };
}

export function parseResearchBackup(raw: string): ResearchBackup {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") throw new Error("备份格式无效");
  const backup = value as Partial<ResearchBackup>;
  if (backup.version !== 1 || !Array.isArray(backup.watchlist) ||
      backup.watchlist.length > 200 || !backup.notes || typeof backup.notes !== "object" ||
      Array.isArray(backup.notes)) throw new Error("备份格式无效");
  if (backup.watchlist.some((item) => !item || !validSymbol(item.symbol) ||
      typeof item.name !== "string" || item.name.length > 200)) {
    throw new Error("备份包含无效的公司");
  }
  if (Object.keys(backup.notes).length > 500 ||
      Object.entries(backup.notes).some(([symbol, note]) => !validSymbol(symbol) ||
      typeof note !== "string" || note.length > 5000)) {
    throw new Error("备份包含无效的笔记");
  }
  return backup as ResearchBackup;
}

export function mergeWatchlists(current: WatchItem[], incoming: WatchItem[]): WatchItem[] {
  const seen = new Set(current.map((item) => item.symbol));
  const merged = [...current];
  for (const item of incoming) {
    if (seen.has(item.symbol) || merged.length === 200) continue;
    seen.add(item.symbol);
    merged.push(item);
  }
  return merged;
}
