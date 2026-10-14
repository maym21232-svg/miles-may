export type Candidate = {
  symbol: string;
  name: string;
  sector: string;
  period?: string;
  price_date?: string;
  piotroski_f?: number;
  return_on_equity?: number;
  free_cash_flow?: number;
  debt_to_equity_ratio?: number;
  return_20d?: number;
  return_60d?: number;
};

export type HorizonBoard = {
  generated_at: number;
  prices_typical_date: string;
  long: Candidate[];
  short: Candidate[];
};

export type PaperOrder = {
  symbol: string;
  side?: string;
  reason?: string;
  name?: string | null;
  decision_date?: string;
  reference_close?: number;
};

export type PaperPosition = {
  symbol: string;
  name?: string | null;
  shares: number;
  entry_price: number;
  entry_date: string;
  mark_price?: number | null;
};

export type PaperFill = {
  date: string;
  side: 'buy' | 'sell';
  symbol: string;
  shares: number;
  price: number;
};

export type PaperPortfolio = {
  status: string;
  reason: string | null;
  generated_at: string;
  data_date: string;
  expected_date: string;
  coverage: number;
  cash: number;
  starting_cash?: number;
  positions: PaperPosition[];
  pending: PaperOrder[];
  fills?: PaperFill[];
  method: string;
};

export type ResearchData = {
  board: HorizonBoard;
  paper: PaperPortfolio;
  fetchedAt: Date;
  source: 'network' | 'cache';
};

export type SearchHit = {
  symbol: string;
  name: string | null;
  country: string | null;
  sector: string | null;
};

export type FinancialPeriod = {
  period: string;
  revenue?: number | null;
  net_income?: number | null;
  free_cash_flow?: number | null;
  operating_cashflow?: number | null;
  return_on_equity?: number | null;
  revenue_growth?: number | null;
  piotroski_f?: number | null;
  provider?: string | null;
  computed_at?: number | null;
};

export type CompanyDetail = {
  profile: SearchHit & { industry?: string | null; exchange?: string | null; currency?: string | null };
  periods: FinancialPeriod[];
};

export type PriceBar = {
  date: string;
  close: number;
  source: string | null;
};
