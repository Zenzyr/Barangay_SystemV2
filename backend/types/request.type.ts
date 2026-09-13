import { Request } from "express";
import { accountInterface } from "./accounts.type";

export interface AuthRequest extends Request {
  account?: accountInterface;
  id?: string;
}
