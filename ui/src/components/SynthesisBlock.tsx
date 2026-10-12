// Deterministic synthesis at the top of the drawer — "is it worth a look?"
// computed from the ONE threshold table (format.verdictKind). Never a second
// rule set, never generated prose: family counters, the composite-rank hero
// with the rank bars, and the red/warn attention points with jump buttons.
// Jumps use scrollIntoView — NEVER <a href="#…">: the app hash-routes, and a
// bare fragment would parse as a route and close the drawer.

import { FLAGS, type VerdictKind, formatCell, formatNumber, verdictKind } from "../format";
import { peerGroupLabel } from "../research-labels";
import { RankBars } from "./RankBars";
import { PiotroskiSparkline } from "./TrendCharts";

interface Family {
  name: string;
  columns: string[];
}

// every column here MUST be decidable by verdictKind — one source of truth
const FAMILIES: Family[] = [
  {
    name: "Solvency & forensics",
    columns: [
      "piotroski_f", "altman_z", "beneish_m", "zmijewski_score",
      "ohlson_o", "montier_c", "dechow_f",
    ],
  },
  { name: "Value", columns: ["graham_margin_of_safety", "ncav_to_market_cap", "peg_ratio"] },
  { name: "Cash", columns: ["fcf_conversion", "dividend_coverage", "rule_of_40"] },
];

// static phrases for the two alarm kinds; good-only columns need none
const ATTENTION_PHRASES: Record<string, Partial<Record<"bad" | "warn", string>> & { sectionId: string }> = {
  piotroski_f: { bad: "Piotroski F 分数较低", sectionId: "drawer-scores" },
  altman_z: { bad: "Altman Z 提示财务压力", sectionId: "drawer-scores" },
  beneish_m: { warn: "Beneish M 超过警戒阈值", sectionId: "drawer-scores" },
  zmijewski_score: { bad: "Zmijewski 模型提示财务压力", sectionId: "drawer-scores" },
  ohlson_o: { bad: "Ohlson O 模型提示财务压力", sectionId: "drawer-scores" },
  montier_c: { warn: "Montier 会计警示项较多", sectionId: "drawer-scores" },
  dechow_f: { warn: "Dechow F 提示财报差错风险", sectionId: "drawer-scores" },
  graham_margin_of_safety: { bad: "价格高于格雷厄姆数", sectionId: "drawer-value" },
  fcf_conversion: { warn: "利润的现金转化偏弱", sectionId: "drawer-cash" },
  dividend_coverage: { bad: "利润未覆盖股息", sectionId: "drawer-cash" },
};

const ATTENTION_CAP = 6;
const THIN_DATA_BELOW = 5;

export interface FamilySummary {
  name: string;
  good: number;
  bad: number;
  warn: number;
  missing: number;
  total: number;
}

export interface AttentionItem {
  column: string;
  kind: "bad" | "warn";
  phrase: string;
  sectionId: string;
}

