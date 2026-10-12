export interface OfficialFiling {
  form: string;
  filed: string | null;
  reportDate: string | null;
  accession: string;
  url: string;
}

export interface OfficialFact {
  key: string;
  label: string;
  value: number;
  unit: string;
  periodEnd: string;
  filed: string;
  form: string;
  url: string | null;
}

export interface OfficialCompany {
  symbol: string;
  status: "available" | "unmapped";
  checkedAt: string;
  cik?: number;
  name?: string;
  filings?: OfficialFiling[];
  facts?: OfficialFact[];
  factsAvailable?: boolean;
  stale?: boolean;
}

export async function fetchOfficialCompany(symbol: string, signal?: AbortSignal): Promise<OfficialCompany> {
  const response = await fetch(`${import.meta.env.BASE_URL}official/sec/${encodeURIComponent(symbol)}`, { signal });
  if (!response.ok) throw new Error(`官方披露查询失败 (${response.status})`);
  return response.json() as Promise<OfficialCompany>;
}
