import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getEmailProviderStatus,
  notifyAccessApproved,
  trySendEmail,
} from "../email";

const originalEnv = { ...process.env };

function setGmailApiEnv() {
  process.env.EMAIL_PROVIDER = "gmail-api";
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.GOOGLE_REFRESH_TOKEN = "test-refresh-token";
  process.env.EMAIL_USER = "soccerstats.notification@gmail.com";
  process.env.EMAIL_FROM = "Soccer Stats <soccerstats.notification@gmail.com>";
}

function decodeBase64Url(value: string) {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  return Buffer.from(
    padded.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString("utf8");
}

describe("Gmail API email delivery", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    setGmailApiEnv();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it("selects Gmail API when EMAIL_PROVIDER is gmail-api", () => {
    const status = getEmailProviderStatus();

    expect(status.provider).toBe("gmail-api");
    expect(status.configured).toBe(true);
    expect(status.missing).toEqual([]);
  });

  it("requests an access token and sends a MIME message through Gmail API HTTPS", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "test-access-token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gmail-message-id" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const delivery = await trySendEmail("access approved", () =>
      notifyAccessApproved({
        email: "approved.user@example.com",
        name: "Approved User",
        role: "admin",
      }),
    );

    expect(delivery).toMatchObject({
      status: "sent",
      success: true,
      provider: "gmail-api",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [tokenUrl, tokenOptions] = fetchMock.mock.calls[0];
    expect(tokenUrl).toBe("https://oauth2.googleapis.com/token");
    expect(String(tokenOptions.body)).toContain("grant_type=refresh_token");

    const [sendUrl, sendOptions] = fetchMock.mock.calls[1];
    expect(sendUrl).toBe(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    );
    expect(sendOptions.method).toBe("POST");
    expect(sendOptions.headers.Authorization).toBe("Bearer test-access-token");

    const raw = JSON.parse(String(sendOptions.body)).raw;
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    const mime = decodeBase64Url(raw);
    expect(mime).toContain(
      "From: Soccer Stats <soccerstats.notification@gmail.com>",
    );
    expect(mime).toContain("To: approved.user@example.com");
    expect(mime).toContain(
      `Subject: =?UTF-8?B?${Buffer.from(
        "Tu cuenta de Soccer Stats fue aprobada",
      ).toString("base64")}?=`,
    );
    expect(mime).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(mime).toContain('Content-Type: text/html; charset="UTF-8"');
  });

  it("returns success=false when OAuth token exchange fails without exposing secrets", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => '{"error":"invalid_grant"}',
    });
    vi.stubGlobal("fetch", fetchMock);

    const delivery = await trySendEmail("access approved", () =>
      notifyAccessApproved({
        email: "approved.user@example.com",
        name: "Approved User",
        role: "admin",
      }),
    );

    expect(delivery).toMatchObject({
      status: "failed",
      success: false,
      provider: "gmail-api",
    });
    expect(JSON.stringify(delivery)).not.toContain("test-client-secret");
    expect(JSON.stringify(delivery)).not.toContain("test-refresh-token");
  });

  it("does not use SMTP when Gmail API is configured", async () => {
    process.env.EMAIL_HOST = "smtp.gmail.com";
    process.env.EMAIL_PORT = "465";
    process.env.EMAIL_USER = "smtp-user@example.com";
    process.env.EMAIL_PASSWORD = "smtp-password";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "test-access-token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "gmail-message-id" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const delivery = await trySendEmail("access approved", () =>
      notifyAccessApproved({
        email: "approved.user@example.com",
        name: "Approved User",
        role: "admin",
      }),
    );

    expect(delivery.provider).toBe("gmail-api");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      expect.any(Object),
    );
  });
});
