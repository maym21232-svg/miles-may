import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { percent } from '../lib/data';
import { color } from '../lib/theme';
import type { Candidate } from '../lib/types';

export function CandidateRow({ candidate, short = false }: { candidate: Candidate; short?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`查看 ${candidate.name} 公司研究`}
      onPress={() => router.push({ pathname: '/company/[symbol]', params: { symbol: candidate.symbol } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.badge}><Text style={styles.badgeText}>{candidate.symbol.slice(0, 3)}</Text></View>
      <View style={styles.content}>
        <Text style={styles.symbol}>{candidate.symbol}</Text>
        <Text style={styles.name} numberOfLines={1}>{candidate.name}</Text>
        <Text style={styles.metric} numberOfLines={1}>
          {short ? `20日 ${percent(candidate.return_20d)}  ·  60日 ${percent(candidate.return_60d)}` : `F分 ${candidate.piotroski_f ?? '—'}  ·  ROE ${percent(candidate.return_on_equity)}`}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color={color.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: color.white, borderWidth: 1, borderColor: color.line, borderRadius: 15, paddingHorizontal: 14, marginBottom: 8 },
  pressed: { opacity: 0.65 },
  badge: { width: 48, height: 48, borderRadius: 13, backgroundColor: color.mint, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 12, fontWeight: '800', color: color.green },
  content: { flex: 1, minWidth: 0 },
  symbol: { color: color.ink, fontSize: 18, fontWeight: '800' },
  name: { color: color.muted, fontSize: 14, marginTop: 2 },
  metric: { color: color.green, fontSize: 12, marginTop: 3 },
});
