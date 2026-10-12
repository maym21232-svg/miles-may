// Company drawer price chart — a hand-rolled SVG close-price line (no chart
// lib, same token-driven style as StatusView). The viewBox is normalized to
// 0..100 × 0..100 with a non-scaling stroke; the line stretches to fit. Hover
// maps the pointer x to the nearest session (nulls filtered — the same series
// the path draws) and shows date + close in the shared ChartTooltip. Renders
// nothing when the symbol has no series (EDGAR-only issuers only carry the
// distilled quote), so its absence is silent.

import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { manifest, prices, type PriceBar } from "../data";
import { ChartTooltip } from "./ChartTooltip";

const W = 100;
const H = 100;

function path(bars: PriceBar[]): string {
  const closes = bars.map((b) => b.close).filter((c): c is number => c !== null);
  if (closes.length < 2) return "";
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const n = closes.length - 1;
  return closes
    .map((c, i) => {
      const x = (i / n) * W;
      const y = H - ((c - min) / span) * H;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function PriceChart({ symbol, currency }: { symbol: string; currency?: string }) {
  const [bars, setBars] = useState<PriceBar[] | null>(null);
  const [marketDate, setMarketDate] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    setBars(null);
    setMarketDate(null);
    setHover(null); // a new symbol invalidates the old session index
    prices(symbol)
      .then((b) => live && setBars(b))
      .catch(() => live && setBars([]));
    manifest().then((data) => {
      if (live) setMarketDate(data?.prices?.max_date ?? null);
    }).catch(() => { if (live) setMarketDate(null); });
    return () => {
      live = false;
    };
  }, [symbol]);

  const d = bars ? path(bars) : "";
  if (!bars || !d) return null;

  // the sessions the path actually draws — hover indexes THIS series
  const pts = bars.flatMap((b) => (b.close === null ? [] : [{ date: b.date, close: b.close }]));
  const closes = pts.map((p) => p.close);
  const last = closes[closes.length - 1];
  const first = bars[0]?.date ?? "";
  const asof = bars[bars.length - 1]?.date ?? "";
  const source = bars[bars.length - 1]?.source ?? "";
  const lagDays = marketDate && asof
    ? Math.round((Date.parse(`${marketDate}T00:00:00Z`) - Date.parse(`${asof}T00:00:00Z`)) / 86_400_000)
    : 0;
  const fmt = (v: number) => (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(2));

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const frac = (event.clientX - rect.left) / rect.width;
    if (!Number.isFinite(frac)) return;
    setHover(Math.max(0, Math.min(pts.length - 1, Math.round(frac * (pts.length - 1)))));
  };
  const active = hover !== null && hover < pts.length ? hover : null;
  const guideX = active === null ? 0 : (active / (pts.length - 1)) * W;
  const align = guideX < 33 ? "start" : guideX > 67 ? "end" : "center";

  return (
    <div className="price-chart">
      <h3>收盘价走势 · {bars.length} 个交易日{currency ? ` · ${currency}` : ""}</h3>
      <div className="chart-frame">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          onPointerMove={onPointerMove}
          onPointerDown={onPointerMove}
          onPointerLeave={(event) => {
            if (event.pointerType !== "touch") setHover(null); // keep tap readouts up
          }}
        >
          <path className="price-chart-line" d={d} />
          {active !== null && (
            <line className="chart-guide" x1={guideX} x2={guideX} y1="0" y2={H} />
          )}
        </svg>
        {active !== null && (
          <ChartTooltip
            label={pts[active].date}
            leftPct={guideX}
            align={align}
            swatches={false}
            rows={[{ key: "close", label: "收盘", value: fmt(pts[active].close) }]}
          />
        )}
      </div>
      <div className="price-chart-meta">
        <span>最低 {fmt(Math.min(...closes))} · 最高 {fmt(Math.max(...closes))}</span>
        <span>
          {fmt(last)} · {first} → {asof}{source ? ` · ${source}` : ""}
        </span>
      </div>
      {lagDays > 7 && <p className="price-chart-lag" role="note">该股最近收盘日期落后于全市场 {lagDays} 天，请核对是否停牌或数据缺失。</p>}
    </div>
  );
}
