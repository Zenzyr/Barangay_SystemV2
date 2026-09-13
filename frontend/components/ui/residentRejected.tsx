"use client";

import { useState, useRef, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import axiosInstance from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
import useBarangaySettingsStore from "@/app/store/useBarangaySettingsStore";
import { successAlert, errorAlert } from "@/app/utils/alert";
import {
  XCircle,
  ArrowLeft,
  Camera,
  IdCard,
  CheckCircle2,
  Upload,
  Loader2,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";

interface ApiError {
  response?: { data?: unknown };
  message?: string;
}

function UploadBox({
  label,
  icon: Icon,
  file,
  preview,
  inputRef,
  onSelect,
  onRemove,
  accentColor,
}: {
  label: string;
  icon: React.ElementType;
  file: File | null;
  preview: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: (file: File) => void;
  onRemove: () => void;
  accentColor: string;
}) {
  return (
    <div className="relative">
      <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
        {label}
      </Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSelect(f);
        }}
      />
      {preview && file ? (
        <div className="relative group rounded-xl overflow-hidden border-2 border-emerald-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
          <img
            src={preview}
            alt={label}
            className="w-full h-44 object-cover"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
            <button
              type="button"
              onClick={onRemove}
              className="opacity-0 group-hover:opacity-100 transition-all duration-300 bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-4 py-2 rounded-lg shadow-lg"
            >
              Remove
            </button>
          </div>
          <div className="absolute top-2 right-2">
            <CheckCircle2 className="size-5 text-green-500 drop-shadow-sm" />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`w-full h-44 rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-2 bg-white hover:shadow-lg group ${accentColor}`}
        >
          <div className="size-12 rounded-full flex items-center justify-center bg-gradient-to-br from-rose-50 to-orange-50 group-hover:scale-110 transition-transform duration-300">
            <Icon className="size-6 text-rose-400" />
          </div>
          <span className="text-sm font-medium text-gray-600">
            Click to upload
          </span>
          <span className="text-xs text-gray-400">
            PNG, JPG or WEBP (max 5MB)
          </span>
        </button>
      )}
    </div>
  );
}

export default function ResidentRejected() {
  const { user , setUser} = useUserStore();
  const settings = useBarangaySettingsStore((s) => s.settings);
  const barangayName = settings?.barangay?.name || "Barangay Rabon";
  const [loading, setLoading] = useState(false);

  // File uploads
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [idSelfie, setIdSelfie] = useState<File | null>(null);

  const [idFrontPreview, setIdFrontPreview] = useState<string | null>(null);
  const [idBackPreview, setIdBackPreview] = useState<string | null>(null);
  const [idSelfiePreview, setIdSelfiePreview] = useState<string | null>(null);

  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (
    file: File,
    setFile: (f: File) => void,
    setPreview: (url: string) => void
  ) => {
    if (!file.type.startsWith("image/")) {
      errorAlert("Please select a valid image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      errorAlert("Image must be less than 5MB");
      return;
    }
    setFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const removeImage = (
    setFile: (f: null) => void,
    setPreview: (url: null) => void,
    ref: React.RefObject<HTMLInputElement | null>
  ) => {
    setFile(null);
    setPreview(null);
    if (ref.current) ref.current.value = "";
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!idFront || !idBack || !idSelfie) {
      errorAlert("Please upload all 3 ID images (front, back, selfie)");
      return;
    }

    if (!user?._id) {
      errorAlert("User not found. Please sign in again.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("idFront", idFront);
      formData.append("idBack", idBack);
      formData.append("idSelfie", idSelfie);

      await axiosInstance.put(`/account/${user._id}/resubmit`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      successAlert("Images resubmitted successfully! Your account is now pending review.");
      // Refresh the page to reflect the new status

      const updatedUser = {...user}

      updatedUser.status = "pending"

      setUser(updatedUser)
      
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      const message =
        (err as ApiError)?.response?.data || (err as ApiError)?.message || "Failed to resubmit images";
      errorAlert(typeof message === "string" ? message : "Failed to resubmit images");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50 flex flex-col">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-sky-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-600 hover:text-sky-600 transition-colors"
            >
              <ArrowLeft className="size-4" />
              <span className="text-sm font-medium">Back to Home</span>
            </Link>
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/assets/logo.jpg"
                alt="Barangay Logo"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-sm font-semibold bg-gradient-to-r from-sky-600 to-emerald-600 bg-clip-text text-transparent">
                {barangayName}
              </span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 px-4 py-8 sm:py-12">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="relative mx-auto mb-6 inline-flex">
              <div className="size-24 rounded-full bg-gradient-to-br from-rose-50 to-red-50 mx-auto flex items-center justify-center shadow-lg shadow-rose-200/30 border border-rose-100">
                <XCircle className="size-12 text-rose-400" />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-3">
              ID Verification Rejected
            </h1>
            <p className="text-gray-500 max-w-md mx-auto">
              The ID images you submitted were not approved by the Barangay
              Secretary. Please upload clear and readable copies of your ID
              documents below.
            </p>
          </div>

          {/* Info card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-rose-100 shadow-lg p-5 mb-8">
            <div className="flex items-start gap-3">
              <ShieldAlert className="size-5 text-rose-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  Why was it rejected?
                </p>
                <p className="text-sm text-gray-600 mt-0.5">
                  Common reasons include blurry or unclear images, incomplete ID
                  information, or the selfie not clearly showing both your face
                  and the ID. Please make sure all details are visible and
                  legible before resubmitting.
                </p>
              </div>
            </div>
          </div>

          {/* Resubmit Form */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-sky-100 shadow-xl p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Upload Section */}
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                  <div className="size-2 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400" />
                  Resubmit ID Images
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  Upload new, clear photos of your ID documents.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <UploadBox
                    label="Front of ID"
                    icon={IdCard}
                    file={idFront}
                    preview={idFrontPreview}
                    inputRef={frontRef}
                    onSelect={(f) => handleFileSelect(f, setIdFront, setIdFrontPreview)}
                    onRemove={() => removeImage(setIdFront, setIdFrontPreview, frontRef)}
                    accentColor="border-rose-300 hover:border-rose-400 hover:bg-rose-50/50"
                  />
                  <UploadBox
                    label="Back of ID"
                    icon={IdCard}
                    file={idBack}
                    preview={idBackPreview}
                    inputRef={backRef}
                    onSelect={(f) => handleFileSelect(f, setIdBack, setIdBackPreview)}
                    onRemove={() => removeImage(setIdBack, setIdBackPreview, backRef)}
                    accentColor="border-rose-300 hover:border-rose-400 hover:bg-rose-50/50"
                  />
                  <UploadBox
                    label="Selfie with ID"
                    icon={Camera}
                    file={idSelfie}
                    preview={idSelfiePreview}
                    inputRef={selfieRef}
                    onSelect={(f) => handleFileSelect(f, setIdSelfie, setIdSelfiePreview)}
                    onRemove={() => removeImage(setIdSelfie, setIdSelfiePreview, selfieRef)}
                    accentColor="border-rose-300 hover:border-rose-400 hover:bg-rose-50/50"
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="space-y-3 pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium rounded-xl shadow-lg shadow-sky-200/50 hover:shadow-emerald-200/50 transition-all duration-300 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-4" />
                      Resubmit for Review
                    </>
                  )}
                </Button>
                <p className="text-center text-xs text-gray-400">
                  Your account status will be set to pending after resubmission.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-gray-400 border-t border-sky-100 bg-white/50">
        &copy; {new Date().getFullYear()} {barangayName}. All rights reserved.
      </footer>
    </div>
  );
}
