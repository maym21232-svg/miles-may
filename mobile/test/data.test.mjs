import assert from 'node:assert/strict';
import test from 'node:test';
import { currentShortCandidates, expectedCloseDate, fetchJson, isCompanyDetail, isPaperCurrent, isShortBoardCurrent, loadCompanyDetail, loadPriceHistory, loadUniverse, money, paperEquity, paperPauseMessage, percent, requiredCloseDate, sectorName } from '../src/lib/data.ts';
import { financialNotes } from '../src/lib/finance.ts';

function report(overrides = {}) {
  return {
    status: 'ready',
    generated_at: new Date().toISOString(),
    data_date: expectedCloseDate(),
    expected_date: expectedCloseDate(),
    coverage: 0.99,
    ...overrides,
  };
}

test('accepts only a fresh, ready report covering its expected trading date', () => {
  assert.equal(isPaperCurrent(report()), true);
  assert.equal(isPaperCurrent(report({ status: 'paused' })), false);
  assert.equal(isPaperCurrent(report({ coverage: 0.94 })), false);
  assert.equal(isPaperCurrent(report({ coverage: Number.NaN })), false);
  assert.equal(isPaperCurrent(report({ coverage: 1.01 })), false);
  assert.equal(isPaperCurrent(report({ data_date: '2000-01-01' })), false);
  assert.equal(isPaperCurrent(report({ expected_date: '2000-01-01' })), false);
  assert.equal(isPaperCurrent(report({ generated_at: new Date(Date.now() - 37 * 60 * 60_000).toISOString() })), false);
  assert.equal(isPaperCurrent(report({ generated_at: new Date(Date.now() + 10 * 60_000).toISOString() })), false);
  assert.equal(isPaperCurrent(report({ generated_at: 'invalid' })), false);
});

test('pauses decisions after the calendar rolls to the next trading date', () => {
  assert.equal(expectedCloseDate(new Date('2026-10-12T12:00:00Z')), '2026-10-09');
  assert.equal(expectedCloseDate(new Date('2026-10-12T20:00:00Z')), '2026-10-12');
  assert.equal(expectedCloseDate(new Date('2026-01-12T20:59:00Z')), '2026-01-09');
  assert.equal(expectedCloseDate(new Date('2026-01-12T21:00:00Z')), '2026-01-12');
  assert.equal(expectedCloseDate(new Date('2026-10-13T12:00:00Z')), '2026-10-12');
  const monday = new Date('2026-10-12T12:00:00Z');
  assert.equal(isPaperCurrent(report({ generated_at: monday.toISOString(), data_date: '2026-10-09', expected_date: '2026-10-09' }), monday), true);
  assert.equal(isPaperCurrent(report({ generated_at: monday.toISOString(), data_date: '2026-10-09', expected_date: '2026-10-09' }), new Date('2026-10-13T00:00:00Z')), false);
});

test('uses exchange-provided next close through holidays and early closes', () => {
  const paper = report({
    generated_at: '2026-11-27T12:00:00Z', data_date: '2026-11-25', expected_date: '2026-11-25',
    next_session_date: '2026-11-27', next_close_at: '2026-11-27T18:00:00+00:00',
  });
  const before = new Date('2026-11-27T17:59:00Z');
  const after = new Date('2026-11-27T18:00:00Z');
  assert.equal(requiredCloseDate(paper, before), '2026-11-25');
  assert.equal(isPaperCurrent(paper, before), true);
  assert.equal(requiredCloseDate(paper, after), '2026-11-27');
  assert.equal(isPaperCurrent(paper, after), false);
  assert.equal(requiredCloseDate({ ...paper, next_close_at: 'invalid' }, before), null);
});

test('translates known sectors without inventing unknown ones', () => {
  assert.equal(sectorName('Health Care'), '医疗健康');
  assert.equal(sectorName('Unclassified'), 'Unclassified');
});

test('hides short-term candidates when price coverage or connection is stale', () => {
  const data = {
    source: 'network',
    board: { prices_typical_date: expectedCloseDate() },
    paper: report(),
  };
  assert.equal(isShortBoardCurrent(data), true);
  assert.equal(isShortBoardCurrent({ ...data, source: 'cache' }), false);
  assert.equal(isShortBoardCurrent({ ...data, board: { prices_typical_date: '2000-01-01' } }), false);
  const before = new Date('2026-10-13T19:59:00Z');
  const after = new Date('2026-10-13T20:00:00Z');
  const priorDay = report({ generated_at: before.toISOString(), data_date: '2026-10-12', expected_date: '2026-10-12' });
  assert.equal(isShortBoardCurrent({ ...data, board: { prices_typical_date: '2026-10-12' }, paper: priorDay }, before), true);
  assert.equal(isShortBoardCurrent({ ...data, board: { prices_typical_date: '2026-10-12' }, paper: priorDay }, after), false);
});

test('shows only short-term candidates with a price from the validated trading day', () => {
  const now = new Date('2026-10-13T12:00:00Z');
  const data = {
    source: 'network',
    paper: report({ generated_at: now.toISOString(), data_date: '2026-10-12', expected_date: '2026-10-12' }),
    board: { prices_typical_date: '2026-10-12', short: [
      { symbol: 'AAA', price_date: '2026-10-12' },
      { symbol: 'OLD', price_date: '2026-10-09' },
      { symbol: 'NONE' },
    ] },
  };
  assert.deepEqual(currentShortCandidates(data, now).map((row) => row.symbol), ['AAA']);
  assert.deepEqual(currentShortCandidates({ ...data, source: 'cache' }, now), []);
});

