"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Swal from "sweetalert2";
import {
  MapPin,
  Plus,
  Pencil,
  Power,
  Trash2,
  ArrowLeft,
  Loader2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { purokApi } from "@/app/utils/barangayApi";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { purokInterface, purokInput } from "@/app/types/purok.type";
import { BackButton } from "@/components/ui/BackButton";

interface ApiError {
  response?: { data?: { message?: string } };
}

interface PurokResident {
  _id: string;
  name: string;
  address?: string;
  contact?: string;
}

export default function Page() {

  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<purokInterface | null>(null);
  const [viewing, setViewing] = useState<purokInterface | null>(null);

  const { data: puroks = [], isLoading } = useQuery({
    queryKey: ["puroks"],
    queryFn: purokApi.getAll,
  });

  const afterMutate = () =>
    queryClient.invalidateQueries({ queryKey: ["puroks"] });

  const createMut = useMutation({
    mutationFn: (data: purokInput) => purokApi.create(data),
    onSuccess: () => {
      afterMutate();
      setModalOpen(false);
      successAlert("Purok added.");
    },
    onError: (e: ApiError) =>
      errorAlert(e?.response?.data?.message || "Failed to add purok."),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<purokInput> }) =>
      purokApi.update(id, data),
    onSuccess: () => {
      afterMutate();
      setModalOpen(false);
      successAlert("Purok updated.");
    },
    onError: (e: ApiError) =>
      errorAlert(e?.response?.data?.message || "Failed to update purok."),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "inactive" }) =>
      purokApi.setStatus(id, status),
    onSuccess: afterMutate,
    onError: (e: ApiError) =>
      errorAlert(e?.response?.data?.message || "Failed to update status."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => purokApi.remove(id),
    onSuccess: () => {
      afterMutate();
      successAlert("Purok deleted.");
    },
    onError: (e: ApiError) =>
      errorAlert(e?.response?.data?.message || "Failed to delete purok."),
  });

  const removePurok = (p: purokInterface) => {
    Swal.fire({
      title: "Delete purok?",
      text: `${p.name} will be removed. Existing residents assigned to this purok keep their purok name.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#dc2626",
    }).then((r) => {
      if (r.isConfirmed) deleteMut.mutate(p._id);
    });
  };

  if (isLoading) {
    return (
      <BackButton href="/pages/secretary/barangaySettings" />

      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <BackButton href="/pages/secretary/barangaySettings" />

      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 text-slate-500" onClick={() => router.push("/pages/secretary/barangaySettings")}>
            <ArrowLeft className="size-4" /> Back to Settings
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            <MapPin className="mr-2 inline size-6 text-sky-600" />
            Purok Management
          </h1>
          <p className="text-sm text-slate-500">
            Maintain the purok list, assign a leader, and view residents under each purok.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="size-4" /> Add Purok
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {puroks.length === 0 && (
          <p className="text-sm text-muted-foreground sm:col-span-full">
            No puroks yet. Add the puroks in your barangay.
          </p>
        )}
        {puroks.map((p) => (
          <div key={p._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-800">{p.name}</p>
                <p className="text-xs text-slate-500">
                  {p.leader ? `Leader: ${p.leader}` : "No leader"} ·{" "}
                  {p.contact ? p.contact : "No contact"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => { setViewing(p); }}>
                  <Users className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setEditing(p); setModalOpen(true); }}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant={p.status === "active" ? "ghost" : "outline"}
                  size="sm"
                  onClick={() => statusMut.mutate({ id: p._id, status: p.status === "active" ? "inactive" : "active" })}
                  title={p.status === "active" ? "Deactivate" : "Activate"}
                >
                  <Power className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => removePurok(p)}>
                  <Trash2 className="size-4 text-rose-500" />
                </Button>
              </div>
            </div>
            {p.description && (
              <p className="mt-2 text-sm text-slate-600">{p.description}</p>
            )}
            <span className={
              "mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold " +
              (p.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")
            }>
              {p.status.toUpperCase()}
            </span>
          </div>
        ))}
      </div>

      <PurokFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        initial={editing}
        onSubmit={(values) => {
          if (editing) {
            updateMut.mutate({ id: editing._id, data: values });
          } else {
            createMut.mutate({ ...values, status: "active" });
          }
        }}
      />

      <ResidentDialog purok={viewing} onOpenChange={(o) => setViewing(o ? o : null)} />
    </div>
  );
}

function PurokFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: purokInterface | null;
  onSubmit: (values: { name: string; leader?: string; contact?: string; description?: string }) => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    leader: initial?.leader ?? "",
    contact: initial?.contact ?? "",
    description: initial?.description ?? "",
  });
  const [error, setError] = useState("");

  // Re-sync when the dialog targets a different record.
  const openedKey = initial?._id ?? "new";
  const [lastKey, setLastKey] = useState(openedKey);
  if (lastKey !== openedKey) {
    setLastKey(openedKey);
    setForm({
      name: initial?.name ?? "",
      leader: initial?.leader ?? "",
      contact: initial?.contact ?? "",
      description: initial?.description ?? "",
    });
  }

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    setError("");
    if (!form.name.trim()) {
      setError("Purok name is required.");
      return;
    }
    onSubmit({
      name: form.name.trim(),
      leader: form.leader.trim() || undefined,
      contact: form.contact.trim() || undefined,
      description: form.description.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Purok" : "Add Purok"}</DialogTitle>
          <DialogDescription>
            Enter the purok name and optional leader / description.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Purok Name *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Purok 1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Leader</Label>
              <Input value={form.leader} onChange={(e) => set("leader", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Contact</Label>
              <Input value={form.contact} onChange={(e) => set("contact", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>{initial ? "Save Changes" : "Add Purok"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResidentDialog({
  purok,
  onOpenChange,
}: {
  purok: purokInterface | null;
  onOpenChange: (purok: purokInterface | null) => void;
}) {
  const { data: residents = [], isLoading } = useQuery({
    queryKey: ["purok-residents", purok?.name ?? ""],
    queryFn: () => purokApi.getResidents((purok as purokInterface).name),
    enabled: !!purok,
  });

  return (
    <Dialog open={!!purok} onOpenChange={(o) => onOpenChange(o ? purok : null)}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Residents of {purok?.name}</DialogTitle>
          <DialogDescription>{residents.length} household member(s) listed under this purok.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading residents…
            </div>
          ) : residents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No residents assigned to this purok yet.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              {residents.map((r: PurokResident, i: number) => (
                <div key={r._id} className={"px-4 py-2.5 text-sm " + (i % 2 ? "bg-slate-50/60" : "bg-white")}>
                  <p className="font-medium text-slate-800">{r.name}</p>
                  <p className="text-xs text-slate-500">
                    {r.address || "—"} · {r.contact || "no contact"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(null)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}