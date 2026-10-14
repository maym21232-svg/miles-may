import type { FinancialPeriod } from './types';

function valid(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function financialNotes(period: FinancialPeriod): string[] {
  const notes: string[] = [];
  if (valid(period.revenue_growth) && period.revenue_growth < 0) {
    notes.push('营收增长率为负，需核对主营业务变化与上一财报期的可比性。');
  }
  if (valid(period.net_income) && period.net_income > 0 &&
      valid(period.operating_cashflow) && period.operating_cashflow < 0) {
    notes.push('净利润为正，但经营现金流为负；应查看现金流量表及附注，确认差异来源。');
  }
  if (valid(period.free_cash_flow) && period.free_cash_flow < 0) {
    notes.push('自由现金流为负，需核对资本开支、营运资金和不同财报期的变化。');
  }
  if (!notes.length && valid(period.operating_cashflow) && period.operating_cashflow > 0 &&
      valid(period.free_cash_flow) && period.free_cash_flow > 0) {
    notes.push('经营现金流与自由现金流均为正；仍需结合多个财报期及附注判断持续性。');
  }
  return notes.length ? notes : ['关键指标不足或未触发上述规则，暂不作自动解读；请核对原始申报。'];
}
