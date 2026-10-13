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
};

export type PaperPortfolio = {
  status: string;
  reason: string | null;
  generated_at: string;
  data_date: string;
  expected_date: string;
  coverage: number;
  cash: number;
  positions: PaperOrder[];
  pending: PaperOrder[];
  method: string;
};

export type ResearchData = {
  board: HorizonBoard;
  paper: PaperPortfolio;
  fetchedAt: Date;
};
