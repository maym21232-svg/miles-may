// Static-mode coverage line: a neutral, honest statement of what the hosted
// screener currently covers — the real screener running in the browser on
// DuckDB-WASM, refreshed nightly from keyless open sources. No upsell.

import { useEffect, useRef, useState } from "react";
import { manifest, type SiteManifest } from "../data";

export function CoverageBanner() {
  const [data, setData] = useState<SiteManifest | null | "loading">("loading");
  const [newer, setNewer] = useState(false);
  const loadedVersion = useRef<{ generated: number; priceDate: string | null; bundle: number } | null>(null);

  useEffect(() => {
    let active = true;
    const check = () => manifest().then((next) => {
      if (!active) return;
      if (!next) {
        if (loadedVersion.current === null) setData(null);
        return;
      }
      if (loadedVersion.current === null) {
        loadedVersion.current = {
          generated: next.generated_at, priceDate: next.prices?.max_date ?? null, bundle: next.bundle_version ?? 0,
        };
        setData(next);
      } else if ((next.bundle_version ?? 0) > loadedVersion.current.bundle ||
          next.generated_at > loadedVersion.current.generated ||
          (next.generated_at === loadedVersion.current.generated &&
            (next.prices?.max_date ?? "") > (loadedVersion.current.priceDate ?? ""))) {
        setNewer(true);
      }
    }).catch(() => {
      if (active && loadedVersion.current === null) setData(null);
    });
    void check();
    const interval = window.setInterval(check, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (data === "loading") return null;

  if (data === null) {
    return (
      <div className="coverage-banner" role="note">
        数据快照暂不可用
      </div>
    );
  }

  const refreshed = new Date(data.generated_at * 1000).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const stale = Date.now() - data.generated_at * 1000 > 4 * 24 * 60 * 60 * 1000;
  return (
    <div className="coverage-banner" role="note">
      快照生成 {refreshed} · 覆盖 {data.snapshot_symbols.toLocaleString("zh-CN")} 家美股上市公司
      {data.prices?.typical_date && data.prices.typical_date !== data.prices.max_date
        ? <> · {data.prices.typical_symbols && data.prices.typical_symbols > data.prices.symbols / 2 ? "多数个股" : "个股常见"}收盘截至 {data.prices.typical_date} · 个别最新 {data.prices.max_date}</>
        : data.prices?.max_date && <> · 最新收盘 {data.prices.max_date}</>}
      {stale && <> · 数据超过 4 天未更新，请核对更新任务</>}
      {newer && <button className="data-refresh" onClick={() => window.location.reload()}>有新数据，刷新页面</button>}
    </div>
  );
}
