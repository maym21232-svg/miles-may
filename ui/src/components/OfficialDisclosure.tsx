import { useEffect, useState } from "react";
import { fetchOfficialCompany, type OfficialCompany } from "../data/official-sec";

function amount(value: number, unit: string): string {
  return `${new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 2 }).format(value)} ${unit}`;
}

export function OfficialDisclosure({ symbol }: { symbol: string }) {
  const staticHost = import.meta.env.VITE_STATIC_HOST === "true";
  const [data, setData] = useState<OfficialCompany | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (staticHost) return;
    const controller = new AbortController();
    setData(null);
    setFailed(false);
    fetchOfficialCompany(symbol, controller.signal)
      .then((result) => setData(result))
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [symbol, retry, staticHost]);

  const latestAnnual = data?.filings?.find((filing) => ["10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"].includes(filing.form));
  const latestFactEnd = data?.facts?.reduce((latest, fact) => fact.periodEnd > latest ? fact.periodEnd : latest, "") ?? "";
  const secSearch = `https://www.sec.gov/edgar/browse/?CIK=${encodeURIComponent(symbol)}&owner=exclude`;

  return <section className="official-disclosure" aria-labelledby="official-disclosure-title">
    <div className="official-disclosure-head">
      <h3 id="official-disclosure-title">SEC 官方披露</h3>
      {data?.status === "available" && <span>核对于 {new Date(data.checkedAt).toLocaleString("zh-CN")}{data.stale ? " · 缓存已过期" : ""}</span>}
    </div>
    {staticHost && <p className="meta">公网静态版暂不提供实时 SEC 数值核验。<a href={secSearch} target="_blank" rel="noreferrer">在 SEC 官网查看申报</a>；下方筛选指标仍是快照数据。</p>}
    {!staticHost && !data && !failed && <p className="meta" role="status">正在核对 SEC 申报…</p>}
    {failed && <p className="official-disclosure-error" role="alert">
      官方查询服务暂不可用，快照指标尚未经过本次核验。
      <button type="button" onClick={() => setRetry((value) => value + 1)}>重试</button>
      <a href={secSearch} target="_blank" rel="noreferrer">打开 SEC</a>
    </p>}
    {data?.status === "unmapped" && <p className="meta">SEC 股票代码目录未匹配到这只证券；不能将快照数字标为官方数据。<a href={secSearch} target="_blank" rel="noreferrer">手动查找</a></p>}
    {data?.status === "available" && <>
      <p className="official-disclosure-name">{data.name} · CIK {data.cik}</p>
      {(data.facts?.length ?? 0) > 0 && <dl className="official-facts">
        {data.facts?.map((fact) => <div key={fact.key}>
          <dt>{fact.label} · {fact.periodEnd}</dt>
          <dd>{fact.url ? <a href={fact.url} target="_blank" rel="noreferrer">{amount(fact.value, fact.unit)}</a> : amount(fact.value, fact.unit)}</dd>
          <small>{fact.form} · {fact.filed}</small>
        </div>)}
      </dl>}
      {!data.factsAvailable && <p className="meta">结构化财务数据暂不可用；以下申报链接仍可核对。</p>}
      {data.factsAvailable && !data.facts?.length && <p className="meta">SEC 暂无可直接提取的年度结构化数值，请查看申报原文。</p>}
      {latestAnnual?.reportDate && latestFactEnd && latestAnnual.reportDate > latestFactEnd &&
        <p className="official-disclosure-lag">最近年报的报告期为 {latestAnnual.reportDate}，上方结构化数值只到 {latestFactEnd}；请打开年报原文核对较新数据。</p>}
      <ul className="official-filings">
        {data.filings?.map((filing) => <li key={filing.accession}>
          <a href={filing.url} target="_blank" rel="noreferrer">{filing.form} · {filing.filed ?? "日期未知"}</a>
          {filing.reportDate && <span>报告期 {filing.reportDate}</span>}
        </li>)}
      </ul>
      <p className="official-disclosure-note">官方数值只对应标明的报告期；下方筛选评分仍来自 crible 快照，未据此自动重算。</p>
    </>}
  </section>;
}
