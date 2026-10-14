import type { CompanyDetail, HorizonBoard, PaperPortfolio, ResearchData, SearchHit } from './types';

export const SITE = 'https://maym21232-svg.github.io/miles-may/';

const sectors: Record<string, string> = {
  'Information Technology': '信息技术',
  'Communication Services': '通信服务',
  'Consumer Discretionary': '可选消费',
  'Consumer Staples': '日常消费',
  Financials: '金融',
  'Health Care': '医疗健康',
  Industrials: '工业',
  Energy: '能源',
  Utilities: '公用事业',
  Materials: '原材料',
  'Real Estate': '房地产',
};

export function sectorName(sector: string): string {
  return sectors[sector] ?? sector;
}

async function readJson<T>(filename: string): Promise<T> {
  const response = await fetch(`${SITE}data/${filename}?t=${Date.now()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`数据请求失败 (${response.status})`);
  return response.json() as Promise<T>;
}

export async function loadResearch(): Promise<ResearchData> {
  const [board, paper] = await Promise.all([
    readJson<HorizonBoard>('horizon-board.json'),
    readJson<PaperPortfolio>('paper-portfolio.json'),
  ]);
  if (!Array.isArray(board.long) || !Array.isArray(board.short) || !Array.isArray(paper.pending)) {
    throw new Error('数据格式有误');
  }
  return { board, paper, fetchedAt: new Date(), source: 'network' };
}

export async function loadUniverse(): Promise<SearchHit[]> {
  const rows = await readJson<SearchHit[]>('overview.json');
  if (!Array.isArray(rows)) throw new Error('公司目录格式有误');
  return rows.filter((row) => typeof row.symbol === 'string');
}

const shards = new Map<string, Promise<Record<string, CompanyDetail>>>();

function shardNumber(symbol: string, count: number): number {
  let value = 0;
  for (const char of symbol) value = (Math.imul(value, 31) + char.codePointAt(0)!) >>> 0;
  return value % count;
}

export async function loadCompanyDetail(symbol: string): Promise<CompanyDetail | null> {
  const manifest = await readJson<{ mobile_shards?: number; generated_at: number }>('manifest.json');
  if (!Number.isInteger(manifest.mobile_shards) || !manifest.mobile_shards || manifest.mobile_shards > 1024) {
    return null;
  }
  const number = shardNumber(symbol, manifest.mobile_shards);
  const key = `${manifest.generated_at}-${number}`;
  let request = shards.get(key);
  if (!request) {
    const name = `companies-${String(number).padStart(3, '0')}.json`;
    request = fetch(`${SITE}data/${name}?v=${manifest.generated_at}`)
      .then((response) => {
        if (!response.ok) throw new Error(`财报请求失败 (${response.status})`);
        return response.json() as Promise<Record<string, CompanyDetail>>;
      })
      .catch((error) => { shards.delete(key); throw error; });
    shards.set(key, request);
    if (shards.size > 12) {
      const oldest = shards.keys().next().value;
      if (oldest) shards.delete(oldest);
    }
  }
  const companies = await request;
  const detail = companies[symbol];
  return detail && Array.isArray(detail.periods) ? detail : null;
}

export function isPaperCurrent(paper: PaperPortfolio): boolean {
  const age = Date.now() - Date.parse(paper.generated_at);
  return paper.status === 'ready'
    && paper.data_date >= paper.expected_date
    && Number.isFinite(age)
    && age >= -5 * 60_000
    && age < 36 * 60 * 60_000;
}

export function percent(value?: number): string {
  return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—';
}

export function money(value?: number): string {
  if (typeof value !== 'number') return '—';
  const absolute = Math.abs(value);
  if (absolute >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (absolute >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toLocaleString('en-US')}`;
}
