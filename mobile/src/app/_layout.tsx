import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ResearchProvider } from '../lib/ResearchContext';
import { color } from '../lib/theme';

export default function RootLayout() {
  return (
    <ResearchProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: color.background }, headerTintColor: color.ink, headerShadowVisible: false, contentStyle: { backgroundColor: color.background } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="company/[symbol]" options={{ title: '公司研究', headerBackTitle: '返回' }} />
      </Stack>
    </ResearchProvider>
  );
}
