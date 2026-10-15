// Best-effort reference quote for stale published data. Only a direct request
// to Yahoo is allowed; third-party CORS relays would disclose the viewed
// symbol and could alter the response. This never feeds scores or decisions.

export interface LiveQuote {
  price: number;
  previousClose: number | null;
  currency: string | null;
  /** epoch seconds of the quote */
  time: number;
  source: string;
}

const QUOTE_URL = (symbol: string) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;

const TIMEOUT_MS = 6_000;
const TTL_MS = 60_000;
const MAX_AGE_MS = 24 * 60 * 60_000;
const cache = new Map<string, { at: number; quote: LiveQuote | null }>();

/** Published closes are EOD — anything not dated today (UTC) is stale. */
export function isStale(asof: string | null | undefined, today = new Date()): boolean {
  if (!asof) return true;
  return String(asof).slice(0, 10) < today.toISOString().slice(0, 10);
}

function parse(payload: unknown): LiveQuote | null {
  const meta = (payload as { chart?: { result?: { meta?: Record<string, unknown> }[] } })?.chart
    ?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  const time = meta?.regularMarketTime;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0 ||
      typeof time !== "number" || !Number.isFinite(time) ||
      time * 1000 > Date.now() + 5 * 60_000 || Date.now() - time * 1000 > MAX_AGE_MS) return null;
  const prev = meta?.chartPreviousClose ?? meta?.previousClose;
  return {
    price,
    previousClose: typeof prev === "number" && Number.isFinite(prev) ? prev : null,
    currency: typeof meta?.currency === "string" ? meta.currency : null,
    time,
    source: "Yahoo Finance",
  };
}

export async function fetchLiveQuote(symbol: string): Promise<LiveQuote | null> {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.quote;
  let quote: LiveQuote | null = null;
  try {
    const signal =
      typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(TIMEOUT_MS) : undefined;
    const res = await fetch(QUOTE_URL(symbol), { signal });
    if (res.ok) quote = parse(await res.json());
  } catch {
    // Direct browser access may be blocked by CORS; keep the dated EOD close.
  }
  cache.set(symbol, { at: Date.now(), quote });
  return quote;
}

export function clearLiveQuoteCache(): void {
  cache.clear();
}
