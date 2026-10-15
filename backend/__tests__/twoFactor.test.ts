import bcrypt from "bcrypt";
import { AccountController } from "../controller/accounts.controller";
import AccountModel from "../model/account.model";
import { sendEmail } from "../utils/email";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  TWO_FA_MAX_ATTEMPTS,
} from "../utils/twoFactor";

jest.mock("../utils/email", () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

const EMAIL = "twofactor@example.com";
const PASSWORD = "Password123!";

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function loginReq() {
  return {
    body: { email: EMAIL, password: PASSWORD },
    headers: { "user-agent": "UA-Chrome" },
    ip: "10.0.0.1",
    socket: {},
  } as any;
}

function verifyReq(twoFactorToken: string, code: string) {
  return {
    body: { twoFactorToken, code },
    headers: { "user-agent": "UA-Chrome" },
    ip: "10.0.0.1",
    socket: {},
  } as any;
}

function authReq(accountId: string, body: Record<string, unknown> = {}) {
  return {
    account: { _id: accountId },
    body,
    headers: { "user-agent": "UA-Chrome" },
    ip: "10.0.0.1",
    socket: {},
  } as any;
}

// Pulls the 6-digit code out of the most recent mocked verification email.
function emailedCode(): string {
  const calls = (sendEmail as jest.Mock).mock.calls;
  const html = String(calls[calls.length - 1][2]);
  const match = html.match(/>\s*(\d{6})\s*</);
  if (!match) throw new Error("No code found in the last email");
  return match[1];
}

async function seedAccount(extra: Record<string, unknown> = {}) {
  return AccountModel.create({
    name: "Test User",
    email: EMAIL,
    contact: "09171234567",
    password: await bcrypt.hash(PASSWORD, 10),
    status: "approved",
    role: "resident",
    emailVerified: true,
    ...extra,
  });
}

describe("two-factor authentication", () => {
  beforeEach(() => {
    (sendEmail as jest.Mock).mockClear();
    (sendEmail as jest.Mock).mockResolvedValue(true);
  });

  describe("login gating", () => {
    it("issues a session directly when 2FA is disabled", async () => {
      await seedAccount();
      const res = makeRes();
      await AccountController.login(loginReq(), res);

      const payload = res.send.mock.calls[0][0];
      expect(payload.token).toBeTruthy();
      expect(payload.twoFactorRequired).toBeUndefined();
    });

    it("requires a code and withholds the token when 2FA is enabled", async () => {
      const seeded = await seedAccount({ twoFactorEnabled: true });
      const res = makeRes();
      await AccountController.login(loginReq(), res);

      const payload = res.send.mock.calls[0][0];
      expect(payload.twoFactorRequired).toBe(true);
      expect(payload.twoFactorToken).toBeTruthy();
      expect(payload.token).toBeUndefined();
      expect(String(payload.email)).toContain("@example.com");
      expect(sendEmail).toHaveBeenCalled();

      // The OTP is stored hashed, not in plaintext.
      const account = await AccountModel.findById(seeded._id).select(
        "+twoFactorOtpHash",
      );
      expect(account!.twoFactorOtpHash).toBeTruthy();
    });
  });

  describe("verifyLoginTwoFactor", () => {
    it("completes login with the emailed code", async () => {
      await seedAccount({ twoFactorEnabled: true });
      const loginRes = makeRes();
      await AccountController.login(loginReq(), loginRes);
      const { twoFactorToken } = loginRes.send.mock.calls[0][0];
      const code = emailedCode();

      const res = makeRes();
      await AccountController.verifyLoginTwoFactor(
        verifyReq(twoFactorToken, code),
        res,
      );

      const payload = res.send.mock.calls[0][0];
      expect(payload.token).toBeTruthy();
      expect(payload.account.twoFactorEnabled).toBe(true);
      // Secrets never leave the server.
      expect(payload.account.twoFactorOtpHash).toBeUndefined();
      expect(payload.account.twoFactorRecoveryHashes).toBeUndefined();
    });

    it("rejects a wrong code and decrements the attempts", async () => {
      await seedAccount({ twoFactorEnabled: true });
      const loginRes = makeRes();
      await AccountController.login(loginReq(), loginRes);
      const { twoFactorToken } = loginRes.send.mock.calls[0][0];
      const realCode = emailedCode();
      const wrongCode = realCode === "000000" ? "111111" : "000000";

      const res = makeRes();
      await AccountController.verifyLoginTwoFactor(
        verifyReq(twoFactorToken, wrongCode),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      const payload = res.send.mock.calls[0][0];
      expect(payload.attemptsRemaining).toBe(TWO_FA_MAX_ATTEMPTS - 1);
    });

    it("locks the account after too many wrong codes", async () => {
      await seedAccount({ twoFactorEnabled: true });
      const loginRes = makeRes();
      await AccountController.login(loginReq(), loginRes);
      const { twoFactorToken } = loginRes.send.mock.calls[0][0];
      const realCode = emailedCode();
      const wrongCode = realCode === "000000" ? "111111" : "000000";

      for (let i = 0; i < TWO_FA_MAX_ATTEMPTS; i++) {
        await AccountController.verifyLoginTwoFactor(
          verifyReq(twoFactorToken, wrongCode),
          makeRes(),
        );
      }

      const res = makeRes();
      await AccountController.verifyLoginTwoFactor(
        verifyReq(twoFactorToken, wrongCode),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.send.mock.calls[0][0].locked).toBe(true);
    });

    it("accepts a recovery code and consumes it", async () => {
      const seeded = await seedAccount({ twoFactorEnabled: true });
      const recoveryCodes = generateRecoveryCodes(2);
      const hashes = await Promise.all(recoveryCodes.map(hashRecoveryCode));
      await AccountModel.findByIdAndUpdate(seeded._id, {
        $set: { twoFactorRecoveryHashes: hashes },
      });

      const loginRes = makeRes();
      await AccountController.login(loginReq(), loginRes);
      const { twoFactorToken } = loginRes.send.mock.calls[0][0];

      const first = makeRes();
      await AccountController.verifyLoginTwoFactor(
        verifyReq(twoFactorToken, recoveryCodes[0]),
        first,
      );
      expect(first.send.mock.calls[0][0].token).toBeTruthy();

      const afterUse = await AccountModel.findById(seeded._id).select(
        "+twoFactorRecoveryHashes",
      );
      expect(afterUse!.twoFactorRecoveryHashes!.length).toBe(1);

      // The same code cannot be replayed.
      const second = makeRes();
      await AccountController.verifyLoginTwoFactor(
        verifyReq(twoFactorToken, recoveryCodes[0]),
        second,
      );
      expect(second.status).toHaveBeenCalledWith(400);
    });

    it("rejects an invalid pending token", async () => {
      await seedAccount({ twoFactorEnabled: true });
      const res = makeRes();
      await AccountController.verifyLoginTwoFactor(
        verifyReq("not-a-real-token", "123456"),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe("setup / enable", () => {
    it("enables 2FA and returns recovery codes once", async () => {
      const seeded = await seedAccount();
      const accountId = seeded._id.toString();

      const setupRes = makeRes();
      await AccountController.setupTwoFactor(authReq(accountId), setupRes);
      expect(setupRes.send).toHaveBeenCalled();

      const code = emailedCode();
      const enableRes = makeRes();
      await AccountController.enableTwoFactor(
        authReq(accountId, { code }),
        enableRes,
      );

      const payload = enableRes.send.mock.calls[0][0];
      expect(payload.twoFactorEnabled).toBe(true);
      expect(Array.isArray(payload.recoveryCodes)).toBe(true);
      expect(payload.recoveryCodes.length).toBe(8);

      const account = await AccountModel.findById(seeded._id).select(
        "+twoFactorRecoveryHashes",
      );
      expect(account!.twoFactorEnabled).toBe(true);
      expect(account!.twoFactorRecoveryHashes!.length).toBe(8);
    });

    it("rejects a wrong setup code", async () => {
      const seeded = await seedAccount();
      const accountId = seeded._id.toString();

      await AccountController.setupTwoFactor(authReq(accountId), makeRes());
      const code = emailedCode();
      const wrongCode = code === "000000" ? "111111" : "000000";

      const res = makeRes();
      await AccountController.enableTwoFactor(
        authReq(accountId, { code: wrongCode }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      const account = await AccountModel.findById(seeded._id);
      expect(account!.twoFactorEnabled).toBe(false);
    });
  });

  describe("disable / regenerate", () => {
    it("requires the correct password to disable", async () => {
      const seeded = await seedAccount({ twoFactorEnabled: true });
      const accountId = seeded._id.toString();

      const bad = makeRes();
      await AccountController.disableTwoFactor(
        authReq(accountId, { password: "WrongPass1!" }),
        bad,
      );
      expect(bad.status).toHaveBeenCalledWith(401);

      const ok = makeRes();
      await AccountController.disableTwoFactor(
        authReq(accountId, { password: PASSWORD }),
        ok,
      );

      const account = await AccountModel.findById(seeded._id).select(
        "+twoFactorRecoveryHashes",
      );
      expect(account!.twoFactorEnabled).toBe(false);
      expect(account!.twoFactorRecoveryHashes ?? []).toEqual([]);
    });

    it("regenerates recovery codes with the correct password", async () => {
      const seeded = await seedAccount({ twoFactorEnabled: true });
      const accountId = seeded._id.toString();
      const oldHashes = await Promise.all(
        generateRecoveryCodes(2).map(hashRecoveryCode),
      );
      await AccountModel.findByIdAndUpdate(seeded._id, {
        $set: { twoFactorRecoveryHashes: oldHashes },
      });

      const res = makeRes();
      await AccountController.regenerateRecoveryCodes(
        authReq(accountId, { password: PASSWORD }),
        res,
      );

      const payload = res.send.mock.calls[0][0];
      expect(payload.recoveryCodes.length).toBe(8);

      const account = await AccountModel.findById(seeded._id).select(
        "+twoFactorRecoveryHashes",
      );
      expect(account!.twoFactorRecoveryHashes!.length).toBe(8);
    });

    it("rejects regeneration when 2FA is not enabled", async () => {
      const seeded = await seedAccount();
      const res = makeRes();
      await AccountController.regenerateRecoveryCodes(
        authReq(seeded._id.toString(), { password: PASSWORD }),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
