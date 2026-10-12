import { useEffect, useState } from "react";
import { prices, type CompanyDetail, type PriceBar } from "../data";
import { longHorizon, shortHorizon, type HorizonResult } from "../research-horizon";

function HorizonLine({ title, result }: { title: string; result: HorizonResult }) {
  return <div className="horizon-line">
    <div className="horizon-line-head">
      <strong>{title}</strong>
      <span className={`horizon-signal horizon-${result.signal}`}>{result.label}</span>
    </div>
    <p>{result.window}{result.asof ? ` · 数据截至 ${result.asof}` : ""}</p>
    <ul>{result.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
  </div>;
}

export function ResearchHorizon({ symbol, detail }: { symbol: string; detail: CompanyDetail }) {
  const [bars, setBars] = useState<PriceBar[] | null>(null);
  useEffect(() => {
    let active = true;
    setBars(null);
    prices(symbol).then((value) => { if (active) setBars(value); })
      .catch(() => { if (active) setBars([]); });
    return () => { active = false; };
  }, [symbol]);

  const latest = detail.periods[0];
  if (!latest) return null;
  return <section className="research-horizon" aria-labelledby="research-horizon-title">
    <h3 id="research-horizon-title">研究周期</h3>
    <div className="horizon-lines">
      {bars === null ? <p className="meta" role="status">正在核对价格日期…</p>
        : <HorizonLine title="短线" result={shortHorizon(bars)} />}
      <HorizonLine title="长线" result={longHorizon(latest)} />
    </div>
    <p className="horizon-note">时间范围是研究与复核节奏，不是涨跌预测或持有建议；短线判断不含实时成交量与交易成本。</p>
  </section>;
}
