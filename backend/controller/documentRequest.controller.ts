import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { DocumentRequestService, DailyRequestStatus } from "../services/documentRequest.service";
import { UserActivityService } from "../services/userActivity.service";
import { NotificationService } from "../services/notification.service";
import { formattedDate } from "../utils/customFunc";
import { sendNotification } from "../utils/sms";
import { smsTemplates } from "../utils/smsTemplates";
import { isObjectId } from "../utils/validation";
import { convertDocxToPdf } from "../utils/docxToPdf";
import { ROLES, isStaffRole } from "../utils/roles";
import { getPayMongoCheckoutDetails } from "../services/payment.service";
import { AccountService } from "../services/acccount.service";
import { ResidentCensusService } from "../services/residentCensus.service";
import { documentDisplayName } from "../utils/documentNames";

const MAX_CASH_PAYMENT = 100000;

const presentValue = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text || text.toUpperCase() === "N/A") return null;
  return text;
};

const fillIfEmpty = (target: Record<string, any>, key: string, value: unknown) => {
  const current = target[key];
  if (current !== undefined && current !== null && String(current).trim() !== "") return;
  const clean = presentValue(value);
  if (clean !== null) target[key] = clean;
};

const amountDueOf = (doc: any): number => {
  const fee = Number(doc?.feeAtRequest);
  if (Number.isFinite(fee) && fee >= 0) return fee;
  const price = Number(doc?.price);
  return Number.isFinite(price) && price >= 0 ? price : 0;
};

const wasRejectedSession = (doc: any, checkoutSessionId: string): boolean =>
  (doc?.paymentHistory ?? []).some(
    (entry: any) => entry?.action === "rejected" && entry?.snapshot?.checkoutSessionId === checkoutSessionId,
  );

const DOC_STATUSES = ["pending", "processing", "ready", "released", "cancelled", "to claim", "completed", "rejected"];

// Allowed forward moves per status. A request can only move along these edges;
// invalid transitions are rejected with a descriptive error. Primary lifecycle:
// pending -> processing -> ready -> released. Any open stage may be cancelled.
// Legacy statuses can step into the primary set so old records migrate forward.
const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["processing", "cancelled"],
  processing: ["ready", "cancelled"],
  ready: ["released", "cancelled"],
  released: ["ready"],
  cancelled: ["pending"],
  "to claim": ["ready", "released", "cancelled"],
  completed: ["released", "ready", "cancelled"],
  rejected: ["pending", "cancelled"],
};

// ... (other parts of the file remain the same, just keeping the imports correct)

const dailyLimitPayload = (daily: DailyRequestStatus) => ({
  message: "Your document request limit for today has been reached. You can submit another request tomorrow.",
  error: "daily_limit_reached",
  daily,
});

export class DocumentRequestController {

  static getDailyStatus = async (request: AuthRequest, response: Response) => {
    try {
      const account = request.account;
      if (!account) {
        response.status(401).send("Authentication required");
        return;
      }
      const daily = await DocumentRequestService.getDailyStatus(account._id);
      response.send(daily);
    } catch (error) {
      response.status(500).send("Failed to fetch daily request status");
    }
  }

