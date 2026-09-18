"use client";

import { useRouter } from "next/navigation";
import { useSuperAdminGuard } from "@/app/hooks/useRoleGuard";
import {
  Users,
  MapPin,
  Image as ImageIcon,
  MessageSquare,
  UserCog,
  FileText,
  ScrollText,
  Landmark,
  ChevronRight,
  DatabaseBackup,
} from "lucide-react";

const SECTIONS = [
  {
    href: "/pages/secretary/barangaySettings/officials",
    label: "Barangay Officials",
    description:
      "Manage the Punong Barangay, Kagawads, Secretary, Treasurer, and SK. Changes automatically apply to newly generated documents.",
    icon: Users,
  },
  {
    href: "/pages/secretary/barangaySettings/puroks",
    label: "Purok Management",
    description:
      "Maintain the list of puroks and their leaders, and view the residents or census linked to each purok.",
    icon: MapPin,
  },
  {
    href: "/pages/secretary/barangaySettings/externalRecipients",
    label: "External Recipients",
    description:
      "Manage offices or persons outside the barangay that documents are addressed to (e.g. the Mayor for endorsement letters).",
    icon: Landmark,
  },
  {
    href: "/pages/secretary/barangaySettings/logo",
    label: "Logo & General Info",
    description:
      "Upload the barangay logo and seal, and update contact details and header/footer text used across documents.",
    icon: ImageIcon,
  },
  {
    href: "/pages/secretary/barangaySettings/sms",
    label: "SMS Notifications",
    description:
      "Configure SMS notifications for document requests, status updates, and payments.",
    icon: MessageSquare,
  },
  {
    href: "/pages/secretary/barangaySettings/account",
    label: "Account Settings",
    description:
      "Update your secretary profile, contact details, and password.",
    icon: UserCog,
  },
  {
    href: "/pages/secretary/document-templates",
    label: "Document Templates",
    description:
      "Design document layouts, dynamic fields, fees, and previews for every barangay certificate.",
    icon: FileText,
  },
  {
    href: "/pages/secretary/barangaySettings/audit",
    label: "Audit Trail",
    description:
      "Review a history of every change made to officials and barangay settings for accountability.",
    icon: ScrollText,
  },
  {
    href: "/pages/secretary/barangaySettings/backup",
    label: "Backup & Restore",
    description:
      "Create a full backup of the barangay system data, download it, or restore from a previous backup.",
    icon: DatabaseBackup,
  },
] as const;

export default function Page() {
  const router = useRouter();
  const { isSuperAdmin } = useSuperAdminGuard();

  if (!isSuperAdmin) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          Barangay Settings
        </h1>
        <p className="text-sm text-slate-500">
          Central configuration hub. Changes here apply to newly generated
          documents automatically — no source-code edits needed.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(({ href, label, description, icon: Icon }) => (
          <button
            key={href}
            onClick={() => router.push(href)}
            className="group flex flex-col items-start rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-sky-200 hover:bg-sky-50/40"
          >
            <div className="mb-3 flex size-11 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
              <Icon className="size-5" />
            </div>
            <div className="flex items-center gap-1">
              <h2 className="font-semibold text-slate-800">{label}</h2>
              <ChevronRight className="size-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}