import { useEffect, useState } from "react";
import { manifest, type SiteManifest } from "../data";
import { expectedCloseDate } from "../market-date";
import type { ThemePref } from "../theme";
import { AppearanceSection } from "./AppearanceSection";

interface Props {
  pref: ThemePref;
  onPref: (pref: ThemePref) => void;
}

export function StaticStatusView({ pref, onPref }: Props) {
  const [data, setData] = useState<SiteManifest | "loading" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    manifest().then((next) => {
      if (active) setData(next ?? "error");
    }).catch(() => { if (active) setData("error"); });
    return () => { active = false; };
  }, [attempt]);

  const site = typeof data === "object" ? data : null;
  const expected = expectedCloseDate(new Date());
  const latestCommon = site?.prices?.typical_date;
  const delayed = !!latestCommon && latestCommon < expected &&
    (site?.prices?.typical_symbols ?? 0) > (site?.prices?.symbols ?? 0) / 2;

  return (
    <main className="simple-status">
      <h1>数据说明</h1>
      {data === "error" && <p role="alert" className="status-load-error">
        数据清单暂不可用。<button type="button" onClick={() => { setData("loading"); setAttempt((value) => value + 1); }}>重试</button>
      </p>}
      <dl className="status-facts">
        <div><dt>覆盖范围</dt><dd>{site ? `${site.snapshot_symbols.toLocaleString("zh-CN")} 家美国交易所上市公司` : data === "loading" ? "加载中…" : "—"}</dd></div>
        {site?.focus_count && <div><dt>重点跟踪</dt><dd>{site.focus_count.toLocaleString("zh-CN")} 家按财报质量与行业分散选取；其余公司仍可搜索和高级筛选</dd></div>}
        {site?.short_target && <div><dt>短线观察</dt><dd>最多 {site.short_target} 家；每日按有效收盘价复核，名单会变动</dd></div>}
        <div><dt>快照生成</dt><dd>{site ? new Date(site.generated_at * 1000).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) : "—"}</dd></div>
        {site?.bundle_built_at && <div><dt>网站重建</dt><dd>{new Date(site.bundle_built_at * 1000).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</dd></div>}
        <div><dt>个别最新收盘</dt><dd>{site?.prices ? site.prices.max_date : "暂无价格历史"}</dd></div>
        {latestCommon && <div><dt>最常见收盘日</dt><dd>{latestCommon} · {site?.prices?.typical_symbols?.toLocaleString("zh-CN")} / {site?.prices?.symbols.toLocaleString("zh-CN")} 家停在这一天</dd></div>}
        {site?.prices?.fresh_symbols !== undefined && <div><dt>近期价格覆盖</dt><dd>{site.prices.fresh_symbols.toLocaleString("zh-CN")} / {site.prices.symbols.toLocaleString("zh-CN")} 家距最新市场日期不超过 7 天</dd></div>}
        {site?.prices && <div><dt>短线数据</dt><dd>{delayed ? `多数行情未覆盖预计交易日 ${expected}，短线与模拟买卖暂停` : `按常规日历预计最近交易日 ${expected}；仍须逐只核对价格日期`}</dd></div>}
        <div><dt>数据来源</dt><dd>crible 公开快照；筛选指标为第三方汇总数据，尚未逐项核对 SEC 原始申报</dd></div>
        <div><dt>官方核对</dt><dd>公司详情提供 SEC 官网申报入口；此静态版不提供实时 SEC 数值核验</dd></div>
      </dl>
      <section className="status-note">
        <h2>使用说明</h2>
        <p>重点池和短线观察池是研究范围，不是上涨概率。全市场基础数据仍从上游快照同步；缩小跟踪名单暂未减少上游下载量。快照生成时间不等于公司财报日期，也不代表所有股票的价格都更新至同一天。每日构建只会检查上游数据，不能保证每只股票的价格同步更新。这里展示的是历史收盘价，不是盘中实时行情；重要指标请以原始申报为准。价格数据的公开再分发需另行核查授权。</p>
      </section>
      <AppearanceSection pref={pref} onPref={onPref} />
    </main>
  );
}
