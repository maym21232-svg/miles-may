// FR-007 / T-016 — the one-window shell: wordmark · view pills · status
// pill · theme toggle, over the active view (screener / status).
// The company drawer is deep-linked at #/company/:symbol over the screener,
// and the screen itself is a permalink (#/?q=…&sort=…): refresh, bookmark
// and share restore the exact query and engine sort. Sorting and paging run
// in the engine — never a client-side sort of one fetched page. Errors keep
// the previous results visible; export downloads the FULL result set of the
// current query (all pages) via /api/screen.csv.

import { useEffect, useMemo, useRef, useState } from "react";
import { Compass, FileText, Settings2, Star } from "lucide-react";
import QUICK_SCREENS from "./quick-screens.json";
import {
  DslApiError,
  STATIC_MODE,
  exportCsv,
  fields,
  manifest,
  screen,
  status,
  type DslErrorDetail,
  type FieldInfo,
  type ScreenResponse,
  type StatusResponse,
} from "./data";
import { ColumnPicker } from "./components/ColumnPicker";
import { CompanyDrawer } from "./components/CompanyDrawer";
import { CoverageBanner } from "./components/CoverageBanner";
import { HorizonBoard, type HorizonBoardData } from "./components/HorizonBoard";
import type { PaperReport } from "./components/PaperDesk";
import { PresetsMenu } from "./components/PresetsMenu";
import { QueryBuilder } from "./components/QueryBuilder";
import { QueryBar } from "./components/QueryBar";
import { ResultsGrid } from "./components/ResultsGrid";
import { SearchBox } from "./components/SearchBox";
import { StatusView } from "./components/StatusView";
import { StaticStatusView } from "./components/StaticStatusView";
import { isHiddenField } from "./data/field-catalog";
import { fieldsInQuery } from "./dsl/fields";
import { pushQueryHistory } from "./query-history";
import { hashFor, parseHash, useHashRoute } from "./router";
import {
  applyTheme,
  effectiveTheme,
  loadThemePref,
  prefersLight,
  saveThemePref,
  watchSystemTheme,
} from "./theme";
import { loadWatchlist, saveWatchlist, type WatchItem } from "./watchlist";

export const DEFAULT_COLUMNS = [
  "symbol", "name", "sector", "composite_rank",
  "return_on_equity", "revenue_growth", "piotroski_f",
];
// a preset's curated columns REPLACE the visible set on top of this base
export const IDENTITY_COLUMNS = ["symbol", "name", "country", "sector"];
// blank = the whole covered universe (q="" is a real, shareable screen);
// the default sort is the engine's own published blend so the first paint
// reads "every company, strongest composite first" — NULLS LAST sinks
// symbols with missing pillars, and an explicit ?sort= in the URL wins
const DEFAULT_QUERY = QUICK_SCREENS[0].query;
export const DEFAULT_SORT = "-composite_rank";
export const PAGE_SIZE = 25;


const VIEWS = [
  { view: "screener" as const, label: "选股", hash: "#/" },
  { view: "watchlist" as const, label: "自选", hash: "#/watchlist" },
  { view: "status" as const, label: "数据说明", hash: "#/status" },
];

