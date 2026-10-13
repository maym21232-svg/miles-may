import { useMemo, useState } from "react";
import { researchValue } from "../research-format";
import { sectorLabel } from "../research-labels";
import { PaperDesk, paperPaused, type PaperReport } from "./PaperDesk";

export interface HorizonCandidate {
  symbol: string;
  name: string | null;
  sector: string | null;
  period?: string;
  price_date?: string;
  piotroski_f?: number | null;
  return_on_equity?: number | null;
  free_cash_flow?: number | null;
  return_20d?: number | null;
  return_60d?: number | null;
}

export interface HorizonBoardData {
  generated_at: number;
  prices_typical_date: string | null;
  long: HorizonCandidate[];
  short: HorizonCandidate[];
}

type Horizon = "long" | "short";

const SECTOR_ORDER = [
  "Information Technology", "Health Care", "Financials", "Consumer Discretionary",
  "Communication Services", "Industrials", "Consumer Staples", "Energy",
  "Materials", "Real Estate", "Utilities",
];

function bySector(rows: HorizonCandidate[]): [string, HorizonCandidate[]][] {
  const groups = new Map<string, HorizonCandidate[]>();
  for (const row of rows) {
    const key = row.sector || "其他";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      const left = SECTOR_ORDER.indexOf(a);
      const right = SECTOR_ORDER.indexOf(b);
      if (left < 0) return right < 0 ? a.localeCompare(b) : 1;
      return right < 0 ? -1 : left - right;
    })
    .map(([sector, members]) => [sector, [...members].sort((a, b) =>
      (a.name || a.symbol).localeCompare(b.name || b.symbol))]);
}

function metric(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

export function HorizonBoard({ board, onSelect, onAdvanced, paper, paperError, onPaperRetry }: {
  board: HorizonBoardData;
  onSelect: (symbol: string) => void;
  onAdvanced: () => void;
  paper?: PaperReport | null;
  paperError?: boolean;
  onPaperRetry?: () => void;
}) {
  const [horizon, setHorizon] = useState<Horizon>("long");
  const [sector, setSector] = useState<string | null>(null);
  const [visible, setVisible] = useState(25);
  const shortPaused = !paper || paperPaused(paper) || board.prices_typical_date !== paper.data_date;
  const rows = horizon === "long" ? board.long : shortPaused ? [] : board.short;
  const sectors = useMemo(() => bySector(rows), [rows]);
  const shown = sector ? sectors.filter(([name]) => name === sector) : sectors;
  const chooseHorizon = (next: Horizon) => {
    setHorizon(next);
    setSector(null);
    setVisible(25);
  };
  const chooseSector = (next: string | null) => {
    setSector(next);
    setVisible(25);
  };

  return (
    <main className="horizon-board">
      <div className="board-heading">
        <div>
          <h1>发现公司</h1>
          <p>按研究周期与行业浏览</p>
        </div>
        <button type="button" className="board-advanced" onClick={onAdvanced}>高级筛选</button>
      </div>
      <PaperDesk report={paper ?? null} error={paperError} onSelect={onSelect} onRetry={onPaperRetry} />
      <div className="horizon-switch" role="group" aria-label="研究周期">
        <button type="button" aria-pressed={horizon === "long"} onClick={() => chooseHorizon("long")}>偏长线</button>
        <button type="button" aria-pressed={horizon === "short"} onClick={() => chooseHorizon("short")}>偏短线</button>
      </div>
      <div className="board-context">
        <p>{horizon === "long"
          ? "1–3 年研究 · 财务质量、现金流和盈利能力符合条件；每季财报后复核"
          : "2–6 周观察 · 近 20/60 个交易日趋势符合条件；至少每周复核"}</p>
        <span>{rows.length} 家候选</span>
      </div>
      <p className="board-caveat">条件筛选不是上涨概率或投资建议。打开公司查看依据、数据日期与风险。</p>
      {horizon === "short" && shortPaused && <p className="board-freshness">行情过期，短线候选名单已暂停展示。</p>}
      {horizon === "short" && !shortPaused && board.prices_typical_date && (
        <p className="board-freshness">多数股票的价格截至 {board.prices_typical_date}；下方仅展示最近 7 天内有有效收盘价、且历史足够的公司。</p>
      )}
      {rows.length === 0 ? (
        <div className="board-empty">
          <strong>{horizon === "short" ? shortPaused ? "短线名单暂时停用" : "暂无可判断的短线候选" : "暂无符合条件的公司"}</strong>
          <p>{horizon === "short"
            ? shortPaused ? "价格日期未通过最新交易日校验，等待自动更新。" : "行情可能尚未更新，或目前没有公司同时满足 20/60 日趋势条件。不会用过期价格填充名单。"
            : "可以使用高级筛选放宽条件。"}</p>
        </div>
      ) : (
        <>
          <div className="board-sector-filter">
            <label htmlFor="board-sector">行业</label>
            <select id="board-sector" value={sector ?? ""} onChange={(event) => chooseSector(event.target.value || null)}>
              <option value="">全部行业</option>
              {sectors.map(([name, members]) => (
                <option key={name} value={name}>{sectorLabel(name)} · {members.length}</option>
              ))}
            </select>
          </div>
          <div className="board-sectors">
            {shown.map(([name, members]) => {
              const limit = sector ? visible : 4;
              return (
                <section className="board-sector" key={name} aria-label={sectorLabel(name)}>
                  <div className="board-sector-heading">
                    <h2>{sectorLabel(name)}</h2>
                    <span>{members.length} 家</span>
                  </div>
                  <div className="board-company-list">
                    {members.slice(0, limit).map((row) => (
                      <button className="board-company" type="button" key={row.symbol} onClick={() => onSelect(row.symbol)}>
                        <span className="board-company-identity"><strong>{row.symbol}</strong><span>{row.name || "公司名称未知"}</span></span>
                        <span className="board-company-detail">
                          {horizon === "long"
                            ? <><span>财务质量 {row.piotroski_f ?? "—"}/9</span><span>ROE {researchValue("return_on_equity", row.return_on_equity)}</span><small>财报 {row.period || "未知"}</small></>
                            : <><span>近 20 日 {metric(row.return_20d)}</span><span>近 60 日 {metric(row.return_60d)}</span><small>收盘 {row.price_date || "未知"}</small></>}
                        </span>
                        <span className="board-company-arrow" aria-hidden="true">›</span>
                      </button>
                    ))}
                  </div>
                  {members.length > limit && (
                    <button type="button" className="board-more" onClick={() => sector ? setVisible((count) => count + 25) : chooseSector(name)}>
                      {sector ? "显示更多" : `查看${sectorLabel(name)}全部 ${members.length} 家`}
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
