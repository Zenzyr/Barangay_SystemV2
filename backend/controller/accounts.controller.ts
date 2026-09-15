import { PurokService } from "../services/purok.service";
import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { accountInterfaceInput } from "../types/accounts.type";
import { AccountService } from "../services/acccount.service";
import jwt from "jsonwebtoken";
import dotenv from 'dotenv';
import bcrypt from "bcrypt";
import { uploadToCloudinary } from "../utils/cloudinaryUpload";
import { isJpegPngWebpFile } from "../utils/upload";
import { UserActivityService } from "../services/userActivity.service";
import { formattedDate } from "../utils/customFunc";
import { sendNotification, sendSms } from "../utils/sms";
import { smsTemplates } from "../utils/smsTemplates";
import { sendEmail } from "../utils/email";
import { generateResetCode, hashResetCode, compareResetCode, resetCodeEmailHtml, resetCodeSmsMessage, RESET_CODE_TTL_MINUTES } from "../utils/passwordReset";
import { verifyIdWithOcr } from "../utils/idVerification";
import { NotificationService } from "../services/notification.service";
import { ResidentCensusService } from "../services/residentCensus.service";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { SystemInfoService } from "../services/systemInfo.service";
import { BusinessService } from "../services/business.service";
import { WorkService } from "../services/work.service";
import { AuditLogService } from "../services/auditLog.service";
import { ROLES, ROLE_LIST } from "../utils/roles";
import {
  assessPersonRegistration,
  buildDuplicateReport,
  computeIdentityHash,
  DUPLICATE_PERSON_MSG,
  EMAIL_IN_USE_MSG,
} from "../utils/duplicateCheck";
import {
  isEmail,
  isName,
  isNonEmptyString,
  isObjectId,
  isPhilippineMobile,
  normalizePhMobile,
  withinLength,
  MAX_NAME_LENGTH,
  MAX_ADDRESS_LENGTH,
  MAX_EMAIL_LENGTH,
  passwordStrengthError,
} from "../utils/validation";

dotenv.config();

const secret = process.env.JWT_SECRET || "";
const GENERIC_LOGIN_MSG = "Invalid email or password";

export class AccountController {

