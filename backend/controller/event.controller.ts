import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { EventService } from "../services/event.service";
import { isObjectId } from "../utils/validation";

const EVENT_STATUSES = ["upcoming", "completed", "cancelled"];

export class EventController {

  static getAll = async (request: AuthRequest, response: Response) => {
    try {
      const { status, includeArchived } = request.query;
      const filter: Record<string, any> = {};
      if (status) filter.status = status;
      if (includeArchived !== "true") filter.isArchived = { $ne: true };
      const events = await EventService.getAll(filter);
      response.send(events);
    } catch (error) {
      console.error("[GET EVENTS ERROR]", error);
      response.status(500).send("Failed to fetch events");
    }
  }

  static get = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid event id");
        return;
      }
      const event = await EventService.get(id);
      if (!event) {
        response.status(404).send("Event not found");
        return;
      }
      response.send(event);
    } catch (error) {
      response.status(500).send("Failed to fetch event");
    }
  }

  static create = async (request: AuthRequest, response: Response) => {
    try {
      const { title, date } = request.body;
      if (!title || !String(title).trim()) {
        response.status(400).send("Event title is required");
        return;
      }
      if (!date || isNaN(new Date(date).getTime())) {
        response.status(400).send("A valid event date is required");
        return;
      }
      if (request.body.status && !EVENT_STATUSES.includes(request.body.status)) {
        response.status(400).send("Invalid event status");
        return;
      }

      const account = request.account;
      const event = await EventService.create({
        ...request.body,
        title: String(title).trim(),
        date: new Date(date),
        createdBy: account?._id,
      });
      response.status(201).send(event);
    } catch (error) {
      console.error("[CREATE EVENT ERROR]", error);
      response.status(500).send("Failed to create event");
    }
  }

  static update = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid event id");
        return;
      }
      if (request.body.status && !EVENT_STATUSES.includes(request.body.status)) {
        response.status(400).send("Invalid event status");
        return;
      }
      if (request.body.date && isNaN(new Date(request.body.date).getTime())) {
        response.status(400).send("A valid event date is required");
        return;
      }

      const event = await EventService.update(id, request.body);
      if (!event) {
        response.status(404).send("Event not found");
        return;
      }
      response.send(event);
    } catch (error) {
      response.status(500).send("Failed to update event");
    }
  }

  static remove = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid event id");
        return;
      }
      const event = await EventService.get(id);
      if (!event) {
        response.status(404).send("Event not found");
        return;
      }
      // Past events are archived (soft delete) so history is preserved.
      if (event.status === "completed" || event.isArchived) {
        await EventService.archive(id);
        response.send({ message: "Event archived", archived: true });
        return;
      }
      await EventService.delete(id);
      response.send({ message: "Event deleted successfully", archived: false });
    } catch (error) {
      response.status(500).send("Failed to delete event");
    }
  }
}