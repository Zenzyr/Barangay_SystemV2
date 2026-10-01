import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { WorkService } from "../services/work.service";
import { WorkRequestService, WorkRequestKind } from "../services/workRequest.service";
import { ScheduleError, WorkScheduleService } from "../services/workSchedule.service";
import { isObjectId } from "../utils/validation";
import { isStaffRole } from "../utils/roles";

const WORK_STATUSES = ['pending', 'rejected', 'active', 'to review', 'completed'];
const LIST_STATUSES = ['pending', 'active', 'accepted', 'to review', 'completed', 'rejected'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const WORKER_TRANSITIONS: Record<string, string[]> = {
  pending: ['active', 'rejected'],
  active: ['to review'],
};

const CLIENT_TRANSITIONS: Record<string, string[]> = {
  'to review': ['completed'],
};

const sendScheduleError = (response: Response, error: unknown) => {
  if (error instanceof ScheduleError) {
    response.status(error.status).json({ message: error.message, code: error.code });
    return true;
  }
  return false;
};

const canAccessParticipant = (request: AuthRequest, participantId: string) => {
  const account = request.account;
  if (!account) return false;
  return isStaffRole(account.role) || account._id.toString() === participantId;
};

const parseListFilters = (query: Record<string, any>) => {
  const status = typeof query.status === "string" && LIST_STATUSES.includes(query.status) ? query.status : undefined;
  const kind = query.kind === "booking" || query.kind === "service" ? (query.kind as WorkRequestKind) : undefined;
  const from = typeof query.from === "string" && DATE_RE.test(query.from) ? query.from : undefined;
  const to = typeof query.to === "string" && DATE_RE.test(query.to) ? query.to : undefined;
  const search = typeof query.search === "string" ? query.search.slice(0, 100) : undefined;
  return { status, kind, from, to, search };
};

export class WorkController {

  static getByClient = async (request: AuthRequest, response: Response) => {
    try {
      const { clientId } = request.params;
      if (!isObjectId(clientId)) {
        response.status(400).send("Invalid client id");
        return;
      }
      if (!canAccessParticipant(request, clientId)) {
        response.status(403).send("You can only view your own work requests");
        return;
      }
      const works = await WorkService.getByClient(clientId);
      response.send(works);
    } catch (error) {
      response.status(500).send("Failed to fetch work records");
    }
  }

  static getByWorker = async (request: AuthRequest, response: Response) => {
    try {
      const { workerId } = request.params;
      if (!isObjectId(workerId)) {
        response.status(400).send("Invalid worker id");
        return;
      }
      if (!canAccessParticipant(request, workerId)) {
        response.status(403).send("You can only view your own work requests");
        return;
      }
      const works = await WorkService.getByWorker(workerId);
      response.send(works);
    } catch (error) {
      response.status(500).send("Failed to fetch work records");
    }
  }

  static getMyRequests = async (request: AuthRequest, response: Response) => {
    try {
      const account = request.account;
      if (!account) {
        response.status(401).send("Authentication required");
        return;
      }
      const role = request.query.role === "client" || request.query.role === "provider" ? request.query.role : "any";
      const items = await WorkRequestService.list({
        ...parseListFilters(request.query),
        participant: account._id.toString(),
        role,
      });
      response.send(items);
    } catch (error) {
      console.error("[WORK REQUESTS MINE ERROR]", error);
      response.status(500).send("Failed to fetch your work requests");
    }
  }

  static getAllRequests = async (request: AuthRequest, response: Response) => {
    try {
      const items = await WorkRequestService.list(parseListFilters(request.query));
      response.send(items);
    } catch (error) {
      console.error("[WORK REQUESTS LIST ERROR]", error);
      response.status(500).send("Failed to fetch work requests");
    }
  }

  static getAvailability = async (request: AuthRequest, response: Response) => {
    try {
      const provider = String(request.query.provider || "");
      const date = String(request.query.date || "");
      if (!isObjectId(provider)) {
        response.status(400).json({ message: "A valid provider is required" });
        return;
      }
      if (!DATE_RE.test(date)) {
        response.status(400).json({ message: "A valid date (YYYY-MM-DD) is required" });
        return;
      }
      const availability = await WorkScheduleService.getAvailability(provider, date);
      response.send(availability);
    } catch (error) {
      if (sendScheduleError(response, error)) return;
      console.error("[WORK AVAILABILITY ERROR]", error);
      response.status(500).json({ message: "Failed to load available time slots" });
    }
  }

  static getScheduleConfig = async (_request: AuthRequest, response: Response) => {
    try {
      const config = await WorkScheduleService.getConfig();
      response.send(config);
    } catch (error) {
      response.status(500).json({ message: "Failed to load the work schedule" });
    }
  }

  static reschedule = async (request: AuthRequest, response: Response) => {
    try {
      const { kind, id } = request.params;
      if (kind !== "booking" && kind !== "service") {
        response.status(400).json({ message: "Invalid work request type" });
        return;
      }
      if (!isObjectId(id)) {
        response.status(400).json({ message: "Invalid work request id" });
        return;
      }
      const { scheduledDate, startTime } = request.body ?? {};
      const updated = await WorkRequestService.reschedule(kind, id, scheduledDate, startTime);
      response.send(updated);
    } catch (error) {
      if (sendScheduleError(response, error)) return;
      console.error("[WORK RESCHEDULE ERROR]", error);
      response.status(500).json({ message: "Failed to reschedule the work request" });
    }
  }

  static updateStatus = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const { status } = request.body;

      if (!isObjectId(id)) {
        response.status(400).send("Invalid work id");
        return;
      }
      if (!status) {
        response.status(400).send("Status is required");
        return;
      }

      if (!WORK_STATUSES.includes(status)) {
        response.status(400).send("Invalid status");
        return;
      }

      const account = request.account;
      if (!account) {
        response.status(401).send("Authentication required");
        return;
      }

      const current: any = await WorkService.get(id);
      if (!current) {
        response.status(404).send("Work record not found");
        return;
      }

      const accountId = account._id.toString();
      const isWorker = String(current.worker?._id || current.worker) === accountId;
      const isClient = String(current.client?._id || current.client) === accountId;
      const allowed = [
        ...(isWorker ? WORKER_TRANSITIONS[current.status] || [] : []),
        ...(isClient ? CLIENT_TRANSITIONS[current.status] || [] : []),
      ];

      if (!isWorker && !isClient) {
        response.status(403).send("You are not authorized to update this work request");
        return;
      }
      if (!allowed.includes(status)) {
        response.status(400).send(`Cannot change status from "${current.status}" to "${status}"`);
        return;
      }

      const work = await WorkService.updateStatusIf(id, current.status, status);
      if (!work) {
        response.status(409).send("This work request was updated by someone else. Please reload and try again.");
        return;
      }

      if (status === "rejected" && current.scheduleSlot) {
        await WorkScheduleService.release(current.scheduleSlot);
      }

      response.send(work);
    } catch (error) {
      response.status(500).send("Failed to update work status");
    }
  }
}
