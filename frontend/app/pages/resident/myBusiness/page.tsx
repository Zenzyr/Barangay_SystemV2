"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Image from "next/image";
import axiosInstance from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
import { businessInterface } from "@/app/types/business.type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { confirmAlert } from "@/app/utils/alert";
import {
  Building2,
  Plus,
  Store,
  MapPin,
  FileText,
  ImageIcon,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Pencil,
  Eye,
  Upload,
  X,
  Search,
  Camera,
  ExternalLink,
  Package,
} from "lucide-react";

// ─── Business types for select ────────────────────────────────────
const BUSINESS_TYPES = [
  "Sari-Sari Store",
  "Restaurant / Eatery",
  "Retail Store",
  "Hardware / Construction",
  "Service Provider",
  "Manufacturing",
  "Wholesale / Distributor",
  "Online Business",
  "Agriculture / Farming",
  "Transportation",
  "Real Estate",
  "Other",
];

// ─── Status config ───────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; bg: string; text: string; border: string }> = {
  pending: {
    label: "Pending",
    icon: Clock,
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
  },
};

// ─── Initial form state ──────────────────────────────────────────
const INITIAL_FORM = {
  businessName: "",
  type: "",
  businessInfo: "",
  address: "",
};

type FormData = typeof INITIAL_FORM;

interface ApiError {
  response?: { data?: unknown };
  message?: string;
}

