"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  DatabaseBackup,
  Download,
  FileJson,
  Loader2,
  RotateCcw,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { useSuperAdminGuard } from "@/app/hooks/useRoleGuard";
import { BackupMetadata, RestoreResponse } from "@/app/types/backup.type";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, i);
  return `${i === 0 ? value : value.toFixed(2)} ${units[i]}`;
}

const fmtDateTime = (iso?: string): string =>
  iso
    ? new Date(iso).toLocaleString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

async function extractErrorMessage(
  err: unknown,
  isBlobResponse = false,
): Promise<string> {
  const response = (err as { response?: { data?: unknown } })?.response;
  let data = response?.data;
  if (isBlobResponse && data instanceof Blob) {
    try {
      data = await data.text();
    } catch {
      data = undefined;
    }
  }
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  const message = (err as Error)?.message;
  return message || "Something went wrong. Please try again.";
}

export default function Page() {
  const router = useRouter();
  const { isSuperAdmin } = useSuperAdminGuard();
  const queryClient = useQueryClient();
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);

  const { data: backups = [], isLoading } = useQuery<BackupMetadata[]>({
    queryKey: ["backups"],
    queryFn: async () => {
      const res = await axiosInstance.get("/backup");
      return res.data;
    },
    enabled: isSuperAdmin,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.post("/backup");
      return res.data as BackupMetadata;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backups"] });
      successAlert("Backup created successfully");
    },
    onError: async (err) => errorAlert(await extractErrorMessage(err)),
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!restoreFile) throw new Error("No backup file selected");
      const formData = new FormData();
      formData.append("backupFile", restoreFile);
      const res = await axiosInstance.post("/backup/restore", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data as RestoreResponse;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["backups"] });
      setRestoreDialogOpen(false);
      setRestoreFile(null);
      if (restoreInputRef.current) restoreInputRef.current.value = "";
      const failed = data.collections.filter((c) => c.error);
      if (failed.length) {
        errorAlert(
          `Restore completed, but some collections failed: ${failed.map((f) => f.name).join(", ")}`,
        );
      } else {
        successAlert("Backup restored successfully");
      }
    },
    onError: async (err) => errorAlert(await extractErrorMessage(err)),
  });

  const handleFileChange = (file: File | null) => {
    if (file && !file.name.toLowerCase().endsWith(".json")) {
      errorAlert("Please select a valid backup (.json) file");
      if (restoreInputRef.current) restoreInputRef.current.value = "";
      setRestoreFile(null);
      return;
    }
    setRestoreFile(file);
  };

  const handleDownload = async (backup: BackupMetadata) => {
    setDownloadingId(backup._id);
    try {
      const res = await axiosInstance.get(`/backup/${backup._id}/download`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = backup.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      errorAlert(await extractErrorMessage(err, true));
    } finally {
      setDownloadingId(null);
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-5">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          onClick={() => router.push("/pages/secretary/barangaySettings")}
        >
          <ArrowLeft className="size-4" /> Back to Settings
        </Button>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Backup & Restore
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Create a full backup of the barangay system data, download it, or
          restore from a previous backup.
        </p>
      </div>

      <div className="space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
              <DatabaseBackup className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Database Backup
              </h2>
              <p className="text-sm text-slate-500">
                Create a complete backup of the barangay system data.
              </p>
            </div>
          </div>
          <Button
            className="mt-4"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Creating Backup...
              </>
            ) : (
              <>
                <DatabaseBackup className="size-4" /> Create Backup
              </>
            )}
          </Button>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">
            Recent Backups
          </h2>

          {isLoading ? (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : backups.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No backups yet. Create one above to see it listed here.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
              {backups.map((backup) => (
                <div
                  key={backup._id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-800">
                      <FileJson className="size-4 shrink-0 text-slate-400" />
                      {backup.filename}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Created: {fmtDateTime(backup.createdAt)} · Size:{" "}
                      {formatBytes(backup.sizeBytes)}
                      {backup.status === "failed" && (
                        <span className="ml-1.5 font-medium text-rose-600">
                          · Failed
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => handleDownload(backup)}
                    disabled={downloadingId === backup._id}
                  >
                    {downloadingId === backup._id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Download className="size-3.5" />
                    )}
                    Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <RotateCcw className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Restore Backup
              </h2>
              <p className="text-sm text-slate-500">
                Upload a backup file to restore the system to a previous state.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <label
              htmlFor="restore-file"
              className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center hover:bg-slate-50"
            >
              <UploadCloud className="size-5 text-slate-400" />
              <span className="text-sm text-slate-600">
                {restoreFile
                  ? "Change selected file"
                  : "Click to select a backup (.json) file"}
              </span>
              <input
                id="restore-file"
                type="file"
                accept="application/json,.json"
                className="hidden"
                ref={restoreInputRef}
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />
            </label>

            {restoreFile && (
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className="truncate">{restoreFile.name}</span>
                <span className="shrink-0 text-slate-500">
                  {formatBytes(restoreFile.size)}
                </span>
              </div>
            )}

            <Button
              variant="destructive"
              disabled={!restoreFile}
              onClick={() => setRestoreDialogOpen(true)}
            >
              <RotateCcw className="size-4" /> Restore Backup
            </Button>
          </div>
        </section>
      </div>

      <Dialog
        open={restoreDialogOpen}
        onOpenChange={(open) =>
          !restoreMutation.isPending && setRestoreDialogOpen(open)
        }
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Restore Backup?</DialogTitle>
            <DialogDescription>
              Restoring this backup may replace or modify existing system data.
              Make sure you have a current backup before continuing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoreDialogOpen(false)}
              disabled={restoreMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => restoreMutation.mutate()}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Restoring...
                </>
              ) : (
                "Restore Backup"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