  static register = async (request: AuthRequest, response: Response) => {
    try {
      // Multipart form-data fields arrive as strings.
      const body = (request.body || {}) as Record<string, unknown>;
      const email = String(body.email || "").trim().toLowerCase();
      const name = String(body.name || "").trim();
      const address = String(body.address || "").trim();
      const contact = String(body.contact || "").trim();
      const password = String(body.password || "");
      const gender = String(body.gender || "").trim();
      const dateOfBirth = String(body.dateOfBirth || "").trim();
      const civilStatus = String(body.civilStatus || "").trim();
      const purok = String(body.purok || "").trim();
      const voterStatus = String(body.voterStatus || "").trim();
      const houseHoldNumber = String(body.houseHoldNumber || "").trim();
      const legalConsent = String(body.legalConsent || "");



      // Verify purok is active
      const activePuroks = await PurokService.getAll({ status: 'active' });
      if (!activePuroks.some((p: any) => p.name === purok)) {
        return response.status(400).send("Invalid purok selected");
      }

      // ── Field validation ─────────────────────────────────────
      if (!isNonEmptyString(name)) return response.status(400).send("Full name is required");
      if (!isName(name)) return response.status(400).send("Name can only contain letters, spaces, periods, hyphens and apostrophes");
      if (!withinLength(name, MAX_NAME_LENGTH)) return response.status(400).send(`Name must be at most ${MAX_NAME_LENGTH} characters`);

      if (!isEmail(email)) return response.status(400).send("A valid email address is required");
      if (!withinLength(email, MAX_EMAIL_LENGTH)) return response.status(400).send("Email is too long");

      if (!isPhilippineMobile(contact)) return response.status(400).send("A valid 11-digit Philippine mobile number is required (e.g. 09171234567)");

      if (!isNonEmptyString(address)) return response.status(400).send("Address is required");
      if (!withinLength(address, MAX_ADDRESS_LENGTH)) return response.status(400).send(`Address must be at most ${MAX_ADDRESS_LENGTH} characters`);

      const passwordError = passwordStrengthError(password);
      if (passwordError) return response.status(400).send(passwordError);

      const requiredEnums: Record<string, readonly string[]> = {
        gender: ["Male", "Female", "Other"],
        civilStatus: ["Single", "Married", "Widowed", "Separated", "Divorced"],
        purok: ["Purok 1", "Purok 2", "Purok 3", "Purok 4"],
        voterStatus: ["Registered", "Not Registered"],
      };
      for (const [field, allowed] of Object.entries(requiredEnums)) {
        const value = String(body[field] || "").trim();
        if (!allowed.includes(value)) {
          return response.status(400).send(`Invalid value for ${field}`);
        }
      }

      // ── Duplicate email check ────────────────────────────────
      const existing = await AccountService.checkEmailIfExist(email);
      if (existing) {
        return response.status(409).send(EMAIL_IN_USE_MSG);
      }

      // ── ONE PERSON = ONE ACCOUNT ─────────────────────────────
      // Identity-based duplicate check (name + date of birth + phone,
      // NEVER email alone) against existing accounts AND the resident
      // census. A confident account match stops registration; uncertain
      // matches are flagged for the verifying clerk instead of blocking.
      const assessment = await assessPersonRegistration({
        name,
        dateOfBirth,
        gender,
        contact,
      });
      if (assessment.status === "blocked") {
        return response.status(409).send(DUPLICATE_PERSON_MSG);
      }

      // ── File validation ──────────────────────────────────────
      const files = request.files as { [fieldname: string]: { path: string }[] } | undefined;
      if (!files?.['idFront']?.[0] || !files?.['idBack']?.[0] || !files?.['idSelfie']?.[0]) {
        return response.status(400).send("All 3 ID images (front ID, back ID, selfie with ID) are required");
      }

      // Reject files whose actual content is not a JPG/PNG/WEBP image, even
      // if the MIME header was spoofed or the type was renamed.
      for (const key of ['idFront', 'idBack', 'idSelfie'] as const) {
        if (!(await isJpegPngWebpFile(files[key][0].path))) {
          return response.status(400).send("All 3 ID images must be valid JPG, PNG or WEBP photos");
        }
      }

      // ── Upload ID images ─────────────────────────────────────
      const accountData: accountInterfaceInput = request.body as accountInterfaceInput;
      const idFront = await uploadToCloudinary(files['idFront'][0].path);
      const idBack = await uploadToCloudinary(files['idBack'][0].path);
      const idSelfie = await uploadToCloudinary(files['idSelfie'][0].path);

      const hashedPassword = await bcrypt.hash(password, 10);

      // Public registration can ONLY ever create a resident account.
      // secretary / super_admin are assigned exclusively through the
      // Super Admin role-management process, never from this form.
      const identityHash = computeIdentityHash(name, dateOfBirth);

      const account = await AccountService.create({
        profile: String(body.profile || ""),
        name,
        address,
        contact,
        email,
        gender,
        dateOfBirth,
        civilStatus,
        purok,
        voterStatus,
        houseHoldNumber,
        password: hashedPassword,
        status: "pending",
        role: "resident",
        idImg: { idFront, idBack, idSelfie },
        skills: [],
        reviews: [],
        legalConsent: legalConsent ? JSON.parse(legalConsent) : undefined,

        ...(identityHash ? { identityHash } : {}),
        ...(assessment.status === "flagged" && assessment.reason
          ? {
              possibleDuplicate: {
                status: "review",
                reason: assessment.reason,
                records: (assessment.records || []).map((r) => ({
                  type: r.kind,
                  id: r.id,
                  name: r.name,
                })),
              },
            }
          : {}),
      });

      // ── Auto-sync into the census at sign-up ───────────────────
      // Every registered resident also becomes a census entry immediately,
      // not just after the verifying clerk approves. The sync is safe to
      // re-run (idempotent): if the person is already in the census, it
      // skips instead of creating a duplicate.
      await ResidentCensusService.upsertFromAccount(account).catch((err) =>
        console.error("[CENSUS-SYNC ERROR]", err)
      );

      return response.status(201).json({ userId: account._id });
    } catch (error: any) {
      console.error("[REGISTER ERROR]", error);
      if (error?.code === 11000) {
        const keyValues = Object.keys(error?.keyValue || {});
        // Two registrations of the SAME person raced; the unique identity
        // hash caught the second one. Reveal nothing personal.
        if (keyValues.includes("identityHash")) {
          return response.status(409).send(DUPLICATE_PERSON_MSG);
        }
        return response.status(409).send(EMAIL_IN_USE_MSG);
      }
      return response.status(500).send("Failed to register account");
    }
  }

