"use client";

import { forwardRef } from "react";
import { ReportResponse } from "@/app/types/report.type";
import { BreakdownTable, ReportColumn, ReportRow, SummaryStat, breakdowns, summaryStats } from "./reportColumns";

export const PRINT_PAGE = { width: 1123, height: 794 };
export const ROWS_PER_PAGE = 22;
const BREAKDOWN_ROW_LIMIT = 12;

const TONES: Record<NonNullable<SummaryStat["tone"]>, string> = {
  default: "#0f172a",
  success: "#047857",
  warning: "#b45309",
  danger: "#be123c",
  info: "#0369a1",
};

const pageStyle: React.CSSProperties = {
  width: PRINT_PAGE.width,
  height: PRINT_PAGE.height,
  padding: "36px 40px 28px",
  boxSizing: "border-box",
  background: "#ffffff",
  color: "#0f172a",
  fontFamily: "Arial, Helvetica, sans-serif",
  display: "flex",
  flexDirection: "column",
  position: "relative",
  overflow: "hidden",
};

const cell: React.CSSProperties = {
  padding: "0 8px",
  height: 24,
  lineHeight: "24px",
  fontSize: 10.5,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  borderBottom: "1px solid #e2e8f0",
};

function PageHeader({ title, barangayName, logoUrl, period, compact }: { title: string; barangayName: string; logoUrl?: string; period: string; compact?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: compact ? 10 : 14, borderBottom: "2px solid #0ea5e9", marginBottom: compact ? 12 : 16 }}>
      {logoUrl && !compact && (
        <img src={logoUrl} alt="" crossOrigin="anonymous" style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }} />
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: compact ? 10 : 11, letterSpacing: 2, textTransform: "uppercase", color: "#64748b" }}>
          {barangayName} · Barangay Information Management System
        </div>
        <div style={{ fontSize: compact ? 15 : 22, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>{title}</div>
      </div>
      <div style={{ textAlign: "right", fontSize: 10.5, color: "#475569" }}>
        <div style={{ fontWeight: 700, color: "#0f172a" }}>Reporting period</div>
        <div>{period}</div>
      </div>
    </div>
  );
}

function PageFooter({ page, total, generatedAt }: { page: number; total: number; generatedAt: string }) {
  return (
    <div style={{ marginTop: "auto", paddingTop: 8, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "#64748b" }}>
      <span>Generated {generatedAt} · Confidential — for official barangay use</span>
      <span style={{ fontWeight: 700 }}>
        Page {page} of {total}
      </span>
    </div>
  );
}

function Breakdown({ table }: { table: BreakdownTable }) {
  const rows = table.rows.slice(0, BREAKDOWN_ROW_LIMIT);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: "#0f172a" }}>{table.title}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <thead>
          <tr style={{ background: "#f1f5f9" }}>
            {table.headers.map((h, i) => (
              <th key={h} style={{ ...cell, fontSize: 9.5, fontWeight: 700, color: "#475569", textAlign: i === 0 ? "left" : "right", textTransform: "uppercase" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={table.headers.length} style={{ ...cell, color: "#94a3b8" }}>
                No data
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => (
                  <td key={j} style={{ ...cell, textAlign: j === 0 ? "left" : "right" }}>
                    {v}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {table.rows.length > BREAKDOWN_ROW_LIMIT && (
        <div style={{ fontSize: 9.5, color: "#64748b", marginTop: 4 }}>+{table.rows.length - BREAKDOWN_ROW_LIMIT} more</div>
      )}
    </div>
  );
}

export const ReportPrintLayout = forwardRef<
  HTMLDivElement,
  {
    report: ReportResponse;
    title: string;
    rows: ReportRow[];
    columns: ReportColumn[];
    filters: { label: string; value: string }[];
    period: string;
    barangayName: string;
    logoUrl?: string;
    searchNote?: string;
  }
>(function ReportPrintLayout({ report, title, rows, columns, filters, period, barangayName, logoUrl, searchNote }, ref) {
  const stats = summaryStats(report);
  const tables = breakdowns(report);
  const chunks: ReportRow[][] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) chunks.push(rows.slice(i, i + ROWS_PER_PAGE));
  const totalPages = 1 + Math.max(chunks.length, 1);
  const generatedAt = new Date(report.generatedAt).toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div ref={ref}>
      <div data-report-page style={pageStyle}>
        <PageHeader title={title} barangayName={barangayName} logoUrl={logoUrl} period={period} />

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", fontSize: 10.5, color: "#334155", marginBottom: 14 }}>
          <span style={{ fontWeight: 700, color: "#0f172a" }}>Filters:</span>
          {filters.length === 0 ? (
            <span>None (all records)</span>
          ) : (
            filters.map((f) => (
              <span key={f.label}>
                {f.label}: <strong>{f.value}</strong>
              </span>
            ))
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", background: "#f8fafc" }}>
              <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.8, color: "#64748b" }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2, color: TONES[s.tone || "default"] }}>{s.value}</div>
              {s.hint && <div style={{ fontSize: 9.5, color: "#64748b" }}>{s.hint}</div>}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 24 }}>
          {tables.map((t) => (
            <Breakdown key={t.title} table={t} />
          ))}
        </div>

        <div style={{ fontSize: 10, color: "#475569", marginTop: 14 }}>
          Detailed records: {rows.length} row{rows.length === 1 ? "" : "s"}
          {searchNote ? ` · ${searchNote}` : ""}
          {report.truncated ? ` · limited to the first ${report.rows.length} of ${report.totalRows} matching records` : ""}
        </div>

        <PageFooter page={1} total={totalPages} generatedAt={generatedAt} />
      </div>

      {(chunks.length ? chunks : [[]]).map((chunk, index) => (
        <div key={index} data-report-page style={pageStyle}>
          <PageHeader title={`${title} — Detailed Records`} barangayName={barangayName} period={period} compact />
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 34 }} />
              {columns.map((c) => (
                <col key={c.key} style={{ width: c.width }} />
              ))}
            </colgroup>
            <thead>
              <tr style={{ background: "#0f172a" }}>
                <th style={{ ...cell, color: "#ffffff", fontSize: 9.5, textAlign: "left" }}>#</th>
                {columns.map((c) => (
                  <th key={c.key} style={{ ...cell, color: "#ffffff", fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", textAlign: c.align || "left" }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chunk.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} style={{ ...cell, textAlign: "center", color: "#94a3b8", height: 60 }}>
                    No records match the selected filters.
                  </td>
                </tr>
              ) : (
                chunk.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 ? "#f8fafc" : "#ffffff" }}>
                    <td style={{ ...cell, color: "#94a3b8" }}>{index * ROWS_PER_PAGE + i + 1}</td>
                    {columns.map((c) => (
                      <td key={c.key} style={{ ...cell, textAlign: c.align || "left" }}>
                        {c.value(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <PageFooter page={index + 2} total={totalPages} generatedAt={generatedAt} />
        </div>
      ))}
    </div>
  );
});
