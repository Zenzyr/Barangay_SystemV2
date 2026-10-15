import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AccountController } from "../controller/accounts.controller";
import AccountModel from "../model/account.model";
import { sendEmail } from "../utils/email";
import { sendSms } from "../utils/sms";
import { PHONE_VERIFY_GENERIC_ERROR } from "../utils/passwordReset";

jest.mock("../utils/email", () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));
jest.mock("../utils/sms", () => ({
  sendSms: jest.fn().mockResolvedValue(true),
  sendNotification: jest.fn().mockResolvedValue(true),
}));
// Fix the generated reset code so verification can be driven deterministically.
jest.mock("../utils/passwordReset", () => {
  const actual = jest.requireActual("../utils/passwordReset");
  return { ...actual, generateResetCode: jest.fn(() => "123456") };
});

const EMAIL = "resetflow@example.com";
const CONTACT = "09171234567";
const PASSWORD = "Password123!";
const SECRET = process.env.JWT_SECRET as string;
const MASKED = "09*******67";

const mockEmail = sendEmail as jest.Mock;
const mockSms = sendSms as jest.Mock;

function makeReq(body: Record<string, unknown>) {
  return { body, headers: {}, ip: "10.0.0.1", socket: {} } as any;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

async function seed(overrides: Record<string, unknown> = {}) {
  return AccountModel.create({
    name: "Reset User",
    email: EMAIL,
    contact: CONTACT,
    password: await bcrypt.hash(PASSWORD, 10),
    status: "approved",
    role: "resident",
    emailVerified: true,
    ...overrides,
  });
}

async function issuePhoneToken(): Promise<string> {
  const res = makeRes();
  await AccountController.verifyForgotPhone(
    makeReq({ email: EMAIL, phone: CONTACT }),
    res,
  );
  return res.send.mock.calls[0][0].phoneToken as string;
}

async function issueResetToken(): Promise<string> {
  // Email reset needs no phone token — it delivers to the registered email.
  await AccountController.forgotPassword(
    makeReq({ method: "email", email: EMAIL }),
    makeRes(),
  );
  const verifyRes = makeRes();
  await AccountController.verifyResetCode(
    makeReq({ email: EMAIL, method: "email", code: "123456" }),
    verifyRes,
  );
  return verifyRes.send.mock.calls[0][0].resetToken as string;
}

beforeEach(() => {
  mockEmail.mockClear();
  mockSms.mockClear();
  mockEmail.mockResolvedValue(true);
  mockSms.mockResolvedValue(true);
});

describe("phone challenge", () => {
  it("returns the registered mobile in masked form only", async () => {
    await seed();
    const res = makeRes();
    await AccountController.forgotPasswordPhoneChallenge(
      makeReq({ email: EMAIL }),
      res,
    );
    expect(res.send).toHaveBeenCalledWith({ maskedPhone: MASKED });
    expect(JSON.stringify(res.send.mock.calls[0][0])).not.toContain(CONTACT);
  });

  it("returns a null mask for an unknown email (no enumeration)", async () => {
    const res = makeRes();
    await AccountController.forgotPasswordPhoneChallenge(
      makeReq({ email: "nobody@example.com" }),
      res,
    );
    expect(res.send).toHaveBeenCalledWith({ maskedPhone: null });
  });

  it("rejects a malformed email with 400", async () => {
    const res = makeRes();
    await AccountController.forgotPasswordPhoneChallenge(
      makeReq({ email: "not-an-email" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("phone verification", () => {
  it("issues a phone_verification token when the full number matches", async () => {
    const account = await seed();
    const res = makeRes();
    await AccountController.verifyForgotPhone(
      makeReq({ email: EMAIL, phone: CONTACT }),
      res,
    );
    const payload = res.send.mock.calls[0][0];
    expect(typeof payload.phoneToken).toBe("string");
    const decoded = jwt.verify(payload.phoneToken, SECRET) as any;
    expect(decoded.purpose).toBe("phone_verification");
    expect(decoded.id).toBe(account._id.toString());
  });

  it("accepts +63 / 63 / 09 and separator formats via normalization", async () => {
    await seed();
    for (const variant of [
      "+639171234567",
      "639171234567",
      "09171234567",
      "0917 123 4567",
      "0917-123-4567",
    ]) {
      const res = makeRes();
      await AccountController.verifyForgotPhone(
        makeReq({ email: EMAIL, phone: variant }),
        res,
      );
      expect(typeof res.send.mock.calls[0][0].phoneToken).toBe("string");
      expect(res.status).not.toHaveBeenCalledWith(400);
    }
  });

  it("rejects a full number that does not match, and counts the attempt", async () => {
    await seed();
    const res = makeRes();
    await AccountController.verifyForgotPhone(
      makeReq({ email: EMAIL, phone: "09171234500" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(PHONE_VERIFY_GENERIC_ERROR);

    const account = await AccountModel.findOne({ email: EMAIL });
    expect(account!.phoneVerifyAttempts).toBe(1);
    expect(account!.phoneVerifyBlockedUntil).toBeFalsy();
  });

  it("rejects malformed input without counting an attempt", async () => {
    await seed();
    const res = makeRes();
    await AccountController.verifyForgotPhone(
      makeReq({ email: EMAIL, phone: "0917" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(PHONE_VERIFY_GENERIC_ERROR);

    const account = await AccountModel.findOne({ email: EMAIL });
    expect(account!.phoneVerifyAttempts || 0).toBe(0);
  });

  it("does not reveal account state for an unknown email", async () => {
    const res = makeRes();
    await AccountController.verifyForgotPhone(
      makeReq({ email: "nobody@example.com", phone: CONTACT }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(PHONE_VERIFY_GENERIC_ERROR);
  });

  it("locks for 15 minutes after five failed attempts", async () => {
    await seed();
    for (let i = 0; i < 5; i++) {
      await AccountController.verifyForgotPhone(
        makeReq({ email: EMAIL, phone: "09171234500" }),
        makeRes(),
      );
    }
    const account = await AccountModel.findOne({ email: EMAIL });
    expect(account!.phoneVerifyAttempts).toBe(5);
    expect(account!.phoneVerifyBlockedUntil).toBeTruthy();
    expect(new Date(account!.phoneVerifyBlockedUntil!).getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it("keeps the lock even with the correct number, and further requests cannot bypass it", async () => {
    await seed();
    for (let i = 0; i < 5; i++) {
      await AccountController.verifyForgotPhone(
        makeReq({ email: EMAIL, phone: "09171234500" }),
        makeRes(),
      );
    }
    const locked = await AccountModel.findOne({ email: EMAIL });

    // The correct number while locked is still rejected generically.
    const correctRes = makeRes();
    await AccountController.verifyForgotPhone(
      makeReq({ email: EMAIL, phone: CONTACT }),
      correctRes,
    );
    expect(correctRes.status).toHaveBeenCalledWith(400);
    expect(correctRes.send).toHaveBeenCalledWith(PHONE_VERIFY_GENERIC_ERROR);

    // More requests do not clear or shorten the lock.
    await AccountController.verifyForgotPhone(
      makeReq({ email: EMAIL, phone: CONTACT }),
      makeRes(),
    );
    const after = await AccountModel.findOne({ email: EMAIL });
    expect(after!.phoneVerifyBlockedUntil!.getTime()).toBe(
      new Date(locked!.phoneVerifyBlockedUntil!).getTime(),
    );
  });

  it("clears earlier failed attempts after a successful verification", async () => {
    await seed();
    await AccountController.verifyForgotPhone(
      makeReq({ email: EMAIL, phone: "09171234500" }),
      makeRes(),
    );
    await AccountController.verifyForgotPhone(
      makeReq({ email: EMAIL, phone: CONTACT }),
      makeRes(),
    );
    const account = await AccountModel.findOne({ email: EMAIL });
    expect(account!.phoneVerifyAttempts || 0).toBe(0);
    expect(account!.phoneVerifyBlockedUntil).toBeFalsy();
  });

  it("allows a fresh set of attempts after the lock window has expired", async () => {
    const account = await seed({
      phoneVerifyAttempts: 5,
      phoneVerifyBlockedUntil: new Date(Date.now() - 60 * 1000),
    });
    const res = makeRes();
    await AccountController.verifyForgotPhone(
      makeReq({ email: EMAIL, phone: CONTACT }),
      res,
    );
    expect(typeof res.send.mock.calls[0][0].phoneToken).toBe("string");
    expect(res.status).not.toHaveBeenCalledWith(400);

    const after = await AccountModel.findById(account._id);
    expect(after!.phoneVerifyAttempts || 0).toBe(0);
  });
});

describe("method separation", () => {
  it("email selection sends email only, without a phone token", async () => {
    await seed();
    const res = makeRes();
    await AccountController.forgotPassword(
      makeReq({ method: "email", email: EMAIL }),
      res,
    );
    expect(mockEmail).toHaveBeenCalledTimes(1);
    expect(mockSms).not.toHaveBeenCalled();
    const account = await AccountModel.findOne({ email: EMAIL });
    expect(account!.resetCodeHash).toBeTruthy();
    expect(account!.resetCodeMethod).toBe("email");
  });

  it("email selection delivers to the registered address, not a supplied one", async () => {
    await seed();
    const res = makeRes();
    await AccountController.forgotPassword(
      makeReq({ method: "email", email: EMAIL }),
      res,
    );
    expect(mockEmail.mock.calls[0][0]).toBe(EMAIL);
  });

  it("email selection works for accounts without a registered mobile", async () => {
    await seed({ contact: "" });
    const res = makeRes();
    await AccountController.forgotPassword(
      makeReq({ method: "email", email: EMAIL }),
      res,
    );
    expect(mockEmail).toHaveBeenCalledTimes(1);
    expect(mockSms).not.toHaveBeenCalled();
  });

  it("email selection is generic and silent for an unknown email", async () => {
    const res = makeRes();
    await AccountController.forgotPassword(
      makeReq({ method: "email", email: "nobody@example.com" }),
      res,
    );
    expect(mockEmail).not.toHaveBeenCalled();
    expect(mockSms).not.toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledWith({
      message: "If that is registered, a reset code has been sent.",
    });
  });

  it("email selection is silent for an unverified resident", async () => {
    await seed({ emailVerified: false });
    const res = makeRes();
    await AccountController.forgotPassword(
      makeReq({ method: "email", email: EMAIL }),
      res,
    );
    expect(mockEmail).not.toHaveBeenCalled();
    const account = await AccountModel.findOne({ email: EMAIL });
    expect(account!.resetCodeHash).toBeFalsy();
  });

  it("sms selection sends SMS only, after a valid phone token", async () => {
    await seed();
    const phoneToken = await issuePhoneToken();
    const res = makeRes();
    await AccountController.forgotPassword(
      makeReq({ method: "sms", email: EMAIL, phoneToken }),
      res,
    );
    expect(mockSms).toHaveBeenCalledTimes(1);
    expect(mockEmail).not.toHaveBeenCalled();
    const account = await AccountModel.findOne({ email: EMAIL });
    expect(account!.resetCodeHash).toBeTruthy();
    expect(account!.resetCodeMethod).toBe("sms");
  });

  it("sms selection without a phone token is rejected without sending", async () => {
    await seed();
    const res = makeRes();
    await AccountController.forgotPassword(
      makeReq({ method: "sms", email: EMAIL }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockSms).not.toHaveBeenCalled();
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it("rejects an expired phone token without sending", async () => {
    const account = await seed();
    const expired = jwt.sign(
      { id: account._id.toString(), purpose: "phone_verification" },
      SECRET,
      { expiresIn: -10 },
    );
    const res = makeRes();
    await AccountController.forgotPassword(
      makeReq({ method: "sms", email: EMAIL, phoneToken: expired }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockSms).not.toHaveBeenCalled();
  });

  it("rejects an invalid or missing method", async () => {
    await seed();
    for (const method of [undefined, "", "whatsapp", "telegram", 7]) {
      const res = makeRes();
      await AccountController.forgotPassword(
        makeReq({ method, email: EMAIL }),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockEmail).not.toHaveBeenCalled();
      expect(mockSms).not.toHaveBeenCalled();
    }
  });

  it("does not fall back to email when SMS delivery fails", async () => {
    await seed();
    const phoneToken = await issuePhoneToken();
    mockSms.mockResolvedValue(false);
    const res = makeRes();
    await AccountController.forgotPassword(
      makeReq({ method: "sms", email: EMAIL, phoneToken }),
      res,
    );
    expect(mockSms).toHaveBeenCalledTimes(1);
    expect(mockEmail).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(502);
    // The undelivered code is cleared so it cannot be redeemed.
    const account = await AccountModel.findOne({ email: EMAIL });
    expect(account!.resetCodeHash).toBeFalsy();
  });

  it("does not fall back to SMS when email delivery fails", async () => {
    await seed();
    mockEmail.mockResolvedValue(false);
    const res = makeRes();
    await AccountController.forgotPassword(
      makeReq({ method: "email", email: EMAIL }),
      res,
    );
    expect(mockEmail).toHaveBeenCalledTimes(1);
    expect(mockSms).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(502);
    const account = await AccountModel.findOne({ email: EMAIL });
    expect(account!.resetCodeHash).toBeFalsy();
  });
});

describe("reset code and single-use token", () => {
  it("rejects an invalid method in verify-reset-code", async () => {
    await seed();
    await AccountController.forgotPassword(
      makeReq({ method: "email", email: EMAIL }),
      makeRes(),
    );
    const res = makeRes();
    await AccountController.verifyResetCode(
      makeReq({ email: EMAIL, method: "carrier-pigeon", code: "123456" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send.mock.calls[0][0].resetToken).toBeUndefined();
  });

  it("rejects a code redeemed through the other channel", async () => {
    await seed();
    // Issue via email, then try to verify it as if it were an SMS code.
    await AccountController.forgotPassword(
      makeReq({ method: "email", email: EMAIL }),
      makeRes(),
    );
    const res = makeRes();
    await AccountController.verifyResetCode(
      makeReq({ email: EMAIL, method: "sms", code: "123456" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send.mock.calls[0][0].resetToken).toBeUndefined();

    // The same code still works through its own (email) channel.
    const ok = makeRes();
    await AccountController.verifyResetCode(
      makeReq({ email: EMAIL, method: "email", code: "123456" }),
      ok,
    );
    expect(typeof ok.send.mock.calls[0][0].resetToken).toBe("string");
  });

  it("verifies a code delivered by SMS through the SMS channel", async () => {
    await seed();
    const phoneToken = await issuePhoneToken();
    await AccountController.forgotPassword(
      makeReq({ method: "sms", email: EMAIL, phoneToken }),
      makeRes(),
    );
    const res = makeRes();
    await AccountController.verifyResetCode(
      makeReq({ email: EMAIL, method: "sms", code: "123456" }),
      res,
    );
    expect(typeof res.send.mock.calls[0][0].resetToken).toBe("string");
  });

  it("does not issue a reset token for an incorrect code", async () => {
    await seed();
    await AccountController.forgotPassword(
      makeReq({ method: "email", email: EMAIL }),
      makeRes(),
    );
    const res = makeRes();
    await AccountController.verifyResetCode(
      makeReq({ email: EMAIL, method: "email", code: "000000" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send.mock.calls[0][0].resetToken).toBeUndefined();
  });

  it("issues a token for the correct code and consumes the code (single-use)", async () => {
    await seed();
    await AccountController.forgotPassword(
      makeReq({ method: "email", email: EMAIL }),
      makeRes(),
    );

    const res = makeRes();
    await AccountController.verifyResetCode(
      makeReq({ email: EMAIL, method: "email", code: "123456" }),
      res,
    );
    expect(typeof res.send.mock.calls[0][0].resetToken).toBe("string");

    // The code is now cleared, so the same code cannot be used again.
    const reuse = makeRes();
    await AccountController.verifyResetCode(
      makeReq({ email: EMAIL, method: "email", code: "123456" }),
      reuse,
    );
    expect(reuse.status).toHaveBeenCalledWith(400);
  });

  it("resets the password once and rejects replay of the same token", async () => {
    await seed();
    const resetToken = await issueResetToken();

    const res = makeRes();
    await AccountController.resetPassword(
      makeReq({ resetToken, newPassword: "NewPassword123!" }),
      res,
    );
    expect(res.send).toHaveBeenCalledWith({
      message: "Password reset successfully",
    });

    const account = await AccountModel.findOne({ email: EMAIL });
    expect(await bcrypt.compare("NewPassword123!", account!.password)).toBe(true);

    // Replaying the same token must fail.
    const replay = makeRes();
    await AccountController.resetPassword(
      makeReq({ resetToken, newPassword: "Another123!" }),
      replay,
    );
    expect(replay.status).toHaveBeenCalledWith(401);
  });

  it("rejects an expired reset token", async () => {
    const account = await seed();
    const expired = jwt.sign(
      { id: account._id.toString(), purpose: "password_reset", jti: "abc" },
      SECRET,
      { expiresIn: -10 },
    );
    const res = makeRes();
    await AccountController.resetPassword(
      makeReq({ resetToken: expired, newPassword: "NewPassword123!" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
