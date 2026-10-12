import { fieldLabel } from "./data/field-catalog";

const FIELD_LABELS: Record<string, string> = {
  symbol: "代码",
  name: "公司",
  country: "国家",
  sector: "行业",
  composite_rank: "综合分位",
  return_on_equity: "净资产收益率",
  revenue_growth: "营收增长",
  piotroski_f: "财务质量",
  free_cash_flow: "自由现金流",
  market_cap: "市值",
  price_to_earnings_ratio: "市盈率",
  revenue: "营业收入",
  gross_profit: "毛利润",
  operating_income: "营业利润",
  net_income: "净利润",
  total_assets: "总资产",
  total_equity: "股东权益",
  total_debt: "总债务",
  operating_cashflow: "经营现金流",
  ebitda_margin: "EBITDA 利润率",
  fcf_margin: "自由现金流率",
  fcf_conversion: "利润现金转化率",
  income_quality_ratio: "利润质量（现金流/净利润）",
  sloan_accruals: "应计项目比率",
  rule_of_40: "40 法则",
  capex_coverage_ratio: "资本支出覆盖率",
  dividend_coverage: "股息覆盖率",
  dividend_payout_ratio: "股息支付率",
  peg_ratio: "PEG 比率",
  price_to_book_ratio: "市净率",
  ev_to_ebitda_ratio: "企业价值 / EBITDA",
  ev_to_sales_ratio: "企业价值 / 收入",
  earnings_yield: "盈利收益率",
  free_cash_flow_yield: "自由现金流收益率",
  weighted_dividend_yield: "股息率",
  shareholder_yield: "股东回报率",
  gross_margin: "毛利率",
  operating_margin: "营业利润率",
  net_profit_margin: "净利率",
  return_on_assets: "总资产收益率",
  return_on_capital_employed: "已用资本回报率",
  return_on_invested_capital: "投入资本回报率",
  current_ratio: "流动比率",
  quick_ratio: "速动比率",
  cash_ratio: "现金比率",
  debt_to_equity_ratio: "负债权益比",
  net_debt_to_ebitda_ratio: "净债务 / EBITDA",
  interest_coverage_ratio: "利息覆盖倍数",
  asset_turnover_ratio: "资产周转率",
  inventory_turnover_ratio: "存货周转率",
  days_of_sales_outstanding: "应收账款周转天数",
  days_of_inventory_outstanding: "存货周转天数",
  days_of_accounts_payable_outstanding: "应付账款周转天数",
  cash_conversion_cycle: "现金周转周期",
  sga_to_revenue_ratio: "销售管理费用率",
  net_income_growth: "净利润增长",
  operating_cashflow_growth: "经营现金流增长",
  free_cash_flow_growth: "自由现金流增长",
  total_debt_growth: "总债务增长",
  revenue_cagr_3y: "营收三年复合增长",
  net_income_cagr_3y: "净利润三年复合增长",
  return_6m: "近六个月回报",
  return_12_1: "12-1 动量",
  high_52w_proximity: "距离 52 周高点",
  volatility_1y: "一年波动率",
  ttm_revenue: "近十二个月营收",
  ttm_net_income: "近十二个月净利润",
  ttm_operating_cashflow: "近十二个月经营现金流",
  ttm_free_cash_flow: "近十二个月自由现金流",
  price_to_earnings_ttm: "近十二个月市盈率",
  price_to_sales_ttm: "近十二个月市销率",
  ttm_fcf_yield: "近十二个月自由现金流收益率",
  piotroski_roa_positive: "资产收益为正",
  piotroski_ocf_positive: "经营现金流为正",
  piotroski_roa_improving: "资产收益改善",
  piotroski_accruals: "现金流高于利润",
  piotroski_leverage_decreasing: "杠杆率下降",
  piotroski_current_ratio_improving: "流动比率改善",
  piotroski_no_dilution: "未增发稀释",
  piotroski_gross_margin_improving: "毛利率改善",
  piotroski_asset_turnover_improving: "资产周转改善",
  altman_x1_wc_ta: "营运资本 / 总资产",
  altman_x2_re_ta: "留存收益 / 总资产",
  altman_x3_ebit_ta: "息税前利润 / 总资产",
  altman_x4_mve_tl: "股权市值 / 总负债",
  altman_x5_s_ta: "销售额 / 总资产",
  beneish_dsri: "应收账款指数",
  beneish_gmi: "毛利率指数",
  beneish_aqi: "资产质量指数",
  beneish_sgi: "销售增长指数",
  beneish_depi: "折旧率指数",
  beneish_sgai: "销售管理费用指数",
  beneish_tata: "应计项目 / 总资产",
  beneish_lvgi: "杠杆率指数",
  montier_ni_cfo_diverging: "利润与现金流背离",
  montier_dso_rising: "应收周转天数上升",
  montier_dsi_rising: "存货周转天数上升",
  montier_oca_to_rev_rising: "其他流动资产占收入上升",
  montier_depr_declining: "折旧率下降",
  montier_asset_growth_high: "资产增长过快",
  dechow_rsst: "应计项目（RSST）",
  dechow_ch_rec: "应收变化",
  dechow_ch_inv: "存货变化",
  dechow_soft_assets: "软资产占比",
  dechow_ch_cs: "现金销售变化",
  dechow_ch_roa: "资产收益变化",
  dechow_issuance: "增发",
  mohanram_g1_roa: "同业资产收益",
  mohanram_g2_cfo_roa: "现金流 / 资产收益",
  mohanram_g3_accruals: "应计质量",
  mohanram_g4_roa_stability: "资产收益稳定性",
  mohanram_g5_growth_stability: "增长稳定性",
  mohanram_g6_capex_intensity: "资本支出强度",
};

const SECTORS: Record<string, string> = {
  "Communication Services": "通信服务",
  "Consumer Discretionary": "可选消费",
  "Consumer Staples": "日常消费",
  Energy: "能源",
  Financials: "金融",
  "Health Care": "医疗保健",
  Industrials: "工业",
  "Information Technology": "信息技术",
  Materials: "材料",
  "Real Estate": "房地产",
  Utilities: "公用事业",
};

const FIELD_GROUPS: Record<string, string> = {
  Identity: "公司信息",
  Scores: "财务评分",
  Ranks: "分位排名",
  Value: "价值指标",
  Valuation: "估值",
  Profitability: "盈利能力",
  Health: "偿债与财务健康",
  Efficiency: "运营效率",
  Fundamentals: "财务数据",
  "Growth (YoY)": "同比增长",
  "Growth (3y)": "三年增长",
  Other: "其他",
};

export function researchFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? fieldLabel(field);
}

export function researchGroupLabel(group: string): string {
  return FIELD_GROUPS[group] ?? group;
}

export function sectorLabel(value: unknown): string {
  const name = String(value ?? "");
  return SECTORS[name] ?? (name || "行业未知");
}

export function peerGroupLabel(value: unknown): string {
  if (!value) return "全球";
  const [region, sector] = String(value).split("×");
  const regionNames: Record<string, string> = { us: "美国", europe: "欧洲", world: "全球" };
  return sector ? `${regionNames[region] ?? region} · ${sectorLabel(sector)}` : (regionNames[region] ?? region);
}

export function missingPillarsLabel(value: unknown): string {
  const names: Record<string, string> = { quality: "质量", value: "估值", momentum: "动量" };
  return String(value).split(",").map((item) => names[item.trim()] ?? item.trim()).join("、");
}
