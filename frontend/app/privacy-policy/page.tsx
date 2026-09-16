"use client";
import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

function PrivacyPolicyContent() {
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
          <h1 className="text-3xl font-bold mb-6 text-slate-900">Privacy Policy</h1>
          <p className="text-sm text-slate-500 mb-6">Last updated: September 16, 2026. Version: 1.0</p>
          <section className="space-y-4 mb-8">
            <h2 className="text-xl font-semibold text-slate-800">1. Information We Collect</h2>
            <p className="text-slate-600">
              We collect information provided by residents during registration and document requests, including account details (name, email), resident information (address, purok), contact information, and necessary identification documents uploaded for verification purposes.
            </p>
          </section>
          <section className="space-y-4 mb-8">
            <h2 className="text-xl font-semibold text-slate-800">2. How We Use Information</h2>
            <p className="text-slate-600">
              Information is used to facilitate document requests, verify residency, and maintain administrative records as required for barangay operations.
            </p>
          </section>
          <section className="space-y-4 mb-8">
            <h2 className="text-xl font-semibold text-slate-800">3. Data Security and Access</h2>
            <p className="text-slate-600">
              Access to information is strictly controlled based on roles: residents can access their own data, while authorized barangay staff (Secretaries, Super Admins) have permissions to process requests and manage records. We implement security measures to protect your data. Identification documents are retained only as long as necessary for verification.
            </p>
          </section>
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800">4. Your Rights</h2>
            <p className="text-slate-600">
              You have the right to access, correct, or request deletion of your data. For any privacy concerns, please contact the Barangay Office directly.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <PrivacyPolicyContent />
    </Suspense>
  );
}
