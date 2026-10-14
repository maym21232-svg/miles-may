import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { loadCompanyDetail, money, percent } from '../lib/data';
import { color } from '../lib/theme';
import type { CompanyDetail, FinancialPeriod } from '../lib/types';

function sourceLink(provider: string, symbol: string): { label: string; url: string } | null {
  if (provider === 'edgar' || provider === 'fsds') return {
    label: '查看 SEC 申报文件',
    url: `https://www.sec.gov/edgar/browse/?CIK=${encodeURIComponent(symbol)}&owner=exclude`,
  };
  if (provider === 'defeatbeta') return {
    label: '查看第三方数据集',
    url: 'https://huggingface.co/datasets/defeatbeta/yahoo-finance-data',
  };
  if (provider === 'yfinance') return {
    label: '查看 Yahoo Finance 来源',
    url: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
  };
  if (provider === 'esef') return { label: '查看 ESEF 申报文件', url: 'https://filings.xbrl.org/' };
  return null;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
}

function PeriodRow({ period }: { period: FinancialPeriod }) {
  return (
    <View style={styles.period}>
      <Text style={styles.periodDate}>{period.period}</Text>
      <Text style={styles.periodNumbers}>营收 {money(period.revenue ?? undefined)}  ·  净利润 {money(period.net_income ?? undefined)}</Text>
      <Text style={styles.periodNumbers}>自由现金流 {money(period.free_cash_flow ?? undefined)}</Text>
    </View>
  );
}

export function FinancialReport({ symbol }: { symbol: string }) {
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cacheKey = `miles-may-company-${symbol}-v1`;

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(cacheKey)
      .then((saved) => {
        if (!saved) return;
        const parsed: unknown = JSON.parse(saved);
        if (active && parsed && typeof parsed === 'object' && Array.isArray((parsed as CompanyDetail).periods)) {
          setDetail(parsed as CompanyDetail);
          setCached(true);
        }
      })
      .catch(() => undefined)
      .then(() => loadCompanyDetail(symbol))
      .then((result) => {
        if (!active) return;
        setDetail(result);
        setCached(false);
        setError(null);
        if (result) void AsyncStorage.setItem(cacheKey, JSON.stringify(result)).catch(() => undefined);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : '财报获取失败'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cacheKey, symbol]);

  const retry = async () => {
    setLoading(true);
    try {
      const result = await loadCompanyDetail(symbol);
      setDetail(result);
      setCached(false);
      setError(null);
      if (result) void AsyncStorage.setItem(cacheKey, JSON.stringify(result)).catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '财报获取失败');
    } finally {
      setLoading(false);
    }
  };

  const latest = detail?.periods[0];
  const provenance = sourceLink(latest?.provider ?? '', symbol);
  const computedAt = latest?.computed_at ? new Date(latest.computed_at * 1000) : null;
  return (
    <View>
      <View style={styles.heading}><Text style={styles.title}>财报分析</Text>{loading && <ActivityIndicator color={color.green} />}</View>
      {cached && <Text style={styles.notice}>当前显示本机保存的财报，请核对报告日期。</Text>}
      {error && <View style={styles.errorRow}><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void retry()}><Text style={styles.retry}>重试</Text></Pressable></View>}
      {!detail && !loading && <Text style={styles.empty}>暂无可用的公司财报，完整资料可在网页版查看。</Text>}
      {latest && <>
        <Text style={styles.periodTitle}>最近财报期 · {latest.period}</Text>
        <View style={styles.metrics}>
          <Metric label="营收" value={money(latest.revenue ?? undefined)} />
          <Metric label="营收增长" value={percent(latest.revenue_growth ?? undefined)} />
          <Metric label="净利润" value={money(latest.net_income ?? undefined)} />
          <Metric label="经营现金流" value={money(latest.operating_cashflow ?? undefined)} />
          <Metric label="自由现金流" value={money(latest.free_cash_flow ?? undefined)} />
          <Metric label="F 分" value={typeof latest.piotroski_f === 'number' ? String(latest.piotroski_f) : '—'} />
        </View>
        <Text style={styles.subtitle}>历年对照</Text>
        <View style={styles.history}>{detail?.periods.slice(0, 3).map((period) => <PeriodRow key={period.period} period={period} />)}</View>
        <Text style={styles.source}>来源：{latest.provider || '未标明'}{computedAt && !Number.isNaN(computedAt.getTime()) ? `  ·  整理于 ${computedAt.toLocaleDateString('zh-CN')}` : ''}</Text>
        {provenance && <Pressable accessibilityRole="link" style={styles.sourceLink} onPress={() => void Linking.openURL(provenance.url)}><Text style={styles.sourceLinkText}>{provenance.label}</Text><Ionicons name="open-outline" size={16} color={color.green} /></Pressable>}
        <Text style={styles.caveat}>增长率及 F 分为基于源数据的计算值；缺失项不填充。财报期不是最新交易日。</Text>
      </>}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 29, marginBottom: 11 },
  title: { color: color.ink, fontSize: 23, fontWeight: '800' },
  periodTitle: { color: color.muted, fontSize: 13, marginBottom: 10 },
  metrics: { backgroundColor: color.white, borderWidth: 1, borderColor: color.line, borderRadius: 16, paddingHorizontal: 16 },
  metric: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  label: { color: color.muted, fontSize: 14 },
  value: { color: color.ink, fontSize: 15, fontWeight: '700', textAlign: 'right' },
  subtitle: { color: color.ink, fontSize: 18, fontWeight: '700', marginTop: 22, marginBottom: 10 },
  history: { backgroundColor: color.white, borderWidth: 1, borderColor: color.line, borderRadius: 16, paddingHorizontal: 16 },
  period: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line, paddingVertical: 11 },
  periodDate: { color: color.ink, fontSize: 14, fontWeight: '700' },
  periodNumbers: { color: color.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  source: { color: color.muted, fontSize: 12, lineHeight: 18, marginTop: 15 },
  sourceLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  sourceLinkText: { color: color.green, fontSize: 13, fontWeight: '700' },
  caveat: { color: color.muted, fontSize: 12, lineHeight: 18, marginTop: 12 },
  notice: { color: color.amber, fontSize: 13, marginBottom: 9 },
  errorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  error: { flex: 1, color: color.red, fontSize: 13 },
  retry: { color: color.green, fontSize: 13, fontWeight: '700' },
  empty: { color: color.muted, fontSize: 14, lineHeight: 21, marginBottom: 9 },
});