  /**
   * Public, low-noise pre-registration identity check for UX only.
   * Returns { status: "clean" | "flagged" | "blocked" } — never any
   * private details. The authoritative check still runs inside register().
   *
   * When the person is a census resident (status "flagged" because of a
   * census match, meaning this is likely their FIRST account), the matching
   * census record's public profile fields are included so the sign-up form
   * can auto-fill their details.
   */
  static checkDuplicate = async (request: AuthRequest, response: Response) => {
    try {
      const body = (request.body || {}) as Record<string, unknown>;
      const name = String(body.name || "").trim();
      const dateOfBirth = String(body.dateOfBirth || "").trim();
      const gender = String(body.gender || "").trim();
      const contact = String(body.contact || "").trim();

      if (!name) {
        response.status(400).send("Full name is required");
        return;
      }

      const assessment = await assessPersonRegistration({ name, dateOfBirth, gender, contact });
      const censusMatch = (assessment.records || []).find((r) => r.kind === "census");

      const payload: Record<string, any> = { status: assessment.status };
      if (censusMatch) {
        const record = await ResidentCensusService.get(censusMatch.id);
        if (record) {
          payload.census = {
            id: record._id,
            name: record.name,
            sex: record.sex,
            birthday: record.birthday,
            purok: record.purok,
            householdNumber: record.householdNumber,
            cellphone: record.cellphone,
            occupation: record.occupation,
            education: record.education,
          };
        }
      }
      response.send(payload);
    } catch (error) {
      console.error("[CHECK-DUPLICATE ERROR]", error);
      response.status(500).send("Duplicate check unavailable");
    }
  }

  /**
   * Super Admin only. Read-only report of possible duplicate people across
   * accounts and the resident census. Nothing is deleted or merged.
   */
  static duplicatesReport = async (request: AuthRequest, response: Response) => {
    try {
      const entries = await buildDuplicateReport();
      response.send({ generatedAt: new Date().toISOString(), entries });
    } catch (error) {
      console.error("[DUPLICATES-REPORT ERROR]", error);
      response.status(500).send("Failed to generate duplicate report");
    }
  }

  static verifyIdImage = async (request: AuthRequest, response: Response) => {
    try {
      const body = (request.body || {}) as { base64?: string; side?: string };
      const { base64, side } = body;
      if (typeof base64 !== "string" || base64.length === 0) {
        response.status(400).send("Image data is required");
        return;
      }
      if (base64.length > 2_000_000) {
        response.status(400).send("Image too large");
        return;
      }
      const result = await verifyIdWithOcr(base64, side === "back" ? "back" : "front");
      response.send(result);
    } catch (error) {
      console.error("[VERIFY-ID ERROR]", error);
      response.status(500).send("ID verification service unavailable");
    }
  };

  static getAll = async (request: AuthRequest, response: Response) => {
    try {
      const { status } = request.query;
      const filter = status ? { status } : {};
      const accounts = await AccountService.getAll(filter);
      response.send(accounts);
    } catch (error) {
      response.status(500).send("Failed to fetch accounts");
    }
  }

  static getActivityByResident = async (request: AuthRequest, response: Response) => {
      try {
        const { id } = request.params;
        if (!isObjectId(id)) {
          response.status(400).send("Invalid account id");
          return;
        }
        const activity = await UserActivityService.getByAccount(id);
        response.send(activity);
      } catch (error) {
        response.status(500).send("Failed to fetch activity requests by resident");
      }
  }
  

  static updateStatus = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const { status } = request.body;

      if (!isObjectId(id)) {
        response.status(400).send("Invalid account id");
        return;
      }
      if (!['approved', 'rejected'].includes(status)) {
        response.status(400).send("Invalid status. Must be 'approved' or 'rejected'");
        return;
      }

      const account = await AccountService.updateStatus(id, status);
      if (!account) {
        response.status(404).send("Account not found");
        return;
      }

      // ── Auto-sync approved residents into the census ────────────
      // When a resident account is approved, its profile details are mirrored
      // into the ResidentCensus collection so signups automatically populate
      // the barangay census. Duplicates are prevented (exact name+birthday
      // match), and any resident who is already in the census is never
      // re-inserted.
      if (status === "approved") {
        await ResidentCensusService.upsertFromAccount(account).catch((err) =>
          console.error("[CENSUS-SYNC ERROR]", err)
        );
      }

