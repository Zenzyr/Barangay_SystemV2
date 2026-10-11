"use client";

import { ReportWorkspace } from "@/components/reports/ReportWorkspace";

export default function Page() {
  return <ReportWorkspace types={["documents", "census", "work"]} />;
}
