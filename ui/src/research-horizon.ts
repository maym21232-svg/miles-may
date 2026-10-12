import type { PriceBar } from "./data/types";

export type HorizonSignal = "supported" | "mixed" | "insufficient";

export interface HorizonResult {
  signal: HorizonSignal;
  label: string;
  window: string;
  asof: string | null;
  reasons: string[];
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function ageDays(date: string, now: Date): number | null {
  const stamp = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(stamp)) return null;
  return Math.floor((now.getTime() - stamp) / 86_400_000);
}

function periodEnd(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}$/.test(raw)) return `${raw}-12-31`;
  return null;
}

export function shortHorizon(bars: PriceBar[], now = new Date()): HorizonResult {
  const window = "2–6 周观察，至少每周复核";
  const valid = bars.filter((bar) => {
    const close = finite(bar.close);
    return close !== null && close > 0 && /^\d{4}-\d{2}-\d{2}$/.test(bar.date);
  });
  const last = valid.at(-1);
  const asof = last?.date ?? null;
  const age = asof ? ageDays(asof, now) : null;
  if (age === null || age < 0 || age > 7) {
    return { signal: "insufficient", label: "暂不判断", window, asof,
      reasons: [asof ? `收盘价停留在 ${asof}，不足以判断当前短线状态` : "暂无可用收盘价"] };
  }
  if (valid.length < 61) {
    return { signal: "insufficient", label: "数据不足", window, asof,
      reasons: [`只有 ${valid.length} 个有效交易日，至少需要 61 个交易日`] };
  }
  const oldestWindowDate = valid.at(-61)!.date;
  const windowAge = ageDays(oldestWindowDate, now);
  if (windowAge === null || windowAge > 150) {
    return { signal: "insufficient", label: "数据不足", window, asof,
      reasons: ["最近 60 个交易日跨度过长，价格历史可能缺失"] };
  }
  const closes = valid.map((bar) => bar.close as number);
  const close = closes.at(-1)!;
  const last20 = closes.slice(-20);
  const average20 = last20.reduce((sum, value) => sum + value, 0) / last20.length;
  const return20 = close / closes.at(-21)! - 1;
  const return60 = close / closes.at(-61)! - 1;
  const reasons = [
    `近 20 个交易日 ${return20 >= 0 ? "上涨" : "下跌"} ${Math.abs(return20 * 100).toFixed(1)}%`,
    `收盘价${close >= average20 ? "高于" : "低于"} 20 日均价`,
    `近 60 个交易日 ${return60 >= 0 ? "上涨" : "下跌"} ${Math.abs(return60 * 100).toFixed(1)}%`,
  ];
  const supported = return20 > 0 && close > average20 && return60 > 0;
  return { signal: supported ? "supported" : "mixed", label: supported ? "趋势条件吻合" : "趋势条件不齐", window, asof, reasons };
}

export function longHorizon(latest: Record<string, unknown>, now = new Date()): HorizonResult {
  const window = "1–3 年研究，每季财报后复核";
  const asof = periodEnd(latest.period);
  const age = asof ? ageDays(asof, now) : null;
  if (age === null || age < 0 || age > 455) {
    return { signal: "insufficient", label: "暂不判断", window, asof,
      reasons: [asof ? `财报期间为 ${asof}，需先核对较新的财报` : "缺少可确认的财报期间"] };
  }
  const checks: Array<[string, boolean]> = [];
  const f = finite(latest.piotroski_f);
  if (f !== null) checks.push([`财务质量 F 分 ${f.toFixed(0)}/9`, f >= 6]);
  const cash = finite(latest.free_cash_flow);
  if (cash !== null) checks.push([`自由现金流${cash > 0 ? "为正" : "未为正"}`, cash > 0]);
  const roe = finite(latest.return_on_equity);
  if (roe !== null) checks.push([`净资产收益率 ${(roe * 100).toFixed(1)}%`, roe >= 0.1]);
  const debt = finite(latest.debt_to_equity_ratio);
  if (debt !== null) checks.push([`负债权益比 ${debt.toFixed(2)}`, debt >= 0 && debt < 1.5]);
  if (checks.length < 3) {
    return { signal: "insufficient", label: "数据不足", window, asof,
      reasons: [`四项基本面指标只有 ${checks.length} 项可用，至少需要 3 项`] };
  }
  const distress = finite(latest.altman_z);
  const hasDistress = distress !== null && distress < 1.81;
  const passes = checks.filter(([, pass]) => pass).length;
  const reasons = checks.map(([label, pass]) => `${pass ? "符合" : "未符合"}：${label}`);
  if (hasDistress) reasons.push(`财务压力警示：Altman Z ${distress.toFixed(2)}`);
  const supported = passes >= 3 && !hasDistress;
  return { signal: supported ? "supported" : "mixed", label: supported ? "基本面条件吻合" : "基本面仍需核对", window, asof, reasons };
}
