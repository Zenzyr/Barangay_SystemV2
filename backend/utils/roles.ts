/**
 * Canonical application roles. Used consistently across the MongoDB schema,
 * backend authorization, and frontend.
 */
export const ROLES = {
  RESIDENT: "resident",
  SECRETARY: "secretary",
  SUPER_ADMIN: "super_admin",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LIST: readonly string[] = [
  ROLES.RESIDENT,
  ROLES.SECRETARY,
  ROLES.SUPER_ADMIN,
];

/** Operational barangay staff roles (secretary runs the office, super admin may also). */
export const STAFF_ROLES: readonly string[] = [ROLES.SECRETARY, ROLES.SUPER_ADMIN];

export const isStaffRole = (role?: string): boolean =>
  role === ROLES.SECRETARY || role === ROLES.SUPER_ADMIN;