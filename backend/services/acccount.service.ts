import AccountModel from "../model/account.model"
import { accountInterface, accountInterfaceInput } from "../types/accounts.type";
import { ROLES } from "../utils/roles";
import { phMobileMatchRegex } from "../utils/validation";


export class AccountService {

  static async create(data : accountInterfaceInput) {
    return await AccountModel.create(data)
  }

  static async getAll(filter: Record<string, any> = {}) {
    return await AccountModel.find(filter).select('-password');
  }

  static async get(id : string) {
    return await AccountModel.findById(id);
  }

  static async getProfile(id: string) {
    return await AccountModel.findById(id).select('-password');
  }

  static async addSkill(id: string, skill: { skill: string; experience: number; proficiency: string; serviceTypes?: string[] }) {
    return await AccountModel.findByIdAndUpdate(
      id,
      { $push: { skills: skill } },
      { new: true }
    ).select('-password');
  }

  static async removeSkill(id: string, skillId: string) {
    return await AccountModel.findByIdAndUpdate(
      id,
      { $pull: { skills: { _id: skillId } } },
      { new: true }
    ).select('-password');
  }

  static async delete(id : string) {
    return await AccountModel.findByIdAndDelete(id);
  }

  static async update(id : string, data : Partial<accountInterface>) {
    return await AccountModel.findByIdAndUpdate(id, data, { new: true });
  }

  static async updateStatus(id: string, status: string) {
    return await AccountModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
  }

  /** Race-safe status change: only applies when the status is still `fromStatus`. */
  static async updateStatusIf(id: string, fromStatus: string, status: string) {
    return await AccountModel.findOneAndUpdate(
      { _id: id, status: fromStatus },
      { $set: { status } },
      { new: true }
    ).select("-password");
  }

  static async updateRole(id: string, role: string) {
    return await AccountModel.findByIdAndUpdate(
      id,
      { role },
      { new: true }
    );
  }

  /** Race-safe role change: only applies when the role is still `fromRole`. */
  static async updateRoleIf(id: string, fromRole: string, role: string) {
    return await AccountModel.findOneAndUpdate(
      { _id: id, role: fromRole },
      { $set: { role } },
      { new: true }
    ).select("-password");
  }

  /** Succeeds only when the account is not already suspended. */
  static async suspendIf(id: string, suspendedBy: string, reason: string) {
    return await AccountModel.findOneAndUpdate(
      { _id: id, isSuspended: { $ne: true } },
      {
        $set: {
          isSuspended: true,
          suspendedAt: new Date(),
          suspendedBy,
          suspensionReason: reason,
        },
      },
      { new: true }
    ).select("-password");
  }

  /** Succeeds only when the account is currently suspended. */
  static async unsuspendIf(id: string) {
    return await AccountModel.findOneAndUpdate(
      { _id: id, isSuspended: true },
      {
        $set: { isSuspended: false, suspendedBy: "", suspensionReason: "" },
        $unset: { suspendedAt: "" },
      },
      { new: true }
    ).select("-password");
  }

  static async countByRole(role: string) {
    return await AccountModel.countDocuments({ role });
  }

  static async checkEmailIfExist(email : string) {
    return await AccountModel.findOne({ email });
  }

  static async checkContactIfExist(contact : string) {
    const regex = phMobileMatchRegex(contact);
    if (!regex) return null;
    return await AccountModel.findOne({ contact: { $regex: regex } });
  }

  /** All accounts holding a phone number, matching any stored format (09xx, 639xx, +63…, separators). */
  static async findAccountsByContact(contact : string) {
    const regex = phMobileMatchRegex(contact);
    if (!regex) return [];
    return await AccountModel.find({ contact: { $regex: regex } });
  }

  static async setResetCode(
    id: string,
    resetCodeHash: string,
    resetCodeExpires: Date,
    resetCodeCooldownUntil: Date,
    resetCodeMethod: "email" | "sms",
  ) {
    return await AccountModel.findByIdAndUpdate(id, {
      $set: {
        resetCodeHash,
        resetCodeExpires,
        resetCodeCooldownUntil,
        resetCodeMethod,
        resetAttempts: 0,
      },
    }, { new: true });
  }

  static async incrementResetAttempt(id: string, attempts: number, blockedUntil?: Date) {
    const update: Record<string, any> = { $set: { resetAttempts: attempts } };
    if (blockedUntil) update.$set.resetBlockedUntil = blockedUntil;
    return await AccountModel.findByIdAndUpdate(id, update, { new: true });
  }

