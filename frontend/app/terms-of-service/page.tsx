"use client";
import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

function TermsOfServiceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const isFromSignup = from === "signup";
  
  const handleBack = () => {
    if (isFromSignup) {
      router.push("/guest/signUp");
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-4 text-slate-600 hover:text-sky-600"
          onClick={handleBack}
        >
          <ArrowLeft className="size-4 mr-2" /> {isFromSignup ? "Back to Sign Up" : "Back to Home"}
        </Button>
        <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200">
          <h1 className="text-3xl font-bold mb-6 text-slate-900">Terms of Service</h1>
          <p className="text-sm text-slate-500 mb-6">Last updated: September 16, 2026. Version: 1.0</p>
          <section className="space-y-4 mb-8">
            <h2 className="text-xl font-semibold text-slate-800">1. Accurate Information</h2>
            <p className="text-slate-600">
              Users must provide accurate information. Do not submit fraudulent requests. You may only request documents you are authorized to request.
            </p>
          </section>
          <section className="space-y-4 mb-8">
            <h2 className="text-xl font-semibold text-slate-800">2. Document Processing</h2>
            <p className="text-slate-600">
              Document fees/prices are determined by the barangay. Generated documents are not officially issued until they have gone through the barangay approval/issuance process.
            </p>
          </section>
          <section className="space-y-4 mb-8">
            <h2 className="text-xl font-semibold text-slate-800">3. Account Responsibility</h2>
            <p className="text-slate-600">
              Users are responsible for their account credentials. Misuse of the system may result in account restrictions. System maintenance may occur periodically.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function TermsOfServicePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <TermsOfServiceContent />
    </Suspense>
  );
}
