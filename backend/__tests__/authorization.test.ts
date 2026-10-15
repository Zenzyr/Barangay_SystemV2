import { requireRoles } from "../middleware/auth";
import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../types/request.type";

const make = (role?: string) =>
  ({ account: role ? { role } : undefined }) as unknown as AuthRequest;

function run(role: string | undefined, roles: string[]) {
  const req = make(role);
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
  const next: NextFunction = jest.fn() as unknown as NextFunction;
  requireRoles(...roles)(req, res, next);
  return { res, next };
}

describe("requireRoles (decision-support authorization)", () => {
  it("blocks residents and unauthenticated requests with 403", () => {
    expect(run("resident", ["secretary", "super_admin"]).res.status).toHaveBeenCalledWith(403);
    expect(run(undefined, ["secretary", "super_admin"]).res.status).toHaveBeenCalledWith(403);
  });

  it("does not call next() for a blocked role", () => {
    const { next } = run("resident", ["secretary", "super_admin"]);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows secretaries and super admins", () => {
    const secretary = run("secretary", ["secretary", "super_admin"]);
    expect(secretary.next).toHaveBeenCalled();
    expect(secretary.res.status).not.toHaveBeenCalled();

    const admin = run("super_admin", ["secretary", "super_admin"]);
    expect(admin.next).toHaveBeenCalled();
  });
});