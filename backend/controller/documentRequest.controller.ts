import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { DocumentRequestService } from "../services/documentRequest.service";
import { UserActivityService } from "../services/userActivity.service";
import { NotificationService } from "../services/notification.service";
import { formattedDate } from "../utils/customFunc";
import { sendNotification } from "../utils/sms";
import { smsTemplates } from "../utils/smsTemplates";
import { isObjectId } from "../utils/validation";
import { convertDocxToPdf } from "../utils/docxToPdf";
import { isStaffRole } from "../utils/roles";
import { verifyPayMongoPayment } from "../services/payment.service";

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

// Human-friendly names for notifications (falls back to a CamelCase -> Title).
// NOTE: "Barangay Clearance" is deliberately absent from selection/validation.
// Historical records that used barangayClearance still map to this display name
// for backward-compatibility in views/history, but the type is never created in
// new requests.
const DOCUMENT_NAMES: Record<string, string> = {
  barangayCertificate: "Barangay Certificate",
  barangayClearance: "Barangay Certificate",
  certificateOfResidency: "Certificate of Residency",
  certificateOfIndigency: "Certificate of Indigency",
  barangayBusinessClearance: "Barangay Business Clearance",
  certificateOfAttestation: "Certificate of Attestation",
  certificationOfTreesCutting: "Certification of Trees Cutting",
  barangayCertification: "Barangay Certification",
  certificateOfFirstTimeJobseeker: "Barangay Certification (First-Time Jobseeker)",
  firstTimeJobseekerOath: "Oath of Undertaking (FTJ)",
  certificateOfLowIncome: "Certificate of Low Income",
  endorsementLetter: "Endorsement Letter",
};

const documentDisplayName = (key: string): string =>
  DOCUMENT_NAMES[key] ||
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

export class DocumentRequestController {

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
      if (documentData.resident && !isObjectId(documentData.resident)) {
        response.status(400).send("A valid resident is required");
        return;
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
      const stamp = DocumentRequestService.getRequestStamp();
      documentData.requestDate = stamp.requestDate;
      documentData.requestTime = stamp.requestTime;

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
      const document = await DocumentRequestService.get(id);
      if (!document) {
        response.status(404).send("Document request not found");
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
    "treeType", "age", "spouseName", "annualIncome", "purok",
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
      const { isPaid } = request.body;

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
      const current = await DocumentRequestService.get(id);
      if (!current) {
        response.status(404).send("Document request not found");
        return;
      }
      const residentId = String(current.resident?._id || current.resident);
      const isStaff = isStaffRole(account.role);
      // Only the secretary may mark a request unpaid; the resident owner may
      // only confirm their own payment succeeded (isPaid → true).
      const isOwner = account._id === residentId;
      if (!isStaff && !(isOwner && isPaid === true)) {
        response.status(403).send("You are not allowed to update this payment record");
        return;
      }

      const document = await DocumentRequestService.updatePayment(id, isPaid);
      if (!document) {
        response.status(404).send("Document request not found");
        return;
      }

      const resident = document.resident as any;
      if (isPaid && resident?._id) {
        await NotificationService.create({
          accountId: resident._id.toString(),
          title: "Payment Received",
          message: `We received your payment for your ${documentDisplayName(document.document)} request.`,
          type: "payment",
        }).catch(() => null);
      }
      if (isPaid && resident?.contact) {
        sendNotification("payment", resident.contact, smsTemplates.paymentReceived(resident.name, document.document));
      }

      response.send({ message: `Payment status updated to ${isPaid ? 'paid' : 'unpaid'} successfully` });
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
            const document = await DocumentRequestService.update(id, { checkoutSessionId });
            if (!document) {
                response.status(404).send("Document request not found");
                return;
            }
            response.send({ message: "Checkout session ID saved" });
        } catch (error) {
            console.error("[SAVE CHECKOUT SESSION ERROR]", error);
            response.status(500).send("Failed to save checkout session ID");
        }
    }


    static onlinePayment = async (request: AuthRequest, response: Response) => {
        try {
            const { documentID, checkoutSessionId } = request.body;
            if (!isObjectId(documentID)) {
                response.status(400).send("Invalid document id");
                return;
            }

            // Secure Verification
            const isPaid = await verifyPayMongoPayment(checkoutSessionId);
            if (!isPaid) {
                response.status(400).send("Payment not verified");
                return;
            }

            const document = await DocumentRequestService.updatePayment(documentID, true);
            // Online payment marks the request ready for the secretary to print
            // and release — payment alone never releases the document.
            await DocumentRequestService.updateStatus(documentID, "ready");
            
            const account = request.account;
            if (account) {
                await UserActivityService.create({
                    accountId: account._id.toString(),
                    activity: `online payment`,
                    date: formattedDate()
                });
            }

            const resident = document?.resident as any;
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
