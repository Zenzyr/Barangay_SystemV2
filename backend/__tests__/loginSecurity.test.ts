import {
  isNewDeviceLogin,
  newDeviceLoginEmailHtml,
} from "../utils/loginSecurity";

describe("isNewDeviceLogin", () => {
  it("does not flag the first-ever login (no baseline)", () => {
    expect(
      isNewDeviceLogin(
        { lastLoginAt: undefined, lastLoginIp: "", lastLoginUserAgent: "" },
        { ip: "1.1.1.1", userAgent: "Chrome" },
      ),
    ).toBe(false);
  });

  it("does not flag a login from the same IP and browser", () => {
    expect(
      isNewDeviceLogin(
        {
          lastLoginAt: new Date(),
          lastLoginIp: "1.1.1.1",
          lastLoginUserAgent: "Chrome",
        },
        { ip: "1.1.1.1", userAgent: "Chrome" },
      ),
    ).toBe(false);
  });

  it("flags a login from a different IP", () => {
    expect(
      isNewDeviceLogin(
        {
          lastLoginAt: new Date(),
          lastLoginIp: "1.1.1.1",
          lastLoginUserAgent: "Chrome",
        },
        { ip: "2.2.2.2", userAgent: "Chrome" },
      ),
    ).toBe(true);
  });

  it("flags a login from a different browser on the same IP", () => {
    expect(
      isNewDeviceLogin(
        {
          lastLoginAt: new Date(),
          lastLoginIp: "1.1.1.1",
          lastLoginUserAgent: "Chrome",
        },
        { ip: "1.1.1.1", userAgent: "Firefox" },
      ),
    ).toBe(true);
  });

  it("treats missing stored fields as empty strings when a baseline exists", () => {
    expect(
      isNewDeviceLogin(
        { lastLoginAt: new Date(), lastLoginIp: undefined, lastLoginUserAgent: undefined },
        { ip: "1.1.1.1", userAgent: "Chrome" },
      ),
    ).toBe(true);
  });
});

describe("newDeviceLoginEmailHtml", () => {
  it("includes the sign-in details", () => {
    const html = newDeviceLoginEmailHtml({
      name: "Juan",
      when: "Jan 1, 2026 10:00 AM",
      ip: "1.1.1.1",
      userAgent: "Chrome",
    });
    expect(html).toContain("Juan");
    expect(html).toContain("Jan 1, 2026 10:00 AM");
    expect(html).toContain("1.1.1.1");
    expect(html).toContain("Chrome");
  });

  it("escapes angle brackets from untrusted values", () => {
    const html = newDeviceLoginEmailHtml({
      name: "<script>alert(1)</script>",
      when: "now",
      ip: "1.1.1.1",
      userAgent: "<b>x</b>",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>x</b>");
  });
});
