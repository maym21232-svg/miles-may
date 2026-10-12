import { useEffect, useState } from "react";
import { manifest, type SiteManifest } from "../data";
import type { ThemePref } from "../theme";
import { AppearanceSection } from "./AppearanceSection";

interface Props {
  pref: ThemePref;
  onPref: (pref: ThemePref) => void;
}

export function StaticStatusView({ pref, onPref }: Props) {
  const [data, setData] = useState<SiteManifest | null>(null);

  useEffect(() => {
    manifest().then(setData).catch(() => setData(null));
  }, []);

  return (
    <main className="simple-status">
      <h1>数据说明</h1>
      <dl className="status-facts">
        <div><dt>覆盖范围</dt><dd>{data ? `${data.snapshot_symbols.toLocaleString("zh-CN")} 家美国交易所上市公司` : "加载中…"}</dd></div>
        <div><dt>快照生成</dt><dd>{data ? new Date(data.generated_at * 1000).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) : "—"}</dd></div>
        <div><dt>个别最新收盘</dt><dd>{data?.prices ? data.prices.max_date : "暂无价格历史"}</dd></div>
        {data?.prices?.typical_date && <div><dt>最常见收盘日</dt><dd>{data.prices.typical_date} · {data.prices.typical_symbols?.toLocaleString("zh-CN")} / {data.prices.symbols.toLocaleString("zh-CN")} 家停在这一天</dd></div>}
        {data?.prices?.fresh_symbols !== undefined && <div><dt>近期价格覆盖</dt><dd>{data.prices.fresh_symbols.toLocaleString("zh-CN")} / {data.prices.symbols.toLocaleString("zh-CN")} 家距最新市场日期不超过 7 天</dd></div>}
        <div><dt>数据来源</dt><dd>crible 快照；财报含 SEC EDGAR 等来源，具体来源见公司详情</dd></div>
        <div><dt>官方核对</dt><dd>公司详情按需查询 SEC 披露，服务端缓存 15 分钟；不参与现有排名计算</dd></div>
      </dl>
      <section className="status-note">
        <h2>使用说明</h2>
        <p>快照生成时间不等于公司财报日期，也不代表所有股票的价格都更新至同一天。这里展示的是每日收盘价，不是盘中实时行情。请在公司详情中核对财报期间与数据来源；异常指标以原始申报为准。价格数据的公开再分发需另行核查授权。</p>
      </section>
      <AppearanceSection pref={pref} onPref={onPref} />
    </main>
  );
}
