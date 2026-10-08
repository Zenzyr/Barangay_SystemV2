"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CollectionPeriod, CollectionPeriodRow } from "@/app/types/report.type";
import { formatCurrency } from "@/app/utils/transactionFormat";
import { BarChart3 } from "lucide-react";

function shortLabel(period: CollectionPeriod, row: CollectionPeriodRow): string {
  if (period === "daily") return new Date(`${row.period}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  if (period === "monthly") return new Date(`${row.period}-01T00:00:00`).toLocaleDateString("en-PH", { month: "short", year: "2-digit" });
  return row.period.replace(/^\d{4}-W/, "Wk ");
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5 text-gray-600">
          <span className="inline-block size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <strong className="text-gray-900">{formatCurrency(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

export function CollectionTrendChart({
  rows,
  period,
  height = 256,
  showPending = true,
}: {
  rows: CollectionPeriodRow[] | { label: string; cash?: number; online?: number; collected?: number; pending: number }[];
  period?: CollectionPeriod;
  height?: number;
  showPending?: boolean;
}) {
  const data = rows.map((row) =>
    "period" in row
      ? { label: period ? shortLabel(period, row) : row.period, cash: row.cash, online: row.online, collected: row.collected, pending: row.pending }
      : row,
  );
  const stacked = data.some((d) => d.cash !== undefined);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-gray-400" style={{ height }}>
        <BarChart3 className="size-6" />
        <p className="text-sm">No collections in this period</p>
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v: number) => (v >= 1000 ? `₱${Math.round(v / 100) / 10}k` : `₱${v}`)}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {stacked ? (
            <>
              <Bar dataKey="cash" name="Cash" stackId="collected" fill="#10b981" />
              <Bar dataKey="online" name="Online" stackId="collected" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </>
          ) : (
            <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
          )}
          {showPending && <Bar dataKey="pending" name="Pending verification" fill="#fbbf24" radius={[4, 4, 0, 0]} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
