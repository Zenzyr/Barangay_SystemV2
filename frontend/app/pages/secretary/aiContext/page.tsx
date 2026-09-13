"use client";

import { useState, useEffect } from "react";
import axiosInstance from "@/app/utils/axios";
import { useSuperAdminGuard } from "@/app/hooks/useRoleGuard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { successAlert, errorAlert } from "@/app/utils/alert";
import {
  Brain,
  Save,
  Loader2,
  Info,
} from "lucide-react";

interface ApiError {
  response?: { data?: unknown };
  message?: string;
}

export default function AiContextPage() {
  const { isSuperAdmin } = useSuperAdminGuard();
  const [aiContext, setAiContext] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Fetch existing AI context once on mount ──────────────────
  useEffect(() => {
    let cancelled = false;
    const fetchContext = async () => {
      try {
        const res = await axiosInstance.get("/account/ai-context");
        if (!cancelled) {
          setAiContext(res.data.aiContext || "");
        }
      } catch {
        // No context yet, leave empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchContext();
    return () => { cancelled = true; };
  }, []);

  // ── Save ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!aiContext.trim()) {
      errorAlert("AI context cannot be empty");
      return;
    }
    setSaving(true);
    try {
      await axiosInstance.put("/account/ai-context", { aiContext });
      successAlert("AI context saved successfully!");
    } catch (err) {
      const apiErr = err as ApiError;
      const message =
        apiErr?.response?.data || apiErr?.message || "Failed to save AI context";
      errorAlert(typeof message === "string" ? message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const charCount = aiContext.length;

  if (!isSuperAdmin) return null;

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Brain className="size-6 text-sky-600" />
          Barangay Details
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure the AI context that the chatbot uses to answer resident
          inquiries about the barangay.
        </p>
      </div>

      {/* ── Editor Card ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="size-5 text-sky-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              AI Context
            </h2>
          </div>
          {!loading && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {charCount} characters
            </span>
          )}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-9 w-28 rounded-lg ml-auto" />
            </div>
          ) : (
            <div className="space-y-4">
              <Textarea
                placeholder="Enter the AI context for the barangay chatbot..."
                value={aiContext}
                onChange={(e) => setAiContext(e.target.value)}
                className="min-h-[300px] sm:min-h-[400px] resize-y text-sm leading-relaxed p-4 border-gray-200 focus:border-sky-400 focus:ring-sky-400/20 rounded-xl"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  This context is used by the AI chatbot when responding to
                  resident questions.
                </p>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="h-10 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium rounded-xl shadow-lg shadow-sky-200/50 hover:shadow-emerald-200/50 transition-all duration-300 disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tips Card ── */}
      <div className="bg-gradient-to-br from-sky-50 to-emerald-50 rounded-xl border border-sky-100 p-5">
        <div className="flex items-start gap-3">
          <div className="size-8 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
            <Brain className="size-4 text-sky-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              Tips for writing good AI context
            </h3>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              <li>Include barangay background, mission, and vision</li>
              <li>List barangay officials and their roles</li>
              <li>Describe services offered (certificates, clearances, etc.)</li>
              <li>Include office hours, contact info, and location</li>
              <li>Specify requirements for each document/service</li>
              <li>Mention any fees or processing times</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