function numeric(latest: Record<string, unknown>, column: string): number | null {
  const raw = latest[column];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

export function synthesize(latest: Record<string, unknown>): {
  families: FamilySummary[];
  attention: AttentionItem[];
  decidable: number;
  total: number;
} {
  const families = FAMILIES.map(({ name, columns }) => {
    const counts = { good: 0, bad: 0, warn: 0, missing: 0 };
    for (const column of columns) {
      const value = numeric(latest, column);
      if (value === null) {
        counts.missing += 1;
        continue;
      }
      const kind = verdictKind(column, value);
      if (kind) counts[kind] += 1; // mid-band counts toward total only
    }
    return { name, ...counts, total: columns.length };
  });

  const attention: AttentionItem[] = [];
  for (const kindWanted of ["bad", "warn"] as const) {
    for (const { columns } of FAMILIES) {
      for (const column of columns) {
        const value = numeric(latest, column);
        if (value === null || verdictKind(column, value) !== kindWanted) continue;
        const entry = ATTENTION_PHRASES[column];
        const phrase = entry?.[kindWanted];
        if (phrase) attention.push({ column, kind: kindWanted, phrase, sectionId: entry.sectionId });
      }
    }
  }

  const total = families.reduce((n, f) => n + f.total, 0);
  const decidable = families.reduce((n, f) => n + (f.total - f.missing), 0);
  return { families, attention: attention.slice(0, ATTENTION_CAP), decidable, total };
}

function kindGlyph(kind: VerdictKind): string {
  return FLAGS[kind].trim();
}

// ---------------------------------------------------------------- invest signal
// One deterministic tier from the SAME verdict table the counters use — no
// second rule set. Display-only synthesis: mechanical thresholds, never advice.

export type InvestSignal = "favorable" | "mixed" | "unfavorable" | "insufficient";

export interface InvestVerdict {
  signal: InvestSignal;
  reason: string;
}

// a distress-model red flag vetoes on its own — solvency first
const CRITICAL_COLUMNS = ["piotroski_f", "altman_z", "zmijewski_score", "ohlson_o"];

const FAVORABLE_GOOD_SHARE = 0.6;
const FAVORABLE_MIN_COMPOSITE = 55;

export function investVerdict(latest: Record<string, unknown>): InvestVerdict {
  const { families, decidable } = synthesize(latest);
  if (decidable < THIN_DATA_BELOW) {
    return {
      signal: "insufficient",
      reason: `only ${decidable} checks decidable — too thin to call`,
    };
  }
  const good = families.reduce((n, f) => n + f.good, 0);
  const bad = families.reduce((n, f) => n + f.bad, 0);
  const warn = families.reduce((n, f) => n + f.warn, 0);
  const critical = CRITICAL_COLUMNS.filter((column) => {
    const value = numeric(latest, column);
    return value !== null && verdictKind(column, value) === "bad";
  });
  if (critical.length > 0) {
    return { signal: "unfavorable", reason: `distress red flag: ${critical.join(", ")}` };
  }
  if (bad >= 2) {
    return { signal: "unfavorable", reason: `${bad} failed checks of ${decidable}` };
  }
  const composite = numeric(latest, "composite_rank");
  if (
    bad === 0 &&
    warn <= 1 &&
    good >= Math.ceil(decidable * FAVORABLE_GOOD_SHARE) &&
    (composite === null || composite >= FAVORABLE_MIN_COMPOSITE)
  ) {
    return {
      signal: "favorable",
      reason:
        `${good}/${decidable} checks pass, no red flag` +
        (composite !== null ? `, composite ${formatNumber(composite)}` : ""),
    };
  }
  return {
    signal: "mixed",
    reason: `${good} pass · ${bad} fail · ${warn} warn of ${decidable} checks`,
  };
}

const SIGNAL_BADGES: Record<InvestSignal, { glyph: string; label: string }> = {
  favorable: { glyph: "✓", label: "多项通过" },
  mixed: { glyph: "!", label: "结果不一" },
  unfavorable: { glyph: "✗", label: "存在警示" },
  insufficient: { glyph: "—", label: "数据不足" },
};

const FAMILY_LABELS: Record<string, string> = {
  "Solvency & forensics": "偿债与财报质量",
  Value: "估值",
  Cash: "现金流",
};

export function SynthesisBlock({
  latest,
  periods,
}: {
  latest: Record<string, unknown>;
  periods: Record<string, unknown>[];
}) {
  const { families, attention, decidable, total } = synthesize(latest);
  const composite = numeric(latest, "composite_rank");
  const thin = decidable < THIN_DATA_BELOW;
  const audited = String(latest.audited_fields ?? "").length > 0;
  const crawled = String(latest.provider ?? "").includes("yfinance");
  const missingInputs = String(latest.missing_inputs ?? "")
    .split(",")
    .filter(Boolean)
    .slice(0, 4);
  const jump = (sectionId: string) => {
    const target = document.getElementById(sectionId);
    target?.scrollIntoView({ block: "start" });
    target?.focus?.();
  };

  const verdict = investVerdict(latest);
  const badge = SIGNAL_BADGES[verdict.signal];
  const good = families.reduce((count, family) => count + family.good, 0);
  const bad = families.reduce((count, family) => count + family.bad, 0);
  const warn = families.reduce((count, family) => count + family.warn, 0);
  const verdictSummary = thin
    ? `可判断指标 ${decidable} 项，数据不足`
    : `通过 ${good} 项 · 未通过 ${bad} 项 · 需注意 ${warn} 项`;

  return (
    <section className="synthesis" aria-label="指标汇总">
      <div className={`invest-signal invest-${verdict.signal}`} role="status">
        <span className="invest-signal-badge">
          {badge.glyph} 指标检查：{badge.label}
        </span>
        <span className="meta">{verdictSummary} · 仅供研究，不构成投资建议</span>
      </div>
      <div className="synthesis-hero">
        <div>
          <div className="synthesis-rank">{composite !== null ? formatNumber(composite) : "—"}</div>
          <div className="meta">
            综合分位 · 同类比较：{peerGroupLabel(latest.rank_peer_group)}
            {composite === null ? " · 数据不足，无法计算分位" : ""}
          </div>
        </div>
        <RankBars row={latest} />
      </div>
      {thin && (
        <div className="coverage-note" role="status">
          <p>
            数据不完整：共 {total} 项检查，当前可判断 {decidable} 项。
          </p>
          <p className="meta">
            {audited
              ? "已收录审计申报文件，部分辅助数据仍待补充。"
              : crawled
                ? "当前只有公开抓取数据，尚未匹配审计申报文件。"
                : "这家公司仍在等待数据更新。"}
          </p>
        </div>
      )}
      <div className="synthesis-families">
        {families.map((family) =>
          family.missing === family.total ? (
            <div key={family.name} className="synthesis-family">
              <span className="synthesis-family-name">{FAMILY_LABELS[family.name] ?? family.name}</span>
              <span className="meta">暂无数据</span>
            </div>
          ) : (
            <div key={family.name} className="synthesis-family">
              <span className="synthesis-family-name">{FAMILY_LABELS[family.name] ?? family.name}</span>
              <span className="num-good">{family.good} ✓</span>
              <span className="num-bad">{family.bad} ✗</span>
              <span className="num-warn">{family.warn} !</span>
              <span className="meta">
                {family.missing} 项缺失 · 共 {family.total} 项
              </span>
              {family.name === "Solvency & forensics" && <PiotroskiSparkline periods={periods} />}
            </div>
          ),
        )}
      </div>
      {attention.length > 0 && (
        <ul className="attention-list">
          {attention.map((item) => (
            <li key={item.column}>
              <span className={`num-${item.kind}`}>
                {kindGlyph(item.kind)} {formatCell(item.column, latest[item.column]).text}
              </span>{" "}
              {item.phrase}{" "}
              <button className="jump-link" onClick={() => jump(item.sectionId)}>
                查看
              </button>
            </li>
          ))}
        </ul>
      )}
      {thin && missingInputs.length > 0 && (
        <p className="meta">缺失字段：{missingInputs.join(", ")}…</p>
      )}
    </section>
  );
}