function FirstRun({ statusData }: { statusData: StatusResponse }) {
  const coverage = statusData.ingest?.coverage_pct ?? 0;
  const crawled = statusData.ingest?.crawled;
  const universe = statusData.ingest?.universe ?? statusData.universe;
  return (
    <div className="grid-wrap">
      <div className="teach firstrun">
        <h3>The first crawl is running</h3>
        <p>
          <strong className="stat">{coverage} %</strong> of the universe covered
          {crawled !== undefined && universe
            ? ` — ${crawled.toLocaleString("en-US")} of ${universe.toLocaleString("en-US")} companies`
            : ""}
          .
        </p>
        <p>
          Screens return rows as soon as the first snapshot publishes, and grow with
          coverage. Watch progress in the <a href="#/status">Status view</a>.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [route, navigate] = useHashRoute();
  const [themePref, setThemePref] = useState(() => loadThemePref());
  const [systemLight, setSystemLight] = useState(() => prefersLight());
  const theme = effectiveTheme(themePref, systemLight);
  const [query, setQuery] = useState(() => route.q ?? DEFAULT_QUERY);
  const [ranQuery, setRanQuery] = useState<string | null>(null);
  const [sort, setSort] = useState<string | null>(route.sort ?? DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ScreenResponse | null>(null);
  const [error, setError] = useState<DslErrorDetail | null>(null);
  const [errorKind, setErrorKind] = useState<"query" | "load" | "export" | null>(null);
  const [running, setRunning] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [statusData, setStatusData] = useState<StatusResponse | null>(null);
  const [statusLine, setStatusLine] = useState("");
  const [fieldInfos, setFieldInfos] = useState<FieldInfo[]>([]);
  const [exporting, setExporting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [watchlist, setWatchlist] = useState<WatchItem[]>(loadWatchlist);
  const [watchlistError, setWatchlistError] = useState("");
  const [board, setBoard] = useState<HorizonBoardData | null>(null);
  const [boardError, setBoardError] = useState(false);
  const [paper, setPaper] = useState<PaperReport | null>(null);
  const [paperError, setPaperError] = useState(false);
  const queryInputRef = useRef<HTMLInputElement>(null);
  const routedScreenRef = useRef<string | null>(null);

  const loadBoard = () => {
    setBoardError(false);
    fetch(`${import.meta.env.BASE_URL}data/horizon-board.json`, { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) {
          const [legacy, site] = await Promise.all([
            screen(DEFAULT_QUERY, DEFAULT_SORT, 1, 10_000), manifest(),
          ]);
          const now = Date.now();
          return {
            generated_at: site?.generated_at ?? 0,
            prices_typical_date: site?.prices?.typical_date ?? null,
            long: legacy.rows.filter((row) => {
              const raw = String(row.period ?? "");
              const date = Date.parse(`${raw.length === 4 ? `${raw}-12-31` : raw}T00:00:00Z`);
              const z = row.altman_z;
              const roe = row.return_on_equity;
              return Number.isFinite(date) && date <= now && now - date <= 455 * 86_400_000 &&
                typeof roe === "number" && roe <= 10 &&
                (z == null || (typeof z === "number" && z >= 1.81));
            }).map((row) => ({
              symbol: String(row.symbol),
              name: typeof row.name === "string" ? row.name : null,
              sector: typeof row.sector === "string" ? row.sector : null,
              period: String(row.period),
              piotroski_f: typeof row.piotroski_f === "number" ? row.piotroski_f : null,
              return_on_equity: typeof row.return_on_equity === "number" ? row.return_on_equity : null,
            })),
            short: [],
          } satisfies HorizonBoardData;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<HorizonBoardData>;
      })
      .then(setBoard)
      .catch(() => setBoardError(true));
  };

  const loadPaper = () => {
    setPaperError(false);
    fetch(`${import.meta.env.BASE_URL}data/paper-portfolio.json`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<PaperReport>;
      })
      .then((result) => {
        if (result.version !== 1 || !Array.isArray(result.positions) ||
            !Array.isArray(result.pending) || !Array.isArray(result.decisions) ||
            !Array.isArray(result.fills)) throw new Error("模拟记录结构无效");
        setPaper(result);
      })
      .catch(() => {
        setPaper(null);
        setPaperError(true);
      });
  };

  const changeWatchlist = (next: WatchItem[]) => {
    if (!saveWatchlist(next)) {
      setWatchlistError("本机无法保存自选，请检查浏览器存储设置。");
      return;
    }
    setWatchlist(next);
    setWatchlistError("");
  };

  const toggleWatchlist = (symbol: string, name: string) => {
    changeWatchlist(watchlist.some((item) => item.symbol === symbol)
      ? watchlist.filter((item) => item.symbol !== symbol)
      : [{ symbol, name }, ...watchlist]);
  };

  useEffect(() => watchSystemTheme(() => setSystemLight(prefersLight())), []);

  useEffect(() => {
    applyTheme(theme);
    saveThemePref(themePref);
  }, [theme, themePref]);

  // The single screening entry point: runs the query in the engine and makes
  // the URL remember the screen (replace — a run is not a history entry).
  const runScreen = async (q: string, sortNext: string | null, pageNext: number) => {
    setRunning(true);
    setError(null);
    setErrorKind(null);
    try {
      const response = await screen(q, sortNext, pageNext, PAGE_SIZE);
      setResult(response);
      setRanQuery(q);
      setSort(sortNext);
      setPage(pageNext);
      pushQueryHistory(q);
      // a screen always surfaces the fields it filtered on (union — never
      // removes what the user picked; chains after a preset's replace)
      setVisibleColumns((prev) => {
        if (QUICK_SCREENS.some((item) => item.query === q)) return prev;
        const extra = fieldsInQuery(q).filter((field) => !prev.includes(field));
        return extra.length ? [...prev, ...extra] : prev;
      });
      // sync the URL from the CURRENT hash (never a stale closure): keep the
      // open drawer, and never hijack the status/providers views
      const current = parseHash(window.location.hash);
      if (current.view === "screener") {
        navigate({ ...current, q, sort: sortNext }, { replace: true });
      }
    } catch (err) {
      if (err instanceof DslApiError) {
        setError(err.detail);
        setErrorKind("query");
        setAdvancedOpen(true);
      } else {
        setError({ error: "数据加载失败", position: null, hint: "请检查网络或数据服务后重试。" });
        setErrorKind("load");
      }
      // previous results intentionally stay visible
    } finally {
      setRunning(false);
    }
  };

  const run = (dsl?: string) => runScreen(dsl ?? query, sort, 1);

  const toggleSort = (column: string) => {
    const next = sort === `-${column}` ? column : sort === column ? null : `-${column}`;
    runScreen(ranQuery ?? query, next, 1);
  };

  const handleExport = async () => {
    if (ranQuery === null || exporting) return;
    setExporting(true);
    try {
      const csv = await exportCsv(ranQuery, sort, columns);
      if ("url" in csv) {
        window.location.assign(csv.url);
      } else {
        const url = URL.createObjectURL(csv.blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = csv.filename;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError({ error: `导出失败：${String(err)}`, position: null, hint: "请稍后重试" });
      setErrorKind("export");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fields()
      .then((fs) => setFieldInfos(fs.filter((f) => !isHiddenField(f.name))))
      .catch(() => {});
    status()
      .then((s) => {
        setStatusData(s);
        const universe = s.universe ?? "?";
        const snapshot = s.snapshot ? "snapshot ✓" : "no snapshot yet";
        setStatusLine(`${universe} 家公司 · ${snapshot}`);
      })
      .catch(() => setStatusLine("数据暂不可用"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (STATIC_MODE && route.view === "screener" && route.q === null && !board && !boardError) loadBoard();
    if (STATIC_MODE && route.view === "screener" && route.q === null && !paper && !paperError) loadPaper();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.view, route.q]);

  useEffect(() => {
    if (!STATIC_MODE) return;
    const refresh = () => {
      if (document.hidden) return;
      loadBoard();
      loadPaper();
    };
    const timer = window.setInterval(refresh, 15 * 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A hand-edited or history-navigated URL re-runs its screen (the guard on
  // ranQuery breaks the loop: runScreen writes the same q back via replace).
  useEffect(() => {
    if (route.view !== "screener" || running) return;
    const next = STATIC_MODE && route.q === null ? null : route.q ?? DEFAULT_QUERY;
    if (next === null) {
      routedScreenRef.current = null;
      return;
    }
    const targetSort = route.sort ?? (ranQuery === next ? sort : DEFAULT_SORT);
    const key = `${next}\u0000${targetSort ?? ""}`;
    if (routedScreenRef.current === key) return;
    routedScreenRef.current = key;
    if (ranQuery !== next || sort !== targetSort) {
      setQuery(next);
      runScreen(next, targetSort, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.q, route.sort, route.view, running]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (event.key === "/" && !typing && route.view === "screener" && !route.company) {
        event.preventDefault();
        setAdvancedOpen(true);
        queryInputRef.current?.focus();
      }
      if (event.key === "Escape" && route.company) {
        navigate({ ...route, company: null });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  const availableColumns = useMemo(
    () =>
      result?.rows.length
        ? Object.keys(result.rows[0]).filter((c) => !isHiddenField(c))
        : DEFAULT_COLUMNS,
    [result],
  );
  // symbol is the row's identity (and its keyboard path into the drawer) —
  // it stays visible no matter what the picker says
  const columns = [
    "symbol",
    ...visibleColumns.filter((c) => c !== "symbol" && availableColumns.includes(c)),
  ];

  const firstRun =
    statusData?.snapshot === false && !(result && result.total > 0);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;
  const firstRow = result ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastRow = result ? Math.min(page * PAGE_SIZE, result.total) : 0;
  const showBoard = STATIC_MODE && route.view === "screener" && route.q === null;

  return (
    <div className="app">
      <header className="topbar">
        <a className="wordmark-link" href="#/" aria-label="美股研究">
          <span className="app-brand">美股研究</span>
        </a>
        <a className="mobile-settings" href="#/status" aria-label="数据与外观设置" title="数据与外观设置">
          <Settings2 size={21} strokeWidth={2.2} aria-hidden="true" />
        </a>
        <nav className="views" aria-label="主导航">
          {VIEWS.map((v) => (
            <a
              key={v.view}
              href={v.hash}
              aria-current={route.view === v.view ? "page" : undefined}
            >
              {v.view === "screener" ? <Compass aria-hidden="true" />
                : v.view === "watchlist" ? <Star aria-hidden="true" />
                  : <FileText aria-hidden="true" />}
              {v.label}
            </a>
          ))}
        </nav>
        <SearchBox
          onPick={(symbol) =>
            navigate({ view: route.view, company: symbol, q: route.q, sort: route.sort })
          }
        />
      </header>

      {STATIC_MODE && !showBoard && <CoverageBanner report={paper} />}

      {showBoard && (board ? (
        <HorizonBoard board={board}
          overview={<CoverageBanner report={paper} />}
          paper={paper} paperError={paperError} onPaperRetry={loadPaper}
          onSelect={(symbol) => navigate({ view: "screener", company: symbol, q: null, sort: null })}
          onAdvanced={() => {
            setAdvancedOpen(true);
            navigate({ view: "screener", company: null, q: DEFAULT_QUERY, sort: DEFAULT_SORT });
          }} />
      ) : (
        <main className="horizon-board board-empty-state">
          {boardError ? <><p role="alert">板块数据暂时无法加载。</p><button type="button" onClick={loadBoard}>重试</button></>
            : <p aria-busy="true">正在加载板块…</p>}
        </main>
      ))}

      {route.view === "screener" && !showBoard && (
        <main className="screener-workspace">
          <div className="screen-heading">
            <h1>股票筛选</h1>
            {STATIC_MODE && <a className="board-return" href="#/">按板块浏览</a>}
            {!STATIC_MODE && <span className="meta">{statusLine}</span>}
          </div>
          <div className="screen-filter-row">
            <div className="quick-screens" role="group" aria-label="快速筛选">
              {QUICK_SCREENS.map((item) => (
                <button key={item.label} type="button" aria-pressed={ranQuery === item.query}
                  onClick={() => { setQuery(item.query); runScreen(item.query, DEFAULT_SORT, 1); }}>
                  {item.label}
                </button>
              ))}
            </div>
            <button className="advanced-toggle" type="button" aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen((value) => !value)}>
              {advancedOpen ? "收起高级筛选" : "高级筛选"}
            </button>
          </div>
          <div className={`advanced-panel${advancedOpen ? " open" : ""}`}>
          <QueryBar
            value={query}
            onChange={setQuery}
            onRun={() => run()}
            running={running}
            error={firstRun || errorKind !== "query" ? null : error}
            inputRef={queryInputRef}
            fields={fieldInfos}
          />
          <details className="builder-details">
            <summary>可视化条件编辑</summary>
            <QueryBuilder
              fields={fieldInfos}
              onApply={(dsl) => {
                setQuery(dsl);
                run(dsl);
              }}
            />
          </details>
          <div className="advanced-tools">
            <PresetsMenu
              currentQuery={query}
              activeDsl={ranQuery}
              onPick={(preset) => {
                setQuery(preset.dsl);
                if (preset.columns?.length) {
                  setVisibleColumns([...new Set([...IDENTITY_COLUMNS, ...preset.columns])]);
                }
                run(preset.dsl);
              }}
            />
            <ColumnPicker
              available={availableColumns}
              visible={visibleColumns}
              onChange={setVisibleColumns}
            />
            <button disabled={!ranQuery || !result?.total || exporting} onClick={handleExport}>
              {exporting ? "导出中…" : "导出 CSV"}
            </button>
          </div>
          </div>
          <div className="toolbar">
            {result && !firstRun && (
              <span className="meta">
                {result.total === 0
                  ? "暂无符合条件的公司"
                  : `共 ${result.total.toLocaleString("zh-CN")} 家 · 第 ${firstRow.toLocaleString("zh-CN")}–${lastRow.toLocaleString("zh-CN")} 家`}
              </span>
            )}
            {result && !firstRun && totalPages > 1 && (
              <span className="pager" role="group" aria-label="结果翻页">
                <button
                  aria-label="上一页"
                  disabled={running || page <= 1}
                  onClick={() => runScreen(ranQuery ?? query, sort, page - 1)}
                >
                  ‹
                </button>
                <span className="meta">
                  {page} / {totalPages}
                </span>
                <button
                  aria-label="下一页"
                  disabled={running || page >= totalPages}
                  onClick={() => runScreen(ranQuery ?? query, sort, page + 1)}
                >
                  ›
                </button>
              </span>
            )}
          </div>
          {error && (errorKind === "load" || errorKind === "export") && !running && (
            <div className="screen-error" role="alert">
              <span>{error.error}。{error.hint}</span>
              <button type="button" onClick={() => errorKind === "export" ? void handleExport() : void runScreen(ranQuery ?? query, sort, page)}>重试</button>
            </div>
          )}
          {firstRun && statusData ? (
            <FirstRun statusData={statusData} />
          ) : !result && running ? (
            /* the engine (DuckDB-WASM in static mode) is still booting — never
               show a false "No matching rows" as the first paint */
            <div className="grid-wrap" aria-busy="true">
              <p className="meta">正在加载筛选结果…</p>
            </div>
          ) : (
            <ResultsGrid
              rows={result?.rows ?? []}
              columns={columns}
              query={ranQuery ?? undefined}
              selected={route.company}
              onSelect={(symbol) =>
                navigate({ view: "screener", company: symbol, q: ranQuery, sort })
              }
              sort={sort}
              onSort={toggleSort}
              hrefFor={(symbol) =>
                hashFor({ view: "screener", company: symbol, q: ranQuery, sort })
              }
            />
          )}
        </main>
      )}

      {route.view === "status" && (STATIC_MODE
        ? <StaticStatusView pref={themePref} onPref={setThemePref} />
        : <StatusView pref={themePref} onPref={setThemePref} />)}

      {route.view === "watchlist" && (
        <main className="watchlist-view">
          <div className="watchlist-heading">
            <h1>自选公司</h1>
            <span>{watchlist.length} 家</span>
          </div>
          {watchlistError && <p role="alert">{watchlistError}</p>}
          {watchlist.length === 0 ? (
            <p className="watchlist-empty">暂无自选公司。在选股结果或搜索中打开公司，即可加入自选。</p>
          ) : (
            <ul className="watchlist-items">
              {watchlist.map((item) => (
                <li key={item.symbol}>
                  <a href={hashFor({ view: "watchlist", company: item.symbol, q: null, sort: null })}>
                    <strong>{item.symbol}</strong><span>{item.name}</span>
                  </a>
                  <button type="button" aria-label={`移出自选 ${item.symbol}`}
                    onClick={() => changeWatchlist(watchlist.filter((entry) => entry.symbol !== item.symbol))}>
                    移除
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="watchlist-storage">仅保存在此浏览器，不会同步到其他设备。</p>
        </main>
      )}

      {route.company && (
        <CompanyDrawer
          symbol={route.company}
          onClose={() => navigate({ ...route, company: null })}
          watched={watchlist.some((item) => item.symbol === route.company)}
          onToggleWatchlist={(name) => toggleWatchlist(route.company!, name)}
          watchlistError={watchlistError}
        />
      )}
    </div>
  );
}