  static create = async (request: AuthRequest, response: Response) => {
    try {
      const documentData: any = { ...request.body };

      const account = request.account;
      if (!account) {
        response.status(401).send("Authentication required");
        return;
      }

      // An account-linked request must reference a real account. A walk-in
      // without an account (resident field omitted) is allowed as long as a
      // denormalized fullName is provided for the snapshot fields.
      if (account.role === ROLES.TREASURER) {
        response.status(403).send("Treasurer accounts cannot file document requests");
        return;
      }
      const requesterIsStaff = isStaffRole(account.role);
      if (!requesterIsStaff) delete documentData.census;
      for (const key of ["paymentMethod", "paymentChannel", "amountPaid", "amountTendered", "changeGiven", "paidAt", "receiptNumber", "paymentReference", "paymentProcessedBy", "checkoutSessionId"]) {
        delete documentData[key];
      }
      for (const key of ["templateId", "templateVersion", "feeAtRequest", "isArchived", "archivedAt", "statusHistory", "officialsSnapshot"]) {
        delete documentData[key];
      }
      documentData.isPaid = false;
      documentData.status = "pending";

      if (documentData.resident && !isObjectId(documentData.resident)) {
        response.status(400).send("A valid resident is required");
        return;
      }
      if (documentData.census && !isObjectId(documentData.census)) {
        response.status(400).send("A valid census record is required");
        return;
      }
      if (documentData.resident) {
        const residentAccount = await AccountService.get(documentData.resident);
        if (!residentAccount) {
          response.status(400).send("The selected resident could not be found");
          return;
        }
        if (requesterIsStaff && account._id !== documentData.resident) {
          if (residentAccount.role !== "resident" || residentAccount.status !== "approved" || residentAccount.isSuspended) {
            response.status(400).send("Walk-in requests can only be filed for approved, active resident accounts");
            return;
          }
          fillIfEmpty(documentData, "fullName", residentAccount.name);
          fillIfEmpty(documentData, "contact", residentAccount.contact);
          fillIfEmpty(documentData, "address", residentAccount.address);
          fillIfEmpty(documentData, "dateOfBirth", residentAccount.dateOfBirth);
          fillIfEmpty(documentData, "civilStatus", residentAccount.civilStatus);
          fillIfEmpty(documentData, "purok", residentAccount.purok);
          if (residentAccount.censusId) documentData.census = residentAccount.censusId;
          else delete documentData.census;
        }
      } else if (documentData.census) {
        const censusRecord: any = await ResidentCensusService.get(documentData.census);
        if (!censusRecord || censusRecord.isArchived) {
          response.status(400).send("The selected census resident could not be found");
          return;
        }
        documentData.fullName = presentValue(censusRecord.name) ?? documentData.fullName;
        fillIfEmpty(documentData, "contact", censusRecord.cellphone);
        fillIfEmpty(documentData, "dateOfBirth", censusRecord.birthday);
        fillIfEmpty(documentData, "purok", censusRecord.purok);
        fillIfEmpty(documentData, "age", censusRecord.age);
      }
      if (!documentData.resident && !String(documentData.fullName || "").trim()) {
        response.status(400).send("A full name is required for walk-in requests");
        return;
      }
      const validDocs = [
        "certificateOfResidency",
        "certificateOfIndigency",
        "barangayBusinessClearance",
        "certificateOfAttestation",
        "certificationOfTreesCutting",
        "barangayCertification",
        "certificateOfFirstTimeJobseeker",
        "firstTimeJobseekerOath",
        "certificateOfLowIncome",
        "endorsementLetter",
        "certificationOfCohabitant",
        "soloCertification",
      ];
      if (!validDocs.includes(documentData.document)) {
        response.status(400).send("Invalid document type");
        return;
      }

      // ── Resolve the fee from the document's template ─────────────
      // The template's fee is authoritative. When a matching template is
      // found, the client-sent price is ignored and the current fee is
      // stamped onto the request (templateId + version + feeAtRequest) so it
      // never changes even if the admin edits the price later.
      const { DocumentTemplateService } = await import("../services/documentTemplate.service");
      const template = await DocumentTemplateService.getByDocumentType(documentData.document);
      if (template) {
        documentData.price = Number(template.fee) || 0;
        documentData.templateId = template._id;
        documentData.templateVersion = template.version || 1;
        documentData.feeAtRequest = Number(template.fee) || 0;
      } else if (typeof documentData.price !== "number" || documentData.price < 0) {
        response.status(400).send("Invalid price");
        return;
      }

      // ── Permissions: a resident may only ever request for themselves ──
      const isStaff = isStaffRole(account.role);
      if (!isStaff && account._id !== documentData.resident) {
        response.status(403).send("You can only request documents for yourself");
        return;
      }

      // ── Normalize the single request timestamp + source ──
      const isWalkIn = isStaff && account._id !== documentData.resident;
      documentData.source = isWalkIn ? "walk-in" : "online";
      const requestedAt = new Date();
      const stamp = DocumentRequestService.getRequestStamp(requestedAt);
      documentData.requestDate = stamp.requestDate;
      documentData.requestTime = stamp.requestTime;

      if (!isStaff) {
        const daily = await DocumentRequestService.getDailyStatus(account._id, requestedAt);
        if (daily.limitReached) {
          response.status(429).json(dailyLimitPayload(daily));
          return;
        }
      }

      // ── Duplicate prevention (normalized key) ──
      const existing = await DocumentRequestService.findExistingDuplicate(
        documentData.resident,
        documentData.document,
        stamp.requestDate,
        stamp.requestTime,
        documentData.fullName
      );
      if (existing) {
        response.status(409).json({
          message: "A request for this resident, document type, date and time already exists.",
          error: "duplicate_request",
          existing,
        });
        return;
      }

      const document = await DocumentRequestService.create(documentData);

      if (!isStaff) {
        const withinLimit = await DocumentRequestService.isWithinDailyLimit(account._id, stamp.requestDate, String(document._id));
        if (!withinLimit) {
          await DocumentRequestService.delete(String(document._id));
          const daily = await DocumentRequestService.getDailyStatus(account._id, requestedAt);
          response.status(429).json(dailyLimitPayload(daily));
          return;
        }
      }

      await UserActivityService.create({
        accountId: account._id.toString(),
        activity: `Request Document ${documentData.document}`,
        date: formattedDate()
      })

      sendNotification("request", account.contact, smsTemplates.requestReceived(account.name, documentData.document));

      response.status(201).send(document);
    } catch (error: any) {
      console.error("[CREATE DOCUMENT REQUEST ERROR]", error);
      // ── Race-condition protection: unique index E11000 → 409 + existing ──
      if (error?.code === 11000) {
        try {
          const dup = await DocumentRequestService.findExistingDuplicate(
            request.body?.resident,
            request.body?.document,
            request.body?.requestDate,
            request.body?.requestTime,
            request.body?.fullName
          );
          response.status(409).json({
            message: "A request for this resident, document type, date and time already exists.",
            error: "duplicate_request",
            existing: dup,
          });
        } catch {
          response.status(409).json({
            message: "A duplicate request was detected. Please try again.",
            error: "duplicate_request",
          });
        }
        return;
      }
      if (error?.name === "ValidationError") {
        response.status(400).send("Invalid document request data");
        return;
      }
      response.status(500).send("Failed to create document request");
    }
  }

