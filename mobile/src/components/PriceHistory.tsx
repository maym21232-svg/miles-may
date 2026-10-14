import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import { loadPriceHistory } from '../lib/data';
import { color } from '../lib/theme';
import type { PriceBar } from '../lib/types';

const ranges = [
  { label: '1 月', bars: 22 },
  { label: '3 月', bars: 66 },
  { label: '1 年', bars: 252 },
];

export function PriceHistory({ symbol }: { symbol: string }) {
  const [bars, setBars] = useState<PriceBar[]>([]);
  const [range, setRange] = useState(1);
  const [loading, setLoading] = useState(true);
  const [cached, setCached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheKey = `miles-may-prices-${symbol}-v1`;

  useEffect(() => {
    let active = true;
    let hadCache = false;
    AsyncStorage.getItem(cacheKey)
      .then((saved) => {
        if (!saved) return;
        const parsed: unknown = JSON.parse(saved);
        if (active && Array.isArray(parsed)) {
          const savedBars = parsed.filter((row): row is PriceBar => !!row && typeof row.date === 'string' && typeof row.close === 'number' && Number.isFinite(row.close) && row.close > 0);
          if (savedBars.length) {
            hadCache = true;
            setBars(savedBars);
            setCached(true);
          }
        }
      })
      .catch(() => undefined)
      .then(() => loadPriceHistory(symbol))
      .then((result) => {
        if (!active) return;
        if (!result.length && hadCache) {
          setError('本次源数据为空，继续显示本机保存的历史走势。');
          return;
        }
        setBars(result);
        setCached(false);
        setError(null);
        void AsyncStorage.setItem(cacheKey, JSON.stringify(result)).catch(() => undefined);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : '走势获取失败'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cacheKey, symbol]);

  const retry = async () => {
    setLoading(true);
    try {
      const result = await loadPriceHistory(symbol);
      if (!result.length && bars.length) {
        setError('本次源数据为空，继续显示本机保存的历史走势。');
        setCached(true);
        return;
      }
      setBars(result);
      setCached(false);
      setError(null);
      void AsyncStorage.setItem(cacheKey, JSON.stringify(result)).catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '走势获取失败');
    } finally {
      setLoading(false);
    }
  };

  const chart = useMemo(() => {
    const rows = bars.slice(-ranges[range].bars);
    if (rows.length < 2) return null;
    const closes = rows.map((bar) => bar.close);
    const low = Math.min(...closes);
    const high = Math.max(...closes);
    const spread = high - low || high * 0.01 || 1;
    const points = closes.map((close, index) => `${(index / (rows.length - 1) * 320).toFixed(2)},${(132 - (close - low) / spread * 116).toFixed(2)}`).join(' ');
    const change = (closes[closes.length - 1] / closes[0] - 1) * 100;
    return { rows, points, low, high, change };
  }, [bars, range]);

  const latest = bars[bars.length - 1];
  const lineColor = chart && chart.change < 0 ? color.red : color.green;
  return (
    <View style={styles.section}>
      <View style={styles.heading}><Text style={styles.title}>历史收盘走势</Text>{loading && <ActivityIndicator color={color.green} />}</View>
      <Text style={styles.subtitle}>非实时行情 · 仅供历史研究</Text>
      {cached && <Text style={styles.notice}>当前显示本机保存的价格记录。</Text>}
      {error && <View style={styles.errorRow}><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void retry()}><Text style={styles.retry}>重试</Text></Pressable></View>}
      {latest && <View style={styles.summary}><View><Text style={styles.summaryLabel}>最近收盘 · {latest.date}</Text><Text style={styles.close}>${latest.close.toFixed(2)}</Text></View>{chart && <Text style={[styles.change, { color: lineColor }]}>{chart.change >= 0 ? '+' : ''}{chart.change.toFixed(1)}%</Text>}</View>}
      {!!bars.length && <View style={styles.segment}>{ranges.map((item, index) => <Pressable key={item.label} accessibilityRole="button" accessibilityState={{ selected: range === index }} style={[styles.segmentItem, range === index && styles.segmentActive]} onPress={() => setRange(index)}><Text style={[styles.segmentText, range === index && styles.segmentTextActive]}>{item.label}</Text></Pressable>)}</View>}
      {chart && <View style={styles.plot}>
        <Svg width="100%" height={148} viewBox="0 0 320 148" accessibilityLabel={`${ranges[range].label}历史收盘价走势，从 ${chart.rows[0].date} 到 ${latest.date}`}>
          <Line x1="0" y1="74" x2="320" y2="74" stroke={color.line} strokeWidth="1" />
          <Line x1="0" y1="132" x2="320" y2="132" stroke={color.line} strokeWidth="1" />
          <Polyline points={chart.points} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        </Svg>
        <View style={styles.axis}><Text style={styles.axisText}>{chart.rows[0].date}</Text><Text style={styles.axisText}>{latest.date}</Text></View>
        <Text style={styles.extremes}>区间最低 ${chart.low.toFixed(2)} · 最高 ${chart.high.toFixed(2)}</Text>
      </View>}
      {!chart && !loading && <Text style={styles.empty}>价格记录不足，暂不能绘制走势。</Text>}
      {latest && <Text style={styles.source}>数据提供方：{latest.source || '未标明'} · 价格可能延迟或缺失，交易前请核对正式行情。</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 29 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: color.ink, fontSize: 23, fontWeight: '800' },
  subtitle: { color: color.muted, fontSize: 13, marginTop: 5, marginBottom: 12 },
  summary: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { color: color.muted, fontSize: 13 },
  close: { color: color.ink, fontSize: 27, fontWeight: '800', marginTop: 3 },
  change: { fontSize: 18, fontWeight: '800', paddingBottom: 4 },
  segment: { flexDirection: 'row', padding: 4, backgroundColor: '#E9EFED', borderRadius: 12, marginBottom: 12 },
  segmentItem: { flex: 1, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: color.green },
  segmentText: { color: color.muted, fontSize: 13, fontWeight: '700' },
  segmentTextActive: { color: color.white },
  plot: { backgroundColor: color.white, borderRadius: 15, borderWidth: 1, borderColor: color.line, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  axisText: { color: color.muted, fontSize: 12 },
  extremes: { color: color.muted, fontSize: 12, textAlign: 'center', marginTop: 6 },
  source: { color: color.muted, fontSize: 12, lineHeight: 18, marginTop: 10 },
  notice: { color: color.amber, fontSize: 13, marginBottom: 9 },
  errorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  error: { flex: 1, color: color.red, fontSize: 13 },
  retry: { color: color.green, fontSize: 13, fontWeight: '700' },
  empty: { color: color.muted, fontSize: 14, marginBottom: 10 },
});
