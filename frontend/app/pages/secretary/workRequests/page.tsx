"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { WorkRequestItem } from "@/app/types/work.type";
import { apiErrorMessage, formatDateTime } from "@/app/utils/transactionFormat";
import { OPEN_WORK_STATUSES, WORK_STATUS_OPTIONS, formatScheduleDate } from "@/app/utils/workRequest";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkKindBadge, WorkStatusBadge } from "@/components/workRequest/WorkRequestCard";
import { RescheduleDialog } from "@/components/workRequest/RescheduleDialog";
import { CalendarClock, ChevronLeft, ChevronRight, FilterX, Hammer, Inbox, Search } from "lucide-react";

const ALL = "all";
const PAGE_SIZE = 15;

export default function Page() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [reschedule, setReschedule] = useState<WorkRequestItem | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (search) p.search = search;
    if (status) p.status = status;
    if (kind) p.kind = kind;
    if (from) p.from = from;
    if (to) p.to = to;
    return p;
  }, [search, status, kind, from, to]);

  const { data = [], isLoading, isError, error } = useQuery<WorkRequestItem[]>({
    queryKey: ["work-requests", "staff", params],
    queryFn: async () => (await axiosInstance.get("/work/requests", { params })).data,
    placeholderData: keepPreviousData,
  });

  const pages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = data.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const stats = useMemo(
    () => ({
      total: data.length,
      pending: data.filter((d) => d.status === "pending").length,
      active: data.filter((d) => ["active", "accepted", "to review"].includes(d.status)).length,
      unscheduled: data.filter((d) => !d.scheduledDate).length,
    }),
    [data],
  );
  const hasFilters = !!(searchInput || status || kind || from || to);

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center shrink-0 shadow-sm">
          <Hammer className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Work Requests</h1>
          <p className="text-sm text-gray-500 mt-0.5">Resident work bookings and service requests with their scheduled time slots</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, tone: "text-gray-900" },
          { label: "Pending", value: stats.pending, tone: "text-amber-700" },
          { label: "In Progress", value: stats.active, tone: "text-sky-700" },
          { label: "No Schedule", value: stats.unscheduled, tone: "text-rose-700" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{c.label}</p>
            {isLoading ? <Skeleton className="h-6 w-12 mt-2" /> : <p className={`text-xl font-bold mt-1 ${c.tone}`}>{c.value}</p>}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input placeholder="Search request, resident, provider, or category..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-9 h-9 border-gray-200" />
          </div>
          {hasFilters && (
            <Button
              variant="outline"
              className="h-9 gap-1.5 border-gray-200 text-gray-600"
              onClick={() => {
                setSearchInput("");
                setStatus("");
                setKind("");
                setFrom("");
                setTo("");
                setPage(1);
              }}
            >
              <FilterX className="size-4" /> Clear filters
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500">Scheduled from</label>
            <Input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-9 border-gray-200" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500">Scheduled to</label>
            <Input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-9 border-gray-200" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500">Status</label>
            <Select value={status || ALL} onValueChange={(v) => { setStatus(v === ALL ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-full h-9 border-gray-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {WORK_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500">Type</label>
            <Select value={kind || ALL} onValueChange={(v) => { setKind(v === ALL ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-full h-9 border-gray-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                <SelectItem value="booking">Booking</SelectItem>
                <SelectItem value="service">Service Contract</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                {["Request", "Resident", "Provider", "Schedule", "Status", "Created", ""].map((h, i) => (
                  <TableHead
                    key={i}
                    className={`text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80 ${h === "Provider" ? "hidden lg:table-cell" : ""} ${h === "Created" ? "hidden md:table-cell" : ""} ${h === "" ? "text-right" : ""}`}
                  >
                    {h || "Actions"}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full max-w-[120px]" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-14 text-sm text-rose-600">{apiErrorMessage(error, "Failed to load work requests.")}</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center"><Inbox className="size-6" /></div>
                      <p className="text-sm font-medium">{hasFilters ? "No work requests match your filters" : "No work requests yet"}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((item) => (
                  <TableRow key={`${item.kind}-${item._id}`} className="hover:bg-slate-50/60">
                    <TableCell>
                      <p className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">{item.title}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <WorkKindBadge kind={item.kind} />
                        {item.category && <span className="text-[11px] text-sky-700">{item.category}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-700">
                      <p className="truncate max-w-[150px]">{item.client?.name || "Unknown"}</p>
                      {item.client?.purok && <p className="text-[11px] text-gray-400">{item.client.purok}</p>}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-gray-700">{item.provider?.name || "Unknown"}</TableCell>
                    <TableCell>
                      {item.scheduledDate ? (
                        <div>
                          <p className="text-sm font-medium text-gray-900 whitespace-nowrap">{formatScheduleDate(item.scheduledDate, { month: "short", day: "numeric", year: "numeric" })}</p>
                          <p className="text-[11px] text-sky-700 whitespace-nowrap">{item.scheduleLabel}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No schedule assigned</span>
                      )}
                    </TableCell>
                    <TableCell><WorkStatusBadge status={item.status} /></TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-gray-500">{formatDateTime(item.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!OPEN_WORK_STATUSES.includes(item.status) || !item.provider}
                        onClick={() => setReschedule(item)}
                        className="h-8 text-xs gap-1.5 border-sky-200 text-sky-700 hover:bg-sky-50"
                      >
                        <CalendarClock className="size-3.5" />
                        {item.scheduledDate ? "Reschedule" : "Schedule"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {data.length > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
            <span>Showing {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, data.length)} of {data.length}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 border-gray-200" disabled={current <= 1} onClick={() => setPage(current - 1)}><ChevronLeft className="size-4" /></Button>
              <span className="px-2">Page {current} of {pages}</span>
              <Button variant="outline" size="sm" className="h-8 border-gray-200" disabled={current >= pages} onClick={() => setPage(current + 1)}><ChevronRight className="size-4" /></Button>
            </div>
          </div>
        )}
      </div>

      <RescheduleDialog item={reschedule} onOpenChange={(o) => !o && setReschedule(null)} />
    </div>
  );
}
