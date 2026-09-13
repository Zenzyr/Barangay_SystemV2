"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
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
import ViewReviewsModal from "@/components/ui/viewReviewsModal";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Users,
  Search,
  Briefcase,
  Star,
  Clock,
  BadgeCheck,
  Mail,
  Phone,
  MapPin,
  MessageSquareText,
  SlidersHorizontal,
  X,
  UserRound,
  Loader2,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────
interface Skill {
  _id: string;
  skill: string;
  experience: number;
  proficiency: string;
}

interface Review {
  _id?: string;
  user: string;
  userProfile: string;
  star: number;
  skill: string;
  message: string;
}

interface Resident {
  _id: string;
  name: string;
  address: string;
  email: string;
  contact: string;
  profile: string;
  status: string;
  skills: Skill[];
  reviews: Review[];
  averageRating: number;
  totalReviews: number;
}

const PROFICIENCY_LEVELS = ["Beginner", "Intermediate", "Advanced"];

const PROFICIENCY_COLORS: Record<string, string> = {
  Beginner: "#10b981",
  Intermediate: "#0ea5e9",
  Advanced: "#8b5cf6",
};

const CHART_COLORS = [
  "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#06b6d4", "#d946ef", "#eab308", "#22c55e", "#3b82f6",
];

// ─── Star Rating Display ──────────────────────────────────────────
function StarRatingDisplay({ rating, total }: { rating: number; total: number }) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center">
        {Array.from({ length: fullStars }).map((_, i) => (
          <Star key={`full-${i}`} className="size-3.5 fill-amber-400 text-amber-400" />
        ))}
        {hasHalf && (
          <div className="relative size-3.5">
            <Star className="absolute inset-0 size-3.5 fill-gray-200 text-gray-200" />
            <div className="absolute inset-0 overflow-hidden w-1/2">
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
            </div>
          </div>
        )}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Star key={`empty-${i}`} className="size-3.5 fill-gray-200 text-gray-200" />
        ))}
      </div>
      <span className="text-xs font-medium text-gray-600">
        {rating > 0 ? rating.toFixed(1) : "—"}
      </span>
      <span className="text-xs text-gray-400">
        ({total} {total === 1 ? "review" : "reviews"})
      </span>
    </div>
  );
}