  static getAll = async (request: AuthRequest, response: Response) => {
    try {
      const { status, statusNot, resident, includeArchived } = request.query;
      const filter: Record<string, any> = {};
      if (status) filter.status = status;
      if (statusNot) filter.status = { $ne: statusNot };
      if (resident) filter.resident = resident;
      // Archived (soft-deleted) requests stay hidden by default so the audit
      // trail is preserved for history pages that pass includeArchived=true.
      if (includeArchived !== "true") filter.isArchived = { $ne: true };
      const documents = await DocumentRequestService.getAll(filter);
      response.send(documents);
    } catch (error) {
      response.status(500).send("Failed to fetch document requests");
    }
  }

  static get = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid document request id");
        return;
      }
      const account = request.account;
      if (!account) {
        response.status(401).send("Authentication required");
        return;
      }
      const document: any = await DocumentRequestService.get(id);
      if (!document) {
        response.status(404).send("Document request not found");
        return;
      }
      const ownerId = document.resident?._id ? String(document.resident._id) : document.resident ? String(document.resident) : null;
      if (!isStaffRole(account.role) && ownerId !== account._id.toString()) {
        response.status(403).send("You can only view your own document requests");
        return;
      }
      response.send(document);
    } catch (error) {
      response.status(500).send("Failed to fetch document request");
    }
  }

  static getByResident = async (request: AuthRequest, response: Response) => {
    try {
      const { residentId } = request.params;
      if (!isObjectId(residentId)) {
        response.status(400).send("Invalid resident id");
        return;
      }
      const account = request.account;
      if (!account || (!isStaffRole(account.role) && account._id.toString() !== residentId)) {
        response.status(403).send("You can only view your own document requests");
        return;
      }
      const documents = await DocumentRequestService.getByResident(residentId);
      response.send(documents.filter((d: any) => !d.isArchived));
    } catch (error) {
      response.status(500).send("Failed to fetch document requests by resident");
    }
  }

  static convertToPdf = async (request: AuthRequest, response: Response) => {
    try {
      const file = request.file;
      if (!file || !file.buffer || file.buffer.length === 0) {
        response.status(400).send("A .docx file is required");
        return;
      }
      const pdf = await convertDocxToPdf(file.buffer);
      response.setHeader("Content-Type", "application/pdf");
      response.setHeader("Content-Disposition", 'attachment; filename="document.pdf"');
      response.send(pdf);
    } catch (error) {
      console.error("[CONVERT DOCX TO PDF ERROR]", error);
      response.status(500).send("Failed to convert DOCX to PDF");
    }
  }

  static updateStatus = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const { status } = request.body;

      if (!isObjectId(id)) {
        response.status(400).send("Invalid document request id");
        return;
      }
      if (!DOC_STATUSES.includes(status)) {
        response.status(400).send("Invalid status");
        return;
      }
      const account = request.account;
      if (!account || !isStaffRole(account.role)) {
        response.status(403).send("Only the barangay secretary can update document statuses");
        return;
      }

      // ── Workflow enforcement ──────────────────────────────────
      // The requested status must be a legal forward move from the current
      // one (pending -> processing -> ready -> released, or cancelled at any
      // open stage). This keeps the audit trail a clean linear narrative.
      const currentDoc = await DocumentRequestService.get(id);
      if (!currentDoc) {
        response.status(404).send("Document request not found");
        return;
      }
      const allowed = STATUS_TRANSITIONS[currentDoc.status] || [];
      if (!allowed.includes(String(status))) {
        response
          .status(400)
          .send(
            `Cannot change status from "${currentDoc.status}" to "${status}". Valid moves: ${
              allowed.length ? allowed.join(", ") : "none (terminal status)"
            }.`,
          );
        return;
      }

      const document = await DocumentRequestService.updateStatus(id, status);
      if (!document) {
        response.status(404).send("Document request not found");
        return;
      }

      const resident = document.resident as any;
      if (resident?._id) {
        await NotificationService.create({
          accountId: resident._id.toString(),
          title: "Document Request Update",
          message: `Your ${documentDisplayName(document.document)} request is now ${status}.`,
          type: "document",
        }).catch(() => null);
      }
      if (resident?.contact) {
        sendNotification("status", resident.contact, smsTemplates.statusUpdate(resident.name, document.document, status));
      }

      response.send({ message: `Document request status updated to ${status} successfully` });
    } catch (error) {
      response.status(500).send("Failed to update document request status");
    }
  }

  /**
   * Fields that may be edited through the edit-request flow. Structural
   * fields (resident, document, status, price, payment, source, request
   * stamp, archive flags) are intentionally excluded from updating here.
   */
  static EDITABLE_FIELDS = [
    "fullName", "contact", "address", "dateOfBirth", "civilStatus", "nationality",
    "occupation", "yrsOfResidency", "purpose", "documentNumber", "dateIssued",
    "businessName", "businessAddress", "businessType", "businessNature",
    "workStatus", "workplace", "monthlyIncome", "expenseType", "householdExpenses",
    "assistanceTo", "titleNo", "taxDeclarationNo", "landArea", "treeCount",
    "treeType", "age", "spouseName", "spouseDateOfBirth", "cohabitationYear", "annualIncome", "purok",
  ];

  static update = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const updateData = request.body;

      if (!isObjectId(id)) {
        response.status(400).send("Invalid document request id");
        return;
      }

      const account = request.account;
      if (!account) {
        response.status(401).send("Authentication required");
        return;
      }

      const current = await DocumentRequestService.get(id);
      if (!current) {
        response.status(404).send("Document request not found");
        return;
      }

      const residentId = String(current.resident?._id || current.resident);
      const isStaff = isStaffRole(account.role);

      // Owner/resident edits are only allowed on pending and rejected requests.
      // Secretaries may also edit processing/ready requests; released and
      // cancelled stay locked unless an authorized user explicitly reopens
      // (cancelled -> pending) the request.
      const editable: Record<string, string[]> = {
        resident: ["pending", "rejected"],
        secretary: ["pending", "processing", "ready", "rejected", "cancelled"],
      };
      const allowedFor = isStaff ? editable.secretary : editable.resident;

      if (!isStaff && account._id !== residentId) {
        response.status(403).send("You can only edit your own requests");
        return;
      }
      if (!allowedFor.includes(current.status)) {
        response.status(403).send(`Requests with status "${current.status}" can no longer be edited.`);
        return;
      }

      // Strip to the allow-list so users can't mutate structural fields.
      const cleaned: Record<string, any> = {};
      for (const key of DocumentRequestController.EDITABLE_FIELDS) {
        if (key in updateData) cleaned[key] = updateData[key];
      }
      if (Object.keys(cleaned).length === 0) {
        response.status(400).send("No editable fields provided");
        return;
      }

      const document = await DocumentRequestService.update(id, cleaned);
      if (!document) {
        response.status(404).send("Document request not found");
        return;
      }

      response.send(document);
    } catch (error) {
      console.error("[UPDATE DOCUMENT REQUEST ERROR]", error);
      response.status(500).send("Failed to update document request");
    }
  }

  static updatePayment = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const { isPaid, amountTendered } = request.body;

      if (!isObjectId(id)) {
        response.status(400).send("Invalid document request id");
        return;
      }
      if (typeof isPaid !== 'boolean') {
        response.status(400).send("isPaid must be a boolean");
        return;
      }

      const account = request.account;
      if (!account) {
        response.status(401).send("Authentication required");
        return;
      }
      if (!isStaffRole(account.role)) {
        response.status(403).send("Only barangay staff can record over-the-counter payments");
        return;
      }
      const current: any = await DocumentRequestService.get(id);
      if (!current) {
        response.status(404).send("Document request not found");
        return;
      }

      if (!isPaid) {
        if (current.paymentVerificationStatus === "verified") {
          response.status(409).send("This payment has been verified by the treasurer and can no longer be cleared");
          return;
        }
        await DocumentRequestService.clearPayment(id, { id: account._id.toString(), name: account.name });
        response.send({ message: "Payment status updated to unpaid successfully" });
        return;
      }

      if (current.isPaid) {
        response.status(409).send("This request has already been paid");
        return;
      }

      const amountDue = amountDueOf(current);
      let tendered: number | undefined;
      if (amountTendered !== undefined && amountTendered !== null && amountTendered !== "") {
        tendered = Number(amountTendered);
        if (!Number.isFinite(tendered) || tendered < 0) {
          response.status(400).send("Amount tendered must be a valid amount");
          return;
        }
        if (tendered > MAX_CASH_PAYMENT) {
          response.status(400).send(`Amount tendered cannot exceed ${MAX_CASH_PAYMENT}`);
          return;
        }
        if (tendered < amountDue) {
          response.status(400).send("Amount tendered is less than the amount due");
          return;
        }
        tendered = Math.round(tendered * 100) / 100;
      }

      const document = await DocumentRequestService.recordPayment(id, {
        paymentMethod: "over-the-counter",
        paymentChannel: "cash",
        amountPaid: amountDue,
        amountTendered: tendered ?? amountDue,
        changeGiven: Math.round(((tendered ?? amountDue) - amountDue) * 100) / 100,
        paymentProcessedBy: account._id.toString(),
        recordedByName: account.name,
      });
      if (!document) {
        response.status(409).send("This request has already been paid");
        return;
      }

      const resident = document.resident as any;
      if (resident?._id) {
        await NotificationService.create({
          accountId: resident._id.toString(),
          title: "Payment Received",
          message: `We received your payment for your ${documentDisplayName(document.document)} request. Receipt No. ${document.receiptNumber}.`,
          type: "payment",
        }).catch(() => null);
      }
      if (resident?.contact) {
        sendNotification("payment", resident.contact, smsTemplates.paymentReceived(resident.name, document.document));
      }

      response.send({ message: "Payment status updated to paid successfully", receiptNumber: document.receiptNumber });
    } catch (error) {
      response.status(500).send("Failed to update payment status");
    }
  }

  static delete = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid document request id");
        return;
      }

      const account = request.account;
      if (!account) {
        response.status(401).send("Authentication required");
        return;
      }

      const current = await DocumentRequestService.get(id);
      if (!current) {
        response.status(404).send("Document request not found");
        return;
      }

      const residentId = String(current.resident?._id || current.resident);
      const isStaff = isStaffRole(account.role);

      // ── Ownership ──
      if (!isStaff && account._id !== residentId) {
        response.status(403).send("You can only delete your own requests");
        return;
      }

      // ── Status-based permission matrix ──
      const RESIDENT_CAN_DELETE = ["pending", "rejected"];
      if (!isStaff && !RESIDENT_CAN_DELETE.includes(current.status)) {
        response.status(403).send("You can no longer delete this request. Please contact the barangay secretary for assistance.");
        return;
      }

      // ── Completed/released requests are archived (soft delete), never
      //    hard-deleted, so the request history and audit trail are preserved. ──
      const TERMINAL_STATUSES = ["released", "completed"];
      if (isStaff && TERMINAL_STATUSES.includes(current.status)) {
        await DocumentRequestService.archive(id);
        response.send({ message: "Released request archived. It remains visible in Request History.", archived: true });
        return;
      }

      const document = await DocumentRequestService.delete(id);
      if (!document) {
        response.status(404).send("Document request not found");
        return;
      }
      response.send({ message: "Document request deleted successfully", archived: false });
    } catch (error) {
      response.status(500).send("Failed to delete document request");
    }
  }



    static saveSnapshot = async (request: AuthRequest, response: Response) => {
        try {
            const { id } = request.params;
            if (!isObjectId(id)) {
                response.status(400).send("Invalid document request id");
                return;
            }
            const snapshot = request.body?.snapshot ?? {};
            const document = await DocumentRequestService.updateSnapshot(id, snapshot);
            if (!document) {
                response.status(404).send("Document request not found");
                return;
            }
            response.send({ message: "Snapshot saved" });
        } catch (error) {
            console.error("[DOC SNAPSHOT ERROR]", error);
            response.status(500).send("Failed to save snapshot");
        }
    }

    static saveCheckoutSession = async (request: AuthRequest, response: Response) => {
        try {
            const { id } = request.params;
            const { checkoutSessionId } = request.body;
            if (!isObjectId(id)) {
                response.status(400).send("Invalid document request id");
                return;
            }
            if (typeof checkoutSessionId !== "string" || !/^[A-Za-z0-9_]{1,100}$/.test(checkoutSessionId)) {
                response.status(400).send("Invalid checkout session id");
                return;
            }
            const account = request.account;
            if (!account) {
                response.status(401).send("Authentication required");
                return;
            }
            const current: any = await DocumentRequestService.get(id);
            if (!current) {
                response.status(404).send("Document request not found");
                return;
            }
            const residentId = String(current.resident?._id || current.resident);
            if (!isStaffRole(account.role) && account._id !== residentId) {
                response.status(403).send("You can only pay for your own requests");
                return;
            }
            if (current.isPaid) {
                response.status(409).send("This request has already been paid");
                return;
            }
            if (wasRejectedSession(current, checkoutSessionId)) {
                response.status(400).send("This payment session was rejected by the treasurer. Please start a new payment.");
                return;
            }
            await DocumentRequestService.update(id, { checkoutSessionId });
            response.send({ message: "Checkout session ID saved" });
        } catch (error) {
            console.error("[SAVE CHECKOUT SESSION ERROR]", error);
            response.status(500).send("Failed to save checkout session ID");
        }
    }


    static onlinePayment = async (request: AuthRequest, response: Response) => {
        try {
            const { documentID, checkoutSessionId } = request.body;
            const routeId = request.params?.id;
            if (!isObjectId(documentID) || (routeId && routeId !== documentID)) {
                response.status(400).send("Invalid document id");
                return;
            }

            const account = request.account;
            if (!account) {
                response.status(401).send("Authentication required");
                return;
            }

            const current: any = await DocumentRequestService.get(documentID);
            if (!current) {
                response.status(404).send("Document request not found");
                return;
            }
            const residentId = String(current.resident?._id || current.resident);
            if (!isStaffRole(account.role) && account._id !== residentId) {
                response.status(403).send("You can only confirm payments for your own requests");
                return;
            }
            if (!checkoutSessionId || current.checkoutSessionId !== checkoutSessionId) {
                response.status(400).send("Payment session does not match this request");
                return;
            }
            if (current.isPaid) {
                response.send("success");
                return;
            }
            if (wasRejectedSession(current, checkoutSessionId)) {
                response.status(400).send("This payment session was rejected by the treasurer. Please start a new payment.");
                return;
            }

            const details = await getPayMongoCheckoutDetails(checkoutSessionId);
            if (!details.paid) {
                response.status(400).send("Payment not verified");
                return;
            }

            const document = await DocumentRequestService.recordPayment(documentID, {
                paymentMethod: "online",
                paymentChannel: details.paymentMethod || "paymongo",
                amountPaid: details.amount ?? amountDueOf(current),
                paidAt: details.paidAt ?? new Date(),
                paymentReference: details.reference ?? checkoutSessionId,
                recordedByName: account.name,
            });
            if (!document) {
                response.send("success");
                return;
            }

            // Online payment marks the request ready for the secretary to print
            // and release — payment alone never releases the document.
            await DocumentRequestService.updateStatus(documentID, "ready");

            await UserActivityService.create({
                accountId: account._id.toString(),
                activity: `online payment`,
                date: formattedDate()
            });

            const resident = document?.resident as any;
            if (resident?._id) {
                await NotificationService.create({
                    accountId: resident._id.toString(),
                    title: "Payment Received",
                    message: `We received your online payment for your ${documentDisplayName(document.document)} request. Receipt No. ${document.receiptNumber}.`,
                    type: "payment",
                }).catch(() => null);
            }
            if (resident?.contact) {
                sendNotification("payment", resident.contact, smsTemplates.paymentReceived(resident.name, document!.document));
            }

            response.send("success");
        } catch(e: any) {
            console.error("[ONLINE PAYMENT ERROR]", e);
            response.status(500).send(e.message || "error occurred");
        }
    }
}
