import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { loadResearch, loadUniverse } from './data';
import type { ResearchData, SearchHit } from './types';

const WATCHLIST_KEY = 'miles-may-watchlist-v1';
const DATA_KEY = 'miles-may-research-v1';
const UNIVERSE_KEY = 'miles-may-universe-v1';

function cachedResearch(saved: string | null): ResearchData | null {
  if (!saved) return null;
  const parsed: unknown = JSON.parse(saved);
  if (!parsed || typeof parsed !== 'object') return null;
  const value = parsed as Partial<ResearchData>;
  if (!Array.isArray(value.board?.long) || !Array.isArray(value.board?.short) || !Array.isArray(value.paper?.pending)) return null;
  const fetchedAt = new Date(value.fetchedAt as unknown as string);
  if (Number.isNaN(fetchedAt.getTime())) return null;
  return { board: value.board, paper: value.paper, fetchedAt, source: 'cache' };
}

type ResearchContextValue = {
  data: ResearchData | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  watchlist: string[];
  toggleWatchlist: (symbol: string) => void;
  universe: SearchHit[];
};

const ResearchContext = createContext<ResearchContextValue | null>(null);

export function ResearchProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<ResearchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [universe, setUniverse] = useState<SearchHit[]>([]);
  const [watchlistReady, setWatchlistReady] = useState(false);
  const lastRefreshAttempt = useRef(0);
  const lastUniverseAttempt = useRef(0);
  const researchRequest = useRef(0);
  const universeRequest = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++researchRequest.current;
    lastRefreshAttempt.current = Date.now();
    if (Date.now() - lastUniverseAttempt.current >= 24 * 60 * 60_000) {
      lastUniverseAttempt.current = Date.now();
      const catalogRequest = ++universeRequest.current;
      void loadUniverse()
        .then((rows) => {
          if (catalogRequest !== universeRequest.current) return;
          setUniverse(rows);
          void AsyncStorage.setItem(UNIVERSE_KEY, JSON.stringify(rows)).catch(() => undefined);
        })
        .catch(() => { if (catalogRequest === universeRequest.current) lastUniverseAttempt.current = 0; });
    }
    setLoading(true);
    try {
      const result = await loadResearch();
      if (request !== researchRequest.current) return;
      setData(result);
      void AsyncStorage.setItem(DATA_KEY, JSON.stringify(result)).catch(() => undefined);
      setError(null);
    } catch (cause) {
      if (request !== researchRequest.current) return;
      setData((current) => current ? { ...current, source: 'cache' } : null);
      setError(cause instanceof Error ? cause.message : '暂时无法连接数据源');
    } finally {
      if (request === researchRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const request = ++researchRequest.current;
    lastRefreshAttempt.current = Date.now();
    const catalogRequest = ++universeRequest.current;
    lastUniverseAttempt.current = Date.now();
    AsyncStorage.getItem(DATA_KEY)
      .then((saved) => { const cached = cachedResearch(saved); if (cached && request === researchRequest.current) setData(cached); })
      .catch(() => undefined)
      .then(() => loadResearch())
      .then((result) => {
        if (request !== researchRequest.current) return;
        setData(result);
        setError(null);
        void AsyncStorage.setItem(DATA_KEY, JSON.stringify(result)).catch(() => undefined);
      })
      .catch((cause) => {
        if (request !== researchRequest.current) return;
        setData((current) => current ? { ...current, source: 'cache' } : null);
        setError(cause instanceof Error ? cause.message : '暂时无法连接数据源');
      })
      .finally(() => { if (request === researchRequest.current) setLoading(false); });
    AsyncStorage.getItem(UNIVERSE_KEY)
      .then((saved) => {
        if (!saved) return;
        const parsed: unknown = JSON.parse(saved);
        if (catalogRequest === universeRequest.current && Array.isArray(parsed)) setUniverse(parsed.filter((row): row is SearchHit => !!row && typeof row.symbol === 'string'));
      })
      .catch(() => undefined)
      .then(() => loadUniverse())
      .then((rows) => {
        if (catalogRequest !== universeRequest.current) return;
        setUniverse(rows);
        void AsyncStorage.setItem(UNIVERSE_KEY, JSON.stringify(rows)).catch(() => undefined);
      })
      .catch(() => { if (catalogRequest === universeRequest.current) lastUniverseAttempt.current = 0; });
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
    const maybeRefresh = () => {
      if (Date.now() - lastRefreshAttempt.current >= 15 * 60_000) void refresh();
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') maybeRefresh();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') maybeRefresh();
    }, 15 * 60_000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [refresh]);

  useEffect(() => {
    if (watchlistReady) void AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist)).catch(() => undefined);
  }, [watchlist, watchlistReady]);

  const toggleWatchlist = useCallback((symbol: string) => {
    setWatchlist((current) => current.includes(symbol)
      ? current.filter((item) => item !== symbol)
      : [...current, symbol]);
  }, []);

  const value = useMemo(() => ({ data, error, loading, refresh, watchlist, toggleWatchlist, universe }),
    [data, error, loading, refresh, watchlist, toggleWatchlist, universe]);
  return <ResearchContext.Provider value={value}>{children}</ResearchContext.Provider>;
}

export function useResearch(): ResearchContextValue {
  const value = useContext(ResearchContext);
  if (!value) throw new Error('ResearchProvider is missing');
  return value;
}
