import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadResearch } from './data';
import type { ResearchData } from './types';

const WATCHLIST_KEY = 'miles-may-watchlist-v1';

type ResearchContextValue = {
  data: ResearchData | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  watchlist: string[];
  toggleWatchlist: (symbol: string) => void;
};

const ResearchContext = createContext<ResearchContextValue | null>(null);

export function ResearchProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<ResearchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchlistReady, setWatchlistReady] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadResearch());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂时无法连接数据源');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResearch()
      .then((result) => { setData(result); setError(null); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : '暂时无法连接数据源'))
      .finally(() => setLoading(false));
    AsyncStorage.getItem(WATCHLIST_KEY)
      .then((saved) => {
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (Array.isArray(parsed)) setWatchlist(parsed.filter((item): item is string => typeof item === 'string'));
        }
      })
      .catch(() => undefined)
      .finally(() => setWatchlistReady(true));
  }, []);

  useEffect(() => {
    if (watchlistReady) void AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  }, [watchlist, watchlistReady]);

  const toggleWatchlist = useCallback((symbol: string) => {
    setWatchlist((current) => current.includes(symbol)
      ? current.filter((item) => item !== symbol)
      : [...current, symbol]);
  }, []);

  const value = useMemo(() => ({ data, error, loading, refresh, watchlist, toggleWatchlist }),
    [data, error, loading, refresh, watchlist, toggleWatchlist]);
  return <ResearchContext.Provider value={value}>{children}</ResearchContext.Provider>;
}

export function useResearch(): ResearchContextValue {
  const value = useContext(ResearchContext);
  if (!value) throw new Error('ResearchProvider is missing');
  return value;
}
