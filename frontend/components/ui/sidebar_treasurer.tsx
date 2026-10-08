"use client"
import {
  LayoutDashboard,
  ReceiptText,
  ShieldCheck,
  Receipt,
  FileBarChart,
} from "lucide-react"
import { NavItem, StaffSidebar } from "@/components/ui/sidebar_shared";
import { PERMISSIONS } from "@/lib/constants/roles";

const navigationItems: NavItem[] = [
  { title: "Dashboard", url: "/pages/treasurer/dashboard", icon: LayoutDashboard, permission: PERMISSIONS.TREASURER_DASHBOARD_VIEW },
  { title: "Payment Transactions", url: "/pages/treasurer/payment-transactions", icon: ReceiptText, permission: PERMISSIONS.PAYMENTS_VIEW },
  { title: "Payment Verification", url: "/pages/treasurer/payment-verification", icon: ShieldCheck, permission: PERMISSIONS.PAYMENTS_VERIFY },
  { title: "Receipts", url: "/pages/treasurer/receipts", icon: Receipt, permission: PERMISSIONS.RECEIPTS_VIEW },
  { title: "Collection Reports", url: "/pages/treasurer/collection-reports", icon: FileBarChart, permission: PERMISSIONS.COLLECTION_REPORTS_VIEW },
]

export function SidebarTreasurer({ className }: { className?: string }) {
  return <StaffSidebar className={className} subtitle="Treasurer" homeHref="/pages/treasurer/dashboard" items={navigationItems} />
}
