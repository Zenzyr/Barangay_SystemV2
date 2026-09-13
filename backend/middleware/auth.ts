import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../types/request.type";
import jwt from "jsonwebtoken";
import dotenv from 'dotenv';
import { AccountService } from "../services/acccount.service";
import { accountInterface } from "../types/accounts.type";
import { isObjectId } from "../utils/validation";

dotenv.config();

const secret = process.env.JWT_SECRET || "";

/**
 * Guards a route to a set of allowed roles. Must run after authenticateJWT.
 * Canonical roles: "resident", "secretary", "super_admin".
 * - Legislative configuration (settings, officials, purok writes, rule writes,
 *   role management) is limited to super_admin.
 * - Operational staff endpoints accept ("secretary", "super_admin").
 */
export const requireRoles = (...roles: string[]) => {
  return (request: AuthRequest, response: Response, next: NextFunction) => {
    const role = request.account?.role;
    if (!role || !roles.includes(role)) {
      response.status(403).json({ message: "Access denied" });
      return;
    }
    next();
  };
};

export const authenticateJWT = async (request: AuthRequest, response: Response, next: NextFunction) => {
  if (!secret) {
    console.error("[AUTH] JWT_SECRET is not configured in the server environment");
    response.status(500).json({ message: "Server authentication is not configured" });
    return;
  }

  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    response.status(401).json({ message: "No token provided" });
    return
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    response.status(401).json({ message: "No token provided" });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as { id?: string };
    const { id } = decoded;

    if (!id || !isObjectId(id)) {
      response.status(401).json({ message: "Invalid token" });
      return;
    }

    const accountDoc = await AccountService.get(id);

    if (!accountDoc) {
      response.status(401).json({ message: "Account no longer exists" });
      return;
    }

    const account: accountInterface = {
      _id: accountDoc._id.toString(),
      profile: accountDoc.profile ?? "",
      name: accountDoc.name,
      contact: accountDoc.contact ?? "",
      address: accountDoc.address ?? "",
      email: accountDoc.email,
      password: accountDoc.password,
      status: accountDoc.status,
      role: accountDoc.role || "resident",
      idImg: {
        idFront: accountDoc.idImg?.idFront ?? "",
        idBack: accountDoc.idImg?.idBack ?? "",
        idSelfie: accountDoc.idImg?.idSelfie ?? "",
      },
      skills: accountDoc.skills,
      reviews: accountDoc.reviews,
      gender: accountDoc.gender ?? "",
      dateOfBirth: accountDoc.dateOfBirth ?? "",
      civilStatus: accountDoc.civilStatus ?? "",
      purok: accountDoc.purok ?? "",
      voterStatus: accountDoc.voterStatus ?? "",
      houseHoldNumber: accountDoc.houseHoldNumber ?? "",
    };
    request.account = account;
    next();
  } catch (err) {
    response.status(401).json({ message: "Invalid token" });
  }
};
