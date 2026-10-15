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
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { withBarangayLocality } from "@/app/utils/residentAddress";
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
import useUserStore from "@/app/store/useUserStore";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { apiErrorMessage } from "@/app/utils/transactionFormat";
import { purokInterface, purokInput } from "@/app/types/purok.type";
import { BackButton } from "@/components/ui/BackButton";
import RequestActionsMenu, {
  RequestActionItem,
} from "@/components/documentRequest/RequestActionsMenu";

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

type PurokFormField = "name" | "leader" | "contact" | "description";

type PurokFormValues = {
  name: string;
  leader?: string;
  contact?: string;
  description?: string;
};

const PUROK_NAME_MAX_LENGTH = 100;
const PUROK_LEADER_MAX_LENGTH = 150;
const PUROK_DESCRIPTION_MAX_LENGTH = 500;
const PUROK_NAME_PATTERN = /^[a-zA-ZñÑ0-9\s.'()#&-]+$/;
const LEADER_NAME_PATTERN = /^[a-zA-ZñÑ.'\-\s]+$/;

const collapseSpaces = (value: string) => value.trim().replace(/\s+/g, " ");
const purokNameKey = (value: string) => collapseSpaces(value).toLowerCase();

const isPhilippineMobile = (value: string) => {
  const digits = value.replace(/[^\d]/g, "");
  return (
    (digits.length === 11 && /^09/.test(digits)) ||
    (digits.length === 12 && /^639/.test(digits)) ||
    (digits.length === 10 && /^9/.test(digits))
  );
};

const PUROK_FORM_FIELDS: PurokFormField[] = ["name", "leader", "contact", "description"];

const purokFieldError = (err: unknown): { field: PurokFormField; message: string } | null => {
  const data = (err as { response?: { data?: unknown } } | null)?.response?.data;
  if (!data || typeof data !== "object") return null;
  const { field, message } = data as { field?: unknown; message?: unknown };
  if (typeof message !== "string" || typeof field !== "string") return null;
  if (!PUROK_FORM_FIELDS.includes(field as PurokFormField)) return null;
  return { field: field as PurokFormField, message };
};

interface PurokResident {
  _id: string;
  name: string;
  address?: string;
  contact?: string;
}

export default function Page() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useUserStore();

  // Secretary may add puroks; edit/status/delete stay super admin only.
  const canManage = user?.role === "super_admin";

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
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<purokInput> }) =>
      purokApi.update(id, data),
    onSuccess: () => {
      afterMutate();
      setModalOpen(false);
      successAlert("Purok updated.");
    },
  });

  const statusMut = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "active" | "inactive";
    }) => purokApi.setStatus(id, status),
    onSuccess: afterMutate,
    onError: (e: unknown) =>
      errorAlert(apiErrorMessage(e, "Failed to update status.")),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => purokApi.remove(id),
    onSuccess: () => {
      afterMutate();
      successAlert("Purok deleted.");
    },
    onError: (e: unknown) =>
      errorAlert(apiErrorMessage(e, "Failed to delete purok.")),
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
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        <BackButton href="/pages/secretary/barangaySettings" />
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            <MapPin className="mr-2 inline size-6 text-sky-600" />
            Purok Management
          </h1>
          <p className="text-sm text-slate-500">
            Maintain the purok list, assign a leader, and view residents under
            each purok.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus className="size-4" /> Add Purok
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-100">
                <TableHead className="p-4 md:p-2">Purok Name</TableHead>
                <TableHead className="p-4 md:p-2">Barangay Kagawad</TableHead>
                <TableHead className="p-4 md:p-2">Contact</TableHead>
                <TableHead className="p-4 md:p-2">Status</TableHead>
                <TableHead className="p-4 md:p-2 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {puroks.map((p) => (
                <TableRow
                  key={p._id}
                  className="border-b border-slate-100 hover:bg-slate-50/50"
                >
                  <TableCell className="font-medium text-slate-800 p-4 md:p-2">
                    {p.name}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500 p-4 md:p-2">
                    {p.leader || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500 p-4 md:p-2">
                    {p.contact || "—"}
                  </TableCell>
                  <TableCell className="p-4 md:p-2">
                    <span
                      className={
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                        (p.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500")
                      }
                    >
                      {p.status.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right p-4 md:p-2">
                    <RequestActionsMenu
                      actions={[
                        {
                          key: "view",
                          label: "View Residents",
                          icon: Users,
                          onClick: () => setViewing(p),
                        },
                        ...(canManage
                          ? ([
                              {
                                key: "edit",
                                label: "Edit",
                                icon: Pencil,
                                onClick: () => {
                                  setEditing(p);
                                  setModalOpen(true);
                                },
                              },
                              {
                                key: "status",
                                label:
                                  p.status === "active"
                                    ? "Deactivate"
                                    : "Activate",
                                icon: Power,
                                onClick: () =>
                                  statusMut.mutate({
                                    id: p._id,
                                    status:
                                      p.status === "active"
                                        ? "inactive"
                                        : "active",
                                  }),
                              },
                              {
                                key: "delete",
                                label: "Delete",
                                icon: Trash2,
                                className: "text-rose-500",
                                onClick: () => removePurok(p),
                              },
                            ] as RequestActionItem[])
                          : []),
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {puroks.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-slate-500 py-8"
                  >
                    No puroks yet. Add the puroks in your barangay.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <PurokFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        initial={editing}
        existingNames={puroks
          .filter((p) => p._id !== editing?._id)
          .map((p) => p.name)}
        onSubmit={async (values) => {
          if (editing) {
            await updateMut.mutateAsync({ id: editing._id, data: values });
          } else {
            await createMut.mutateAsync({ ...values, status: "active" });
          }
        }}
      />

      <ResidentDialog
        purok={viewing}
        onOpenChange={(o) => setViewing(o ? o : null)}
      />
    </div>
  );
}

function PurokFormDialog({
  open,
  onOpenChange,
  initial,
  existingNames,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: purokInterface | null;
  existingNames: string[];
  onSubmit: (values: PurokFormValues) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    leader: initial?.leader ?? "",
    contact: initial?.contact ?? "",
    description: initial?.description ?? "",
  });
  const [errors, setErrors] = useState<Partial<Record<PurokFormField, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const openedKey = `${open}:${initial?._id ?? "new"}`;
  const [lastKey, setLastKey] = useState(openedKey);
  if (lastKey !== openedKey) {
    setLastKey(openedKey);
    setForm({
      name: initial?.name ?? "",
      leader: initial?.leader ?? "",
      contact: initial?.contact ?? "",
      description: initial?.description ?? "",
    });
    setErrors({});
  }

  const set = (key: PurokFormField, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const validate = () => {
    const next: Partial<Record<PurokFormField, string>> = {};
    const name = collapseSpaces(form.name);
    const leader = collapseSpaces(form.leader);
    const contact = collapseSpaces(form.contact);
    const description = form.description.trim();

    if (!name) {
      next.name = "Purok name is required.";
    } else if (name.length > PUROK_NAME_MAX_LENGTH) {
      next.name = `Purok name must be at most ${PUROK_NAME_MAX_LENGTH} characters.`;
    } else if (!PUROK_NAME_PATTERN.test(name)) {
      next.name = "Purok name can only contain letters, numbers, spaces, and - . ' ( ) # &";
    } else if (existingNames.some((n) => purokNameKey(n) === purokNameKey(name))) {
      next.name = "A purok with this name already exists.";
    }

    if (leader && leader !== collapseSpaces(initial?.leader ?? "")) {
      if (leader.length > PUROK_LEADER_MAX_LENGTH) {
        next.leader = `Leader name must be at most ${PUROK_LEADER_MAX_LENGTH} characters.`;
      } else if (!LEADER_NAME_PATTERN.test(leader)) {
        next.leader = "Leader name can only contain letters, spaces, periods, hyphens and apostrophes.";
      }
    }

    if (contact && contact !== collapseSpaces(initial?.contact ?? "") && !isPhilippineMobile(contact)) {
      next.contact = "Enter a valid Philippine mobile number (e.g. 09171234567).";
    }

    if (description.length > PUROK_DESCRIPTION_MAX_LENGTH) {
      next.description = `Description must be at most ${PUROK_DESCRIPTION_MAX_LENGTH} characters.`;
    }

    setErrors(next);
    return { valid: Object.keys(next).length === 0, name, leader, contact, description };
  };

  const submit = async () => {
    if (submitting) return;
    const { valid, name, leader, contact, description } = validate();
    if (!valid) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name,
        leader: leader || undefined,
        contact: contact || undefined,
        description: description || undefined,
      });
    } catch (err) {
      const fieldError = purokFieldError(err);
      if (fieldError) {
        setErrors((e) => ({ ...e, [fieldError.field]: fieldError.message }));
      } else {
        errorAlert(
          apiErrorMessage(err, initial ? "Failed to update purok." : "Failed to add purok."),
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Purok" : "Add Purok"}</DialogTitle>
          <DialogDescription>
            Enter the purok name and optional leader / description.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="purok-name">Purok Name *</Label>
            <Input
              id="purok-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Purok 1"
              maxLength={PUROK_NAME_MAX_LENGTH}
              aria-invalid={!!errors.name}
              disabled={submitting}
            />
            {errors.name && <p className="text-sm text-rose-600">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="purok-leader">Leader</Label>
              <Input
                id="purok-leader"
                value={form.leader}
                onChange={(e) => set("leader", e.target.value)}
                maxLength={PUROK_LEADER_MAX_LENGTH}
                aria-invalid={!!errors.leader}
                disabled={submitting}
              />
              {errors.leader && <p className="text-sm text-rose-600">{errors.leader}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="purok-contact">Contact</Label>
              <Input
                id="purok-contact"
                value={form.contact}
                onChange={(e) => set("contact", e.target.value)}
                placeholder="09XXXXXXXXX"
                inputMode="tel"
                maxLength={30}
                aria-invalid={!!errors.contact}
                disabled={submitting}
              />
              {errors.contact && <p className="text-sm text-rose-600">{errors.contact}</p>}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="purok-description">Description</Label>
            <Textarea
              id="purok-description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              maxLength={PUROK_DESCRIPTION_MAX_LENGTH}
              aria-invalid={!!errors.description}
              disabled={submitting}
            />
            {errors.description && (
              <p className="text-sm text-rose-600">{errors.description}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {submitting
                ? initial
                  ? "Saving..."
                  : "Adding..."
                : initial
                  ? "Save Changes"
                  : "Add Purok"}
            </Button>
          </DialogFooter>
        </form>
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
          <DialogDescription>
            {residents.length} household member(s) listed under this purok.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading residents…
            </div>
          ) : residents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No residents assigned to this purok yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              {residents.map((r: PurokResident, i: number) => (
                <div
                  key={r._id}
                  className={
                    "px-4 py-2.5 text-sm " +
                    (i % 2 ? "bg-slate-50/60" : "bg-white")
                  }
                >
                  <p className="font-medium text-slate-800">{r.name}</p>
                  <p className="text-xs text-slate-500">
                    {withBarangayLocality(r.address) || "—"} · {r.contact || "no contact"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(null)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