export default function MyBusinessPage() {
  const queryClient = useQueryClient();
  const { user } = useUserStore();

  // ── State ──────────────────────────────────────────────────────
  const [search, setSearch] = useState("");

  // Add business modal
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<FormData>(INITIAL_FORM);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState<string>("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);

  // View business modal
  const [viewBusiness, setViewBusiness] = useState<businessInterface | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  // Edit business modal
  const [editBusiness, setEditBusiness] = useState<businessInterface | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<FormData>(INITIAL_FORM);
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
  const [editDocumentFile, setEditDocumentFile] = useState<File | null>(null);
  const [editDocumentName, setEditDocumentName] = useState<string>("");

  // Edit modal refs
  const editLogoInputRef = useRef<HTMLInputElement>(null);
  const editDocumentInputRef = useRef<HTMLInputElement>(null);

  // Add images modal
  const [addImagesBusiness, setAddImagesBusiness] = useState<businessInterface | null>(null);
  const [addImagesOpen, setAddImagesOpen] = useState(false);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const newImagesInputRef = useRef<HTMLInputElement>(null);

  // ── File handlers ──────────────────────────────────────────────
  const handleLogoSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleDocumentSelect = (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) {
      toast.error("Please select a valid document (JPG, PNG, or PDF)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Document must be less than 10MB");
      return;
    }
    setDocumentFile(file);
    setDocumentName(file.name);
  };

  const handleImagesSelect = (files: FileList) => {
    const valid: File[] = [];
    const previews: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not a valid image`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} must be less than 5MB`);
        continue;
      }
      valid.push(file);
      previews.push(URL.createObjectURL(file));
    }
    setImageFiles((prev) => [...prev, ...valid]);
    setImagePreviews((prev) => [...prev, ...previews]);
  };

  const removeNewImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Fetch businesses ──────────────────────────────────────────
  const { data: businesses, isLoading } = useQuery<businessInterface[]>({
    queryKey: ["businesses", "resident", user?._id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/business/resident/${user?._id}`);
      return res.data;
    },
    enabled: !!user?._id,
  });

  // ── Filter by search ───────────────────────────────────────────
  const filtered = businesses?.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.businessName.toLowerCase().includes(q) ||
      b.type.toLowerCase().includes(q) ||
      b.status.toLowerCase().includes(q) ||
      b.address.toLowerCase().includes(q)
    );
  });

  // ── Create business mutation ───────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user?._id) {
        throw new Error("You must be signed in to register a business");
      }
      const formData = new FormData();
      formData.append("resident", user._id);
      formData.append("businessName", addForm.businessName);
      formData.append("type", addForm.type);
      formData.append("businessInfo", addForm.businessInfo);
      formData.append("address", addForm.address);
      formData.append("status", "pending");
      if (logoFile) formData.append("logo", logoFile);
      if (documentFile) formData.append("document", documentFile);
      imageFiles.forEach((f) => formData.append("images", f));

      const res = await axiosInstance.post("/business", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
      toast.success("Business registered successfully!", {
        description: "Your business is now pending review.",
        icon: <Building2 className="size-5" />,
      });
      setAddOpen(false);
      resetAddForm();
    },
    onError: (err: ApiError) => {
      const msg = err?.response?.data || err?.message || "Failed to create business";
      toast.error(typeof msg === "string" ? msg : "Creation failed");
    },
  });

  // ── Update business mutation ───────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("businessName", editForm.businessName);
      formData.append("type", editForm.type);
      formData.append("businessInfo", editForm.businessInfo);
      formData.append("address", editForm.address);
      if (editLogoFile) formData.append("logo", editLogoFile);
      if (editDocumentFile) formData.append("document", editDocumentFile);

      const res = await axiosInstance.put(`/business/${editBusiness?._id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
      toast.success("Business updated successfully!");
      setEditOpen(false);
      setEditBusiness(null);
    },
    onError: (err: ApiError) => {
      const msg = err?.response?.data || err?.message || "Failed to update business";
      toast.error(typeof msg === "string" ? msg : "Update failed");
    },
  });

  // ── Delete business mutation ───────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axiosInstance.delete(`/business/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
      toast.success("Business deleted successfully");
    },
    onError: (err: ApiError) => {
      const message = err?.response?.data;
      toast.error(typeof message === "string" ? message : "Failed to delete business");
    },
  });

  // ── Add images mutation ────────────────────────────────────────
  const addImagesMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      newImageFiles.forEach((f) => formData.append("images", f));

      const res = await axiosInstance.post(`/business/${addImagesBusiness?._id}/images`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
      toast.success("Images added successfully!");
      setAddImagesOpen(false);
      setAddImagesBusiness(null);
      setNewImageFiles([]);
      setNewImagePreviews([]);
    },
    onError: (err: ApiError) => {
      const message = err?.response?.data;
      toast.error(typeof message === "string" ? message : "Failed to add images");
    },
  });

  // ── Remove image mutation ──────────────────────────────────────
  const removeImageMutation = useMutation({
    mutationFn: async ({ businessId, imageUrl }: { businessId: string; imageUrl: string }) => {
      await axiosInstance.delete(`/business/${businessId}/images`, {
        data: { imageUrl },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
      toast.success("Image removed");
    },
    onError: (err: ApiError) => {
      const message = err?.response?.data;
      toast.error(typeof message === "string" ? message : "Failed to remove image");
    },
  });

  // ── Reset handlers ─────────────────────────────────────────────
  const resetAddForm = () => {
    setAddForm(INITIAL_FORM);
    setLogoFile(null);
    setLogoPreview(null);
    setDocumentFile(null);
    setDocumentName("");
    setImageFiles([]);
    setImagePreviews([]);
  };

  const openEditModal = (business: businessInterface) => {
    setEditBusiness(business);
    setEditForm({
      businessName: business.businessName,
      type: business.type,
      businessInfo: business.businessInfo,
      address: business.address,
    });
    setEditLogoFile(null);
    setEditLogoPreview(null);
    setEditDocumentFile(null);
    setEditDocumentName("");
    setEditOpen(true);
  };

  const openViewModal = (business: businessInterface) => {
    setViewBusiness(business);
    setViewOpen(true);
  };

  const openAddImagesModal = (business: businessInterface) => {
    setAddImagesBusiness(business);
    setNewImageFiles([]);
    setNewImagePreviews([]);
    setAddImagesOpen(true);
  };

  // ── Validation ─────────────────────────────────────────────────
  const isAddFormValid = addForm.businessName && addForm.type && addForm.businessInfo && addForm.address && logoFile;
  const isEditFormValid = editForm.businessName && editForm.type && editForm.businessInfo && editForm.address;

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="size-6 text-sky-600" />
            My Businesses
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your registered businesses and permits
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-sky-50 rounded-xl px-4 py-2 border border-sky-100">
            <Store className="size-4 text-sky-500" />
            <span>
              Total:{" "}
              <strong className="text-sky-700">{businesses?.length || 0}</strong>
            </span>
          </div>
          <Button
            onClick={() => {
              resetAddForm();
              setAddOpen(true);
            }}
            className="h-9 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium shadow-lg shadow-sky-200/50"
          >
            <Plus className="size-4" />
            Register Business
          </Button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
        <Input
          placeholder="Search by name, type or status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
        />
      </div>

      {/* ── Business Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="size-14 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          ))}
        </div>
      ) : !businesses || businesses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="size-16 rounded-2xl bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center mb-4">
            <Store className="size-8 text-sky-500" />
          </div>
          <p className="text-base font-medium text-gray-600">No businesses registered yet</p>
          <p className="text-sm mt-1">Register your first business to get started</p>
          <Button
            onClick={() => {
              resetAddForm();
              setAddOpen(true);
            }}
            variant="outline"
            className="mt-4 border-sky-200 text-sky-600 hover:bg-sky-50"
          >
            <Plus className="size-4" />
            Register Business
          </Button>
        </div>
      ) : filtered?.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-gray-400">
          <Search className="size-8" />
          <p className="text-sm font-medium">No results match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered?.map((business) => {
            const statusCfg = STATUS_CONFIG[business.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.icon;

            return (
              <div
                key={business._id}
                className="group relative bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg hover:border-sky-200 transition-all duration-200 hover:-translate-y-0.5"
              >
                {/* Hover accent bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="p-5">
                  {/* Top: Logo + Name */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="size-14 rounded-xl overflow-hidden bg-gradient-to-br from-sky-100 to-emerald-100 border border-gray-100 shrink-0">
                      {business.logo ? (
                        <img
                          src={business.logo}
                          alt={business.businessName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Building2 className="size-6 text-sky-400" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">
                        {business.businessName}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {business.type}
                      </p>
                    </div>
                  </div>

                  {/* Info */}
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                    {business.businessInfo}
                  </p>

                  {/* Address */}
                  <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">{business.address}</span>
                  </div>

                  {/* Images count */}
                  {business.images && business.images.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                      <ImageIcon className="size-3 shrink-0" />
                      <span>{business.images.length} image{business.images.length > 1 ? "s" : ""}</span>
                    </div>
                  )}

                  {/* Status + Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border} border`}
                    >
                      <StatusIcon className="size-3" />
                      {statusCfg.label}
                    </span>

                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => openViewModal(business)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-all"
                        title="View details"
                      >
                        <Eye className="size-3.5" />
                      </button>
                      <button
                        onClick={() => openEditModal(business)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                        title="Edit"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      {business.images && (
                        <button
                          onClick={() => openAddImagesModal(business)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-all"
                          title="Add images"
                        >
                          <Camera className="size-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          confirmAlert(
                            "Delete this business? This action cannot be undone.",
                            "Delete",
                            () => deleteMutation.mutate(business._id)
                          );
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          ADD BUSINESS MODAL
          ════════════════════════════════════════════════════════════ */}
      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetAddForm(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="size-8 rounded-lg bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center">
                <Store className="size-4 text-white" />
              </div>
              Register New Business
            </DialogTitle>
            <DialogDescription>
              Fill in the details to register your business. It will be reviewed by the barangay.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Business Name + Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  Business Name <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    placeholder="e.g. Juan's Sari-Sari Store"
                    value={addForm.businessName}
                    onChange={(e) => setAddForm((p) => ({ ...p, businessName: e.target.value }))}
                    className="pl-10 h-10 border-gray-200 focus:border-sky-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  Business Type <span className="text-red-400">*</span>
                </Label>
                <Select
                  value={addForm.type}
                  onValueChange={(val) => setAddForm((p) => ({ ...p, type: val }))}
                >
                  <SelectTrigger className="w-full h-10 border-gray-200 focus:border-sky-400 bg-white">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Business Info */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                Business Information <span className="text-red-400">*</span>
              </Label>
              <Textarea
                placeholder="Describe your business, products, and services..."
                value={addForm.businessInfo}
                onChange={(e) => setAddForm((p) => ({ ...p, businessInfo: e.target.value }))}
                className="min-h-[80px] border-gray-200 focus:border-sky-400 resize-none"
              />
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                Business Address <span className="text-red-400">*</span>
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  placeholder="e.g. 456 Rizal St., Barangay Rabon"
                  value={addForm.address}
                  onChange={(e) => setAddForm((p) => ({ ...p, address: e.target.value }))}
                  className="pl-10 h-10 border-gray-200 focus:border-sky-400"
                />
              </div>
            </div>

            {/* File Uploads */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Logo */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  Business Logo <span className="text-red-400">*</span>
                </Label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLogoSelect(f);
                  }}
                />
                {logoPreview ? (
                  <div className="relative group rounded-xl overflow-hidden border-2 border-sky-200 bg-white">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-full h-32 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          setLogoFile(null);
                          setLogoPreview(null);
                          if (logoInputRef.current) logoInputRef.current.value = "";
                        }}
                        className="opacity-0 group-hover:opacity-100 bg-red-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="w-full h-32 rounded-xl border-2 border-dashed border-gray-200 hover:border-sky-300 hover:bg-sky-50/50 transition-all flex flex-col items-center justify-center gap-1.5"
                  >
                    <div className="size-8 rounded-full bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center">
                      <Upload className="size-4 text-sky-500" />
                    </div>
                    <span className="text-xs font-medium text-gray-500">Upload Logo</span>
                    <span className="text-[10px] text-gray-400">PNG, JPG (max 5MB)</span>
                  </button>
                )}
              </div>

              {/* Document */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  Business Document
                </Label>
                <input
                  ref={documentInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleDocumentSelect(f);
                  }}
                />
                {documentFile ? (
                  <div className="relative group rounded-xl overflow-hidden border-2 border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2">
                      <FileText className="size-5 text-emerald-500 shrink-0" />
                      <span className="text-xs text-gray-700 truncate">{documentName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDocumentFile(null);
                        setDocumentName("");
                        if (documentInputRef.current) documentInputRef.current.value = "";
                      }}
                      className="absolute top-1 right-1 p-1 rounded-md hover:bg-emerald-200/50 text-gray-400 hover:text-red-500"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => documentInputRef.current?.click()}
                    className="w-full h-32 rounded-xl border-2 border-dashed border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all flex flex-col items-center justify-center gap-1.5"
                  >
                    <div className="size-8 rounded-full bg-gradient-to-br from-emerald-100 to-sky-100 flex items-center justify-center">
                      <FileText className="size-4 text-emerald-500" />
                    </div>
                    <span className="text-xs font-medium text-gray-500">Upload Document</span>
                    <span className="text-[10px] text-gray-400">Image (max 10MB)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Business Images */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Business Images</Label>
              <input
                ref={imagesInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files) handleImagesSelect(files);
                  if (imagesInputRef.current) imagesInputRef.current.value = "";
                }}
              />
              {imagePreviews.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {imagePreviews.map((preview, idx) => (
                    <div key={idx} className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square">
                      <img
                        src={preview}
                        alt={`Image ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeNewImage(idx)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => imagesInputRef.current?.click()}
                    className="aspect-square rounded-lg border-2 border-dashed border-gray-200 hover:border-sky-300 hover:bg-sky-50/50 transition-all flex flex-col items-center justify-center gap-1"
                  >
                    <Plus className="size-4 text-gray-400" />
                    <span className="text-[10px] text-gray-400">Add more</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imagesInputRef.current?.click()}
                  className="w-full h-24 rounded-xl border-2 border-dashed border-gray-200 hover:border-sky-300 hover:bg-sky-50/50 transition-all flex flex-col items-center justify-center gap-1.5"
                >
                  <div className="size-8 rounded-full bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center">
                    <ImageIcon className="size-4 text-sky-500" />
                  </div>
                  <span className="text-xs font-medium text-gray-500">Upload Images (optional)</span>
                  <span className="text-[10px] text-gray-400">You can add more later</span>
                </button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setAddOpen(false); resetAddForm(); }}
              disabled={createMutation.isPending}
              className="border-gray-200"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!isAddFormValid || createMutation.isPending}
              className="bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white"
            >
              {createMutation.isPending ? (
                <><Loader2 className="size-4 animate-spin" /> Submitting...</>
              ) : (
                <><Store className="size-4" /> Register Business</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════
          VIEW BUSINESS MODAL
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
              </DialogHeader>

              <div className="space-y-6 py-2">
                {/* Logo + Status */}
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
                    <h2 className="font-semibold text-gray-900">{viewBusiness.businessName}</h2>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
                        <Package className="size-3" />
                        {viewBusiness.type}
                      </span>
                      {(() => {
                        const sc = STATUS_CONFIG[viewBusiness.status] || STATUS_CONFIG.pending;
                        const SI = sc.icon;
                        return (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text} ${sc.border} border`}>
                            <SI className="size-3" />
                            {sc.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Info + Address */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 font-medium">Business Information</Label>
                    <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 border border-gray-100">
                      {viewBusiness.businessInfo}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 font-medium">Address</Label>
                    <div className="flex items-start gap-2 text-sm text-gray-800 bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <MapPin className="size-4 text-gray-400 shrink-0 mt-0.5" />
                      <span>{viewBusiness.address}</span>
                    </div>
                  </div>
                </div>

                {/* Document */}
                {viewBusiness.document && (
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 font-medium">Business Document</Label>
                    <a
                      href={viewBusiness.document}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-sky-600 bg-sky-50 rounded-lg p-3 border border-sky-100 hover:bg-sky-100 transition-colors"
                    >
                      <FileText className="size-4" />
                      <span>View Document</span>
                      <ExternalLink className="size-3 ml-auto" />
                    </a>
                  </div>
                )}

                {/* Images Gallery */}
                {viewBusiness.images && viewBusiness.images.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500 font-medium">
                      Business Images ({viewBusiness.images.length})
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {viewBusiness.images.map((img, idx) => (
                        <div key={idx} className="rounded-lg overflow-hidden border border-gray-200 aspect-video">
                          <img
                            src={img}
                            alt={`Business image ${idx + 1}`}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
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

      {/* ════════════════════════════════════════════════════════════════
          EDIT BUSINESS MODAL
          ════════════════════════════════════════════════════════════ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {editBusiness && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <div className="size-8 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center">
                    <Pencil className="size-4 text-white" />
                  </div>
                  Edit Business
                </DialogTitle>
                <DialogDescription>
                  Update your business information.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                {/* Business Name + Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Business Name</Label>
                    <div className="relative">
                      <Store className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                      <Input
                        value={editForm.businessName}
                        onChange={(e) => setEditForm((p) => ({ ...p, businessName: e.target.value }))}
                        className="pl-10 h-10 border-gray-200 focus:border-emerald-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Business Type</Label>
                    <Select
                      value={editForm.type}
                      onValueChange={(val) => setEditForm((p) => ({ ...p, type: val }))}
                    >
                      <SelectTrigger className="w-full h-10 border-gray-200 focus:border-emerald-400 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Business Info */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Business Information</Label>
                  <Textarea
                    value={editForm.businessInfo}
                    onChange={(e) => setEditForm((p) => ({ ...p, businessInfo: e.target.value }))}
                    className="min-h-[80px] border-gray-200 focus:border-emerald-400 resize-none"
                  />
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Business Address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                    <Input
                      value={editForm.address}
                      onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
                      className="pl-10 h-10 border-gray-200 focus:border-emerald-400"
                    />
                  </div>
                </div>

                {/* Logo Update */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Update Logo (optional)</Label>
                  <input
                    ref={editLogoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        if (!f.type.startsWith("image/")) {
                          toast.error("Please select a valid image file");
                          return;
                        }
                        if (f.size > 5 * 1024 * 1024) {
                          toast.error("Image must be less than 5MB");
                          return;
                        }
                        setEditLogoFile(f);
                        setEditLogoPreview(URL.createObjectURL(f));
                      }
                    }}
                  />
                  <div className="flex items-center gap-3">
                    {(editLogoPreview || editBusiness.logo) && (
                      <div className="size-16 rounded-xl overflow-hidden border border-gray-200">
                        <img
                          src={editLogoPreview || editBusiness.logo}
                          alt="Logo"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => editLogoInputRef.current?.click()}
                      className="flex-1 h-16 rounded-xl border-2 border-dashed border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all flex items-center justify-center gap-2"
                    >
                      <Upload className="size-4 text-gray-400" />
                      <span className="text-xs text-gray-500">
                        {editBusiness.logo ? "Change Logo" : "Upload Logo"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Document Update */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Update Document (optional)</Label>
                  <input
                    ref={editDocumentInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        if (f.size > 10 * 1024 * 1024) {
                          toast.error("Document must be less than 10MB");
                          return;
                        }
                        setEditDocumentFile(f);
                        setEditDocumentName(f.name);
                      }
                    }}
                  />
                  <div className="flex items-center gap-2">
                    {editBusiness.document && (
                      <a
                        href={editBusiness.document}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-sky-600 bg-sky-50 rounded-lg px-3 py-2 border border-sky-100 hover:bg-sky-100"
                      >
                        <FileText className="size-3.5" />
                        Current Document
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => editDocumentInputRef.current?.click()}
                      className="flex-1 h-12 rounded-xl border-2 border-dashed border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all flex items-center justify-center gap-2"
                    >
                      <Upload className="size-4 text-gray-400" />
                      <span className="text-xs text-gray-500">
                        {editDocumentFile ? editDocumentName : "Upload New Document"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                  disabled={updateMutation.isPending}
                  className="border-gray-200"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => updateMutation.mutate()}
                  disabled={!isEditFormValid || updateMutation.isPending}
                  className="bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 text-white"
                >
                  {updateMutation.isPending ? (
                    <><Loader2 className="size-4 animate-spin" /> Saving...</>
                  ) : (
                    <><Pencil className="size-4" /> Save Changes</>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════
          ADD IMAGES MODAL
          ════════════════════════════════════════════════════════════ */}
      <Dialog open={addImagesOpen} onOpenChange={setAddImagesOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {addImagesBusiness && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <div className="size-8 rounded-lg bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center">
                    <Camera className="size-4 text-white" />
                  </div>
                  Add Images to {addImagesBusiness.businessName}
                </DialogTitle>
                <DialogDescription>
                  Upload additional photos of your business.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Current images */}
                {addImagesBusiness.images && addImagesBusiness.images.length > 0 && (
                  <div>
                    <Label className="text-xs text-gray-500 font-medium mb-2 block">
                      Current Images ({addImagesBusiness.images.length})
                    </Label>
                    <div className="flex gap-2 flex-wrap">
                      {addImagesBusiness.images.map((img, idx) => (
                        <div key={idx} className="relative group size-16 rounded-lg overflow-hidden border border-gray-200">
                          <img src={img} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              confirmAlert("Remove this image?", "Remove", () =>
                                removeImageMutation.mutate({
                                  businessId: addImagesBusiness._id,
                                  imageUrl: img,
                                })
                              );
                            }}
                            className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="size-4 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload new images */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Add New Images</Label>
                  <input
                    ref={newImagesInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files) {
                        const valid: File[] = [];
                        const previews: string[] = [];
                        for (const f of Array.from(files)) {
                          if (!f.type.startsWith("image/")) continue;
                          if (f.size > 5 * 1024 * 1024) continue;
                          valid.push(f);
                          previews.push(URL.createObjectURL(f));
                        }
                        setNewImageFiles((prev) => [...prev, ...valid]);
                        setNewImagePreviews((prev) => [...prev, ...previews]);
                      }
                      if (newImagesInputRef.current) newImagesInputRef.current.value = "";
                    }}
                  />
                  {newImagePreviews.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {newImagePreviews.map((preview, idx) => (
                        <div key={idx} className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square">
                          <img src={preview} alt={`New ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              setNewImageFiles((prev) => prev.filter((_, i) => i !== idx));
                              setNewImagePreviews((prev) => prev.filter((_, i) => i !== idx));
                            }}
                            className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/50 text-white"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => newImagesInputRef.current?.click()}
                        className="aspect-square rounded-lg border-2 border-dashed border-gray-200 hover:border-sky-300 hover:bg-sky-50/50 transition-all flex items-center justify-center"
                      >
                        <Plus className="size-5 text-gray-400" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => newImagesInputRef.current?.click()}
                      className="w-full h-24 rounded-xl border-2 border-dashed border-gray-200 hover:border-sky-300 hover:bg-sky-50/50 transition-all flex flex-col items-center justify-center gap-1.5"
                    >
                      <Upload className="size-5 text-gray-400" />
                      <span className="text-xs text-gray-500">Click to select images</span>
                    </button>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => { setAddImagesOpen(false); setNewImageFiles([]); setNewImagePreviews([]); }}
                  disabled={addImagesMutation.isPending}
                  className="border-gray-200"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => addImagesMutation.mutate()}
                  disabled={newImageFiles.length === 0 || addImagesMutation.isPending}
                  className="bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white"
                >
                  {addImagesMutation.isPending ? (
                    <><Loader2 className="size-4 animate-spin" /> Uploading...</>
                  ) : (
                    <><Upload className="size-4" /> Upload Images</>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