  static async blockResetCode(id: string, blockedUntil: Date) {
    return await AccountModel.findByIdAndUpdate(id, {
      $set: { resetBlockedUntil: blockedUntil },
      $unset: { resetCodeHash: "", resetCodeExpires: "" },
    }, { new: true });
  }

  static async clearResetCode(id: string) {
    return await AccountModel.findByIdAndUpdate(id, { $unset: { resetCodeHash: "", resetCodeExpires: "", resetCodeCooldownUntil: "", resetCodeMethod: "" } }, { new: true });
  }

  /** Records failed attempts for the phone-verification pre-step. */
  static async setPhoneVerifyAttempts(id: string, attempts: number) {
    return await AccountModel.findByIdAndUpdate(
      id,
      { $set: { phoneVerifyAttempts: attempts } },
      { new: true },
    );
  }

  /** Locks the phone-verification pre-step for the given window. */
  static async blockPhoneVerify(id: string, blockedUntil: Date, attempts?: number) {
    const update: Record<string, any> = {
      $set: { phoneVerifyBlockedUntil: blockedUntil },
    };
    if (typeof attempts === "number") update.$set.phoneVerifyAttempts = attempts;
    return await AccountModel.findByIdAndUpdate(id, update, { new: true });
  }

  /** Clears the phone-verification counters after a successful check. */
  static async clearPhoneVerify(id: string) {
    return await AccountModel.findByIdAndUpdate(
      id,
      { $unset: { phoneVerifyAttempts: "", phoneVerifyBlockedUntil: "" } },
      { new: true },
    );
  }

  /** Stores the single-use password-reset token fingerprint for an account. */
  static async setResetToken(id: string, resetTokenHash: string, resetTokenExpires: Date) {
    return await AccountModel.findByIdAndUpdate(
      id,
      { $set: { resetTokenHash, resetTokenExpires } },
      { new: true },
    );
  }

  /** Consumes the single-use password-reset token. */
  static async clearResetToken(id: string) {
    return await AccountModel.findByIdAndUpdate(
      id,
      { $unset: { resetTokenHash: "", resetTokenExpires: "" } },
      { new: true },
    );
  }

  /**
   * Reads an account including the 2FA secret fields, which the schema hides
   * from normal queries (`select: false`). Only the 2FA code paths should use
   * this — never send its result directly to a client.
   */
  static async getWithTwoFactorSecrets(id: string) {
    return await AccountModel.findById(id).select(
      "+twoFactorOtpHash +twoFactorRecoveryHashes",
    );
  }

  /** Stores a freshly-generated 2FA OTP, resetting attempt counters. */
  static async setTwoFactorOtp(
    id: string,
    twoFactorOtpHash: string,
    twoFactorOtpExpires: Date,
    twoFactorOtpCooldownUntil: Date,
  ) {
    return await AccountModel.findByIdAndUpdate(
      id,
      {
        $set: {
          twoFactorOtpHash,
          twoFactorOtpExpires,
          twoFactorOtpCooldownUntil,
          twoFactorOtpAttempts: 0,
        },
        $unset: { twoFactorOtpBlockedUntil: "" },
      },
      { new: true },
    );
  }

  /** Clears the live 2FA OTP after success (or when enabling). */
  static async clearTwoFactorOtp(id: string) {
    return await AccountModel.findByIdAndUpdate(
      id,
      {
        $unset: {
          twoFactorOtpHash: "",
          twoFactorOtpExpires: "",
          twoFactorOtpCooldownUntil: "",
          twoFactorOtpAttempts: "",
          twoFactorOtpBlockedUntil: "",
        },
      },
      { new: true },
    );
  }

  /** Increments the failed 2FA attempt counter, optionally locking the account. */
  static async registerTwoFactorFailure(
    id: string,
    attempts: number,
    blockedUntil?: Date,
  ) {
    const update: Record<string, any> = { $set: { twoFactorOtpAttempts: attempts } };
    if (blockedUntil) update.$set.twoFactorOtpBlockedUntil = blockedUntil;
    return await AccountModel.findByIdAndUpdate(id, update, { new: true });
  }

  /** Clears the 2FA failed-attempt counters after a success or lock expiry. */
  static async clearTwoFactorFailures(id: string) {
    return await AccountModel.findByIdAndUpdate(
      id,
      { $unset: { twoFactorOtpAttempts: "", twoFactorOtpBlockedUntil: "" } },
      { new: true },
    );
  }

