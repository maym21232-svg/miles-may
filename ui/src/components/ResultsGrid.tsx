// FR-007 — the results grid: TanStack Table, engine-sorted columns (the sort
// travels to DuckDB, never a client-side sort of one page), dense monospaced
// numerals, score coloring, symbol links + row click open the company drawer.

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo } from "react";
import { formatCell } from "../format";
import { researchValue } from "../research-format";
import { researchFieldLabel, sectorLabel } from "../research-labels";
import { ZeroDiagnosis } from "./ZeroDiagnosis";

type Row = Record<string, unknown>;

interface Props {
  rows: Row[];
  columns: string[];
  selected?: string | null;
  onSelect: (symbol: string) => void;
  /** engine sort: "-field" descending, "field" ascending, null unsorted */
  sort?: string | null;
  onSort?: (column: string) => void;
  /** permalink for a symbol's drawer (keeps the current screen in the URL) */
  hrefFor?: (symbol: string) => string;
  /** the query that produced these rows — powers the zero-result funnel */
  query?: string;
}

function ariaSort(sort: string | null | undefined, column: string): "ascending" | "descending" | undefined {
  if (sort === column) return "ascending";
  if (sort === `-${column}`) return "descending";
  return undefined;
}

export function ResultsGrid({ rows, columns, selected, onSelect, sort, onSort, hrefFor, query }: Props) {
  const helper = createColumnHelper<Row>();
  const linkFor = hrefFor ?? ((symbol: string) => `#/company/${encodeURIComponent(symbol)}`);
  const tableColumns = useMemo(
    () =>
      columns.map((name) =>
        helper.accessor((row) => row[name], {
          id: name,
          header: researchFieldLabel(name),
          cell: (info) => {
            const value = info.getValue();
            if (name === "symbol" && value !== null && value !== undefined) {
              const symbol = String(value);
              // a real link: keyboard-reachable, middle-clickable, honest URL
              return (
                <a className="symlink" href={linkFor(symbol)} onClick={(event) => event.stopPropagation()}>
                  {symbol}
                </a>
              );
            }
            const { text, className, flag } = formatCell(name, value);
            if (name === "name") {
              // compact identity column: truncate, full name on hover —
              // the numbers are what the grid is for
              return (
                <span className="cell-name" title={text}>
                  {text}
                </span>
              );
            }
            if (name === "sector") return sectorLabel(value);
            if (name === "return_on_equity" || name === "revenue_growth" || name === "composite_rank") {
              return <span className={className}>{researchValue(name, value)}</span>;
            }
            if (name === "piotroski_f") {
              return value == null ? "—" : `${researchValue(name, value)}/9`;
            }
            return (
              <span className={className}>
                {text}
                {flag && <span className="cell-flag">{flag}</span>}
              </span>
            );
          },
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns.join("|"), linkFor],
  );

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!rows.length) {
    return (
      <div className="grid-wrap">
        <p className="meta">
          暂无符合条件的公司。可以换一组筛选条件，或查看<a href="#/status">数据说明</a>。
        </p>
        {query ? <ZeroDiagnosis query={query} /> : null}
      </div>
    );
  }

  return (
    <div className="grid-wrap">
      <div className="mobile-results" aria-label="筛选结果">
        {rows.map((row) => {
          const symbol = String(row.symbol);
          return (
            <button className="mobile-result" type="button" key={symbol} onClick={() => onSelect(symbol)}>
              <span className="mobile-result-top">
                <span><strong>{symbol}</strong><small>{String(row.name ?? "公司名称未知")}</small><em>{sectorLabel(row.sector)}</em></span>
                <span className="mobile-score">
                  {researchValue("composite_rank", row.composite_rank)}<small>综合分位</small>
                  {typeof row.composite_rank === "number" && Number.isFinite(row.composite_rank) &&
                    <span className="mobile-score-track" aria-hidden="true">
                      <span style={{ width: `${Math.max(0, Math.min(100, row.composite_rank))}%` }} />
                    </span>}
                </span>
              </span>
              <span className="mobile-result-metrics">
                <span>净资产收益率 <b>{researchValue("return_on_equity", row.return_on_equity)}</b></span>
                <span>营收增长 <b>{researchValue("revenue_growth", row.revenue_growth)}</b></span>
                <span>财务质量 <b>{row.piotroski_f == null ? "—" : `${researchValue("piotroski_f", row.piotroski_f)}/9`}</b></span>
              </span>
            </button>
          );
        })}
      </div>
      <table className="results">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const name = header.column.id;
                const direction = ariaSort(sort, name);
                return (
                  <th key={header.id} aria-sort={direction}>
                    <button
                      type="button"
                      className="th-sort"
                      onClick={() => onSort?.(name)}
                      title={`按${researchFieldLabel(name)}排序`}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {direction === "ascending" ? " ↑" : direction === "descending" ? " ↓" : ""}
                    </button>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={String(row.original.symbol) === selected ? "selected" : undefined}
              onClick={() => onSelect(String(row.original.symbol))}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
