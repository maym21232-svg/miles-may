import type { Candidate, CompanyDetail, HorizonBoard, PaperPortfolio, PriceBar, ResearchData, SearchHit } from './types';

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

export async function fetchJson<T>(url: string, timeoutMs = 20_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`数据请求失败 (${response.status})`);
    return await response.json() as T;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('连接超时，请检查网络后重试');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function readJson<T>(filename: string): Promise<T> {
  return fetchJson<T>(`${SITE}data/${filename}?t=${Date.now()}`);
}

export async function loadResearch(): Promise<ResearchData> {
  const [board, paper] = await Promise.all([
    readJson<HorizonBoard>('horizon-board.json'),
    readJson<PaperPortfolio>('paper-portfolio.json'),
  ]);
  if (!Array.isArray(board.long) || !Array.isArray(board.short) || !Array.isArray(paper.pending)
    || !Array.isArray(paper.positions) || (paper.fills != null && !Array.isArray(paper.fills))) {
    throw new Error('数据格式有误');
  }
  return { board, paper, fetchedAt: new Date(), source: 'network' };
}

export async function loadUniverse(): Promise<SearchHit[]> {
  const rows = await readJson<SearchHit[]>('overview.json');
  if (!Array.isArray(rows)) throw new Error('公司目录格式有误');
  return rows.filter((row) => !!row && typeof row.symbol === 'string');
}

const shards = new Map<string, Promise<Record<string, CompanyDetail>>>();
const priceShards = new Map<string, Promise<Record<string, [string, number, string | null][]>>>();

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
    request = fetchJson<Record<string, CompanyDetail>>(`${SITE}data/${name}?v=${manifest.generated_at}`)
      .catch((error) => { shards.delete(key); throw error; });
    shards.set(key, request);
    if (shards.size > 12) {
      const oldest = shards.keys().next().value;
      if (oldest) shards.delete(oldest);
    }
  }
  const companies = await request;
  const detail = companies[symbol];
  return isCompanyDetail(detail, symbol) ? detail : null;
}

export function isCompanyDetail(value: unknown, symbol: string): value is CompanyDetail {
  if (!value || typeof value !== 'object') return false;
  const detail = value as Partial<CompanyDetail>;
  return detail.profile?.symbol === symbol && Array.isArray(detail.periods) &&
    detail.periods.every((period) => !!period && typeof period.period === 'string' &&
      (period.symbol == null || period.symbol === symbol));
}

export async function loadPriceHistory(symbol: string): Promise<PriceBar[]> {
  const manifest = await readJson<{ mobile_shards?: number; generated_at: number }>('manifest.json');
  if (!Number.isInteger(manifest.mobile_shards) || !manifest.mobile_shards || manifest.mobile_shards > 1024) return [];
  const number = shardNumber(symbol, manifest.mobile_shards);
  const key = `${manifest.generated_at}-${number}`;
  let request = priceShards.get(key);
  if (!request) {
    const name = `prices-${String(number).padStart(3, '0')}.json`;
    request = fetchJson<Record<string, [string, number, string | null][]>>(`${SITE}data/${name}?v=${manifest.generated_at}`)
      .catch((error) => { priceShards.delete(key); throw error; });
    priceShards.set(key, request);
    if (priceShards.size > 12) {
      const oldest = priceShards.keys().next().value;
      if (oldest) priceShards.delete(oldest);
    }
  }
  const rows = (await request)[symbol];
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => Array.isArray(row) && typeof row[0] === 'string' && Number.isFinite(row[1]) && row[1] > 0)
    .map(([date, close, source]) => ({ date, close, source: source ?? null }));
}

export function expectedCloseDate(now = new Date()): string {
  // 20:00 UTC is the earliest regular 4 p.m. ET close; winter may pause an hour early.
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(),
    now.getUTCDate() - (now.getUTCHours() >= 20 ? 0 : 1)));
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

export function isPaperCurrent(paper: PaperPortfolio, now = new Date()): boolean {
  const age = now.getTime() - Date.parse(paper.generated_at);
  return paper.status === 'ready'
    && Number.isFinite(paper.coverage)
    && paper.coverage >= 0.95
    && paper.coverage <= 1
    && paper.data_date === paper.expected_date
    && paper.data_date === expectedCloseDate(now)
    && Number.isFinite(age)
    && age >= -5 * 60_000
    && age < 36 * 60 * 60_000;
}

export function isShortBoardCurrent(data: ResearchData, now = new Date()): boolean {
  return data.source === 'network'
    && isPaperCurrent(data.paper, now)
    && data.board.prices_typical_date === data.paper.data_date;
}

export function paperPauseMessage(data: ResearchData, now = new Date()): string {
  if (data.source === 'cache') return '当前离线，显示上次保存的数据；模拟买卖暂停。';
  const expected = expectedCloseDate(now);
  if (data.paper.data_date !== expected) {
    return `等待 ${expected} 的行情（目前 ${data.paper.data_date || '未知'}），模拟买卖暂停。`;
  }
  if (!Number.isFinite(data.paper.coverage) || data.paper.coverage < 0.95 || data.paper.coverage > 1) {
    return '行情覆盖率未通过校验（要求至少 95%），模拟买卖暂停。';
  }
  if (data.paper.expected_date !== data.paper.data_date) {
    return '报告预期交易日与行情不一致，模拟买卖暂停。';
  }
  return data.paper.reason || '报告已过期或生成时间无效，模拟买卖暂停。';
}

export function currentShortCandidates(data: ResearchData, now = new Date()): Candidate[] {
  return isShortBoardCurrent(data, now)
    ? data.board.short.filter((candidate) => candidate.price_date === data.paper.data_date)
    : [];
}

export function paperEquity(paper: PaperPortfolio, current: boolean): number | null {
  if (!current || !Number.isFinite(paper.cash) || paper.cash < 0 || !Array.isArray(paper.positions)) return null;
  if (paper.positions.some((position) => !Number.isFinite(position.shares) || position.shares <= 0
    || typeof position.mark_price !== 'number' || !Number.isFinite(position.mark_price)
    || position.mark_price <= 0)) return null;
  const equity = paper.cash + paper.positions.reduce((total, position) => total + position.shares * position.mark_price!, 0);
  return Number.isFinite(equity) ? equity : null;
}

export function percent(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '—';
}

export function money(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const absolute = Math.abs(value);
  if (absolute >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (absolute >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toLocaleString('en-US')}`;
}