  /** Turns 2FA on with a new set of recovery-code hashes. */
  static async enableTwoFactor(id: string, recoveryHashes: string[]) {
    return await AccountModel.findByIdAndUpdate(
      id,
      {
        $set: {
          twoFactorEnabled: true,
          twoFactorRecoveryHashes: recoveryHashes,
          twoFactorRecoveryUpdatedAt: new Date(),
        },
        $unset: {
          twoFactorOtpHash: "",
          twoFactorOtpExpires: "",
          twoFactorOtpCooldownUntil: "",
          twoFactorOtpAttempts: "",
          twoFactorOtpBlockedUntil: "",
        },
      },
      { new: true },
    );
  }

  /** Turns 2FA off and removes all of its stored state. */
  static async disableTwoFactor(id: string) {
    return await AccountModel.findByIdAndUpdate(
      id,
      {
        $set: { twoFactorEnabled: false },
        $unset: {
          twoFactorOtpHash: "",
          twoFactorOtpExpires: "",
          twoFactorOtpCooldownUntil: "",
          twoFactorOtpAttempts: "",
          twoFactorOtpBlockedUntil: "",
          twoFactorRecoveryHashes: "",
          twoFactorRecoveryUpdatedAt: "",
        },
      },
      { new: true },
    );
  }

  /** Replaces the stored recovery-code hashes (regeneration, or code used up). */
  static async setRecoveryHashes(id: string, recoveryHashes: string[]) {
    return await AccountModel.findByIdAndUpdate(
      id,
      {
        $set: {
          twoFactorRecoveryHashes: recoveryHashes,
          twoFactorRecoveryUpdatedAt: new Date(),
        },
      },
      { new: true },
    );
  }

  static async updatePassword(id: string, hashedPassword: string) {
    return await AccountModel.findByIdAndUpdate(id, { password: hashedPassword }, { new: true });
  }

  /** Records the fingerprint of a successful sign-in for new-device detection. */
  static async recordLogin(id: string, data: { at: Date; ip: string; userAgent: string }) {
    return await AccountModel.findByIdAndUpdate(
      id,
      {
        $set: {
          lastLoginAt: data.at,
          lastLoginIp: data.ip,
          lastLoginUserAgent: data.userAgent,
        },
      },
      { new: true },
    ).select("-password");
  }

  static async getResidentsWithSkills(filter: { skill?: string; serviceType?: string; availability?: string; location?: string; search?: string } = {}) {
    const query: Record<string, any> = { status: 'approved' };

    // Barangay staff accounts are not service marketplace providers.
    query.role = { $nin: [ROLES.SECRETARY, ROLES.SUPER_ADMIN, ROLES.TREASURER] };

    if (filter.availability) query.availability = filter.availability;
    if (filter.location) query.providerLocation = { $regex: filter.location, $options: "i" };

    if (filter.skill) {
      query["skills.skill"] = { $regex: filter.skill, $options: "i" };
    }
    if (filter.serviceType) {
      query["skills.serviceTypes"] = { $regex: filter.serviceType, $options: "i" };
    }
    if (filter.search) {
      query.$or = [
        { name: { $regex: filter.search, $options: "i" } },
        { "skills.skill": { $regex: filter.search, $options: "i" } },
        { "skills.serviceTypes": { $regex: filter.search, $options: "i" } },
      ];
    }

    // Project to public marketplace fields only: never leak ID images,
    // hashes, census links or registration internals to resident clients.
    const accounts = await AccountModel.find(query)
      .select(
        "name nickname profile email contact address purok providerLocation providerDescription availability completedServices skills reviews status role",
      )
      .lean();

    return accounts.map((account) => {
      const reviews = account.reviews || [];
      const averageRating = reviews.length
        ? reviews.reduce((sum, r) => sum + r.star, 0) / reviews.length
        : 0;
      return {
        ...account,
        averageRating: Math.round(averageRating * 10) / 10,
        totalReviews: reviews.length,
      };
    });
  }

  static async updateAvailability(id: string, availability: "AVAILABLE" | "BUSY" | "NOT_AVAILABLE") {
    return await AccountModel.findByIdAndUpdate(id, { availability }, { new: true }).select('-password');
  }

  static async incrementCompletedServices(id: string) {
    return await AccountModel.findByIdAndUpdate(id, { $inc: { completedServices: 1 } }, { new: true });
  }

  static async addReview(id: string, review: {
    user: string;
    userProfile: string;
    star: number;
    skill: string;
    message: string;
  }) {
    return await AccountModel.findByIdAndUpdate(
      id,
      { $push: { reviews: review } },
      { new: true }
    ).select('-password');
  }

  static async getAccountsForAI() {
    const accounts = await AccountModel.find({ role: "resident", status: "approved", isSuspended: { $ne: true } })
      .select("name email contact skills")
      .lean();

    return JSON.stringify(accounts, null, 2);
  }

}
