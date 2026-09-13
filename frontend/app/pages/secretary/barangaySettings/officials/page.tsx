"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Swal from "sweetalert2";
import {
  Users,
  Plus,
  Pencil,
  Power,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import useBarangaySettingsStore from "@/app/store/useBarangaySettingsStore";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { officialsApi } from "@/app/utils/barangayApi";
import { errorAlert } from "@/app/utils/alert";
import { OfficialFormDialog, OfficialFormValues } from "@/components/ui/officialFormDialog";
import {
  officialInterface,
  officialInput,
  SINGLE_HOLDER_POSITIONS,
} from "@/app/types/official.type";

interface ApiError {
  response?: { data?: { message?: string } };
}

export default function Page() {
  const router = useRouter();
  const store = useBarangaySettingsStore();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<officialInterface | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: officials = [], isLoading } = useQuery({
    queryKey: ["officials"],
    queryFn: officialsApi.getAll,
  });

  const current = useMemo(
    () => officials.filter((o) => o.status === "active"),
    [officials]
  );
  const previous = useMemo(
    () => officials.filter((o) => o.status === "inactive"),
    [officials]
  );

  const afterMutate = () => {
    queryClient.invalidateQueries({ queryKey: ["officials"] });
    store.refresh();
  };

  const createMut = useMutation({
    mutationFn: (data: officialInput) => officialsApi.create(data),
    onSuccess: afterMutate,
    onError: (e: ApiError) =>
      errorAlert(e?.response?.data?.message || "Failed to add official."),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<officialInput> }) =>
      officialsApi.update(id, data),
    onSuccess: afterMutate,
    onError: (e: ApiError) =>
      errorAlert(e?.response?.data?.message || "Failed to update official."),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "inactive" }) =>
      officialsApi.setStatus(id, status),
    onSuccess: afterMutate,
    onError: (e: ApiError) =>
      errorAlert(e?.response?.data?.message || "Failed to update status."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => officialsApi.remove(id),
    onSuccess: afterMutate,
    onError: (e: ApiError) =>
      errorAlert(e?.response?.data?.message || "Failed to delete official."),
  });

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (o: officialInterface) => {
    setEditing(o);
    setModalOpen(true);
  };

  const handleUpload = async (kind: "photo" | "signature", file: File) => {
    if (!editing) return "";
    setUploading(true);
    try {
      const updated = await officialsApi.uploadAsset(editing._id, kind, file);
      afterMutate();
      return updated[kind === "photo" ? "photo" : "signatureImage"] || "";
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (values: OfficialFormValues) => {
    const payload: officialInput = {
      fullName: values.fullName,
      position: values.position,
      status: values.status,
      precedence: values.precedence,
      termStart: values.termStart || undefined,
      termEnd: values.termEnd || undefined,
      termLabel: values.termLabel || undefined,
      signatureImage: values.signatureImage || undefined,
      photo: values.photo || undefined,
      contact: values.contact || undefined,
      notes: values.notes || undefined,
    };

    if (editing) {
      const targetActive = values.status === "active" && editing.status !== "active";
const isSingle = SINGLE_HOLDER_POSITIONS.includes(
        values.position as (typeof SINGLE_HOLDER_POSITIONS)[number]
      );
      if (targetActive && isSingle) {
        Swal.fire({
          title: "Replace current holder?",
          text: `Are you sure you want to replace the current ${values.position}? The previous official will be moved to the historical records.`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Yes, activate",
          cancelButtonText: "Cancel",
        }).then((r) => {
          if (r.isConfirmed) {
            updateMut.mutate({ id: editing._id, data: payload });
            setModalOpen(false);
          }
        });
        return;
      }
      updateMut.mutate({ id: editing._id, data: payload });
      setModalOpen(false);
      return;
    }

    const isSingle = SINGLE_HOLDER_POSITIONS.includes(
      values.position as (typeof SINGLE_HOLDER_POSITIONS)[number]
    );
    const existingActive = current.find((o) => o.position === values.position);
    if (values.status === "active" && isSingle && existingActive) {
      Swal.fire({
        title: "Replace current holder?",
        text: `Are you sure you want to replace the current ${values.position} (${existingActive.fullName})? The previous official will be moved to the historical records.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, add & replace",
        cancelButtonText: "Cancel",
      }).then((r) => {
        if (r.isConfirmed) {
          createMut.mutate(payload);
          setModalOpen(false);
        }
      });
      return;
    }
    createMut.mutate(payload);
    setModalOpen(false);
  };

  const toggleStatus = (o: officialInterface) => {
    if (o.status === "inactive") {
      const isSingle = SINGLE_HOLDER_POSITIONS.includes(
        o.position as (typeof SINGLE_HOLDER_POSITIONS)[number]
      );
      const existingActive = current.find((x) => x.position === o.position);
      if (isSingle && existingActive) {
        Swal.fire({
          title: "Replace current holder?",
          text: `${existingActive.fullName} is currently the active ${o.position}. Activating this record will move them to the historical records.`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Yes, activate",
          cancelButtonText: "Cancel",
        }).then((r) => {
          if (r.isConfirmed) statusMut.mutate({ id: o._id, status: "active" });
        });
        return;
      }
      statusMut.mutate({ id: o._id, status: "active" });
      return;
    }
    statusMut.mutate({ id: o._id, status: "inactive" });
  };

  const removeOfficial = (o: officialInterface) => {
    Swal.fire({
      title: "Delete official?",
      text: `${o.fullName} (${o.position}) will be permanently removed. Historical documents keep their snapshot.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#dc2626",
    }).then((r) => {
      if (r.isConfirmed) deleteMut.mutate(o._id);
    });
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 text-slate-500" onClick={() => router.push("/pages/secretary/barangaySettings")}>
            <ArrowLeft className="size-4" /> Back to Settings
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            <Users className="mr-2 inline size-6 text-sky-600" />
            Barangay Officials
          </h1>
          <p className="text-sm text-slate-500">
            Changes to active officials automatically apply to newly generated
            documents.
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="size-4" /> Add Official
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionLabel>Current Officials</SectionLabel>
        {current.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active officials yet. Add the Punong Barangay, Secretary, Treasurer,
            and Kagawads.
          </p>
        ) : (
          <OfficialTable
            officials={current}
            onEdit={openEdit}
            onToggle={toggleStatus}
            onDelete={removeOfficial}
          />
        )}

        <div className="mt-8">
          <SectionLabel>Previous Officials (Historical)</SectionLabel>
          {previous.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No historical records yet. Previous officials are kept here instead of
              being deleted.
            </p>
          ) : (
            <OfficialTable
              officials={previous}
              onEdit={openEdit}
              onToggle={toggleStatus}
              onDelete={removeOfficial}
              muted
            />
          )}
        </div>
      </div>

      <OfficialFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        initial={editing ? {
          fullName: editing.fullName,
          position: editing.position,
          status: editing.status,
          precedence: editing.precedence,
          termStart: editing.termStart || "",
          termEnd: editing.termEnd || "",
          termLabel: editing.termLabel || "",
          signatureImage: editing.signatureImage || "",
          photo: editing.photo || "",
          contact: editing.contact || "",
          notes: editing.notes || "",
        } : null}
        title={editing ? "Edit Official" : "Add Official"}
        onSubmit={handleSubmit}
        onUpload={editing ? handleUpload : undefined}
        uploading={uploading}
      />
    </div>
  );
}

