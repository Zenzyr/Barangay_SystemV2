"use client"
import {
  Home,
  BarChart3,
  Sparkles,
  UserPlus2,
  FileText,
  FileStack,
  History,
  ClipboardList,
  Award,
  Landmark,
  MapPin,
  ScrollText,
  Settings,
  ReceiptText,
  FileBarChart,
  Hammer,
} from "lucide-react"
import { NavItem, StaffSidebar } from "@/components/ui/sidebar_shared";

const navigationItems: NavItem[] = [
  { title: "Dashboard", url: "/pages/secretary/home", icon: Home },
  { title: "Analytics", url: "/pages/secretary/analytics", icon: BarChart3 },
  { title: "Decision Support", url: "/pages/secretary/decisionSupport", icon: Sparkles },
  { title: "Verify Resident", url: "/pages/secretary/verifyResident", icon: UserPlus2 },
  { title: "Document Requests", url: "/pages/secretary/documentRequest", icon: FileText },
  { title: "Document Templates", url: "/pages/secretary/document-templates", icon: FileStack },
  { title: "Request History", url: "/pages/secretary/requestHistory", icon: History },
  { title: "Transactions", url: "/pages/secretary/transactions", icon: ReceiptText },
  { title: "Reports", url: "/pages/secretary/reports", icon: FileBarChart },
  { title: "Work Requests", url: "/pages/secretary/workRequests", icon: Hammer },
  { title: "Resident Census", url: "/pages/secretary/residentCensus", icon: ClipboardList },
  { title: "Resident Skills", url: "/pages/secretary/residentSkills", icon: Award },
  {
    title: "Settings",
    icon: Settings,
    children: [
      { title: "Officials", url: "/pages/secretary/barangaySettings/officials", icon: Landmark },
      { title: "Puroks", url: "/pages/secretary/barangaySettings/puroks", icon: MapPin },
      { title: "Audit Trail", url: "/pages/secretary/barangaySettings/audit", icon: ScrollText },
    ],
  },
]

interface AppSidebarProps {
  className?: string
}

export function SidebarSecretary({ className }: AppSidebarProps) {
  return <StaffSidebar className={className} subtitle="Secretary" homeHref="/pages/secretary/home" items={navigationItems} />
}
