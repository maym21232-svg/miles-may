import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CandidateRow } from '../../components/CandidateRow';
import { currentShortCandidates, isPaperCurrent, isShortBoardCurrent, money, paperEquity, paperPauseMessage, sectorName } from '../../lib/data';
import { useResearch } from '../../lib/ResearchContext';
import { color } from '../../lib/theme';

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { data, now, error, loading, refresh, universe } = useResearch();
  const [term, setTerm] = useState('');
  const [horizon, setHorizon] = useState<'long' | 'short'>('long');
  const [sector, setSector] = useState<string | null>(null);
  const [showMethod, setShowMethod] = useState(false);
  const [visibleCandidates, setVisibleCandidates] = useState(30);
  const [visibleSearch, setVisibleSearch] = useState(30);
  const paperCurrent = !!data && data.source === 'network' && isPaperCurrent(data.paper, now);
  const shortCurrent = !!data && isShortBoardCurrent(data, now);
  const candidates = useMemo(() => {
    const list = horizon === 'short'
      ? data ? currentShortCandidates(data, now) : []
      : data?.board.long ?? [];
    return list.filter((item) => !sector || item.sector === sector);
  }, [data, horizon, now, sector]);
  const searchResults = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return [];
    const rows = universe.length ? universe : [...(data?.board.long ?? []), ...(data?.board.short ?? [])];
    return rows.filter((row) => `${row.symbol} ${row.name ?? ''}`.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.symbol.toLowerCase() === needle) - Number(a.symbol.toLowerCase() === needle)
        || Number(b.symbol.toLowerCase().startsWith(needle)) - Number(a.symbol.toLowerCase().startsWith(needle))
        || a.symbol.localeCompare(b.symbol));
  }, [data, term, universe]);
  const sectors = useMemo(() => [...new Set(candidates.map((item) => item.sector))].sort(), [candidates]);
  const orders = paperCurrent ? data!.paper.pending : [];
  const buys = orders.filter((order) => order.side?.toLowerCase() === 'buy');
  const sells = orders.filter((order) => order.side?.toLowerCase() === 'sell');
  const equity = data ? paperEquity(data.paper, paperCurrent) : null;

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
      {term.trim() ? <>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>搜索结果</Text><Text style={styles.count}>{searchResults.length} 家</Text></View>
        {searchResults.slice(0, visibleSearch).map((item) => <CandidateRow key={item.symbol} candidate={{ symbol: item.symbol, name: item.name ?? item.symbol, sector: item.sector ?? '' }} />)}
        {searchResults.length > visibleSearch && <Pressable accessibilityRole="button" style={styles.more} onPress={() => setVisibleSearch((count) => count + 30)}><Text style={styles.moreText}>加载更多</Text><Ionicons name="chevron-down" size={17} color={color.green} /></Pressable>}
        {!searchResults.length && <Text style={styles.empty}>{loading ? '正在加载公司目录' : '没有匹配的公司'}</Text>}
      </> : data && <>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statLabel}>长线候选</Text><Text style={styles.statValue}>{data.board.long.length} 家</Text></View>
          <View style={[styles.stat, styles.statAmber]}><Text style={styles.statLabel}>每日模拟决策</Text><Text style={[styles.statValue, { color: paperCurrent ? color.green : color.amber }]}>{paperCurrent ? '已更新' : '已暂停'}</Text></View>
        </View>
        {!paperCurrent && <View style={styles.warning}><Ionicons name="warning-outline" size={20} color={color.amber} /><Text style={styles.warningText}>{paperPauseMessage(data, now)}</Text></View>}

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
          {typeof data.paper.starting_cash === 'number' && <Text style={styles.methodLine}>起始模拟资金：{money(data.paper.starting_cash)}</Text>}
          <Text style={styles.methodLine}>虚拟持仓：{data.paper.positions.length} 只　现金：{money(data.paper.cash)}</Text>
          <Text style={styles.methodLine}>{equity === null ? '组合净值：行情不足，暂不估值' : `组合净值：${money(equity)}${typeof data.paper.starting_cash === 'number' && Number.isFinite(data.paper.starting_cash) && data.paper.starting_cash > 0 ? `（${((equity / data.paper.starting_cash - 1) * 100).toFixed(2)}%）` : ''}`}</Text>
          <Text style={styles.methodLine}>{data.paper.method}</Text>
          {!!orders.length && <Text style={styles.methodCaption}>待下个开盘模拟执行</Text>}
          {!orders.length && <Text style={styles.methodLine}>本轮没有待执行的模拟买卖。</Text>}
          {orders.map((order) => <View key={`${order.side}-${order.symbol}`} style={styles.orderReason}>
            <Text style={styles.orderTitle}>{order.side === 'buy' ? '模拟买入' : '模拟卖出'} · {order.symbol}{order.name ? ` · ${order.name}` : ''}</Text>
            <Text style={styles.methodLine}>{order.reason || '未提供决策说明'}</Text>
            {typeof order.reference_close === 'number' && <Text style={styles.methodLine}>参考收盘价 {money(order.reference_close)} · 决策日 {order.decision_date || data.paper.data_date}</Text>}
          </View>)}
          <Text style={styles.methodCaption}>当前虚拟持仓</Text>
          {data.paper.positions.map((position) => <View key={position.symbol} style={styles.orderReason}>
            <Text style={styles.orderTitle}>{position.symbol}{position.name ? ` · ${position.name}` : ''} · {position.shares} 股</Text>
            <Text style={styles.methodLine}>模拟买入 {money(position.entry_price)} · {position.entry_date}{typeof position.mark_price === 'number' ? ` · 最近收盘 ${money(position.mark_price)}` : ''}</Text>
          </View>)}
          {!data.paper.positions.length && <Text style={styles.methodLine}>暂无虚拟持仓。</Text>}
          <Text style={styles.methodCaption}>最近模拟成交</Text>
          {(data.paper.fills ?? []).slice(-5).reverse().map((fill, index) => <Text key={`${fill.date}-${fill.symbol}-${index}`} style={styles.methodLine}>{fill.date} · {fill.side === 'buy' ? '买入' : '卖出'} {fill.symbol} {fill.shares} 股 · {money(fill.price)}</Text>)}
          {!data.paper.fills?.length && <Text style={styles.methodLine}>暂无模拟成交记录。</Text>}
          <Text style={styles.disclaimer}>仅为研究与模拟记录，不构成投资建议；不会实际下单。</Text>
        </View>}

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>发现公司</Text><Text style={styles.count}>{candidates.length} 家</Text></View>
        <View style={styles.segment}>
          {(['long', 'short'] as const).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: horizon === value }} onPress={() => { setHorizon(value); setSector(null); setVisibleCandidates(30); }} style={[styles.segmentItem, horizon === value && styles.segmentActive]}><Text style={[styles.segmentText, horizon === value && styles.segmentTextActive]}>{value === 'long' ? '偏长线' : '偏短线'}</Text></Pressable>)}
        </View>
        <Text style={styles.horizonNote}>{horizon === 'long' ? '1–3 年研究 · 财务质量与现金流符合条件，每季财报后复核。' : '2–6 周观察 · 近 20/60 日趋势符合条件，至少每周复核。'}</Text>
        <Text style={styles.caveat}>条件筛选不是上涨概率，也不是买卖建议。</Text>
        {horizon === 'short' && !shortCurrent && <Text style={styles.staleNote}>行情日期未通过校验，短线候选名单暂停展示。</Text>}
        {horizon === 'short' && shortCurrent && <Text style={styles.horizonNote}>仅展示收盘价已更新到 {data.board.prices_typical_date} 的公司。</Text>}
        {!!sectors.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectors}>
          <Pressable onPress={() => { setSector(null); setVisibleCandidates(30); }} style={[styles.chip, !sector && styles.chipActive]}><Text style={[styles.chipText, !sector && styles.chipTextActive]}>全部</Text></Pressable>
          {sectors.map((name) => <Pressable key={name} onPress={() => { setSector(name); setVisibleCandidates(30); }} style={[styles.chip, sector === name && styles.chipActive]}><Text style={[styles.chipText, sector === name && styles.chipTextActive]}>{sectorName(name)}</Text></Pressable>)}
        </ScrollView>}
        {candidates.slice(0, visibleCandidates).map((item) => <CandidateRow key={item.symbol} candidate={item} short={horizon === 'short'} />)}
        {candidates.length > visibleCandidates && <Pressable accessibilityRole="button" style={styles.more} onPress={() => setVisibleCandidates((count) => count + 30)}><Text style={styles.moreText}>加载更多</Text><Ionicons name="chevron-down" size={17} color={color.green} /></Pressable>}
        {!candidates.length && <Text style={styles.empty}>{horizon === 'short' && !shortCurrent ? '等待有效收盘价更新' : '没有匹配的公司'}</Text>}
        <Text style={styles.footerNote}>{data.source === 'cache' ? '离线缓存' : '联网获取'} · 最后获取 {data.fetchedAt.toLocaleString('zh-CN')}</Text>
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
  methodCaption: { color: color.ink, fontSize: 14, fontWeight: '700', marginTop: 16, marginBottom: 3 },
  orderReason: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line, marginTop: 12, paddingTop: 11 },
  orderTitle: { color: color.ink, fontSize: 14, fontWeight: '700', marginBottom: 3 },
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
  horizonNote: { color: color.muted, fontSize: 13, lineHeight: 19, marginBottom: 7 },
  caveat: { color: color.amber, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  sectors: { gap: 7, paddingBottom: 13 },
  chip: { paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: color.white, borderWidth: 1, borderColor: color.line, justifyContent: 'center' },
  chipActive: { backgroundColor: color.ink },
  chipText: { color: color.muted, fontSize: 13 },
  chipTextActive: { color: color.white },
  empty: { textAlign: 'center', color: color.muted, paddingVertical: 32 },
  more: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: color.white, borderWidth: 1, borderColor: color.line, borderRadius: 13, marginTop: 5 },
  moreText: { color: color.green, fontSize: 14, fontWeight: '700' },
  footerNote: { textAlign: 'center', color: color.muted, fontSize: 12, lineHeight: 18, paddingVertical: 17 },
});
