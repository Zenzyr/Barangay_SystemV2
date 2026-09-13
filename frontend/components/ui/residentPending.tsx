"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Clock, ArrowLeft, ShieldCheck, Mail } from "lucide-react";
import useBarangaySettingsStore from "@/app/store/useBarangaySettingsStore";

export default function ResidentPending() {
  const settings = useBarangaySettingsStore((s) => s.settings);
  const barangayName = settings?.barangay?.name || "Barangay Rabon";
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
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg text-center">
          {/* Animated Icon */}
          <div className="relative mx-auto mb-8">
            <div className="size-24 rounded-full bg-gradient-to-br from-amber-50 to-orange-50 mx-auto flex items-center justify-center shadow-lg shadow-amber-200/30 border border-amber-100">
              <Clock className="size-12 text-amber-500" />
            </div>
            {/* Pulsing ring */}
            <div className="absolute inset-0 size-24 mx-auto rounded-full animate-ping bg-amber-400/10" />
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-3">
            Account Pending Approval
          </h1>

          {/* Description */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-amber-100 shadow-lg p-6 sm:p-8 mb-6 text-left space-y-4">
            <p className="text-gray-600 leading-relaxed">
              Your registration has been submitted successfully! Your account is
              currently under review by the Barangay Secretary.
            </p>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <ShieldCheck className="size-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  What&apos;s next?
                </p>
                <p className="text-sm text-gray-600 mt-0.5">
                  The secretary will review your submitted ID documents. Once
                  approved, you&apos;ll be able to access all Barangay
                  services.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-sky-50 border border-sky-100">
              <Mail className="size-5 text-sky-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  Need help?
                </p>
                <p className="text-sm text-gray-600 mt-0.5">
                  If you have questions, please contact the Barangay Hall
                  directly.
                </p>
              </div>
            </div>
          </div>

          {/* Back to Home */}
          <div className="space-y-3">
            <Link href="/">
              <Button className="w-full h-11 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium rounded-xl shadow-lg shadow-sky-200/50 hover:shadow-emerald-200/50 transition-all duration-300">
                <ArrowLeft className="size-4" />
                Back to Home Page
              </Button>
            </Link>
            <p className="text-xs text-gray-400">
              You will be able to sign in once your account is approved.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-gray-400 border-t border-sky-100 bg-white/50">
        &copy; {new Date().getFullYear()} {barangayName}. All rights
        reserved.
      </footer>
    </div>
  );
}
