export const ROLES = {
  RESIDENT: "resident",
  SECRETARY: "secretary",
  SUPER_ADMIN: "super_admin",
  TREASURER: "treasurer",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export const PERMISSIONS = {
  TREASURER_DASHBOARD_VIEW: "treasurer.dashboard.view",
  PAYMENTS_VIEW: "payments.view",
  PAYMENTS_DETAILS_VIEW: "payments.details.view",
  PAYMENTS_VERIFY: "payments.verify",
  PAYMENTS_REJECT: "payments.reject",
  PAYMENTS_CORRECT: "payments.correct",
  RECEIPTS_VIEW: "receipts.view",
  RECEIPTS_REPRINT: "receipts.reprint",
  COLLECTION_REPORTS_VIEW: "reports.collections.view",
  COLLECTION_REPORTS_EXPORT: "reports.collections.export",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

export const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  resident: [],
  secretary: [
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_DETAILS_VIEW,
    PERMISSIONS.RECEIPTS_VIEW,
    PERMISSIONS.RECEIPTS_REPRINT,
  ],
  super_admin: ALL_PERMISSIONS.filter(
    (p) =>
      p !== PERMISSIONS.TREASURER_DASHBOARD_VIEW &&
      p !== PERMISSIONS.PAYMENTS_VERIFY &&
      p !== PERMISSIONS.PAYMENTS_REJECT &&
      p !== PERMISSIONS.PAYMENTS_CORRECT,
  ),
  treasurer: ALL_PERMISSIONS,
};

export function hasPermission(role: string | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (ROLE_PERMISSIONS[role as AppRole] ?? []).includes(permission);
}

export const ROLE_HOME: Record<AppRole, string> = {
  resident: "/pages/resident/home",
  secretary: "/pages/secretary/home",
  super_admin: "/pages/superadmin/home",
  treasurer: "/pages/treasurer/dashboard",
};

export function homeForRole(role: string | null | undefined): string {
  return ROLE_HOME[(role as AppRole) || "resident"] ?? ROLE_HOME.resident;
}
