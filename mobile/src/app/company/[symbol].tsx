import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FinancialReport } from '../../components/FinancialReport';
import { PriceHistory } from '../../components/PriceHistory';
import { isShortBoardCurrent, money, percent, sectorName, SITE } from '../../lib/data';
import { useResearch } from '../../lib/ResearchContext';
import { color } from '../../lib/theme';

export default function CompanyScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const insets = useSafeAreaInsets();
  const { data, watchlist, toggleWatchlist, universe } = useResearch();
  const code = (symbol ?? '').toUpperCase();
  const long = data?.board.long.find((item) => item.symbol === code);
  const short = data?.board.short.find((item) => item.symbol === code);
  const shortCurrent = !!data && isShortBoardCurrent(data);
  const catalogHit = universe.find((item) => item.symbol === code);
  const company = long ?? short ?? (catalogHit ? { symbol: code, name: catalogHit.name ?? code, sector: catalogHit.sector ?? '' } : undefined);
  const watched = watchlist.includes(code);
  const rows = long ? [
    ['财报期', long.period ?? '—'],
    ['Piotroski F 分', String(long.piotroski_f ?? '—')],
    ['净资产收益率', percent(long.return_on_equity)],
    ['自由现金流', money(long.free_cash_flow)],
    ['负债权益比', typeof long.debt_to_equity_ratio === 'number' ? long.debt_to_equity_ratio.toFixed(2) : '—'],
  ] : short ? [
    ['价格日期', short?.price_date ?? '—'],
    ['20 日涨跌', percent(short?.return_20d)],
    ['60 日涨跌', percent(short?.return_60d)],
  ] : [['状态', '暂无候选指标']];
  if (long && short) {
    rows.push(['价格日期', short.price_date ?? '—']);
    rows.push(['20 日涨跌', percent(short.return_20d)]);
    rows.push(['60 日涨跌', percent(short.return_60d)]);
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 30 }]}>
      <View style={styles.heading}><View style={{ flex: 1 }}><Text style={styles.symbol}>{code}</Text><Text style={styles.name}>{company?.name ?? '暂未收录'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={watched ? '移出自选' : '加入自选'} onPress={() => toggleWatchlist(code)} style={styles.star}><Ionicons name={watched ? 'star' : 'star-outline'} size={25} color={color.green} /></Pressable></View>
      <Text style={styles.sector}>{sectorName(company?.sector ?? '') || '—'}</Text>
      <View style={styles.notice}><Ionicons name="information-circle-outline" size={19} color={color.amber} /><Text style={styles.noticeText}>这里展示历史公开数据，不是实时行情，也不是买卖建议。请核对财报期与价格日期。</Text></View>
      {short && !shortCurrent && <Text style={styles.stale}>短线行情未通过最新日期校验；下方涨跌幅仅为历史参考。</Text>}
      <Text style={styles.title}>{long ? '基本面概览' : short ? '走势概览' : '公司概览'}</Text>
      <View style={styles.metrics}>{rows.map(([label, value]) => <View style={styles.row} key={label}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>)}</View>
      <PriceHistory symbol={code} />
      <FinancialReport symbol={code} />
      <Pressable accessibilityRole="link" style={styles.open} onPress={() => void Linking.openURL(`${SITE}#/company/${encodeURIComponent(code)}`)}><Text style={styles.openText}>查看完整财报与背调</Text><Ionicons name="open-outline" size={19} color={color.white} /></Pressable>
      <Text style={styles.footnote}>完整报告在网页版打开，包含数据来源与更详细的研究材料。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  body: { paddingHorizontal: 18, paddingTop: 15 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  symbol: { color: color.ink, fontSize: 34, fontWeight: '800' },
  name: { color: color.muted, fontSize: 17, marginTop: 3 },
  star: { width: 48, height: 48, borderRadius: 24, backgroundColor: color.mint, alignItems: 'center', justifyContent: 'center' },
  sector: { alignSelf: 'flex-start', color: color.green, fontSize: 13, backgroundColor: color.mint, borderRadius: 13, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 6, marginTop: 15 },
  notice: { flexDirection: 'row', gap: 9, backgroundColor: color.cream, borderRadius: 14, padding: 14, marginTop: 20 },
  noticeText: { flex: 1, color: color.amber, fontSize: 13, lineHeight: 20 },
  stale: { color: color.amber, fontSize: 13, lineHeight: 19, marginTop: 13 },
  title: { color: color.ink, fontSize: 23, fontWeight: '800', marginTop: 30, marginBottom: 15 },
  metrics: { backgroundColor: color.white, borderWidth: 1, borderColor: color.line, borderRadius: 16, paddingHorizontal: 16 },
  row: { minHeight: 53, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  label: { color: color.muted, fontSize: 14 },
  value: { color: color.ink, fontSize: 15, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  open: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: color.green, borderRadius: 14, minHeight: 51, marginTop: 24 },
  openText: { color: color.white, fontSize: 15, fontWeight: '700' },
  footnote: { textAlign: 'center', color: color.muted, fontSize: 12, lineHeight: 18, marginTop: 12 },
});
