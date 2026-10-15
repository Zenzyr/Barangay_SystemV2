import bcrypt from "bcrypt";
import { AccountController } from "../controller/accounts.controller";
import AccountModel from "../model/account.model";
import AuditLogModel from "../model/auditLog.model";
import NotificationModel from "../model/notification.model";
import { sendEmail } from "../utils/email";

jest.mock("../utils/email", () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

const EMAIL = "newdevice@example.com";
const PASSWORD = "Password123!";

function makeReq(userAgent: string, ip = "10.0.0.1") {
  return {
    body: { email: EMAIL, password: PASSWORD },
    headers: { "user-agent": userAgent },
    ip,
    socket: {},
  } as any;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const flush = () => new Promise((r) => setTimeout(r, 80));

async function seedAccount() {
  await AccountModel.create({
    name: "Test User",
    email: EMAIL,
    contact: "09171234567",
    password: await bcrypt.hash(PASSWORD, 10),
    status: "approved",
    role: "resident",
    emailVerified: true,
  });
}

describe("login new-device detection", () => {
  beforeEach(async () => {
    await seedAccount();
  });

  it("sets a baseline on first login without alerting", async () => {
    const res = makeRes();
    await AccountController.login(makeReq("UA-Chrome"), res);
    await flush();

    expect(res.send).toHaveBeenCalled();
    const account = await AccountModel.findOne({ email: EMAIL });
    expect(account!.lastLoginAt).toBeTruthy();
    expect(account!.lastLoginUserAgent).toBe("UA-Chrome");
    expect(account!.lastLoginIp).toBe("10.0.0.1");
    expect(await AuditLogModel.countDocuments({ action: "login_new_device" })).toBe(0);
  });

  it("does not alert on a repeat login from the same device", async () => {
    await AccountController.login(makeReq("UA-Chrome"), makeRes());
    await flush();

    await AccountController.login(makeReq("UA-Chrome"), makeRes());
    await flush();

    expect(await AuditLogModel.countDocuments({ action: "login_new_device" })).toBe(0);
  });

  it("alerts, notifies and records a new device on a changed browser", async () => {
    await AccountController.login(makeReq("UA-Chrome"), makeRes());
    await flush();

    await AccountController.login(makeReq("UA-Firefox"), makeRes());
    await flush();

    const audit = await AuditLogModel.findOne({ action: "login_new_device" });
    expect(audit).toBeTruthy();
    expect((audit!.newValue as any).userAgent).toBe("UA-Firefox");

    expect(await NotificationModel.countDocuments({ type: "security" })).toBe(1);
    expect(sendEmail).toHaveBeenCalled();

    const account = await AccountModel.findOne({ email: EMAIL });
    expect(account!.lastLoginUserAgent).toBe("UA-Firefox");
  });

  it("alerts when only the IP changes", async () => {
    await AccountController.login(makeReq("UA-Chrome", "10.0.0.1"), makeRes());
    await flush();

    await AccountController.login(makeReq("UA-Chrome", "203.0.113.9"), makeRes());
    await flush();

    expect(await AuditLogModel.countDocuments({ action: "login_new_device" })).toBe(1);
  });
});
