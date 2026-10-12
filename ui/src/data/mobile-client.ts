import type {
  CompanyDetail, CsvExport, DataClient, FieldInfo, Preset, PriceBar, ProviderInfo,
  ScreenResponse, SearchHit, SiteManifest, StatusResponse,
} from "./types";

const base = import.meta.env.VITE_DATA_BASE ?? import.meta.env.BASE_URL;

function json<T>(name: string, cache?: RequestCache): Promise<T> {
  return fetch(`${base}data/${name}`, { cache }).then((response) => {
    if (!response.ok) throw new Error(`数据加载失败 (${response.status})`);
    return response.json() as Promise<T>;
  });
}

let screensPromise: Promise<Record<string, Record<string, unknown>[]>> | null = null;
let overviewPromise: Promise<SearchHit[]> | null = null;
let featuredPromise: Promise<Record<string, CompanyDetail>> | null = null;
let fullClientPromise: Promise<DataClient> | null = null;

const screens = () => screensPromise ??= json("screens.json");
const overview = () => overviewPromise ??= json("overview.json");
const featured = () => featuredPromise ??= json("featured.json");
const fullClient = () => fullClientPromise ??= import("./static-client").then((module) => module.createStaticClient());

function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function selectedRows(rows: Record<string, unknown>[], sort: string | null): Record<string, unknown>[] | null {
  if (sort === "-composite_rank" || sort === null) return rows;
  const column = sort.startsWith("-") ? sort.slice(1) : sort;
  if (rows.length && !(column in rows[0])) return null;
  const direction = sort.startsWith("-") ? -1 : 1;
  return [...rows].sort((a, b) => {
    if (a[column] == null) return b[column] == null ? 0 : 1;
    if (b[column] == null) return -1;
    return compare(a[column], b[column]) * direction;
  });
}

function csvCell(value: unknown): string {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export const mobileClient: DataClient = {
  async screen(query, sort, page, pageSize): Promise<ScreenResponse> {
    const started = performance.now();
    const result = (await screens())[query];
    const rows = result && selectedRows(result, sort);
    if (!rows) return (await fullClient()).screen(query, sort, page, pageSize);
    return {
      rows: rows.slice((page - 1) * pageSize, page * pageSize),
      total: rows.length,
      page,
      tookMs: Math.round(performance.now() - started),
    };
  },

  async exportCsv(query, sort, columns): Promise<CsvExport> {
    const result = (await screens())[query];
    const rows = result && selectedRows(result, sort);
    if (!rows) return (await fullClient()).exportCsv(query, sort, columns);
    const keep = columns?.length ? columns : Object.keys(rows[0] ?? {});
    const lines = [keep.join(","), ...rows.map((row) => keep.map((column) => csvCell(row[column])).join(","))];
    return { blob: new Blob([lines.join("\n") + "\n"], { type: "text/csv" }), filename: "us-stock-screen.csv" };
  },

  async company(symbol): Promise<CompanyDetail | null> {
    const cached = (await featured())[symbol];
    return cached ?? (await fullClient()).company(symbol);
  },

  async search(q): Promise<SearchHit[]> {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return (await overview()).filter((row) =>
      row.symbol.toLowerCase().includes(needle) || (row.name ?? "").toLowerCase().includes(needle)
    ).slice(0, 20);
  },

  fields: () => json<FieldInfo[]>("fields.json"),
  status: () => json<StatusResponse>("status.json"),
  presets: () => json<Preset[]>("presets.json"),
  providers: () => json<ProviderInfo[]>("providers.json"),
  manifest: () => json<SiteManifest>("manifest.json", "no-store"),
  prices: async (symbol): Promise<PriceBar[]> => (await fullClient()).prices(symbol),
  requestFetch: async () => { throw new Error("静态版暂不支持即时抓取"); },
};
