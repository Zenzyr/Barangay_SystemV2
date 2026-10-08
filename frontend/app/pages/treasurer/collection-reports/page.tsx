"use client";

import { ReportWorkspace } from "@/components/reports/ReportWorkspace";

export default function Page() {
  return (
    <ReportWorkspace
      types={["collections"]}
      title="Collection Reports"
      subtitle="Daily, weekly, and monthly collections by payment method and document type"
    />
  );
}
