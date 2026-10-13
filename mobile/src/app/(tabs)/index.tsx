import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CandidateRow } from '../../components/CandidateRow';
import { isPaperCurrent } from '../../lib/data';
import { useResearch } from '../../lib/ResearchContext';
import { color } from '../../lib/theme';

const sectorNames: Record<string, string> = {
  'Information Technology': '信息技术',
  'Communication Services': '通信服务',
  'Consumer Discretionary': '可选消费',
  'Consumer Staples': '日常消费',
  'Financials': '金融',
  'Health Care': '医疗健康',
  'Industrials': '工业',
  'Energy': '能源',
  'Utilities': '公用事业',
  'Materials': '原材料',
  'Real Estate': '房地产',
};

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { data, error, loading, refresh } = useResearch();
  const [term, setTerm] = useState('');
  const [horizon, setHorizon] = useState<'long' | 'short'>('long');
  const [sector, setSector] = useState<string | null>(null);
  const [showMethod, setShowMethod] = useState(false);
  const paperCurrent = !!data && isPaperCurrent(data.paper);
  const candidates = useMemo(() => {
    const list = data?.board[horizon] ?? [];
    const needle = term.trim().toLowerCase();
    return list.filter((item) => (!sector || item.sector === sector) && (!needle || `${item.symbol} ${item.name}`.toLowerCase().includes(needle)));
  }, [data, horizon, sector, term]);
  const sectors = useMemo(() => [...new Set((data?.board[horizon] ?? []).map((item) => item.sector))].sort(), [data, horizon]);
  const orders = paperCurrent ? data!.paper.pending : [];
  const buys = orders.filter((order) => order.side?.toLowerCase() === 'buy');
  const sells = orders.filter((order) => order.side?.toLowerCase() === 'sell');

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.body, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={color.green} />}>
      <View style={styles.header}>
        <Text style={styles.title}>美股研究</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="刷新数据" onPress={() => void refresh()} style={styles.refresh}><Ionicons name="refresh" size={22} color={color.green} /></Pressable>
      </View>
      <View style={styles.search}>
        <Ionicons name="search-outline" size={23} color={color.muted} />
        <TextInput style={styles.input} placeholder="搜索公司或股票代码" placeholderTextColor="#8A9694" value={term} onChangeText={setTerm} autoCapitalize="none" returnKeyType="search" accessibilityLabel="搜索公司或股票代码" />
        {!!term && <Pressable onPress={() => setTerm('')} accessibilityLabel="清除搜索"><Ionicons name="close-circle" size={20} color={color.muted} /></Pressable>}
      </View>

      {error && <Text style={styles.error}>{error}{data ? '；仍显示上次获取的数据。' : ''}</Text>}
      {!data && loading && <ActivityIndicator color={color.green} style={{ marginTop: 35 }} />}
      {data && <>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statLabel}>长线候选</Text><Text style={styles.statValue}>{data.board.long.length} 家</Text></View>
          <View style={[styles.stat, styles.statAmber]}><Text style={styles.statLabel}>每日模拟决策</Text><Text style={[styles.statValue, { color: paperCurrent ? color.green : color.amber }]}>{paperCurrent ? '已更新' : '已暂停'}</Text></View>
        </View>
        {!paperCurrent && <View style={styles.warning}><Ionicons name="warning-outline" size={20} color={color.amber} /><Text style={styles.warningText}>{data.paper.reason || '行情日期不足，模拟买卖暂停。'}</Text></View>}

        <View style={[styles.signal, { backgroundColor: color.mint }]}>
          <View style={[styles.signalIcon, { backgroundColor: color.green }]}><Ionicons name="arrow-up" color={color.white} size={22} /></View>
          <View style={styles.signalMain}><Text style={styles.signalTitle}>模拟买入</Text><Text style={styles.signalNumber}>{buys.length}</Text></View>
          <Text style={styles.signalAside}>{buys.length ? buys.map((item) => item.symbol).join(' · ') : '暂无有效信号'}</Text>
        </View>
        <View style={[styles.signal, { backgroundColor: color.blush }]}>
          <View style={[styles.signalIcon, { backgroundColor: color.red }]}><Ionicons name="arrow-down" color={color.white} size={22} /></View>
          <View style={styles.signalMain}><Text style={[styles.signalTitle, { color: color.red }]}>模拟卖出</Text><Text style={[styles.signalNumber, { color: color.red }]}>{sells.length}</Text></View>
          <Text style={[styles.signalAside, { color: color.red }]}>{sells.length ? sells.map((item) => item.symbol).join(' · ') : '暂无有效信号'}</Text>
        </View>
        <Pressable style={styles.methodToggle} accessibilityRole="button" accessibilityState={{ expanded: showMethod }} onPress={() => setShowMethod(!showMethod)}>
          <Ionicons name="document-text-outline" size={21} color={color.muted} /><Text style={styles.methodLabel}>虚拟仓与决策依据</Text><Ionicons name={showMethod ? 'chevron-up' : 'chevron-down'} size={19} color={color.muted} />
        </Pressable>
        {showMethod && <View style={styles.methodBody}>
          <Text style={styles.methodLine}>数据日期：{data.paper.data_date}　预期：{data.paper.expected_date}</Text>
          <Text style={styles.methodLine}>虚拟持仓：{data.paper.positions.length} 只　现金：${data.paper.cash.toLocaleString('en-US')}</Text>
          <Text style={styles.methodLine}>{data.paper.method}</Text>
          <Text style={styles.disclaimer}>仅为研究与模拟记录，不构成投资建议；不会实际下单。</Text>
        </View>}

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>发现公司</Text><Text style={styles.count}>{candidates.length} 家</Text></View>
        <View style={styles.segment}>
          {(['long', 'short'] as const).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: horizon === value }} onPress={() => { setHorizon(value); setSector(null); }} style={[styles.segmentItem, horizon === value && styles.segmentActive]}><Text style={[styles.segmentText, horizon === value && styles.segmentTextActive]}>{value === 'long' ? '偏长线' : '偏短线'}</Text></Pressable>)}
        </View>
        {horizon === 'short' && !paperCurrent && <Text style={styles.staleNote}>以下仅供历史研究，短线行情未更新，不是当前交易信号。</Text>}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectors}>
          <Pressable onPress={() => setSector(null)} style={[styles.chip, !sector && styles.chipActive]}><Text style={[styles.chipText, !sector && styles.chipTextActive]}>全部</Text></Pressable>
          {sectors.map((name) => <Pressable key={name} onPress={() => setSector(name)} style={[styles.chip, sector === name && styles.chipActive]}><Text style={[styles.chipText, sector === name && styles.chipTextActive]}>{sectorNames[name] ?? name}</Text></Pressable>)}
        </ScrollView>
        {candidates.slice(0, 30).map((item) => <CandidateRow key={item.symbol} candidate={item} short={horizon === 'short'} />)}
        {candidates.length > 30 && <Text style={styles.footerNote}>当前显示前 30 家，请用搜索或行业筛选查看更多。</Text>}
        {!candidates.length && <Text style={styles.empty}>没有匹配的公司</Text>}
        <Text style={styles.footerNote}>数据来自公开财报与行情处理流程 · 最后获取 {data.fetchedAt.toLocaleString('zh-CN')}</Text>
      </>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  body: { paddingHorizontal: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 19 },
  title: { fontSize: 31, fontWeight: '800', color: color.ink },
  refresh: { width: 42, height: 42, borderRadius: 21, backgroundColor: color.mint, alignItems: 'center', justifyContent: 'center' },
  search: { height: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, borderRadius: 15, borderWidth: 1, borderColor: color.line, backgroundColor: color.white, marginBottom: 18 },
  input: { flex: 1, fontSize: 16, color: color.ink },
  error: { color: color.red, fontSize: 13, marginBottom: 13 },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stat: { flex: 1, backgroundColor: color.mint, borderRadius: 15, padding: 15, minHeight: 83 },
  statAmber: { backgroundColor: color.cream },
  statLabel: { color: color.muted, fontSize: 13 },
  statValue: { color: color.ink, fontWeight: '800', fontSize: 21, marginTop: 5 },
  warning: { flexDirection: 'row', gap: 9, backgroundColor: color.cream, borderRadius: 13, padding: 13, marginBottom: 14 },
  warningText: { color: color.amber, fontSize: 13, lineHeight: 19, flex: 1 },
  signal: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 91, borderRadius: 17, paddingHorizontal: 15, marginBottom: 10 },
  signalIcon: { width: 39, height: 39, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  signalMain: { minWidth: 90 },
  signalTitle: { fontSize: 15, fontWeight: '700', color: color.green },
  signalNumber: { fontSize: 28, fontWeight: '800', color: color.ink },
  signalAside: { flex: 1, textAlign: 'right', color: color.green, fontSize: 13 },
  methodToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 55, paddingHorizontal: 13, borderWidth: 1, borderColor: color.line, borderRadius: 14, backgroundColor: color.white, marginTop: 2 },
  methodLabel: { flex: 1, color: color.ink, fontSize: 15, fontWeight: '600' },
  methodBody: { padding: 14, backgroundColor: color.white, borderRadius: 14, marginTop: 5 },
  methodLine: { color: color.muted, fontSize: 13, lineHeight: 22 },
  disclaimer: { color: color.amber, fontSize: 12, lineHeight: 18, marginTop: 7 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 9, marginTop: 29, marginBottom: 14 },
  sectionTitle: { color: color.ink, fontSize: 25, fontWeight: '800' },
  count: { color: color.muted, fontSize: 14 },
  segment: { flexDirection: 'row', backgroundColor: '#E9EFED', padding: 4, borderRadius: 13, marginBottom: 13 },
  segmentItem: { flex: 1, height: 42, justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
  segmentActive: { backgroundColor: color.green },
  segmentText: { color: color.muted, fontSize: 15, fontWeight: '700' },
  segmentTextActive: { color: color.white },
  staleNote: { color: color.amber, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  sectors: { gap: 7, paddingBottom: 13 },
  chip: { paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: color.white, borderWidth: 1, borderColor: color.line, justifyContent: 'center' },
  chipActive: { backgroundColor: color.ink },
  chipText: { color: color.muted, fontSize: 13 },
  chipTextActive: { color: color.white },
  empty: { textAlign: 'center', color: color.muted, paddingVertical: 32 },
  footerNote: { textAlign: 'center', color: color.muted, fontSize: 12, lineHeight: 18, paddingVertical: 17 },
});
