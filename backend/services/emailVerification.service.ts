import EmailVerificationModel from "../model/emailVerification.model";

export class EmailVerificationService {
  static async getByEmail(email: string) {
    return await EmailVerificationModel.findOne({ email }).lean();
  }

  static async upsertOtp(
    email: string,
    otpHash: string,
    otpExpiresAt: Date,
    resendCooldownUntil: Date
  ) {
    return await EmailVerificationModel.findOneAndUpdate(
      { email },
      {
        $set: {
          otpHash,
          otpExpiresAt,
          resendCooldownUntil,
          attempts: 0,
          $unset: { blockedUntil: "" },
        },
      },
      { new: true, upsert: true }
    );
  }

  static async incrementAttempt(
    email: string,
    attempts: number,
    blockedUntil?: Date
  ) {
    const update: Record<string, any> = { $set: { attempts } };
    if (blockedUntil) update.$set.blockedUntil = blockedUntil;
    return await EmailVerificationModel.findOneAndUpdate({ email }, update, {
      new: true,
    });
  }

  static async blockEmail(email: string, blockedUntil: Date) {
    return await EmailVerificationModel.findOneAndUpdate(
      { email },
      { $set: { blockedUntil }, $unset: { otpHash: "", otpExpiresAt: "" } },
      { new: true }
    );
  }

  static async markVerified(email: string) {
    return await EmailVerificationModel.findOneAndUpdate(
      { email },
      {
        $set: { verified: true, verifiedAt: new Date() },
        $unset: {
          otpHash: "",
          otpExpiresAt: "",
          attempts: "",
          resendCooldownUntil: "",
          blockedUntil: "",
        },
      },
      { new: true }
    );
  }
}