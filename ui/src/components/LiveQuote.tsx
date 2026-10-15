// A recent direct quote is display-only and stays separate from the EOD data.

import { useEffect, useState } from "react";
import { fetchLiveQuote, isStale, type LiveQuote as Quote } from "../data/live-quote";

function fmt(value: number): string {
  return Math.abs(value) >= 1000 ? value.toFixed(0) : value.toFixed(2);
}

export function LiveQuote({ symbol, asof }: { symbol: string; asof: string | null }) {
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    setQuote(null);
    if (!isStale(asof)) return;
    let live = true;
    fetchLiveQuote(symbol).then((q) => {
      if (live) setQuote(q);
    });
    return () => {
      live = false;
    };
  }, [symbol, asof]);

  if (!quote) return null;
  const change =
    quote.previousClose !== null && quote.previousClose !== 0
      ? (quote.price - quote.previousClose) / quote.previousClose
      : null;
  const when = new Date(quote.time * 1000).toISOString().slice(0, 16).replace("T", " ");
  return (
    <p className="live-quote" role="status">
      <span className="live-quote-dot" aria-hidden="true" />
      参考报价 {fmt(quote.price)}
      {quote.currency ? ` ${quote.currency}` : ""}
      {change !== null && (
        <span className={change < 0 ? "num-bad" : "num-good"}>
          {" "}
          {change >= 0 ? "+" : ""}
          {(change * 100).toFixed(1)}% 较前收盘
        </span>
      )}
      <span className="meta">
        {" "}
        · {when} UTC · {quote.source}，非官方 · 研究数据收盘 {asof ?? "未知"}
      </span>
    </p>
  );
}
