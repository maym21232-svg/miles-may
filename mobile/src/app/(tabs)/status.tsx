import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isPaperCurrent, paperPauseMessage, percent } from '../../lib/data';
import { useResearch } from '../../lib/ResearchContext';
import { color } from '../../lib/theme';

function Fact({ label, value }: { label: string; value: string }) {
  return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>;
}

function ExternalLink({ title, url }: { title: string; url: string }) {
  return <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(url)} style={styles.link}><Text style={styles.linkText}>{title}</Text><Ionicons name="open-outline" size={17} color={color.green} /></Pressable>;
}

export default function StatusScreen() {
  const insets = useSafeAreaInsets();
  const { data, now, error, loading, refresh, universe } = useResearch();
  const current = !!data && data.source === 'network' && isPaperCurrent(data.paper, now);
  const snapshot = data?.board.generated_at ? new Date(data.board.generated_at * 1000) : null;
  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.body, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 30 }]} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={color.green} />}>
      <View style={styles.header}><Text style={styles.title}>数据说明</Text><Pressable accessibilityRole="button" accessibilityLabel="刷新数据" style={styles.refresh} onPress={() => void refresh()}><Ionicons name="refresh" color={color.green} size={22} /></Pressable></View>
      <Text style={styles.lead}>这里的财报与行情用于研究，不是交易所实时行情。模拟买卖仅在数据校验通过时展示。</Text>
      {error && <Text style={styles.error}>最近一次联网失败：{error}</Text>}
      <Text style={styles.sectionTitle}>当前状态</Text>
      <View style={styles.facts}>
        <Fact label="获取方式" value={data?.source === 'network' ? '联网' : data ? '本机缓存' : '尚未获取'} />
        <Fact label="上次获取" value={data?.fetchedAt.toLocaleString('zh-CN') ?? '—'} />
        <Fact label="公司目录" value={universe.length ? `${universe.length.toLocaleString('zh-CN')} 家` : '尚未加载'} />
        <Fact label="研究快照生成" value={snapshot && !Number.isNaN(snapshot.getTime()) ? snapshot.toLocaleString('zh-CN') : '—'} />
        <Fact label="典型行情日期" value={data?.board.prices_typical_date ?? '—'} />
        <Fact label="模拟决策" value={current ? '可用' : '暂停'} />
        <Fact label="模拟数据日期" value={data?.paper.data_date ?? '—'} />
        <Fact label="预期交易日期" value={data?.paper.expected_date ?? '—'} />
        <Fact label="行情覆盖" value={data ? percent(data.paper.coverage) : '—'} />
      </View>
      {!current && data && <View style={styles.warning}><Ionicons name="warning-outline" size={19} color={color.amber} /><Text style={styles.warningText}>{paperPauseMessage(data, now)}</Text></View>}

      <Text style={styles.sectionTitle}>更新方式</Text>
      <Text style={styles.copy}>网页数据由 GitHub Actions 每日尝试重建。快照生成时间变新，不代表上游提供了新收盘价；请以典型行情日期为准。App 打开后联网加载，下拉或点刷新按钮可以手动更新；留在前台或重新回到前台超过 15 分钟时会再次检查。iOS 后台不保证持续运行，源数据更新失败时也不会产生新行情。</Text>
      <Text style={styles.sectionTitle}>来源与核对</Text>
      <Text style={styles.copy}>本应用从公开的 GitHub Pages 数据文件读取研究结果。处理流程与上游清单可公开核对；每家公司财报页还会显示其对应的提供方或申报来源。</Text>
      <ExternalLink title="查看上游数据清单" url="https://maxgfr.github.io/crible/data/manifest.json" />
      <ExternalLink title="查看数据处理脚本" url="https://github.com/maym21232-svg/miles-may/blob/main/scripts/refresh_mobile_data.mjs" />
      <Text style={styles.disclaimer}>本应用不提供证券交易，也不承诺收益。筛选、评分和模拟仓位不构成个人投资建议。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  body: { paddingHorizontal: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: color.ink, fontSize: 30, fontWeight: '800' },
  refresh: { width: 42, height: 42, borderRadius: 21, backgroundColor: color.mint, alignItems: 'center', justifyContent: 'center' },
  lead: { color: color.muted, fontSize: 14, lineHeight: 22, marginTop: 13 },
  sectionTitle: { color: color.ink, fontSize: 21, fontWeight: '800', marginTop: 28, marginBottom: 12 },
  facts: { backgroundColor: color.white, borderWidth: 1, borderColor: color.line, borderRadius: 16, paddingHorizontal: 15 },
  fact: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  factLabel: { color: color.muted, fontSize: 13 },
  factValue: { color: color.ink, fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  warning: { flexDirection: 'row', gap: 9, backgroundColor: color.cream, borderRadius: 13, padding: 13, marginTop: 12 },
  warningText: { flex: 1, color: color.amber, fontSize: 13, lineHeight: 19 },
  copy: { color: color.muted, fontSize: 14, lineHeight: 23 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  linkText: { color: color.green, fontSize: 14, fontWeight: '700' },
  disclaimer: { color: color.muted, fontSize: 12, lineHeight: 19, marginTop: 27 },
  error: { color: color.red, fontSize: 13, marginTop: 10 },
});
