"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Rows3, Rows4, Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number;
  className?: string;
  align?: "left" | "right";
}

export interface TableFilter<T> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  predicate: (row: T, value: string) => boolean;
}

export interface CsvSpec<T> { filename: string; columns: { header: string; value: (row: T) => string | number | null | undefined }[] }

const csvCell = (v: string | number | null | undefined) => {
  let t = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; // stops spreadsheet formula injection
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export function downloadCsv<T>(spec: CsvSpec<T>, rows: T[]) {
  const text = [spec.columns.map((c) => csvCell(c.header)).join(","), ...rows.map((r) => spec.columns.map((c) => csvCell(c.value(r))).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", text], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `${spec.filename}-${new Date().toISOString().slice(0, 10)}.csv` });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  initialQuery?: string;
  filters?: TableFilter<T>[];
  pageSize?: number;
  onRowClick?: (row: T) => void;
  toolbar?: ReactNode;
  /** Adds an "Export CSV" button that downloads the rows currently shown by the search and filters. */
  csv?: CsvSpec<T>;
  empty: ReactNode;
  caption: string;
}

/** Search + filter + sort + paginate over rows already in memory (each admin list loads once, no live listeners). */
export function DataTable<T>({ rows, columns, rowKey, searchText, searchPlaceholder = "Search", initialQuery = "", filters = [], pageSize = 10, onRowClick, toolbar, csv, empty, caption }: Props<T>) {
  const [query, setQuery] = useState(initialQuery);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);
  const [dense, setDense] = useState(false);
  useEffect(() => { try { setDense(localStorage.getItem("table.dense") === "1"); } catch { /* storage unavailable */ } }, []);
  const toggleDense = () => setDense((d) => { try { localStorage.setItem("table.dense", d ? "0" : "1"); } catch { /* ignore */ } return !d; });

  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(() => setPage(0), [query, filterValues, sort, rows.length]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows.filter((r) => (q && searchText ? searchText(r).toLowerCase().includes(q) : true));
    for (const f of filters) {
      const v = filterValues[f.key];
      if (v) out = out.filter((r) => f.predicate(r, v));
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) {
        const get = col.sortValue;
        out = [...out].sort((a, b) => {
          const x = get(a), y = get(b);
          const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
          return sort.dir === "asc" ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [rows, query, filterValues, sort, columns, filters, searchText]);

  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = visible.slice(current * pageSize, current * pageSize + pageSize);

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));

  return (
    <div className="panel overflow-hidden rounded-xl2">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-gradient-to-b from-white to-paper/60 p-3.5">
        {searchText && (
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} className="field pl-9" />
          </div>
        )}
        {filters.map((f) => (
          <select key={f.key} aria-label={f.label} value={filterValues[f.key] ?? ""} onChange={(e) => setFilterValues((cur) => ({ ...cur, [f.key]: e.target.value }))} className="field w-auto min-w-[9rem]">
            <option value="">{f.label}: all</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={toggleDense} aria-pressed={dense} aria-label={dense ? "Use roomy rows" : "Use compact rows"} title={dense ? "Roomy rows" : "Compact rows"} className="hidden h-8 w-8 place-items-center rounded-field border border-line bg-surface text-ink-600 transition hover:border-ink-300 sm:grid">{dense ? <Rows3 className="h-4 w-4" aria-hidden /> : <Rows4 className="h-4 w-4" aria-hidden />}</button>
          {csv && rows.length > 0 && <Button size="sm" variant="secondary" onClick={() => downloadCsv(csv, visible)} title="Download what's shown as a spreadsheet"><Download className="h-3.5 w-3.5" aria-hidden />Export</Button>}
          {toolbar}
        </div>
      </div>

      {rows.length === 0 ? (
        empty
      ) : visible.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-muted">Nothing matches those filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead className="border-b border-line bg-paper/80 text-xs font-semibold text-ink-600">
              <tr>
                {columns.map((c) => {
                  const sorted = sort?.key === c.key ? sort.dir : null;
                  return (
                    <th key={c.key} scope="col" aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined} className={cn("whitespace-nowrap px-4 py-3", c.align === "right" && "text-right", c.className)}>
                      {c.sortValue ? (
                        <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-ink-900">
                          {c.header}
                          {sorted === "asc" ? <ArrowUp className="h-3 w-3" aria-hidden /> : sorted === "desc" ? <ArrowDown className="h-3 w-3" aria-hidden /> : <ArrowUpDown className="h-3 w-3 opacity-30" aria-hidden />}
                        </button>
                      ) : c.header}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {slice.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn("group transition-colors hover:bg-accent/[0.07]", onRowClick && "cursor-pointer")}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 align-middle", dense ? "py-1.5" : "py-3.5", c.align === "right" && "text-right tabular", c.className)}>{c.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visible.length > pageSize && (
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted">
          <span>{current * pageSize + 1}–{Math.min((current + 1) * pageSize, visible.length)} of {visible.length}</span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setPage(current - 1)} disabled={current === 0} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="px-1 tabular">Page {current + 1} of {pages}</span>
            <Button size="sm" variant="ghost" onClick={() => setPage(current + 1)} disabled={current >= pages - 1} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