// ─── Proficiency Badge ────────────────────────────────────────────
function ProficiencyBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    Beginner: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Intermediate: "bg-sky-50 text-sky-700 border-sky-200",
    Advanced: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
        colors[level] || "bg-gray-50 text-gray-600 border-gray-200"
      }`}
    >
      {level}
    </span>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────
function ResidentCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────
interface ChartTooltipPayloadItem {
  name?: string;
  value?: string | number;
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string | number;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-md px-3 py-2 text-sm">
        <p className="font-semibold text-gray-900">{label}</p>
        {payload.map((entry: ChartTooltipPayloadItem, index: number) => (
          <p key={index} style={{ color: entry.color }} className="font-medium">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

// ─── Main Page ────────────────────────────────────────────────────
export default function SecretaryResidentSkillsPage() {
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [proficiencyFilter, setProficiencyFilter] = useState("");
  const [minExperience, setMinExperience] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // View reviews modal
  const [viewReviewsOpen, setViewReviewsOpen] = useState(false);
  const [viewReviewsResident, setViewReviewsResident] = useState<Resident | null>(null);

  // Fetch residents with skills
  const { data: residents, isLoading } = useQuery<Resident[]>({
    queryKey: ["secretary", "residents", "skills"],
    queryFn: async () => {
      const res = await axiosInstance.get("/account/residents/skills");
      return res.data;
    },
  });

  // Extract unique skill names
  const allSkillNames = useMemo(() => {
    const names = new Set<string>();
    residents?.forEach((r) => r.skills?.forEach((s) => names.add(s.skill)));
    return Array.from(names).sort();
  }, [residents]);

  // ── Analytics Data ────────────────────────────────────────────
  const skillDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    residents?.forEach((r) => {
      r.skills?.forEach((s) => {
        counts[s.skill] = (counts[s.skill] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [residents]);

  const proficiencyDistribution = useMemo(() => {
    const counts: Record<string, number> = {
      Beginner: 0,
      Intermediate: 0,
      Advanced: 0,
    };
    residents?.forEach((r) => {
      r.skills?.forEach((s) => {
        if (counts[s.proficiency] !== undefined) {
          counts[s.proficiency]++;
        }
      });
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [residents]);

  const totalResidents = residents?.length || 0;
  const totalSkills = useMemo(
    () => residents?.reduce((sum, r) => sum + (r.skills?.length || 0), 0) || 0,
    [residents]
  );
  const avgSkillPerResident = totalResidents > 0 ? (totalSkills / totalResidents).toFixed(1) : "0";

  // ── Filtered Residents ────────────────────────────────────────
  const filteredResidents = useMemo(() => {
    if (!residents) return [];

    return residents.filter((resident) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          resident.name.toLowerCase().includes(q) ||
          resident.email.toLowerCase().includes(q) ||
          (resident.contact || "").toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      if (skillFilter && skillFilter !== "all") {
        const hasSkill = resident.skills?.some((s) => s.skill === skillFilter);
        if (!hasSkill) return false;
      }

      if (proficiencyFilter && proficiencyFilter !== "all") {
        const hasProficiency = resident.skills?.some(
          (s) => s.proficiency === proficiencyFilter
        );
        if (!hasProficiency) return false;
      }

      if (minExperience) {
        const minExp = Number(minExperience);
        if (!isNaN(minExp) && minExp > 0) {
          const hasExp = resident.skills?.some((s) => s.experience >= minExp);
          if (!hasExp) return false;
        }
      }

      return true;
    });
  }, [residents, searchQuery, skillFilter, proficiencyFilter, minExperience]);

  const openViewReviews = (resident: Resident) => {
    setViewReviewsResident(resident);
    setViewReviewsOpen(true);
  };

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center shadow-sm">
            <BarChart3 className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              Resident Skills Overview
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Browse all registered residents, their skills, and community feedback
            </p>
          </div>
        </div>
      </div>

      {/* ── Analytics Section ── */}
      {!isLoading && residents && residents.length > 0 && (
        <div className="space-y-4">
          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2 text-sky-600 mb-1">
                <Users className="size-4" />
                <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Residents</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{totalResidents}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <Briefcase className="size-4" />
                <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Total Skills</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{totalSkills}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2 text-violet-600 mb-1">
                <TrendingUp className="size-4" />
                <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Avg/Resident</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{avgSkillPerResident}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2 text-amber-600 mb-1">
                <Star className="size-4" />
                <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Avg Rating</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {residents.length > 0
                  ? (residents.reduce((s, r) => s + (r.averageRating || 0), 0) / residents.length).toFixed(1)
                  : "0"}
              </p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Skills Bar Chart */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-8 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
                  <BarChart3 className="size-4" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Top Skills</h3>
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {skillDistribution.length}
                </span>
              </div>
              {skillDistribution.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={skillDistribution} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        axisLine={{ stroke: "#e5e7eb" }}
                        tickLine={false}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" name="Residents" radius={[4, 4, 0, 0]}>
                        {skillDistribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center gap-2 text-center text-gray-400">
                  <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center">
                    <BarChart3 className="size-5" />
                  </div>
                  <p className="text-sm">No skill data available</p>
                </div>
              )}
            </div>

            {/* Proficiency Pie Chart */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-8 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
                  <PieChartIcon className="size-4" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Proficiency Distribution</h3>
              </div>
              {proficiencyDistribution.some((d) => d.value > 0) ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={proficiencyDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {proficiencyDistribution.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={PROFICIENCY_COLORS[entry.name] || "#9ca3af"}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value: string) => (
                          <span className="text-xs text-gray-600">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center gap-2 text-center text-gray-400">
                  <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center">
                    <PieChartIcon className="size-5" />
                  </div>
                  <p className="text-sm">No proficiency data available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Search & Filter Controls ── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              placeholder="Search by name, email, or contact..."
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
            {(skillFilter || proficiencyFilter || minExperience) && (
              <span className="size-2 rounded-full bg-sky-500" />
            )}
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Briefcase className="size-3" />
                Skill
              </label>
              <Select value={skillFilter} onValueChange={setSkillFilter}>
                <SelectTrigger className="w-full h-9 border-gray-200 bg-white">
                  <SelectValue placeholder="All skills" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All skills</SelectItem>
                  {allSkillNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <BadgeCheck className="size-3" />
                Proficiency
              </label>
              <Select value={proficiencyFilter} onValueChange={setProficiencyFilter}>
                <SelectTrigger className="w-full h-9 border-gray-200 bg-white">
                  <SelectValue placeholder="All levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  {PROFICIENCY_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Clock className="size-3" />
                Min. Years of Exp.
              </label>
              <Input
                type="number"
                min="0"
                placeholder="e.g. 2"
                value={minExperience}
                onChange={(e) => setMinExperience(e.target.value)}
                className="h-9 border-gray-200 bg-white"
              />
            </div>

            {(skillFilter || proficiencyFilter || minExperience) && (
              <div className="sm:col-span-3 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSkillFilter("");
                    setProficiencyFilter("");
                    setMinExperience("");
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  <X className="size-3" />
                  Clear all filters
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Results Count ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-3 animate-spin" />
              Loading residents...
            </span>
          ) : (
            <>
              Showing{" "}
              <strong className="text-gray-700">{filteredResidents.length}</strong>{" "}
              {filteredResidents.length === 1 ? "resident" : "residents"}
            </>
          )}
        </p>
      </div>

      {/* ── Resident Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ResidentCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredResidents.length === 0 ? (
        <div className="text-center py-16">
          <div className="size-12 rounded-full bg-slate-100 text-slate-300 mx-auto flex items-center justify-center mb-4">
            <Users className="size-6" />
          </div>
          <p className="text-lg font-medium text-gray-500">
            {searchQuery || skillFilter || proficiencyFilter || minExperience
              ? "No residents match your filters"
              : "No residents found"}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {searchQuery || skillFilter || proficiencyFilter || minExperience
              ? "Try adjusting your search or filter criteria"
              : "Residents with skills will appear here once they register"}
          </p>
          {(searchQuery || skillFilter || proficiencyFilter || minExperience) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSkillFilter("");
                setProficiencyFilter("");
                setMinExperience("");
              }}
              className="mt-4 border-gray-200 text-gray-600"
            >
              <X className="size-3.5" />
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredResidents.map((resident) => (
            <ResidentCard
              key={resident._id}
              resident={resident}
              onViewReviews={() => openViewReviews(resident)}
            />
          ))}
        </div>
      )}

      {/* ── View Reviews Modal ── */}
      {viewReviewsResident && (
        <ViewReviewsModal
          open={viewReviewsOpen}
          onOpenChange={setViewReviewsOpen}
          residentName={viewReviewsResident.name}
          reviews={viewReviewsResident.reviews || []}
          averageRating={viewReviewsResident.averageRating || 0}
          totalReviews={viewReviewsResident.totalReviews || 0}
        />
      )}
    </div>
  );
}

// ─── Resident Card ────────────────────────────────────────────────
function ResidentCard({
  resident,
  onViewReviews,
}: {
  resident: Resident;
  onViewReviews: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const displaySkills = expanded
    ? resident.skills
    : resident.skills?.slice(0, 2);
  const hasMoreSkills = (resident.skills?.length || 0) > 2;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md hover:border-sky-200 transition-all duration-200">
      {/* Resident Info Header */}
      <div className="p-5 pb-3">
        <div className="flex items-start gap-3">
          <div className="size-12 rounded-full overflow-hidden bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shrink-0 border-2 border-white shadow-sm">
            {resident.profile ? (
              <img
                src={resident.profile}
                alt={resident.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <UserRound className="size-6 text-sky-600" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {resident.name}
            </h3>
            <StarRatingDisplay
              rating={resident.averageRating || 0}
              total={resident.totalReviews || 0}
            />
          </div>
        </div>

        {/* Contact Info */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Mail className="size-3.5 text-gray-400 shrink-0" />
            <span className="truncate">{resident.email}</span>
          </div>
          {resident.contact && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Phone className="size-3.5 text-gray-400 shrink-0" />
              <span>{resident.contact}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <MapPin className="size-3.5 text-gray-400 shrink-0" />
            <span className="truncate">{resident.address}</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-slate-100" />

      {/* Skills Section */}
      <div className="p-5 pt-3">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Briefcase className="size-3.5 text-sky-500" />
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Skills
          </span>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
            {resident.skills?.length || 0}
          </span>
        </div>

        {resident.skills && resident.skills.length > 0 ? (
          <div className="space-y-2">
            {displaySkills.map((skill) => (
              <div
                key={skill._id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100 hover:border-sky-100 hover:bg-sky-50/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {skill.skill}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock className="size-3 text-gray-400" />
                    <span className="text-[11px] text-gray-500">
                      {skill.experience}{" "}
                      {skill.experience === 1 ? "yr" : "yrs"}
                    </span>
                  </div>
                </div>
                <ProficiencyBadge level={skill.proficiency} />
              </div>
            ))}

            {hasMoreSkills && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full text-xs text-sky-600 hover:text-sky-700 font-medium py-1.5 transition-colors"
              >
                {expanded
                  ? "Show less"
                  : `+${resident.skills.length - 2} more skills`}
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No skills listed</p>
        )}

        {/* View Reviews Button */}
        {(resident.totalReviews || 0) > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewReviews}
            className="w-full mt-3 h-8 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-all"
          >
            <MessageSquareText className="size-3.5" />
            View {resident.totalReviews} {resident.totalReviews === 1 ? "Review" : "Reviews"}
          </Button>
        )}
      </div>
    </div>
  );
}
