"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { businessInterface } from "@/app/types/business.type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Store,
  Search,
  MapPin,
  FileText,
  ImageIcon,
  Package,
  UserRound,
  Building2,
  Loader2,
  SlidersHorizontal,
  X,
  Star,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

// ─── Loading skeleton ─────────────────────────────────────────────
function BusinessCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <Skeleton className="h-40 w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

export default function BusinessDirectoryPage() {
  // ── State ──────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // View modal
  const [viewBusiness, setViewBusiness] = useState<businessInterface | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  // ── Fetch approved businesses ──────────────────────────────────
  const { data: businesses, isLoading } = useQuery<businessInterface[]>({
    queryKey: ["businesses", "approved"],
    queryFn: async () => {
      const res = await axiosInstance.get("/business", {
        params: { status: "approved" },
      });
      return res.data;
    },
  });

  // ── Extract unique business types for filter ───────────────────
  const allTypes = useMemo(() => {
    const types = new Set<string>();
    businesses?.forEach((b) => types.add(b.type));
    return Array.from(types).sort();
  }, [businesses]);

  // ── Filter businesses ──────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!businesses) return [];

    return businesses.filter((b) => {
      // Text search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          b.businessName.toLowerCase().includes(q) ||
          b.type.toLowerCase().includes(q) ||
          b.address.toLowerCase().includes(q) ||
          b.businessInfo.toLowerCase().includes(q) ||
          (b.resident?.name || "").toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // Type filter
      if (typeFilter && typeFilter !== "all") {
        if (b.type !== typeFilter) return false;
      }

      return true;
    });
  }, [businesses, searchQuery, typeFilter]);

  const openView = (business: businessInterface) => {
    setViewBusiness(business);
    setViewOpen(true);
  };

  const hasActiveFilters = searchQuery || (typeFilter && typeFilter !== "all");

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Store className="size-6 text-sky-600" />
          Business Directory
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Browse registered businesses and services in the barangay
        </p>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              placeholder="Search by name, type, address, or owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={`h-10 border-gray-200 transition-all ${
              showFilters
                ? "bg-sky-50 border-sky-200 text-sky-700"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <SlidersHorizontal className="size-4" />
            Filters
            {typeFilter && typeFilter !== "all" && (
              <span className="size-2 rounded-full bg-sky-500" />
            )}
          </Button>
        </div>

        {/* Expandable Filter Panel */}
        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Package className="size-3" />
                Business Type
              </label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full h-9 border-gray-200 bg-white">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {allTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {typeFilter && typeFilter !== "all" && (
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTypeFilter("")}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  <X className="size-3" />
                  Clear
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Results count ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-3 animate-spin" />
              Loading businesses...
            </span>
          ) : (
            <>
              Showing{" "}
              <strong className="text-gray-700">{filtered.length}</strong>{" "}
              {filtered.length === 1 ? "business" : "businesses"}
            </>
          )}
        </p>
      </div>

      {/* ── Business Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <BusinessCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="size-16 rounded-2xl bg-gray-50 mx-auto flex items-center justify-center mb-4">
            <Store className="size-8 text-gray-300" />
          </div>
          <p className="text-lg font-medium text-gray-500">
            {hasActiveFilters
              ? "No businesses match your filters"
              : "No approved businesses yet"}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {hasActiveFilters
              ? "Try adjusting your search or filter criteria"
              : "Businesses will appear here once they are approved"}
          </p>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setTypeFilter("");
              }}
              className="mt-4 border-gray-200 text-gray-600"
            >
              <X className="size-3.5" />
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((business) => (
            <BusinessCard
              key={business._id}
              business={business}
              onView={() => openView(business)}
            />
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          VIEW BUSINESS DETAILS MODAL
          ════════════════════════════════════════════════════════════ */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewBusiness && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <div className="size-8 rounded-lg bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center">
                    <Building2 className="size-4 text-sky-600" />
                  </div>
                  {viewBusiness.businessName}
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-500">
                  Business details and information
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-2">
                {/* ── Logo + Basic Info ── */}
                <div className="flex items-start gap-4">
                  <div className="size-20 rounded-xl overflow-hidden border border-gray-200 bg-gradient-to-br from-sky-100 to-emerald-100 shrink-0">
                    {viewBusiness.logo ? (
                      <img
                        src={viewBusiness.logo}
                        alt={viewBusiness.businessName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Building2 className="size-8 text-sky-400" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <h2 className="font-semibold text-gray-900 text-lg">
                      {viewBusiness.businessName}
                    </h2>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
                        <Package className="size-3" />
                        {viewBusiness.type}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Star className="size-3" />
                        Approved
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Owner / Registered By ── */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-sky-50 to-emerald-50/50 border border-sky-100">
                  <div className="size-9 rounded-full bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shrink-0">
                    <UserRound className="size-4 text-sky-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                      Business Owner
                    </p>
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {viewBusiness.resident?.name || "Unknown"}
                    </p>
                  </div>
                </div>

                {/* ── Business Info + Address ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                      About the Business
                    </p>
                    <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 border border-gray-100 leading-relaxed">
                      {viewBusiness.businessInfo}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                      Address
                    </p>
                    <div className="flex items-start gap-2 text-sm text-gray-800 bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <MapPin className="size-4 text-gray-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{viewBusiness.address}</span>
                    </div>
                  </div>
                </div>

                {/* ── Document ── */}
               

                {/* ── Images Gallery ── */}
                {viewBusiness.images && viewBusiness.images.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="size-3.5" />
                      Business Photos ({viewBusiness.images.length})
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {viewBusiness.images.map((img, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg overflow-hidden border border-gray-200 aspect-video group cursor-pointer"
                        >
                          <img
                            src={img}
                            alt={`${viewBusiness.businessName} photo ${idx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onClick={() => window.open(img, "_blank")}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Business Card ────────────────────────────────────────────────
function BusinessCard({
  business,
  onView,
}: {
  business: businessInterface;
  onView: () => void;
}) {
  return (
    <div
      className="group relative bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg hover:border-sky-200 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
      onClick={onView}
    >
      {/* Logo / Hero Image */}
      <div className="relative h-40 bg-gradient-to-br from-sky-100 to-emerald-100 overflow-hidden">
        {business.logo ? (
          <img
            src={business.logo}
            alt={business.businessName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Store className="size-12 text-sky-300/60" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Business type badge */}
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/90 text-sky-700 shadow-sm backdrop-blur-sm">
            <Package className="size-3" />
            {business.type}
          </span>
        </div>

        {/* View details indicator */}
        <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm rounded-lg px-2.5 py-1 text-xs font-medium text-sky-700 shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0 flex items-center gap-1">
          View Details
          <ChevronRight className="size-3" />
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate group-hover:text-sky-700 transition-colors">
          {business.businessName}
        </h3>

        <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
          {business.businessInfo}
        </p>

        {/* Address */}
        <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">{business.address}</span>
        </div>

        {/* Owner */}
        <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
          <UserRound className="size-3 shrink-0" />
          <span className="truncate">{business.resident?.name || "Unknown"}</span>
        </div>

        {/* Images count */}
        {business.images && business.images.length > 0 && (
          <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
            <ImageIcon className="size-3 shrink-0" />
            <span>{business.images.length} photo{business.images.length > 1 ? "s" : ""}</span>
          </div>
        )}
      </div>
    </div>
  );
}