function OfficialTable({
  officials,
  onEdit,
  onToggle,
  onDelete,
  muted,
}: {
  officials: officialInterface[];
  onEdit: (o: officialInterface) => void;
  onToggle: (o: officialInterface) => void;
  onDelete: (o: officialInterface) => void;
  muted?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      {officials.map((o, i) => (
        <div
          key={o._id}
          className={
            "flex items-center justify-between gap-3 px-4 py-3 " +
            (i % 2 ? "bg-slate-50/60" : "bg-white") +
            (muted ? " opacity-80" : "")
          }
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">{o.fullName}</p>
            <p className="text-xs text-slate-500">
              {o.position}
              {o.contact && `  ·  ${o.contact}`}
              {"  ·  "}
              {o.termLabel || (o.termStart && o.termEnd
                ? `${o.termStart} – ${o.termEnd}`
                : "No term set")}
              {o.status === "active" && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  ACTIVE
                </span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => onEdit(o)} title="Edit">
              <Pencil className="size-4" />
            </Button>
            <Button
              variant={o.status === "active" ? "ghost" : "outline"}
              size="sm"
              onClick={() => onToggle(o)}
              title={o.status === "active" ? "Deactivate" : "Activate"}
            >
              <Power className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(o)} title="Delete">
              <Trash2 className="size-4 text-rose-500" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </p>
  );
}