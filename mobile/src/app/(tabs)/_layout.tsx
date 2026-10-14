import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { color } from '../../lib/theme';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: color.green, tabBarInactiveTintColor: color.muted, tabBarStyle: { backgroundColor: color.white, borderTopColor: color.line, height: 64, paddingTop: 5 }, tabBarLabelStyle: { fontSize: 12, fontWeight: '600' } }}>
      <Tabs.Screen name="index" options={{ title: '选股', tabBarIcon: ({ color: tint, size }) => <Ionicons name="compass-outline" color={tint} size={size} /> }} />
      <Tabs.Screen name="watchlist" options={{ title: '自选', tabBarIcon: ({ color: tint, size }) => <Ionicons name="star-outline" color={tint} size={size} /> }} />
      <Tabs.Screen name="status" options={{ title: '数据说明', tabBarIcon: ({ color: tint, size }) => <Ionicons name="document-text-outline" color={tint} size={size} /> }} />
    </Tabs>
  );
}
