export interface WatchItem {
  symbol: string;
  name: string;
}

const KEY = "crible-us-watchlist-v1";

export function loadWatchlist(): WatchItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is WatchItem =>
      item !== null && typeof item === "object" &&
      typeof item.symbol === "string" && /^[A-Z0-9.^-]{1,20}$/.test(item.symbol) &&
      typeof item.name === "string" && item.name.length <= 200,
    ).slice(0, 200);
  } catch {
    return [];
  }
}

export function saveWatchlist(items: WatchItem[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}
