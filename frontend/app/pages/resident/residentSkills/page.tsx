"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import axiosInstance from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
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
} from "@/components/ui/dialog";
import { successAlert, errorAlert } from "@/app/utils/alert";
import RequestServiceModal from "@/components/ui/requestServiceModal";
import BookServiceModal from "@/components/ui/bookServiceModal";
import {
  Search,
  Briefcase,
  Star,
  Clock,
  Mail,
  Phone,
  MapPin,
  SlidersHorizontal,
  X,
  UserRound,
  CheckCircle2,
  ListChecks,
  Send,
  CalendarCheck,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────
interface ApiError {
  response?: { data?: unknown };
  message?: string;
}

interface ServiceRequestPayload {
  skill: string;
  serviceType: string;
  description: string;
  preferredDate: string;
  preferredTime: string;
  location: string;
  budget: number;
  notes: string;
}

interface Skill {
  _id: string;
  skill: string;
  experience: number;
  proficiency: string;
  serviceTypes?: string[];
}

interface Review {
  _id?: string;
  user: string;
  userProfile: string;
  star: number;
  skill: string;
  message: string;
}

type Availability = "AVAILABLE" | "BUSY" | "NOT_AVAILABLE";

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
  availability?: Availability;
  providerLocation?: string;
  providerDescription?: string;
  completedServices?: number;
}