test('explains why a paper report is paused', () => {
  const now = new Date('2026-10-13T12:00:00Z');
  const paper = report({ generated_at: now.toISOString(), data_date: '2026-10-12', expected_date: '2026-10-12' });
  const data = { source: 'network', paper };
  assert.match(paperPauseMessage({ ...data, source: 'cache' }, now), /离线/);
  assert.match(paperPauseMessage({ ...data, paper: { ...paper, data_date: '2026-10-09' } }, now), /等待 2026-10-12/);
  assert.match(paperPauseMessage({ ...data, paper: { ...paper, coverage: 0.9 } }, now), /覆盖率/);
  assert.match(paperPauseMessage({ ...data, paper: { ...paper, expected_date: '2026-10-09' } }, now), /预期交易日/);
});

test('financial notes call out cash-flow contradictions without making trade calls', () => {
  const notes = financialNotes({ period: '2026-06-30', revenue_growth: -0.05,
    net_income: 100, operating_cashflow: -10, free_cash_flow: -20 });
  assert.equal(notes.length, 3);
  assert.match(notes[0], /营收增长率为负/);
  assert.match(notes[1], /净利润为正，但经营现金流为负/);
  assert.match(notes[2], /自由现金流为负/);
  assert.deepEqual(financialNotes({ period: '2026-06-30', operating_cashflow: 20,
    free_cash_flow: 5 }), ['经营现金流与自由现金流均为正；仍需结合多个财报期及附注判断持续性。']);
  assert.match(financialNotes({ period: '2026-06-30', free_cash_flow: Number.NaN })[0], /暂不作自动解读/);
});

test('does not value simulated holdings from stale or missing marks', () => {
  const paper = { cash: 500, positions: [{ symbol: 'A', shares: 2, mark_price: 100 }] };
  assert.equal(paperEquity(paper, true), 700);
  assert.equal(paperEquity(paper, false), null);
  assert.equal(paperEquity({ ...paper, positions: [{ symbol: 'A', shares: 2, mark_price: null }] }, true), null);
  assert.equal(paperEquity({ ...paper, cash: -1 }, true), null);
  assert.equal(paperEquity({ ...paper, positions: [{ symbol: 'A', shares: 1e300, mark_price: 1e300 }] }, true), null);
});

test('formats invalid financial numbers as missing rather than NaN', () => {
  assert.equal(money(Number.NaN), '—');
  assert.equal(money(Number.POSITIVE_INFINITY), '—');
  assert.equal(percent(Number.NaN), '—');
});

test('loads price bars from the matching shard and rejects invalid prices', async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (String(url).includes('manifest.json')) return { ok: true, json: async () => ({ mobile_shards: 256, generated_at: 12345 }) };
    return { ok: true, json: async () => ({ A: [['2026-10-09', 100, 'yfinance'], ['2026-10-10', -1, 'bad']] }) };
  };
  try {
    assert.deepEqual(await loadPriceHistory('A'), [{ date: '2026-10-09', close: 100, source: 'yfinance' }]);
    assert.match(urls[1], /prices-065\.json\?v=12345$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('refreshes price shards when only the published bundle changes', async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  let builtAt = 111;
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (String(url).includes('manifest.json')) return { ok: true, json: async () => ({ mobile_shards: 256, generated_at: 12345, bundle_built_at: builtAt }) };
    return { ok: true, json: async () => ({ A: [['2026-10-09', builtAt, 'source']] }) };
  };
  try {
    assert.equal((await loadPriceHistory('A'))[0].close, 111);
    builtAt = 222;
    assert.equal((await loadPriceHistory('A'))[0].close, 222);
    assert.match(urls[1], /prices-065\.json\?v=111$/);
    assert.match(urls[3], /prices-065\.json\?v=222$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ignores malformed company-directory rows', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => [null, { symbol: 'A', name: 'Agilent' }] });
  try {
    assert.deepEqual(await loadUniverse(), [{ symbol: 'A', name: 'Agilent' }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('loads the correct company shard and validates its contents', async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (String(url).includes('manifest.json')) return { ok: true, json: async () => ({ mobile_shards: 256, generated_at: 12345 }) };
    return { ok: true, json: async () => ({ A: { profile: { symbol: 'A', name: 'Agilent' }, periods: [{ period: '2025-10-31' }] } }) };
  };
  try {
    const company = await loadCompanyDetail('A');
    assert.equal(company?.profile.symbol, 'A');
    assert.match(urls[1], /companies-065\.json\?v=12345$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects financial details that belong to another company', () => {
  assert.equal(isCompanyDetail({ profile: { symbol: 'B' }, periods: [{ period: '2025-12-31' }] }, 'A'), false);
  assert.equal(isCompanyDetail({ profile: { symbol: 'A' }, periods: [{ symbol: 'B', period: '2025-12-31' }] }, 'A'), false);
  assert.equal(isCompanyDetail({ profile: { symbol: 'A' }, periods: [null] }, 'A'), false);
  assert.equal(isCompanyDetail({ profile: { symbol: 'A' }, periods: [{ period: '2025-12-31' }] }, 'A'), true);
});

test('times out a stalled request with a retryable message', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  });
  try {
    await assert.rejects(fetchJson('https://example.com/data.json', 5), /连接超时，请检查网络后重试/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
