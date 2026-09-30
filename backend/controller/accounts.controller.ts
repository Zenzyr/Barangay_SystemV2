import { PurokService } from "../services/purok.service";
import { randomBytes } from "crypto";
import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { accountInterfaceInput } from "../types/accounts.type";
import { AccountService } from "../services/acccount.service";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import { uploadToCloudinary } from "../utils/cloudinaryUpload";
import { detectImageFormat, bufferToImageDataUri } from "../utils/upload";
import { UserActivityService } from "../services/userActivity.service";
import { formattedDate } from "../utils/customFunc";
import { sendNotification, sendSms } from "../utils/sms";
import { smsTemplates } from "../utils/smsTemplates";
import { sendEmail } from "../utils/email";
import { EmailVerificationService } from "../services/emailVerification.service";
import {
  generateEmailOtp,
  hashEmailOtp,
  compareEmailOtp,
  emailDomainError,
  emailOtpEmailHtml,
  EMAIL_OTP_TTL_MINUTES,
  EMAIL_OTP_MAX_ATTEMPTS,
  EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
  EMAIL_OTP_BLOCK_MINUTES,
  EMAIL_VERIFICATION_TOKEN_TTL,
} from "../utils/emailVerification";
import { calculateAge } from "../utils/age";
import {
  generateResetCode,
  hashResetCode,
  compareResetCode,
  resetCodeEmailHtml,
  resetCodeSmsMessage,
  RESET_CODE_TTL_MINUTES,
} from "../utils/passwordReset";
import { verifyIdWithOcr } from "../utils/idVerification";
import {
  verifyIdDocumentWithGemini,
  IdDocumentType,
} from "../utils/geminiIdVerification";
import {
  hashIdImages,
  signIdVerificationToken,
  verifyIdVerificationToken,
} from "../utils/idVerificationToken";
import { NotificationService } from "../services/notification.service";
import { ResidentCensusService } from "../services/residentCensus.service";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { SystemInfoService } from "../services/systemInfo.service";

