import { formatCell, formatPercent } from "./format";

const PERCENT_FIELDS = new Set(["revenue_growth", "return_on_equity", "fcf_conversion"]);
const MULTIPLE_FIELDS = new Set(["debt_to_equity_ratio", "price_to_earnings_ratio"]);

export function researchValue(field: string, value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (field === "return_on_equity" && Math.abs(value) > 10) return "需核对";
  if (field === "price_to_earnings_ratio" && value <= 0) return "不适用";
  if (field === "price_to_earnings_ratio" && value < 1) return "需核对";
  if (PERCENT_FIELDS.has(field)) return formatPercent(value);
  if (MULTIPLE_FIELDS.has(field)) return `${value.toFixed(1)}×`;
  if (field === "composite_rank") return value.toFixed(1);
  return formatCell(field, value).text;
}
