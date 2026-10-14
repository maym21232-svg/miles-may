import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CandidateRow } from '../../components/CandidateRow';
import { isShortBoardCurrent } from '../../lib/data';
import { useResearch } from '../../lib/ResearchContext';
import { color } from '../../lib/theme';

export default function WatchlistScreen() {
  const insets = useSafeAreaInsets();
  const { data, watchlist, universe, toggleWatchlist } = useResearch();
  const shortCurrent = !!data && isShortBoardCurrent(data);
  const candidates = [...(data?.board.long ?? []), ...(data?.board.short ?? [])];
  const saved = watchlist.map((symbol) => {
    const candidate = candidates.find((item) => item.symbol === symbol);
    if (candidate) return candidate;
    const hit = universe.find((item) => item.symbol === symbol);
    return hit ? { symbol, name: hit.name ?? symbol, sector: hit.sector ?? '' } : undefined;
  });
  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.body, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title}>我的自选</Text>
      <Text style={styles.subtitle}>保存在这台设备上，不会同步到云端。</Text>
      {!watchlist.length && <View style={styles.empty}><Ionicons name="star-outline" size={32} color={color.green} /><Text style={styles.emptyTitle}>还没有自选公司</Text><Text style={styles.emptyCopy}>在公司研究页点击星标，就会出现在这里。</Text><Link href="/" style={styles.link}>去发现公司</Link></View>}
      {saved.map((item, index) => <CandidateRow key={watchlist[index]}
        candidate={item ?? { symbol: watchlist[index], name: watchlist[index], sector: '' }}
        short={shortCurrent && !!item && !data?.board.long.some((long) => long.symbol === item.symbol)}
        onRemove={() => toggleWatchlist(watchlist[index])} />)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background },
  body: { paddingHorizontal: 18 },
  title: { fontSize: 30, fontWeight: '800', color: color.ink },
  subtitle: { fontSize: 14, color: color.muted, marginTop: 8, marginBottom: 25 },
  empty: { alignItems: 'center', paddingVertical: 58, paddingHorizontal: 24, borderRadius: 17, backgroundColor: color.white, borderWidth: 1, borderColor: color.line },
  emptyTitle: { color: color.ink, fontSize: 19, fontWeight: '700', marginTop: 15 },
  emptyCopy: { color: color.muted, fontSize: 14, textAlign: 'center', marginTop: 7, lineHeight: 22 },
  link: { color: color.green, fontSize: 15, fontWeight: '700', marginTop: 18 },
});