import { WorkService } from "../services/work.service";
import { AuditLogService } from "../services/auditLog.service";
import { ROLES, ROLE_LIST, isStaffRole } from "../utils/roles";
import {
  assessPersonRegistration,
  buildDuplicateReport,
  computeIdentityHash,
  DUPLICATE_PERSON_MSG,
  DUPLICATE_NAME_MSG,
  DUPLICATE_NAME_REASON,
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
const EMAIL_VERIFY_PURPOSE = "email-verification";

// Issues a signed, short-lived token proving the applicant correctly entered
// an OTP for THIS exact address. registration (register) requires it.
function signEmailVerificationToken(email: string): string {
  return jwt.sign(
    { email, purpose: EMAIL_VERIFY_PURPOSE },
    secret,
    { expiresIn: EMAIL_VERIFICATION_TOKEN_TTL }
  );
}

// Validates the email-ownership token against the email being registered.
function verifyEmailVerificationToken(
  token: string,
  expectedEmail: string
): boolean {
  if (!token || !expectedEmail) return false;
  try {
    const decoded = jwt.verify(token, secret) as {
      email?: string;
      purpose?: string;
    };
    return (
      decoded.purpose === EMAIL_VERIFY_PURPOSE &&
      decoded.email === expectedEmail
    );
  } catch {
    return false;
  }
}

/**
 * Shared core of sendEmailOtp / resendEmailOtp: enforces expiry-independent
 * rate limits, generates a NEW hashed code, and emails it. Never logs or
 * echoes the OTP. Never treats a valid-looking email as verified.
 */
async function dispatchEmailOtp(
  email: string,
  response: Response
): Promise<void> {
  const normalized = email.trim().toLowerCase();

  // The address must not already belong to an account.
  const existing = await AccountService.checkEmailIfExist(normalized);
  if (existing) {
    response.status(409).send(EMAIL_IN_USE_MSG);
    return;
  }

  const now = Date.now();
  let record = await EmailVerificationService.getByEmail(normalized);

  // Too many failed attempts → temporary hard block (also covers resend).
  if (record?.blockedUntil && now < new Date(record.blockedUntil).getTime()) {
    const minutes = Math.ceil(
      (new Date(record.blockedUntil).getTime() - now) / 60000
    );
    response.status(429).send(
      `Too many failed attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`
    );
    return;
  }

  // Resend cooldown — one code per address per window.
  if (record?.resendCooldownUntil && now < new Date(record.resendCooldownUntil).getTime()) {
    const seconds = Math.max(
      1,
      Math.ceil((new Date(record.resendCooldownUntil).getTime() - now) / 1000)
    );
    response.status(429).send(
      `A verification code was just sent. Please wait ${seconds} second${seconds === 1 ? "" : "s"} before requesting another.`
    );
    return;
  }

  const code = generateEmailOtp();
  const codeHash = await hashEmailOtp(code);
  const expiresAt = new Date(now + EMAIL_OTP_TTL_MINUTES * 60 * 1000);
  const cooldownUntil = new Date(now + EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000);

  await EmailVerificationService.upsertOtp(
    normalized,
    codeHash,
    expiresAt,
    cooldownUntil
  );

  const sent = await sendEmail(
    normalized,
    "Verify Your Email Address",
    emailOtpEmailHtml(normalized, code)
  );
  if (!sent) {
    console.error("[EMAIL-OTP] Delivery failed for", normalized);
    response
      .status(500)
      .send("We could not send the verification email right now. Please try again later.");
    return;
  }

  response.send({
    message: "A verification code has been sent to your email.",
    resendCooldownSeconds: EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
  });
}

// ── Welcome emails for staff-created resident accounts ──────────────
function accountWelcomeEmailHtml(name: string, tempPassword: string): string {
  return [
    `<p>Hi ${name},</p>`,
    "<p>Your barangay resident account has been created by the barangay office. You can now log in to the resident portal.</p>",
    `<p>Your temporary password is: <b>${tempPassword}</b></p>`,
    "<p>Please sign in and change your password right away to keep your account secure.</p>",
    "<p>Thank you,<br/>Barangay Office</p>",
  ].join("");
}

function accountApprovedEmailHtml(name: string): string {
  return [
    `<p>Hi ${name},</p>`,
    "<p>Your barangay resident account has been created and approved by the barangay office. You can now log in to the resident portal.</p>",
    "<p>Thank you,<br/>Barangay Office</p>",
  ].join("");
}

export class AccountController {
  static register = async (request: AuthRequest, response: Response) => {
    try {
      // Multipart form-data fields arrive as strings.
      const body = (request.body || {}) as Record<string, unknown>;
      const email = String(body.email || "")
        .trim()
        .toLowerCase();
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
      const idType = String(body.idType || "").trim();
      const legalConsent = String(body.legalConsent || "");

      // Verify purok is active
      const activePuroks = await PurokService.getAll({ status: "active" });
      if (!activePuroks.some((p: any) => p.name === purok)) {
        return response.status(400).send("Invalid purok selected");
      }

      // ── Field validation ─────────────────────────────────────
      if (!isNonEmptyString(name))
        return response.status(400).send("Full name is required");
      if (!isName(name))
        return response
          .status(400)
          .send(
            "Name can only contain letters, spaces, periods, hyphens and apostrophes",
          );
      if (!withinLength(name, MAX_NAME_LENGTH))
        return response
          .status(400)
          .send(`Name must be at most ${MAX_NAME_LENGTH} characters`);

      if (!isEmail(email))
        return response.status(400).send("A valid email address is required");
      if (!withinLength(email, MAX_EMAIL_LENGTH))
        return response.status(400).send("Email is too long");
      // Structural domain check on top of the format regex (labels, TLD,
      // no consecutive dots). Ownership is proven by the OTP below, never
      // by this shape check alone.
      const emailDomainCheck = emailDomainError(email);
      if (emailDomainCheck)
        return response.status(400).send(emailDomainCheck);

      if (!isPhilippineMobile(contact))
        return response
          .status(400)
          .send(
            "A valid 11-digit Philippine mobile number is required (e.g. 09171234567)",
          );

      if (!isNonEmptyString(address))
        return response.status(400).send("Address is required");
      if (!withinLength(address, MAX_ADDRESS_LENGTH))
        return response
          .status(400)
          .send(`Address must be at most ${MAX_ADDRESS_LENGTH} characters`);

      const passwordError = passwordStrengthError(password);
      if (passwordError) return response.status(400).send(passwordError);

      const requiredEnums: Record<string, readonly string[]> = {
        gender: ["Male", "Female", "Other"],
        civilStatus: ["Single", "Married", "Widowed", "Separated", "Divorced"],
        purok: ["Purok 1", "Purok 2", "Purok 3", "Purok 4"],
        voterStatus: ["Registered", "Not Registered"],
        idType: ["national_id", "voters_id"],
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
        const message =
          assessment.reason === DUPLICATE_NAME_REASON
            ? DUPLICATE_NAME_MSG
            : DUPLICATE_PERSON_MSG;
        return response.status(409).send(message);
      }

      // ── File validation ──────────────────────────────────────
      // Multer keeps these in memory (see utils/upload.ts's uploadIdImages)
      // — they are NEVER written to backend/uploads. Their only destination
      // is Cloudinary (below); until then they exist only as buffers here.
      const files = request.files as
        | { [fieldname: string]: { buffer: Buffer; mimetype: string }[] }
        | undefined;
      if (
        !files?.["idFront"]?.[0] ||
        !files?.["idBack"]?.[0] ||
        !files?.["idSelfie"]?.[0]
      ) {
        return response
          .status(400)
          .send(
            "All 3 ID images (front ID, back ID, selfie with ID) are required",
          );
      }

      // Reject files whose actual content is not a JPG/PNG/WEBP image, even
      // if the MIME header was spoofed or the type was renamed. The detected
      // format is also what we tell Cloudinary when uploading below.
      const idImageFormat: Partial<Record<"idFront" | "idBack" | "idSelfie", "jpeg" | "png" | "webp">> = {};
      for (const key of ["idFront", "idBack", "idSelfie"] as const) {
        const format = detectImageFormat(files[key][0].buffer);
        if (!format) {
          return response
            .status(400)
            .send("All 3 ID images must be valid JPG, PNG or WEBP photos");
        }
        idImageFormat[key] = format;
      }

      // ── Confirm the ID was already verified (no second Gemini call) ──
      // The frontend runs the Gemini document check as soon as the ID is
      // selected (POST /account/verify-id-document) and gets back a signed
      // token on success. Here we only need to check that signed token
      // against a hash of THESE exact uploaded files — never a raw
      // frontend boolean, and never a second call to Gemini.
      const verificationToken = String(body.verificationToken || "");
      const idFrontBuffer = files["idFront"][0].buffer;
      const idBackBuffer = files["idBack"][0].buffer;
      const idImageHash = hashIdImages(idFrontBuffer, idBackBuffer);
      if (
        !verifyIdVerificationToken(verificationToken, {
          idType,
          imageHash: idImageHash,
        })
      ) {
        return response
          .status(400)
          .send(
            "Your ID could not be confirmed as verified. Please re-upload your ID and wait for it to be verified before submitting.",
          );
      }

      // ── Confirm this exact email was ownership-verified with an OTP ──
      // A structurally-valid email is NOT enough — the applicant must have
      // received an OTP at this address and submitted it correctly, which
      // produced a signed token bound to the email. No token (or a token for
      // a different address) means no verified email.
      const emailToken = String(body.emailToken || "");
      if (!verifyEmailVerificationToken(emailToken, email)) {
        return response
          .status(400)
          .send(
            "Please verify your email address with the verification code before creating your account.",
          );
      }

      const accountData: accountInterfaceInput =
        request.body as accountInterfaceInput;
      const hashedPassword = await bcrypt.hash(password, 10);

      const age = calculateAge(dateOfBirth);

      // Public registration can ONLY ever create a resident account.
      // secretary / super_admin are assigned exclusively through the
      // Super Admin role-management process, never from this form.
      const identityHash = computeIdentityHash(name, dateOfBirth);

      // ── Create the account FIRST, before touching Cloudinary ──────
      // idImg starts empty. This is the step most likely to still fail here
      // (a race-condition duplicate caught by the unique identityHash/email
      // index — see the E11000 handler below) even though every check above
      // passed, so we only spend a Cloudinary upload once we know the
      // account itself was actually created. That way a failed registration
      // can never leave an orphaned Cloudinary file behind.
      const account = await AccountService.create({
        profile: String(body.profile || ""),
        name,
        address,
        contact,
        email,
        gender,
        dateOfBirth,
        age,
        civilStatus,
        purok,
        voterStatus,
        houseHoldNumber,
        idType: idType as "national_id" | "voters_id",
        password: hashedPassword,
        status: "pending",
        role: "resident",
        emailVerified: true,
        emailVerifiedAt: new Date(),
        idImg: { idFront: "", idBack: "", idSelfie: "" },
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
        console.error("[CENSUS-SYNC ERROR]", err),
      );

      // ── Upload ID images to Cloudinary now that the account exists ──
      // Registration itself has already succeeded at this point — an
      // upload failure here is logged and left for the resident/staff to
      // resolve via PUT /account/:id/resubmit, never a reason to fail the
      // whole signup (the account, and the identity/duplicate protections
      // that already ran, are real either way).
      try {
        const idFront = await uploadToCloudinary(
          bufferToImageDataUri(idFrontBuffer, idImageFormat.idFront!),
        );
        const idBack = await uploadToCloudinary(
          bufferToImageDataUri(idBackBuffer, idImageFormat.idBack!),
        );
        const idSelfie = await uploadToCloudinary(
          bufferToImageDataUri(files["idSelfie"][0].buffer, idImageFormat.idSelfie!),
        );
        await AccountService.update(account._id.toString(), {
          idImg: { idFront, idBack, idSelfie },
        });
      } catch (uploadError) {
        console.error(
          `[REGISTER] Cloudinary upload failed for account ${account._id} — account was created, ID images are pending resubmission:`,
          uploadError instanceof Error ? uploadError.message : "unknown error",
        );
        // Nothing to clean up locally — these images were only ever in
        // memory and are discarded automatically once this request ends.
      }

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
  };

  /**
   * Staff-only resident creation (secretary / super admin).
   *
   * The clerk meets the person face-to-face, confirms identity against their
   * ID and records their details — so no OTP, no Gemini ID-document check and
   * no later account-verification step are needed. The account is created
   * already "approved". Every field mirrors the public sign-up form.
   *
   * The duplicate/identity protections still apply exactly as in register():
   * email reuse → 409; a confident same-person match (name + DOB + phone across
   * accounts and the census) → blocked with an explanation. Uncertain matches
   * are flagged for the administrator's review instead of blocking the clerk.
   * Every created resident is synced into the resident census.
   */
  static createResidentAdmin = async (request: AuthRequest, response: Response) => {
    try {
      const body = (request.body || {}) as Record<string, unknown>;
      const email = String(body.email || "")
        .trim()
        .toLowerCase();
      const name = String(body.name || "").trim();
      const address = String(body.address || "").trim();
      const contact = String(body.contact || "").trim();
      const gender = String(body.gender || "").trim();
      const dateOfBirth = String(body.dateOfBirth || "").trim();
      const civilStatus = String(body.civilStatus || "").trim();
      const purok = String(body.purok || "").trim();
      const voterStatus = String(body.voterStatus || "").trim();
      const houseHoldNumber = String(body.houseHoldNumber || "").trim();
      const password = String(body.password || "");

      // Verify purok is active
      const activePuroks = await PurokService.getAll({ status: "active" });
      if (!activePuroks.some((p: any) => p.name === purok)) {
        return response.status(400).send("Invalid purok selected");
      }

      // ── Field validation (same rules as the sign-up form) ─────
      if (!isNonEmptyString(name))
        return response.status(400).send("Full name is required");
      if (!isName(name))
        return response
          .status(400)
          .send(
            "Name can only contain letters, spaces, periods, hyphens and apostrophes",
          );
      if (!withinLength(name, MAX_NAME_LENGTH))
        return response
          .status(400)
          .send(`Name must be at most ${MAX_NAME_LENGTH} characters`);

      if (!isEmail(email))
        return response.status(400).send("A valid email address is required");
      if (!withinLength(email, MAX_EMAIL_LENGTH))
        return response.status(400).send("Email is too long");
      const emailDomainCheck = emailDomainError(email);
      if (emailDomainCheck)
        return response.status(400).send(emailDomainCheck);

      if (!isPhilippineMobile(contact))
        return response
          .status(400)
          .send(
            "A valid 11-digit Philippine mobile number is required (e.g. 09171234567)",
          );

      if (!isNonEmptyString(address))
        return response.status(400).send("Address is required");
      if (!withinLength(address, MAX_ADDRESS_LENGTH))
        return response
          .status(400)
          .send(`Address must be at most ${MAX_ADDRESS_LENGTH} characters`);

      // A clerk-typed password is accepted; when omitted a secure temporary
      // one is generated and sent to the resident in the welcome email.
      const finalPassword = password || randomBytes(6).toString("hex");
      const passwordError = passwordStrengthError(finalPassword);
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

      // ── ONE PERSON = ONE ACCOUNT (same as register) ─────────
      const assessment = await assessPersonRegistration({
        name,
        dateOfBirth,
        gender,
        contact,
      });
      if (assessment.status === "blocked") {
        const message =
          assessment.reason === DUPLICATE_NAME_REASON
            ? DUPLICATE_NAME_MSG
            : DUPLICATE_PERSON_MSG;
        return response.status(409).send(message);
      }

      const hashedPassword = await bcrypt.hash(finalPassword, 10);
      const age = calculateAge(dateOfBirth);
      const identityHash = computeIdentityHash(name, dateOfBirth);

      const account = await AccountService.create({
        profile: String(body.profile || ""),
        name,
        address,
        contact,
        email,
        gender,
        dateOfBirth,
        age,
        civilStatus,
        purok,
        voterStatus,
        houseHoldNumber,
        password: hashedPassword,
        status: "approved",
        role: "resident",
        emailVerified: true,
        emailVerifiedAt: new Date(),
        idImg: { idFront: "", idBack: "", idSelfie: "" },
        skills: [],
        reviews: [],
        legalConsent: { privacyPolicy: true, termsOfService: true },

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

      // ── Auto-sync into the census (idempotent) ──────────────
      await ResidentCensusService.upsertFromAccount(account).catch((err) =>
        console.error("[CENSUS-SYNC ERROR]", err),
      );

      // ── Welcome email with the temporary password ─────────────
      // The account is real either way; a failed email is logged, never a
      // reason to roll back the registration.
      try {
        const welcomeHtml = password
          ? accountApprovedEmailHtml(name)
          : accountWelcomeEmailHtml(name, finalPassword);
        await sendEmail(
          account.email,
          "Your Barangay Resident Account",
          welcomeHtml,
        );
      } catch (emailError) {
        console.error(
          "[ADMIN-CREATE-RESIDENT] welcome email failed for account " +
            account._id,
          emailError,
        );
      }

      return response.status(201).json({ userId: account._id });
    } catch (error: any) {
      console.error("[ADMIN CREATE RESIDENT ERROR]", error);
      if (error?.code === 11000) {
        const keyValues = Object.keys(error?.keyValue || {});
        if (keyValues.includes("identityHash")) {
          return response.status(409).send(DUPLICATE_PERSON_MSG);
        }
        return response.status(409).send(EMAIL_IN_USE_MSG);
      }
      return response.status(500).send("Failed to create resident");
    }
  };

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

      const assessment = await assessPersonRegistration({
        name,
        dateOfBirth,
        gender,
        contact,
      });
      const censusMatch = (assessment.records || []).find(
        (r) => r.kind === "census",
      );

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
  };

  /**
   * Super Admin only. Read-only report of possible duplicate people across
   * accounts and the resident census. Nothing is deleted or merged.
   */
  static duplicatesReport = async (
    request: AuthRequest,
    response: Response,
  ) => {
    try {
      const entries = await buildDuplicateReport();
      response.send({ generatedAt: new Date().toISOString(), entries });
    } catch (error) {
      console.error("[DUPLICATES-REPORT ERROR]", error);
      response.status(500).send("Failed to generate duplicate report");
    }
  };

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
      const result = await verifyIdWithOcr(
        base64,
        side === "back" ? "back" : "front",
      );
      response.send(result);
    } catch (error) {
      console.error("[VERIFY-ID ERROR]", error);
      response.status(500).send("ID verification service unavailable");
    }
  };

  /**
   * Pre-submission check: does the uploaded front/back pair look like a
   * real, readable ID of the applicant's selected type, and do the two
   * sides belong to the same document? Uses Gemini (see
   * utils/geminiIdVerification.ts) — NOT official government identity
   * verification, and not a replacement for admin approval.
   *
   * The uploaded files here are temporary (multer disk storage) and are
   * deleted immediately after being read — they are never persisted or
   * uploaded to Cloudinary; that only happens on the real POST /account
   * submission.
   */
  static verifyIdDocument = async (
    request: AuthRequest,
    response: Response,
  ) => {
    try {
      // In-memory only (see utils/upload.ts's uploadIdFrontBack) — never
      // touches backend/uploads. These images are discarded once this
      // request ends; only a signed token derived from their hash survives.
      const files = request.files as
        | { [fieldname: string]: { buffer: Buffer; mimetype: string }[] }
        | undefined;
      const front = files?.["idFront"]?.[0];
      const back = files?.["idBack"]?.[0];

      const body = (request.body || {}) as { idType?: string };
      const idType = body.idType;
      if (idType !== "national_id" && idType !== "voters_id") {
        return response.status(400).send("A valid ID type is required");
      }
      if (!front || !back) {
        return response
          .status(400)
          .send("Both the front and back ID images are required");
      }

      const frontFormat = detectImageFormat(front.buffer);
      const backFormat = detectImageFormat(back.buffer);
      if (!frontFormat || !backFormat) {
        return response
          .status(400)
          .send("Both ID images must be valid JPG, PNG or WEBP photos");
      }

      const result = await verifyIdDocumentWithGemini({
        idType: idType as IdDocumentType,
        frontBase64: front.buffer.toString("base64"),
        frontMimeType: front.mimetype,
        backBase64: back.buffer.toString("base64"),
        backMimeType: back.mimetype,
      });

      // Only issue a token when the check actually passed — this is what
      // register() will later require and re-verify, so a failed check
      // must never be redeemable. Bound to a hash of these exact image
      // bytes so the token can't be reused for a different upload.
      const verificationToken = result.passed
        ? signIdVerificationToken(idType, hashIdImages(front.buffer, back.buffer))
        : undefined;

      return response.json({ ...result, verificationToken });
    } catch (error) {
      console.error(
        "[VERIFY-ID-DOCUMENT ERROR]",
        error instanceof Error ? error.message : "unknown error",
      );
      return response.status(500).send("ID verification service unavailable");
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
  };

  static getActivityByResident = async (
    request: AuthRequest,
    response: Response,
  ) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid account id");
        return;
      }
      const activity = await UserActivityService.getByAccount(id);
      response.send(activity);
    } catch (error) {
      response
        .status(500)
        .send("Failed to fetch activity requests by resident");
    }
  };

  static updateStatus = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const { status } = request.body;

      if (!isObjectId(id)) {
        response.status(400).send("Invalid account id");
        return;
      }
      if (!["approved", "rejected"].includes(status)) {
        response
          .status(400)
          .send("Invalid status. Must be 'approved' or 'rejected'");
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
          console.error("[CENSUS-SYNC ERROR]", err),
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

      sendNotification(
        "status",
        account.contact,
        smsTemplates.accountStatus(
          account.name,
          status as "approved" | "rejected",
        ),
      );

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
  };

  static updateRole = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const { role } = request.body;

      if (!isObjectId(id)) {
        response.status(400).send("Invalid account id");
        return;
      }
      if (!ROLE_LIST.includes(role)) {
        response
          .status(400)
          .send(`Invalid role. Must be one of: ${ROLE_LIST.join(", ")}`);
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
        const superAdminCount = await AccountService.countByRole(
          ROLES.SUPER_ADMIN,
        );
        if (superAdminCount <= 1) {
          response
            .status(400)
            .send("Cannot demote the last super admin account");
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
  };

  static resubmitImages = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid account id");
        return;
      }

      // Get uploaded files from multer — in-memory only, never written to
      // backend/uploads (see utils/upload.ts's uploadIdImages).
      const files = request.files as
        | { [fieldname: string]: { buffer: Buffer }[] }
        | undefined;

      // Validate that all 3 ID images are provided
      if (
        !files?.["idFront"]?.[0] ||
        !files?.["idBack"]?.[0] ||
        !files?.["idSelfie"]?.[0]
      ) {
        response
          .status(400)
          .send(
            "All 3 ID images (front ID, back ID, selfie with ID) are required",
          );
        return;
      }

      // Reject files whose actual content is not a JPG/PNG/WEBP image.
      const idImageFormat: Partial<Record<"idFront" | "idBack" | "idSelfie", "jpeg" | "png" | "webp">> = {};
      for (const key of ["idFront", "idBack", "idSelfie"] as const) {
        const format = detectImageFormat(files[key][0].buffer);
        if (!format) {
          response
            .status(400)
            .send("All 3 ID images must be valid JPG, PNG or WEBP photos");
          return;
        }
        idImageFormat[key] = format;
      }

      // Find existing account
      const existing = await AccountService.get(id);
      if (!existing) {
        response.status(404).send("Account not found");
        return;
      }

      // Upload new ID images to Cloudinary
      const idFront = await uploadToCloudinary(bufferToImageDataUri(files["idFront"][0].buffer, idImageFormat.idFront!));
      const idBack = await uploadToCloudinary(bufferToImageDataUri(files["idBack"][0].buffer, idImageFormat.idBack!));
      const idSelfie = await uploadToCloudinary(bufferToImageDataUri(files["idSelfie"][0].buffer, idImageFormat.idSelfie!));

      // Update account with new images and set status back to pending
      await AccountService.update(id, {
        idImg: { idFront, idBack, idSelfie },
        status: "pending",
      });

      response.send({
        message: "Images resubmitted successfully. Status set to pending.",
      });
    } catch (error) {
      response.status(500).send("Failed to resubmit images");
    }
  };

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
  };

  static addSkill = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const { skill, experience, proficiency, serviceTypes } = request.body;

      if (!isObjectId(id)) {
        response.status(400).send("Invalid account id");
        return;
      }
      if (!skill || experience === undefined || !proficiency) {
        response
          .status(400)
          .send("All fields are required: skill, experience, proficiency");
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
        accountId: account._id.toString(),
        activity: "Added skills to profile",
        date: formattedDate(),
      });

      response.send(account);
    } catch (error) {
      response.status(500).send("Failed to add skill");
    }
  };

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
        accountId: account._id.toString(),
        activity: "Removed skills to profile",
        date: formattedDate(),
      });

      response.send(account);
    } catch (error) {
      response.status(500).send("Failed to remove skill");
    }
  };

  static uploadProfilePic = async (
    request: AuthRequest,
    response: Response,
  ) => {
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
        accountId: account._id.toString(),
        activity: "Changed Account profile picture",
        date: formattedDate(),
      });

      const profilePicUrl = await uploadToCloudinary(request.file.path);

      const updated = await AccountService.update(id, {
        profile: profilePicUrl,
      });

      response.send(updated);
    } catch (error) {
      response.status(500).send("Failed to upload profile picture");
    }
  };

  static updateInfo = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const {
        name,
        address,
        contact,
        gender,
        dateOfBirth,
        civilStatus,
        purok,
        voterStatus,
        houseHoldNumber,
      } = request.body;

      if (!isObjectId(id)) {
        response.status(400).send("Invalid account id");
        return;
      }
      if (
        !name &&
        !address &&
        !contact &&
        !gender &&
        !dateOfBirth &&
        !civilStatus &&
        !purok &&
        !voterStatus &&
        !houseHoldNumber
      ) {
        response.status(400).send("No fields to update");
        return;
      }
      if (name && (!isName(name) || !withinLength(name, MAX_NAME_LENGTH))) {
        response
          .status(400)
          .send(
            "Name can only contain letters, spaces, periods, hyphens and apostrophes",
          );
        return;
      }
      if (contact && !isPhilippineMobile(contact)) {
        response
          .status(400)
          .send(
            "A valid 11-digit Philippine mobile number is required (e.g. 09171234567)",
          );
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
        accountId: account._id.toString(),
        activity: "Update User Info",
        date: formattedDate(),
      });

      // Keep the linked census record in step with the updated profile.
      await ResidentCensusService.syncLinkedCensus(id).catch((err) =>
        console.error("[CENSUS-SYNC ERROR]", err),
      );

      response.send(account);
    } catch (error) {
      response.status(500).send("Failed to update profile");
    }
  };

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
        accountId: account._id.toString(),
        activity: "Changed Password",
        date: formattedDate(),
      });

      response.send({ message: "Password changed successfully" });
    } catch (error) {
      response.status(500).send("Failed to change password");
    }
  };

  static getResidentsWithSkills = async (
    request: AuthRequest,
    response: Response,
  ) => {
    try {
      const { skill, serviceType, availability, location, search } =
        request.query;
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
  };

  static updateAvailability = async (
    request: AuthRequest,
    response: Response,
  ) => {
    try {
      const { id } = request.params;
      const { availability } = request.body;

      if (!isObjectId(id)) {
        response.status(400).send("Invalid account id");
        return;
      }
      if (!["AVAILABLE", "NOT_AVAILABLE"].includes(availability)) {
        response
          .status(400)
          .send(
            "Availability must be AVAILABLE or NOT_AVAILABLE (BUSY is system-managed)",
          );
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
  };

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
        response
          .status(400)
          .send("All fields are required: star, skill, message");
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
        userProfile: reviewerAccount.profile || "",
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
        date: formattedDate(),
      });

      response.send(account);
    } catch (error) {
      response.status(500).send("Failed to add review");
    }
  };

  static bookWork = async (request: AuthRequest, response: Response) => {
    try {
      const { client, worker, skill, service, description } = request.body;

      if (!isObjectId(client) || !isObjectId(worker)) {
        response
          .status(400)
          .send(
            "All fields are required: client, worker, skill, service, description",
          );
        return;
      }
      if (!skill || !service || !description) {
        response
          .status(400)
          .send(
            "All fields are required: client, worker, skill, service, description",
          );
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
        response
          .status(400)
          .send("This skill is currently busy and cannot be booked");
        return;
      }

      if (
        workerAccount.availability &&
        workerAccount.availability !== "AVAILABLE"
      ) {
        response
          .status(400)
          .send("This worker is currently not available and cannot be booked");
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
  };

  static aiChatBot = async (request: AuthRequest, response: Response) => {
    try {
      const { input, convo } = request.body;

      const systeminfo = await SystemInfoService.getFirst();

      const residentsInfo = await AccountService.getAccountsForAI();



      const genAI = new GoogleGenerativeAI(
        process.env.CHATBOT_API_KEY ||
          process.env.GEMINI_API_KEY ||
          process.env.GOOGLE_API_KEY ||
          "",
      );

      const model = genAI.getGenerativeModel({
        model:
          (process.env.CHATBOT_MODEL as string) ||
          (process.env.GEMINI_MODEL as string) ||
          "gemini-3.6-flash",
      });

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

            Previous Conversation:
            ${Array.isArray(convo) ? convo.join("\n") : ""}

            User input/user qeustion:
            ${input}
       `;

      const result = await model.generateContent(prompt);
      const aiReply = result.response.text();

      response.send(aiReply);
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

      const genAI = new GoogleGenerativeAI(
        process.env.CHATBOT_API_KEY ||
          process.env.GEMINI_API_KEY ||
          process.env.GOOGLE_API_KEY ||
          "",
      );

      const model = genAI.getGenerativeModel({
        model:
          (process.env.CHATBOT_MODEL as string) ||
          (process.env.GEMINI_MODEL as string) ||
          "gemini-3.6-flash",
      });

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

      response.send(aiReply);
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
  };

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
  };

  static sendEmailOtp = async (request: AuthRequest, response: Response) => {
    try {
      const { email } = request.body || {};

      if (typeof email !== "string" || !email.trim()) {
        response.status(400).send("An email address is required");
        return;
      }
      const domainError = emailDomainError(email);
      if (domainError) {
        response.status(400).send(domainError);
        return;
      }
      // Registration accepts only the same shape, so reuse isEmail as the
      // base structural gate before the stricter domain check above.
      if (!isEmail(email)) {
        response.status(400).send("A valid email address is required");
        return;
      }

      await dispatchEmailOtp(email, response);
    } catch (error) {
      console.error("[SEND-EMAIL-OTP ERROR]", error);
      response.status(500).send("Could not send the verification code");
    }
  };

  static resendEmailOtp = async (request: AuthRequest, response: Response) => {
    try {
      const { email } = request.body || {};

      if (typeof email !== "string" || !email.trim()) {
        response.status(400).send("An email address is required");
        return;
      }
      const domainError = emailDomainError(email);
      if (domainError) {
        response.status(400).send(domainError);
        return;
      }
      if (!isEmail(email)) {
        response.status(400).send("A valid email address is required");
        return;
      }

      await dispatchEmailOtp(email, response);
    } catch (error) {
      console.error("[RESEND-EMAIL-OTP ERROR]", error);
      response.status(500).send("Could not resend the verification code");
    }
  };

  static verifyEmailOtp = async (request: AuthRequest, response: Response) => {
    try {
      const { email, otp } = request.body || {};

      if (emailDomainError(email) || !isEmail(email)) {
        response.status(400).send("A valid email address is required");
        return;
      }
      const normalized = String(email).trim().toLowerCase();

      if (typeof otp !== "string" || !otp.trim()) {
        response.status(400).send("Please enter the verification code");
        return;
      }

      const record = await EmailVerificationService.getByEmail(normalized);

      if (!record || !record.otpHash || !record.otpExpiresAt) {
        response
          .status(400)
          .send("No verification code was found. Please request a new one.");
        return;
      }

      const now = new Date();

      // Temporary hard block after repeated failures.
      if (record.blockedUntil && now < new Date(record.blockedUntil)) {
        const minutes = Math.ceil(
          (new Date(record.blockedUntil).getTime() - now.getTime()) / 60000
        );
        response.status(429).send(
          `Too many failed attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`
        );
        return;
      }

      // Reached the attempt ceiling → lock the address down.
      if ((record.attempts || 0) >= EMAIL_OTP_MAX_ATTEMPTS) {
        const blockedUntil = new Date(
          Date.now() + EMAIL_OTP_BLOCK_MINUTES * 60 * 1000
        );
        await EmailVerificationService.blockEmail(normalized, blockedUntil);
        response.status(429).send(
          `Too many failed attempts. Please try again in ${EMAIL_OTP_BLOCK_MINUTES} minutes.`
        );
        return;
      }

      if (now > new Date(record.otpExpiresAt)) {
        response
          .status(400)
          .send("This code has expired. Please request a new one.");
        return;
      }

      const isMatch = await compareEmailOtp(otp.trim(), record.otpHash);

      if (!isMatch) {
        const attempts = (record.attempts || 0) + 1;
        let blockedUntil: Date | undefined;
        if (attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
          blockedUntil = new Date(
            Date.now() + EMAIL_OTP_BLOCK_MINUTES * 60 * 1000
          );
          await EmailVerificationService.blockEmail(normalized, blockedUntil);
          response.status(429).send(
            `Incorrect verification code. Too many failed attempts — please try again in ${EMAIL_OTP_BLOCK_MINUTES} minutes.`
          );
          return;
        }
        await EmailVerificationService.incrementAttempt(
          normalized,
          attempts
        );
        response.status(400).send(
          `Incorrect verification code. ${EMAIL_OTP_MAX_ATTEMPTS - attempts} attempt${EMAIL_OTP_MAX_ATTEMPTS - attempts === 1 ? "" : "s"} remaining.`
        );
        return;
      }

      await EmailVerificationService.markVerified(normalized);

      response.send({
        verified: true,
        emailToken: signEmailVerificationToken(normalized),
      });
    } catch (error) {
      console.error("[VERIFY-EMAIL-OTP ERROR]", error);
      response
        .status(500)
        .send("Could not verify the code. Please try again.");
    }
  };

  static login = async (request: AuthRequest, response: Response) => {
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

      const account = await AccountService.checkEmailIfExist(
        String(email).trim().toLowerCase(),
      );

      if (!account) {
        response.status(401).send(GENERIC_LOGIN_MSG);
        return;
      }

      const isMatch = await bcrypt.compare(password, account.password);

      if (!isMatch) {
        response.status(401).send(GENERIC_LOGIN_MSG);
        return;
      }

      // Accounts explicitly marked as email-unverified cannot sign in.
      // (Accounts created before email verification existed are left
      // untouched — `undefined` does not block them.)
      // Secretary and super_admin accounts are exempt — their roles are
      // assigned by a trusted super admin, so email ownership proof is
      // not required for staff to log in.
      const accountRole = account.role || "resident";
      if (account.emailVerified === false && !isStaffRole(accountRole)) {
        response
          .status(403)
          .send(
            "Your email address has not been verified. Please verify your email before signing in.",
          );
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
  };

  static forgotPassword = async (request: AuthRequest, response: Response) => {
    try {
      const { email, contact, method } = request.body || {};
      const delivery = method === "sms" ? "sms" : "email";

      let account: any = null;
      if (delivery === "sms") {
        const mobile = normalizePhMobile(contact);
        if (!mobile) {
          response
            .status(400)
            .send(
              "A valid 11-digit Philippine mobile number is required (e.g. 09171234567)",
            );
          return;
        }
        account = await AccountService.checkContactIfExist(mobile);
      } else {
        if (!isEmail(email)) {
          response.status(400).send("A valid email address is required");
          return;
        }
        account = await AccountService.checkEmailIfExist(
          String(email).trim().toLowerCase(),
        );
      }

      // Always respond the same way whether or not the account exists, so this
      // endpoint can't be used to check which emails/numbers are registered.
      if (!account) {
        response.send({
          message: "If that is registered, a reset code has been sent.",
        });
        return;
      }

      const code = generateResetCode();
      const codeHash = await hashResetCode(code);
      const expires = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000);

      await AccountService.setResetCode(
        account._id.toString(),
        codeHash,
        expires,
      );

      if (delivery === "sms") {
        const smsSent = await sendSms(
          account.contact,
          resetCodeSmsMessage(code),
        );
        if (!smsSent) {
          console.warn(
            "[FORGOT-PASSWORD] SMS delivery failed, falling back to email",
          );
          await sendEmail(
            account.email,
            "Your Password Reset Code",
            resetCodeEmailHtml(account.name, code),
          );
        }
      } else {
        await sendEmail(
          account.email,
          "Your Password Reset Code",
          resetCodeEmailHtml(account.name, code),
        );
      }

      response.send({
        message: "If that is registered, a reset code has been sent.",
      });
    } catch (error) {
      console.error("[FORGOT-PASSWORD ERROR]", error);
      response.status(500).send("Password reset request failed");
    }
  };

  static verifyResetCode = async (request: AuthRequest, response: Response) => {
    try {
      const { email, contact, method, code } = request.body || {};
      const delivery = method === "sms" ? "sms" : "email";

      let account: any = null;
      if (delivery === "sms") {
        const mobile = normalizePhMobile(contact);
        if (!mobile) {
          response
            .status(400)
            .send(
              "A valid 11-digit Philippine mobile number is required (e.g. 09171234567)",
            );
          return;
        }
        account = await AccountService.checkContactIfExist(mobile);
      } else {
        if (!isEmail(email)) {
          response.status(400).send("Email and code are required");
          return;
        }
        account = await AccountService.checkEmailIfExist(
          String(email).trim().toLowerCase(),
        );
      }

      if (
        !isNonEmptyString(code) ||
        !account ||
        !account.resetCodeHash ||
        !account.resetCodeExpires
      ) {
        response.status(400).send("Invalid or expired code");
        return;
      }

      if (new Date() > account.resetCodeExpires) {
        response
          .status(400)
          .send("Code has expired. Please request a new one.");
        return;
      }

      const isMatch = await compareResetCode(code, account.resetCodeHash);

      if (!isMatch) {
        response.status(400).send("Invalid or expired code");
        return;
      }

      const resetToken = jwt.sign(
        { id: account._id, purpose: "password_reset" },
        secret,
        { expiresIn: "10m" },
      );

      response.send({ resetToken });
    } catch (error) {
      console.error("[VERIFY-RESET-CODE ERROR]", error);
      response.status(500).send("Could not verify reset code");
    }
  };

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

      const decoded = jwt.verify(resetToken, secret) as {
        id: string;
        purpose: string;
      };

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
  };
}
