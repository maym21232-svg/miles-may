import type { HorizonBoard, PaperPortfolio, ResearchData } from './types';

export const SITE = 'https://maym21232-svg.github.io/miles-may/';

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
  return { board, paper, fetchedAt: new Date() };
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
