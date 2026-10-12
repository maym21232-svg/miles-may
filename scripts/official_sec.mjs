const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SEC_ORIGIN = "https://data.sec.gov";
const FILING_FORMS = new Set(["10-K", "10-K/A", "10-Q", "10-Q/A", "20-F", "20-F/A", "40-F", "40-F/A", "6-K", "8-K"]);
const ANNUAL_FORMS = new Set(["10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"]);
const FACTS = [
  { key: "revenue", label: "营业收入", tags: ["us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax", "us-gaap:Revenues", "us-gaap:SalesRevenueNet", "ifrs-full:Revenue", "ifrs-full:RevenueFromContractsWithCustomers"], duration: true },
  { key: "net_income", label: "净利润", tags: ["us-gaap:NetIncomeLoss", "ifrs-full:ProfitLossAttributableToOwnersOfParent", "ifrs-full:ProfitLoss"], duration: true },
  { key: "assets", label: "总资产", tags: ["us-gaap:Assets", "ifrs-full:Assets"], duration: false },
];

function filingUrl(cik, accession, document) {
  if (!/^\d{10}-\d{2}-\d{6}$/.test(accession)) return null;
  const base = `https://www.sec.gov/Archives/edgar/data/${cik}/${accession.replaceAll("-", "")}/`;
  return typeof document === "string" && /^[A-Za-z0-9._-]+$/.test(document)
    ? base + encodeURIComponent(document) : base;
}

function recentFilings(submissions, cik) {
  const recent = submissions?.filings?.recent ?? {};
  const forms = Array.isArray(recent.form) ? recent.form : [];
  const filings = forms.flatMap((form, index) => {
    const accession = recent.accessionNumber?.[index];
    const url = filingUrl(cik, accession, recent.primaryDocument?.[index]);
    if (!FILING_FORMS.has(form) || !url) return [];
    return [{ form, filed: recent.filingDate?.[index] ?? null,
      reportDate: recent.reportDate?.[index] ?? null, accession, url }];
  });
  return filings;
}

function officialFacts(companyFacts, cik, filings) {
  if (!companyFacts?.facts) return [];
  return FACTS.flatMap((definition) => {
    const candidates = definition.tags.flatMap((tag, tagOrder) => {
      const [namespace, name] = tag.split(":");
      const concept = companyFacts.facts?.[namespace]?.[name];
      if (!concept?.units) return [];
      return Object.entries(concept.units).flatMap(([unit, rows]) => rows.flatMap((row) => {
        if (!ANNUAL_FORMS.has(row.form) || !/^\d{4}-\d{2}-\d{2}$/.test(row.end ?? "") ||
            !Number.isFinite(row.val) || !row.accn) return [];
        if (definition.duration) {
          const days = (Date.parse(row.end) - Date.parse(row.start)) / 86_400_000;
          if (!Number.isFinite(days) || days < 300 || days > 400) return [];
        }
        const filing = filings.find((item) => item.accession === row.accn);
        return [{ value: row.val, unit, periodEnd: row.end, filed: row.filed,
          form: row.form, url: filing?.url ?? filingUrl(cik, row.accn), tagOrder }];
      }));
    });
    candidates.sort((a, b) => b.periodEnd.localeCompare(a.periodEnd) ||
      b.filed.localeCompare(a.filed) || a.tagOrder - b.tagOrder ||
      Number(a.unit === "USD") - Number(b.unit === "USD"));
    const chosen = candidates[0];
    if (!chosen) return [];
    const { tagOrder: _tagOrder, ...fact } = chosen;
    return [{ key: definition.key, label: definition.label, ...fact }];
  });
}

export function createSecService({ fetchImpl = fetch, now = Date.now,
  userAgent = process.env.CRIBLE_SEC_USER_AGENT || "crible-screener", minimumIntervalMs = 250 } = {}) {
  let tickers = null;
  let tickersUntil = 0;
  let tickersLoading = null;
  const companies = new Map();
  const pending = new Map();
  let nextRequestAt = 0;

  async function getJson(url) {
    const delay = Math.max(0, nextRequestAt - now());
    nextRequestAt = Math.max(nextRequestAt, now()) + minimumIntervalMs;
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    const response = await fetchImpl(url, {
      headers: { "User-Agent": userAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`SEC HTTP ${response.status}`);
    return response.json();
  }

  async function tickerMap() {
    if (tickers && now() < tickersUntil) return tickers;
    if (!tickersLoading) tickersLoading = getJson(TICKERS_URL).then((data) => {
      const mapped = new Map();
      for (const item of Object.values(data)) {
        if (/^[A-Z0-9.-]{1,12}$/.test(item.ticker) && Number.isInteger(item.cik_str)) {
          mapped.set(item.ticker, { cik: item.cik_str, name: item.title });
        }
      }
      tickers = mapped;
      tickersUntil = now() + 24 * 60 * 60 * 1000;
      return mapped;
    }).finally(() => { tickersLoading = null; });
    try { return await tickersLoading; } catch (error) {
      if (tickers) return tickers;
      throw error;
    }
  }

  async function company(symbol) {
    const normalized = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9.-]{1,12}$/.test(normalized)) throw new RangeError("股票代码不合法");
    const cached = companies.get(normalized);
    if (cached && now() < cached.until) return cached.value;
    if (pending.has(normalized)) return pending.get(normalized);
    const work = (async () => {
      try {
        const map = await tickerMap();
        const match = map.get(normalized) ?? map.get(normalized.replaceAll(".", "-"));
        if (!match) return { symbol: normalized, status: "unmapped", checkedAt: new Date(now()).toISOString() };
        const cik = match.cik;
        const cikPadded = String(cik).padStart(10, "0");
        const submissions = await getJson(`${SEC_ORIGIN}/submissions/CIK${cikPadded}.json`);
        const allFilings = recentFilings(submissions, cik);
        const filings = allFilings.slice(0, 6);
        const annual = allFilings.find((filing) => ANNUAL_FORMS.has(filing.form));
        if (annual && !filings.includes(annual)) filings.push(annual);
        let facts = [];
        let factsAvailable = true;
        try {
          facts = officialFacts(await getJson(`${SEC_ORIGIN}/api/xbrl/companyfacts/CIK${cikPadded}.json`), cik, allFilings);
        } catch { factsAvailable = false; }
        const value = { symbol: normalized, status: "available", cik, name: submissions.name ?? match.name,
          checkedAt: new Date(now()).toISOString(), filings, facts, factsAvailable, stale: false };
        companies.set(normalized, { value, until: now() + 15 * 60 * 1000 });
        return value;
      } catch (error) {
        if (cached) return { ...cached.value, stale: true };
        throw error;
      }
    })().finally(() => pending.delete(normalized));
    pending.set(normalized, work);
    return work;
  }

  return { company };
}

const service = createSecService();

export function officialSecMiddleware(req, res, next) {
  const match = /^\/official\/sec\/([^/?]+)(?:\?.*)?$/.exec(req.url ?? "");
  if (!match) return next();
  const send = (status, payload) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, max-age=60" });
    res.end(JSON.stringify(payload));
  };
  let symbol;
  try { symbol = decodeURIComponent(match[1]); }
  catch { send(400, { error: "股票代码不合法" }); return; }
  service.company(symbol).then((value) => send(200, value)).catch((error) => {
    send(error instanceof RangeError ? 400 : 503, { error: error instanceof RangeError ? error.message : "SEC 暂时不可用" });
  });
}