const AVAILABILITY_CONFIG: Record<Availability, { label: string; dot: string; text: string; bg: string }> = {
  AVAILABLE: { label: "Available", dot: "bg-emerald-400", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  BUSY: { label: "Busy", dot: "bg-amber-400", text: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  NOT_AVAILABLE: { label: "Not Available", dot: "bg-red-400", text: "text-red-700", bg: "bg-red-50 border-red-200" },
};

function AvailabilityBadge({ availability }: { availability?: Availability }) {
  const cfg = AVAILABILITY_CONFIG[availability || "AVAILABLE"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text}`}>
      <span className={`size-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Star Rating Display ──────────────────────────────────────────
function StarRatingDisplay({ rating, total }: { rating: number; total: number }) {
  if (total === 0) {
    return <span className="text-xs text-gray-400 italic">No reviews yet</span>;
  }
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
      <span className="text-xs font-medium text-gray-600">{rating.toFixed(1)}</span>
      <span className="text-xs text-gray-400">({total})</span>
    </div>
  );
}

function ProficiencyBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    Beginner: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Intermediate: "bg-sky-50 text-sky-700 border-sky-200",
    Advanced: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${colors[level] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {level}
    </span>
  );
}

function ResidentCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function ResidentSkillsPage() {
  const queryClient = useQueryClient();
  const { user } = useUserStore();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Profile modal
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileResident, setProfileResident] = useState<Resident | null>(null);

  // Request service modal
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestResident, setRequestResident] = useState<Resident | null>(null);

  // Book service modal
  const [bookOpen, setBookOpen] = useState(false);
  const [bookResident, setBookResident] = useState<Resident | null>(null);

  const { data: residents, isLoading } = useQuery<Resident[]>({
    queryKey: ["residents", "skills"],
    queryFn: async () => (await axiosInstance.get("/account/residents/skills")).data,
  });

  const requestMutation = useMutation({
    mutationFn: async (payload: ServiceRequestPayload) => {
      await axiosInstance.post("/service-requests", { ...payload, provider: requestResident?._id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-requests"] });
      successAlert("Service request sent! You'll be notified once the provider responds.");
    },
    onError: (err: ApiError) => {
      const message = err?.response?.data || "Failed to send service request";
      errorAlert(typeof message === "string" ? message : "Failed to send service request");
      throw err;
    },
  });

  const bookMutation = useMutation({
    mutationFn: async ({ skill, service, description }: { skill: string; service: string; description: string }) => {
      await axiosInstance.post("/account/book", {
        client: user?._id,
        worker: bookResident?._id,
        skill,
        service,
        description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["works"] });
      successAlert("Service booked! The worker will confirm your booking.");
    },
    onError: (err: ApiError) => {
      const message = err?.response?.data || "Failed to book service";
      errorAlert(typeof message === "string" ? message : "Failed to book service");
      throw err;
    },
  });

  const allSkillNames = useMemo(() => {
    const names = new Set<string>();
    residents?.forEach((r) => r.skills?.forEach((s) => names.add(s.skill)));
    return Array.from(names).sort();
  }, [residents]);

  const allServiceTypes = useMemo(() => {
    const types = new Set<string>();
    residents?.forEach((r) => r.skills?.forEach((s) => s.serviceTypes?.forEach((st) => types.add(st))));
    return Array.from(types).sort();
  }, [residents]);

  const filteredResidents = useMemo(() => {
    if (!residents) return [];
    return residents.filter((resident) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSkill = resident.skills?.some((s) => s.skill.toLowerCase().includes(q) || s.serviceTypes?.some((st) => st.toLowerCase().includes(q)));
        const matchesName = resident.name.toLowerCase().includes(q);
        if (!matchesSkill && !matchesName) return false;
      }
      if (skillFilter && skillFilter !== "all") {
        if (!resident.skills?.some((s) => s.skill === skillFilter)) return false;
      }
      if (serviceTypeFilter && serviceTypeFilter !== "all") {
        if (!resident.skills?.some((s) => s.serviceTypes?.includes(serviceTypeFilter))) return false;
      }
      if (availabilityFilter && availabilityFilter !== "all") {
        if ((resident.availability || "AVAILABLE") !== availabilityFilter) return false;
      }
      if (locationFilter) {
        const loc = (resident.providerLocation || resident.address || "").toLowerCase();
        if (!loc.includes(locationFilter.toLowerCase())) return false;
      }
      return true;
    });
  }, [residents, searchQuery, skillFilter, serviceTypeFilter, availabilityFilter, locationFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setSkillFilter("");
    setServiceTypeFilter("");
    setAvailabilityFilter("");
    setLocationFilter("");
  };

  const hasActiveFilters = Boolean(searchQuery || skillFilter || serviceTypeFilter || availabilityFilter || locationFilter);

  const openProfile = (resident: Resident) => {
    setProfileResident(resident);
    setProfileOpen(true);
  };

  const openRequest = (resident: Resident) => {
    setRequestResident(resident);
    setRequestOpen(true);
    setProfileOpen(false);
  };

  const openBook = (resident: Resident) => {
    setBookResident(resident);
    setBookOpen(true);
    setProfileOpen(false);
  };

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center shrink-0">
            <Briefcase className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              Service Marketplace
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Find and request services from skilled residents in the barangay</p>
          </div>
        </div>
        <Link href="/pages/resident/serviceRequests">
          <Button variant="outline" className="h-9 text-sm border-gray-200 gap-1.5">
            <ListChecks className="size-4" />
            My Requests
          </Button>
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              placeholder="Search skills or services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 border-gray-200"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={`h-10 border-gray-200 shrink-0 ${showFilters ? "bg-sky-50 border-sky-200 text-sky-700" : ""}`}
          >
            <SlidersHorizontal className="size-4" />
            Filters
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <Select value={skillFilter} onValueChange={setSkillFilter}>
              <SelectTrigger className="h-9 border-gray-200"><SelectValue placeholder="Skill" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Skills</SelectItem>
                {allSkillNames.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
              <SelectTrigger className="h-9 border-gray-200"><SelectValue placeholder="Service Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Service Types</SelectItem>
                {allServiceTypes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
              <SelectTrigger className="h-9 border-gray-200"><SelectValue placeholder="Availability" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Availability</SelectItem>
                <SelectItem value="AVAILABLE">Available</SelectItem>
                <SelectItem value="BUSY">Busy</SelectItem>
                <SelectItem value="NOT_AVAILABLE">Not Available</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Location"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="h-9 border-gray-200"
            />
          </div>
        )}

        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1">
            <X className="size-3" /> Clear all filters
          </button>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <ResidentCardSkeleton key={i} />)}
        </div>
      ) : filteredResidents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
          <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center mx-auto mb-3">
            <Briefcase className="size-5" />
          </div>
          <p className="text-sm font-medium text-gray-500">No providers found</p>
          <p className="text-sm text-gray-400 mt-1">
            {hasActiveFilters ? "Try adjusting your search or filter criteria" : "Residents with skills will appear here once they register"}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4 border-gray-200 text-gray-600">
              <X className="size-3.5" /> Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredResidents.map((resident) => (
            <ResidentCard
              key={resident._id}
              resident={resident}
              isOwnProfile={user?._id === resident._id}
              onViewProfile={() => openProfile(resident)}
              onRequestService={() => openRequest(resident)}
              onBookService={() => openBook(resident)}
            />
          ))}
        </div>
      )}

      {/* Provider Profile Modal */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {profileResident && (
            <>
              <DialogHeader>
                <DialogTitle className="sr-only">{profileResident.name}&apos;s Profile</DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-4">
                <div className="size-16 rounded-full overflow-hidden bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shrink-0 border-2 border-white shadow-sm">
                  {profileResident.profile ? (
                    <img src={profileResident.profile} alt={profileResident.name} className="w-full h-full object-cover" />
                  ) : (
                    <UserRound className="size-8 text-sky-600" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{profileResident.name}</h2>
                  <AvailabilityBadge availability={profileResident.availability} />
                </div>
              </div>

              {profileResident.providerDescription && (
                <p className="text-sm text-gray-600 mt-4">{profileResident.providerDescription}</p>
              )}

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-lg font-bold text-gray-900">{profileResident.completedServices || 0}</p>
                  <p className="text-xs text-gray-500">Completed Services</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <StarRatingDisplay rating={profileResident.averageRating || 0} total={profileResident.totalReviews || 0} />
                  <p className="text-xs text-gray-500 mt-1">Rating</p>
                </div>
              </div>

              <div className="mt-4 space-y-1.5 text-sm text-gray-500">
                <div className="flex items-center gap-2"><MapPin className="size-4 text-gray-400" />{profileResident.providerLocation || profileResident.address}</div>
                <div className="flex items-center gap-2"><Mail className="size-4 text-gray-400" />{profileResident.email}</div>
                {profileResident.contact && <div className="flex items-center gap-2"><Phone className="size-4 text-gray-400" />{profileResident.contact}</div>}
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Skills &amp; Services</p>
                <div className="space-y-2">
                  {profileResident.skills?.map((skill) => (
                    <div key={skill._id} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-800">{skill.skill}</p>
                        <ProficiencyBadge level={skill.proficiency} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{skill.experience} {skill.experience === 1 ? "yr" : "yrs"} experience</p>
                      {skill.serviceTypes && skill.serviceTypes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {skill.serviceTypes.map((st) => (
                            <span key={st} className="text-[10px] bg-white border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{st}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {profileResident.totalReviews > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Reviews</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {profileResident.reviews.map((review, i) => (
                      <div key={review._id || i} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-gray-700">{review.user}</p>
                          <div className="flex items-center">
                            {Array.from({ length: 5 }).map((_, s) => (
                              <Star key={s} className={`size-3 ${s < review.star ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{review.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {user?._id !== profileResident._id && (
                <Button
                  onClick={() => openRequest(profileResident)}
                  disabled={(profileResident.availability || "AVAILABLE") !== "AVAILABLE"}
                  className="w-full mt-5 h-10 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium disabled:opacity-50"
                >
                  <Send className="size-4" />
                  {(profileResident.availability || "AVAILABLE") === "AVAILABLE" ? "Request Service" : "Currently Unavailable"}
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Request Service Modal */}
      {requestResident && (
        <RequestServiceModal
          open={requestOpen}
          onOpenChange={setRequestOpen}
          providerName={requestResident.name}
          providerSkills={requestResident.skills || []}
          defaultLocation={user?.address}
          onSubmit={async (data) => {
            await requestMutation.mutateAsync(data);
          }}
        />
      )}

      {/* Book Service Modal */}
      {bookResident && (
        <BookServiceModal
          open={bookOpen}
          onOpenChange={setBookOpen}
          residentName={bookResident.name}
          residentSkills={bookResident.skills || []}
          onBook={async (data) => {
            await bookMutation.mutateAsync(data);
          }}
        />
      )}
    </div>
  );
}

// ─── Resident Card ────────────────────────────────────────────────
function ResidentCard({
  resident,
  isOwnProfile,
  onViewProfile,
  onRequestService,
  onBookService,
}: {
  resident: Resident;
  isOwnProfile: boolean;
  onViewProfile: () => void;
  onRequestService: () => void;
  onBookService: () => void;
}) {
  const displaySkills = resident.skills?.slice(0, 2);
  const hasMoreSkills = (resident.skills?.length || 0) > 2;
  const canRequest = (resident.availability || "AVAILABLE") === "AVAILABLE";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md hover:border-sky-200 transition-all duration-200">
      <div className="p-5 pb-3">
        <div className="flex items-start gap-3">
          <div className="size-12 rounded-full overflow-hidden bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shrink-0 border-2 border-white shadow-sm">
            {resident.profile ? (
              <img src={resident.profile} alt={resident.name} className="w-full h-full object-cover" />
            ) : (
              <UserRound className="size-6 text-sky-600" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {resident.name}
              {isOwnProfile && <span className="ml-1.5 text-[10px] text-sky-600 font-medium">(you)</span>}
            </h3>
            <StarRatingDisplay rating={resident.averageRating || 0} total={resident.totalReviews || 0} />
          </div>
          <AvailabilityBadge availability={resident.availability} />
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-1 min-w-0">
            <MapPin className="size-3.5 text-gray-400 shrink-0" />
            <span className="truncate">{resident.providerLocation || resident.address}</span>
          </div>
          {(resident.completedServices || 0) > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              <CheckCircle2 className="size-3.5 text-emerald-400" />
              {resident.completedServices} completed
            </div>
          )}
        </div>
      </div>

      <div className="mx-5 border-t border-gray-100" />

      <div className="p-5 pt-3">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Briefcase className="size-3.5 text-sky-500" />
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Skills</span>
        </div>

        {resident.skills && resident.skills.length > 0 ? (
          <div className="space-y-2">
            {displaySkills.map((skill) => (
              <div key={skill._id} className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-800 truncate">{skill.skill}</p>
                  <ProficiencyBadge level={skill.proficiency} />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Clock className="size-3 text-gray-400" />
                  <span className="text-[11px] text-gray-500">{skill.experience} {skill.experience === 1 ? "yr" : "yrs"}</span>
                </div>
              </div>
            ))}
            {hasMoreSkills && (
              <p className="text-xs text-gray-400 text-center py-1">+{resident.skills.length - 2} more skills</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No skills listed</p>
        )}

        {!isOwnProfile && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onViewProfile} className="flex-1 h-9 text-xs border-gray-200">
                View Profile
              </Button>
              <Button
                size="sm"
                onClick={onRequestService}
                disabled={!canRequest}
                className="flex-1 h-9 text-xs bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {canRequest ? "Request Service" : AVAILABILITY_CONFIG[resident.availability || "AVAILABLE"].label}
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onBookService}
              disabled={!canRequest}
              className="w-full h-9 text-xs border-sky-200 text-sky-700 hover:bg-sky-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CalendarCheck className="size-3.5" />
              Book Service
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
