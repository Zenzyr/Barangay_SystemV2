import { sendSms } from "../utils/sms";

const originalFetch = global.fetch;
const originalToken = process.env.IPROG_API_TOKEN;
const originalSender = process.env.IPROG_SENDER_NAME;

const mockFetch = jest.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function textResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
  process.env.IPROG_API_TOKEN = "test-token";
  delete process.env.IPROG_SENDER_NAME;
});

afterAll(() => {
  global.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.IPROG_API_TOKEN;
  else process.env.IPROG_API_TOKEN = originalToken;
  if (originalSender === undefined) delete process.env.IPROG_SENDER_NAME;
  else process.env.IPROG_SENDER_NAME = originalSender;
});

describe("sendSms", () => {
  it("returns true for iProg's success body (HTTP 200 + message_id)", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        status: 200,
        message: "Your SMS message has been successfully added to the queue.",
        message_id: "iSms-XHYBk",
      }),
    );

    await expect(sendSms("09171234567", "hello")).resolves.toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns false when iProg reports an error inside an HTTP 200 body", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        status: 500,
        message: "Invalid api token or no load balance",
      }),
    );

    await expect(sendSms("09171234567", "hello")).resolves.toBe(false);
  });

  it("returns false on a non-2xx HTTP status", async () => {
    mockFetch.mockResolvedValue(textResponse("boom", 500));
    await expect(sendSms("09171234567", "hello")).resolves.toBe(false);
  });

  it("accepts a string 'success' status", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ status: "success", message: "ok" }));
    await expect(sendSms("09171234567", "hello")).resolves.toBe(true);
  });

  it("returns false when the API token is missing without calling iProg", async () => {
    delete process.env.IPROG_API_TOKEN;
    await expect(sendSms("09171234567", "hello")).resolves.toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns false for an invalid phone number without calling iProg", async () => {
    await expect(sendSms("123", "hello")).resolves.toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("normalizes 639xx numbers and includes the sender name when configured", async () => {
    process.env.IPROG_SENDER_NAME = "BRGY RABON";
    mockFetch.mockResolvedValue(jsonResponse({ status: 200, message_id: "iSms-1" }));

    await expect(sendSms("639171234567", "hi")).resolves.toBe(true);

    const [url, init] = mockFetch.mock.calls[0];
    const body = init.body as URLSearchParams;
    expect(String(url)).toContain("/api/v1/sms_messages");
    expect(init.method).toBe("POST");
    expect(body.get("phone_number")).toBe("09171234567");
    expect(body.get("api_token")).toBe("test-token");
    expect(body.get("sender_name")).toBe("BRGY RABON");
  });

  it("omits the sender name when it is not configured", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ status: 200, message_id: "iSms-2" }));

    await expect(sendSms("09171234567", "hi")).resolves.toBe(true);

    const body = mockFetch.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("sender_name")).toBeNull();
  });

  it("returns false when the request throws", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));
    await expect(sendSms("09171234567", "hello")).resolves.toBe(false);
  });
});
