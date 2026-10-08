/**
 * Canonical application roles. Used consistently across the MongoDB schema,
 * backend authorization, and frontend.
 */
export const ROLES = {
  RESIDENT: "resident",
  SECRETARY: "secretary",
  SUPER_ADMIN: "super_admin",
  TREASURER: "treasurer",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LIST: readonly string[] = [
  ROLES.RESIDENT,
  ROLES.SECRETARY,
  ROLES.SUPER_ADMIN,
  ROLES.TREASURER,
];

/** Operational barangay staff roles (secretary runs the office, super admin may also). */
export const STAFF_ROLES: readonly string[] = [ROLES.SECRETARY, ROLES.SUPER_ADMIN];

export const isStaffRole = (role?: string): boolean =>
  role === ROLES.SECRETARY || role === ROLES.SUPER_ADMIN;

/** Accounts whose role is assigned by a super admin rather than self-registration. */
export const isOfficeRole = (role?: string): boolean =>
  isStaffRole(role) || role === ROLES.TREASURER;

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
  [ROLES.RESIDENT]: [],
  [ROLES.SECRETARY]: [
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_DETAILS_VIEW,
    PERMISSIONS.RECEIPTS_VIEW,
    PERMISSIONS.RECEIPTS_REPRINT,
  ],
  [ROLES.SUPER_ADMIN]: ALL_PERMISSIONS.filter(
    (p) =>
      p !== PERMISSIONS.TREASURER_DASHBOARD_VIEW &&
      p !== PERMISSIONS.PAYMENTS_VERIFY &&
      p !== PERMISSIONS.PAYMENTS_REJECT &&
      p !== PERMISSIONS.PAYMENTS_CORRECT,
  ),
  [ROLES.TREASURER]: ALL_PERMISSIONS,
};

export const hasPermission = (role: string | undefined | null, permission: Permission): boolean => {
  if (!role) return false;
  return (ROLE_PERMISSIONS[role as AppRole] ?? []).includes(permission);
};
