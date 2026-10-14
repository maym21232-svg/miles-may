import assert from 'node:assert/strict';
import test from 'node:test';
import { isPaperCurrent, loadCompanyDetail, sectorName } from '../src/lib/data.ts';

function report(overrides = {}) {
  return {
    status: 'ready',
    generated_at: new Date().toISOString(),
    data_date: '2026-10-12',
    expected_date: '2026-10-12',
    ...overrides,
  };
}

test('accepts only a fresh, ready report covering its expected trading date', () => {
  assert.equal(isPaperCurrent(report()), true);
  assert.equal(isPaperCurrent(report({ status: 'paused' })), false);
  assert.equal(isPaperCurrent(report({ data_date: '2026-10-09' })), false);
  assert.equal(isPaperCurrent(report({ generated_at: new Date(Date.now() - 37 * 60 * 60_000).toISOString() })), false);
  assert.equal(isPaperCurrent(report({ generated_at: new Date(Date.now() + 10 * 60_000).toISOString() })), false);
  assert.equal(isPaperCurrent(report({ generated_at: 'invalid' })), false);
});

test('translates known sectors without inventing unknown ones', () => {
  assert.equal(sectorName('Health Care'), '医疗健康');
  assert.equal(sectorName('Unclassified'), 'Unclassified');
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