      await NotificationService.create({
        accountId: account._id.toString(),
        title: status === "approved" ? "Account Approved" : "Account Rejected",
        message:
          status === "approved"
            ? "Your account has been approved. You can now use all resident features."
            : "Your account registration was rejected. Please review your submitted ID images and resubmit.",
        type: "account",
      }).catch(() => null);

      sendNotification("status", account.contact, smsTemplates.accountStatus(account.name, status as "approved" | "rejected"));

      await AuditLogService.create({
        actor: request.account?.name ?? "System",
        actorId: request.account?._id?.toString?.() ?? "",
        action: "verify",
        entity: "account",
        entityId: account._id.toString(),
        entityLabel: account.name,
        field: "status",
        previousValue: "pending",
        newValue: status,
      }).catch(() => null);

      response.send({ message: `Account ${status} successfully` });
    } catch (error) {
      response.status(500).send("Failed to update account status");
    }
  }

  static updateRole = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const { role } = request.body;

      if (!isObjectId(id)) {
        response.status(400).send("Invalid account id");
        return;
      }
      if (!ROLE_LIST.includes(role)) {
        response.status(400).send(`Invalid role. Must be one of: ${ROLE_LIST.join(", ")}`);
        return;
      }

      const account = await AccountService.get(id);
      if (!account) {
        response.status(404).send("Account not found");
        return;
      }

      const currentRole = account.role || ROLES.RESIDENT;

      // Never allow demoting the last remaining super admin account.
      if (currentRole === ROLES.SUPER_ADMIN && role !== ROLES.SUPER_ADMIN) {
        const superAdminCount = await AccountService.countByRole(ROLES.SUPER_ADMIN);
        if (superAdminCount <= 1) {
          response.status(400).send("Cannot demote the last super admin account");
          return;
        }
      }

      if (currentRole === role) {
        response.send({ message: `Role is already '${role}'` });
        return;
      }

      await AccountService.updateRole(id, role);

      await AuditLogService.create({
        actor: request.account?.name ?? "System",
        actorId: request.account?._id?.toString?.() ?? "",
        action: "role",
        entity: "account",
        entityId: account._id.toString(),
        entityLabel: account.name,
        field: "role",
        previousValue: currentRole,
        newValue: role,
      }).catch(() => null);

      response.send({ message: `Role updated to '${role}'` });
    } catch (error) {
      response.status(500).send("Failed to update account role");
    }
  }

  static resubmitImages = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid account id");
        return;
      }

      // Get uploaded files from multer
      const files = request.files as { [fieldname: string]: { path: string }[] } | undefined;

      // Validate that all 3 ID images are provided
      if (!files?.['idFront']?.[0] || !files?.['idBack']?.[0] || !files?.['idSelfie']?.[0]) {
        response.status(400).send("All 3 ID images (front ID, back ID, selfie with ID) are required");
        return;
      }

      // Reject files whose actual content is not a JPG/PNG/WEBP image.
      for (const key of ['idFront', 'idBack', 'idSelfie'] as const) {
        if (!(await isJpegPngWebpFile(files[key][0].path))) {
          response.status(400).send("All 3 ID images must be valid JPG, PNG or WEBP photos");
          return;
        }
      }

      // Find existing account
      const existing = await AccountService.get(id);
      if (!existing) {
        response.status(404).send("Account not found");
        return;
      }

      // Upload new ID images to Cloudinary
      const idFront = await uploadToCloudinary(files['idFront'][0].path);
      const idBack = await uploadToCloudinary(files['idBack'][0].path);
      const idSelfie = await uploadToCloudinary(files['idSelfie'][0].path);

      // Update account with new images and set status back to pending
      await AccountService.update(id, {
        idImg: { idFront, idBack, idSelfie },
        status: 'pending',
      });

      response.send({ message: 'Images resubmitted successfully. Status set to pending.' });
    } catch (error) {
      response.status(500).send("Failed to resubmit images");
    }
  }

  static getProfile = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid account id");
        return;
      }

      const account = await AccountService.getProfile(id);
      if (!account) {
        response.status(404).send("Account not found");
        return;
      }
      response.send(account);
    } catch (error) {
      response.status(500).send("Failed to fetch profile");
    }
  }

  static addSkill = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const { skill, experience, proficiency, serviceTypes } = request.body;

      if (!isObjectId(id)) {
        response.status(400).send("Invalid account id");
        return;
      }
      if (!skill || experience === undefined || !proficiency) {
        response.status(400).send("All fields are required: skill, experience, proficiency");
        return;
      }
      if (typeof Number(experience) !== "number" || Number(experience) < 0) {
        response.status(400).send("Experience must be a non-negative number");
        return;
      }

      const account = await AccountService.addSkill(id, {
        skill,
        experience: Number(experience),
        proficiency,
        serviceTypes: Array.isArray(serviceTypes) ? serviceTypes : [],
      });

      if (!account) {
        response.status(404).send("Account not found");
        return;
      }


      await UserActivityService.create({
        accountId : account._id.toString(),
        activity : "Added skills to profile",
        date : formattedDate()
      })

      response.send(account);
    } catch (error) {
      response.status(500).send("Failed to add skill");
    }
  }

  static removeSkill = async (request: AuthRequest, response: Response) => {
    try {
      const { id, skillId } = request.params;
      if (!isObjectId(id) || !isObjectId(skillId)) {
        response.status(400).send("Invalid account or skill id");
        return;
      }

      const account = await AccountService.removeSkill(id, skillId);

      if (!account) {
        response.status(404).send("Account not found");
        return;
      }

      await UserActivityService.create({
        accountId : account._id.toString(),
        activity : "Removed skills to profile",
        date : formattedDate()
      })

      response.send(account);
    } catch (error) {
      response.status(500).send("Failed to remove skill");
    }
  }

  static uploadProfilePic = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;

      if (!isObjectId(id)) {
        response.status(400).send("Invalid account id");
        return;
      }
      if (!request.file) {
        response.status(400).send("No profile image provided");
        return;
      }

      const account = await AccountService.get(id);
      if (!account) {
        response.status(404).send("Account not found");
        return;
      }

      await UserActivityService.create({
        accountId : account._id.toString(),
        activity : "Changed Account profile picture",
        date : formattedDate()
      })

      const profilePicUrl = await uploadToCloudinary(request.file.path);

      const updated = await AccountService.update(id, {
        profile: profilePicUrl,
      });

      response.send(updated);
    } catch (error) {
      response.status(500).send("Failed to upload profile picture");
    }
  }

  static updateInfo = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const { name, address, contact, gender, dateOfBirth, civilStatus, purok, voterStatus, houseHoldNumber } = request.body;

      if (!isObjectId(id)) {
        response.status(400).send("Invalid account id");
        return;
      }
      if (!name && !address && !contact && !gender && !dateOfBirth && !civilStatus && !purok && !voterStatus && !houseHoldNumber) {
        response.status(400).send("No fields to update");
        return;
      }
      if (name && (!isName(name) || !withinLength(name, MAX_NAME_LENGTH))) {
        response.status(400).send("Name can only contain letters, spaces, periods, hyphens and apostrophes");
        return;
      }
      if (contact && !isPhilippineMobile(contact)) {
        response.status(400).send("A valid 11-digit Philippine mobile number is required (e.g. 09171234567)");
        return;
      }

      const updateData: Record<string, string> = {};
      if (name) updateData.name = name;
      if (address) updateData.address = address;
      if (contact) updateData.contact = contact;
      if (gender) updateData.gender = gender;
      if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;
      if (civilStatus) updateData.civilStatus = civilStatus;
      if (purok) updateData.purok = purok;
      if (voterStatus) updateData.voterStatus = voterStatus;
      if (houseHoldNumber) updateData.houseHoldNumber = houseHoldNumber;

      const account = await AccountService.update(id, updateData);
      if (!account) {
        response.status(404).send("Account not found");
        return;
      }

      await UserActivityService.create({
        accountId : account._id.toString(),
        activity : "Update User Info",
        date : formattedDate()
      })

      // Keep the linked census record in step with the updated profile.
      await ResidentCensusService.syncLinkedCensus(id).catch((err) =>
        console.error("[CENSUS-SYNC ERROR]", err)
      );

      response.send(account);
    } catch (error) {
      response.status(500).send("Failed to update profile");
    }
  }

  static changePassword = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const { oldPassword, newPassword } = request.body;

      if (!isObjectId(id)) {
        response.status(400).send("Invalid account id");
        return;
      }
      if (!oldPassword || !newPassword) {
        response.status(400).send("Old password and new password are required");
        return;
      }

      const passwordError = passwordStrengthError(newPassword);
      if (passwordError) {
        response.status(400).send(passwordError);
        return;
      }

      const account = await AccountService.get(id);
      if (!account) {
        response.status(404).send("Account not found");
        return;
      }

      const isMatch = await bcrypt.compare(oldPassword, account.password);
      if (!isMatch) {
        response.status(400).send("Old password is incorrect");
        return;
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await AccountService.update(id, { password: hashedPassword });

       await UserActivityService.create({
        accountId : account._id.toString(),
        activity : "Changed Password",
        date : formattedDate()
      })

      response.send({ message: "Password changed successfully" });
    } catch (error) {
      response.status(500).send("Failed to change password");
    }
  }

  static getResidentsWithSkills = async (request: AuthRequest, response: Response) => {
    try {
      const { skill, serviceType, availability, location, search } = request.query;
      const residents = await AccountService.getResidentsWithSkills({
        skill: skill as string,
        serviceType: serviceType as string,
        availability: availability as string,
        location: location as string,
        search: search as string,
      });
      response.send(residents);
    } catch (error) {
      response.status(500).send("Failed to fetch residents");
    }
  }

  static updateAvailability = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const { availability } = request.body;

      if (!isObjectId(id)) {
        response.status(400).send("Invalid account id");
        return;
      }
      if (!["AVAILABLE", "NOT_AVAILABLE"].includes(availability)) {
        response.status(400).send("Availability must be AVAILABLE or NOT_AVAILABLE (BUSY is system-managed)");
        return;
      }

      const account = await AccountService.updateAvailability(id, availability);
      if (!account) {
        response.status(404).send("Account not found");
        return;
      }
      response.send(account);
    } catch (error) {
      response.status(500).send("Failed to update availability");
    }
  }

  static addReview = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const { star, skill, message, workId } = request.body;

      if (!isObjectId(id)) {
        response.status(400).send("Invalid account id");
        return;
      }
      if (workId && !isObjectId(workId)) {
        response.status(400).send("Invalid work id");
        return;
      }
      if (!star || !skill || !message) {
        response.status(400).send("All fields are required: star, skill, message");
        return;
      }

      if (star < 1 || star > 5) {
        response.status(400).send("Star rating must be between 1 and 5");
        return;
      }

      const reviewer = request.account;
      if (!reviewer) {
        response.status(401).send("User not authenticated");
        return;
      }

      const reviewerAccount = await AccountService.get(reviewer._id);
      if (!reviewerAccount) {
        response.status(404).send("Reviewer not found");
        return;
      }

      const account = await AccountService.addReview(id, {
        user: reviewerAccount.name,
        userProfile: reviewerAccount.profile || '',
        star: Number(star),
        skill,
        message,
      });

      if (!account) {
        response.status(404).send("Account not found");
        return;
      }

      if (workId) {
        await WorkService.updateStatus(workId, "completed");
      }

      await UserActivityService.create({
        accountId: account._id.toString(),
        activity: "Place a Review to other Resident",
        date: formattedDate()
      })

      response.send(account);
    } catch (error) {
      response.status(500).send("Failed to add review");
    }
  }

  static bookWork = async (request: AuthRequest, response: Response) => {
    try {
      const { client, worker, skill, service, description } = request.body;

      if (!isObjectId(client) || !isObjectId(worker)) {
        response.status(400).send("All fields are required: client, worker, skill, service, description");
        return;
      }
      if (!skill || !service || !description) {
        response.status(400).send("All fields are required: client, worker, skill, service, description");
        return;
      }

      const workerAccount = await AccountService.get(worker);
      if (!workerAccount) {
        response.status(404).send("Worker not found");
        return;
      }

      const skillData = workerAccount.skills?.find((s) => s.skill === skill);
      if (!skillData) {
        response.status(400).send("Skill not found for this worker");
        return;
      }

      if (skillData.availability && skillData.availability !== "available") {
        response.status(400).send("This skill is currently busy and cannot be booked");
        return;
      }

      if (workerAccount.availability && workerAccount.availability !== "AVAILABLE") {
        response.status(400).send("This worker is currently not available and cannot be booked");
        return;
      }

      const work = await WorkService.create({
        client,
        worker,
        status: "pending",
        service: `${skill} - ${service}`,
        description,
        date: formattedDate(),
      });

      response.send(work);
    } catch (error) {
      response.status(500).send("Failed to book service");
    }
  }

  static aiChatBot = async (request: AuthRequest, response: Response) => {
    try {
      const { input, convo } = request.body;

      const systeminfo = await SystemInfoService.getFirst();

      const residentsInfo = await AccountService.getAccountsForAI();

      const businessInfo = await BusinessService.getBusinessForAI();

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

      const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

      const prompt = `
      You are an AI assistant for the Barangay Information System.

      All resident information and all business information is provided. respond to user question based on the data provided.

        If a question is unrelated to the system

        "I'm here to assist with barangay-related questions, including information about barangay services, office hours, announcements, registered residents and their skills, and registered businesses. I can't answer questions outside of these topics."

        Be friendly, concise, and accurate.

            barangayInfo: (information about barangay)
            ${systeminfo}

            residentsInfo (information about resident)
            ${residentsInfo}

            businessInfo (information about business)
            ${businessInfo}

            Previous Conversation:
            ${Array.isArray(convo) ? convo.join("\n") : ""}

            User input/user qeustion:
            ${input}
       `;

      const result = await model.generateContent(prompt);
      const aiReply = result.response.text();

      response.send(aiReply)
    } catch (error) {
      console.error(error);

      response.status(500).json({
        success: false,
        message: "Failed to generate response",
      });
    }
  };

  static aiSuggestions = async (request: AuthRequest, response: Response) => {
    try {
      const residentsInfo = await AccountService.getAccountsForAI();

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

      const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

      const prompt = `
       You are an AI advisor for a Philippine barangay.

        Analyze the resident skills provided below.

        Generate ONLY ONE recommendation each time.

        IMPORTANT RULES:

        - Do not always choose the most common skill.
        - Randomly select one meaningful opportunity from the data.
        - Sometimes recommend a training program.
        - Sometimes recommend a community event.
        - Sometimes recommend a livelihood project.
        - Sometimes recommend a volunteer initiative.
        - Sometimes recommend a partnership with TESDA, schools, or local businesses.
        - Sometimes recommend helping residents without registered skills.
        - Avoid repeating the exact same recommendation if there are multiple possible opportunities.
        - Base your recommendation on the resident data.

        Your response should contain:

        Title

        Reason

        Recommendation

        Implementation

        Expected Benefits

        Keep the response between 150 and 250 words.

        Resident Data:

              ${residentsInfo}
       `;

      const result = await model.generateContent(prompt);
      const aiReply = result.response.text();

      response.send(aiReply)
    } catch (error) {
      console.error(error);

      response.status(500).json({
        success: false,
        message: "Failed to generate response",
      });
    }
  };

  static getAiContext = async (_request: AuthRequest, response: Response) => {
    try {
      const systemInfo = await SystemInfoService.getFirst();

      response.send(systemInfo || { aiContext: "" });
    } catch (error) {
      response.status(500).send("Failed to fetch AI context");
    }
  }

  static upsertAiContext = async (request: AuthRequest, response: Response) => {
    try {
      const { aiContext } = request.body;

      if (!aiContext || !aiContext.trim()) {
        response.status(400).send("AI context is required");
        return;
      }

      const systemInfo = await SystemInfoService.upsert({ aiContext });
      response.send(systemInfo);
    } catch (error) {
      response.status(500).send("Failed to save AI context");
    }
  }

  static login = async (request : AuthRequest , response : Response) => {
    try {
      const { email, password } = request.body || {};

      if (!isEmail(email)) {
        response.status(400).send(GENERIC_LOGIN_MSG);
        return;
      }
      if (!isNonEmptyString(password)) {
        response.status(400).send(GENERIC_LOGIN_MSG);
        return;
      }

      const account = await AccountService.checkEmailIfExist(String(email).trim().toLowerCase());

      if (!account) {
        response.status(401).send(GENERIC_LOGIN_MSG);
        return;
      }

      const isMatch = await bcrypt.compare(password, account.password);

      if (!isMatch) {
        response.status(401).send(GENERIC_LOGIN_MSG);
        return;
      }

      const token = jwt.sign({ id: account._id }, secret, { expiresIn: "3d" });

      response.send({
        token,
        account: {
          ...account.toObject(),
          role: account.role || "resident",
        },
      });
    } catch (error) {
      console.error("[LOGIN ERROR]", error);
      response.status(500).send("Login failed");
    }
  }

  static forgotPassword = async (request: AuthRequest, response: Response) => {
    try {
      const { email, contact, method } = request.body || {};
      const delivery = method === "sms" ? "sms" : "email";

      let account: any = null;
      if (delivery === "sms") {
        const mobile = normalizePhMobile(contact);
        if (!mobile) {
          response.status(400).send("A valid 11-digit Philippine mobile number is required (e.g. 09171234567)");
          return;
        }
        account = await AccountService.checkContactIfExist(mobile);
      } else {
        if (!isEmail(email)) {
          response.status(400).send("A valid email address is required");
          return;
        }
        account = await AccountService.checkEmailIfExist(String(email).trim().toLowerCase());
      }

      // Always respond the same way whether or not the account exists, so this
      // endpoint can't be used to check which emails/numbers are registered.
      if (!account) {
        response.send({ message: "If that is registered, a reset code has been sent." });
        return;
      }

      const code = generateResetCode();
      const codeHash = await hashResetCode(code);
      const expires = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000);

      await AccountService.setResetCode(account._id.toString(), codeHash, expires);

      if (delivery === "sms") {
        const smsSent = await sendSms(account.contact, resetCodeSmsMessage(code));
        if (!smsSent) {
          console.warn("[FORGOT-PASSWORD] SMS delivery failed, falling back to email");
          await sendEmail(account.email, "Your Password Reset Code", resetCodeEmailHtml(account.name, code));
        }
      } else {
        await sendEmail(account.email, "Your Password Reset Code", resetCodeEmailHtml(account.name, code));
      }

      response.send({ message: "If that is registered, a reset code has been sent." });
    } catch (error) {
      console.error("[FORGOT-PASSWORD ERROR]", error);
      response.status(500).send("Password reset request failed");
    }
  }

  static verifyResetCode = async (request: AuthRequest, response: Response) => {
    try {
      const { email, contact, method, code } = request.body || {};
      const delivery = method === "sms" ? "sms" : "email";

      let account: any = null;
      if (delivery === "sms") {
        const mobile = normalizePhMobile(contact);
        if (!mobile) {
          response.status(400).send("A valid 11-digit Philippine mobile number is required (e.g. 09171234567)");
          return;
        }
        account = await AccountService.checkContactIfExist(mobile);
      } else {
        if (!isEmail(email)) {
          response.status(400).send("Email and code are required");
          return;
        }
        account = await AccountService.checkEmailIfExist(String(email).trim().toLowerCase());
      }

      if (!isNonEmptyString(code) || !account || !account.resetCodeHash || !account.resetCodeExpires) {
        response.status(400).send("Invalid or expired code");
        return;
      }

      if (new Date() > account.resetCodeExpires) {
        response.status(400).send("Code has expired. Please request a new one.");
        return;
      }

      const isMatch = await compareResetCode(code, account.resetCodeHash);

      if (!isMatch) {
        response.status(400).send("Invalid or expired code");
        return;
      }

      const resetToken = jwt.sign({ id: account._id, purpose: "password_reset" }, secret, { expiresIn: "10m" });

      response.send({ resetToken });
    } catch (error) {
      console.error("[VERIFY-RESET-CODE ERROR]", error);
      response.status(500).send("Could not verify reset code");
    }
  }

  static resetPassword = async (request: AuthRequest, response: Response) => {
    try {
      const { resetToken, newPassword } = request.body || {};

      if (!resetToken || !isNonEmptyString(newPassword)) {
        response.status(400).send("Reset token and new password are required");
        return;
      }

      const passwordError = passwordStrengthError(newPassword);
      if (passwordError) {
        response.status(400).send(passwordError);
        return;
      }

      const decoded = jwt.verify(resetToken, secret) as { id: string; purpose: string };

      if (decoded.purpose !== "password_reset") {
        response.status(401).send("Invalid reset token");
        return;
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await AccountService.updatePassword(decoded.id, hashedPassword);
      await AccountService.clearResetCode(decoded.id);

      response.send({ message: "Password reset successfully" });
    } catch (error) {
      response.status(401).send("Reset token is invalid or has expired");
    }
  }



}
