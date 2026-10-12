import type { CompanyDetail } from "../data";
import { researchValue } from "../research-format";

type Finding = { label: string; field: string };

const FINDINGS: Finding[] = [
  { label: "营收增长", field: "revenue_growth" },
  { label: "净资产收益率", field: "return_on_equity" },
  { label: "自由现金流", field: "free_cash_flow" },
  { label: "负债权益比", field: "debt_to_equity_ratio" },
  { label: "市盈率", field: "price_to_earnings_ratio" },
  { label: "财务质量（F 分）", field: "piotroski_f" },
];

export function ResearchBrief({ symbol, detail }: { symbol: string; detail: CompanyDetail }) {
  const latest = detail.periods[0];
  if (!latest) return null;
  const period = String(latest.period ?? "未知期间");
  const source = String(latest.source ?? latest.provider ?? "crible 数据快照");

  return (
    <section className="research-brief" aria-labelledby="research-brief-title">
      <div className="research-brief-head">
        <div>
          <h3 id="research-brief-title">财报概览</h3>
          <p>财报期间：{period}</p>
        </div>
      </div>
      <dl className="research-metrics">
        {FINDINGS.map(({ label, field }) => (
          <div key={field}>
            <dt>{label}</dt>
            <dd>{field === "free_cash_flow" && typeof latest[field] === "number"
              ? latest[field] > 0 ? "为正" : latest[field] < 0 ? "为负" : "0"
              : researchValue(field, latest[field])}</dd>
          </div>
        ))}
      </dl>
      <p className="research-source">快照指标来源：{source === "edgar" || source === "fsds" ? "SEC EDGAR" : source} · 与上方官方披露分开显示，未经逐项比对。空值表示暂无数据。</p>
      {typeof detail.profile.country === "string" && detail.profile.country !== "US" &&
        ["NMS", "NYQ", "NCM", "NGM", "ASE"].includes(String(detail.profile.exchange)) &&
        source !== "edgar" && source !== "fsds" &&
        <p className="research-currency-warning">跨境上市公司：交易币种可能不同于财报币种，涉及金额与估值的指标须核对原始报表。</p>}
    </section>
  );
}
