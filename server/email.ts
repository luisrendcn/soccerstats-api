import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailDeliveryResult = {
  status: "sent" | "skipped" | "failed";
  success: boolean;
  provider: EmailProvider;
  message?: string;
};

type EmailProvider = "gmail-api" | "smtp" | "none";

type EmailSendResult =
  | {
      provider: Exclude<EmailProvider, "none">;
      response: unknown;
    }
  | {
      provider: EmailProvider;
      skipped: true;
    };

class EmailProviderError extends Error {
  constructor(
    public readonly provider: EmailProvider,
    message: string,
    public readonly reason?: string,
  ) {
    super(message);
    this.name = "EmailProviderError";
  }
}

const appName = process.env.APP_NAME || "Soccer Stats";
const appUrl =
  process.env.APP_PUBLIC_BASE_URL ||
  process.env.VITE_API_BASE ||
  "https://soccer-stats-api.onrender.com";

function mailConfig() {
  const emailUser = process.env.EMAIL_USER;
  return {
    emailDeliveryMethod: normalizeEmailProvider(
      process.env.EMAIL_PROVIDER || process.env.EMAIL_DELIVERY_METHOD,
    ),
    emailHost: process.env.EMAIL_HOST || "smtp.gmail.com",
    emailPort: Number(process.env.EMAIL_PORT || 465),
    emailSecure: process.env.EMAIL_SECURE !== "false",
    emailForceIpv4: process.env.EMAIL_FORCE_IPV4 !== "false",
    emailConnectionTimeoutMs: Number(
      process.env.EMAIL_CONNECTION_TIMEOUT_MS || 10_000,
    ),
    emailUser,
    emailPassword: process.env.EMAIL_PASSWORD,
    emailFrom: process.env.EMAIL_FROM || emailUser,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    googleGmailUser: process.env.GOOGLE_GMAIL_USER || "me",
    adminNotifyEmail: process.env.ADMIN_NOTIFY_EMAIL,
  };
}

export function isEmailConfigured() {
  return getEmailProviderStatus().configured;
}

export function getEmailProviderStatus() {
  const {
    emailDeliveryMethod,
    emailHost,
    emailPort,
    emailUser,
    emailPassword,
    emailFrom,
    googleClientId,
    googleClientSecret,
    googleRefreshToken,
  } = mailConfig();
  const provider = selectedEmailProvider();
  const gmailApiConfigured = Boolean(
    googleClientId &&
      googleClientSecret &&
      googleRefreshToken &&
      emailUser &&
      emailFrom,
  );
  const smtpConfigured = Boolean(
    emailHost &&
      Number.isFinite(emailPort) &&
      emailUser &&
      emailPassword &&
      emailFrom,
  );

  if (provider === "gmail-api") {
    return {
      provider,
      configured: gmailApiConfigured,
      missing: missingVars({
        GOOGLE_CLIENT_ID: googleClientId,
        GOOGLE_CLIENT_SECRET: googleClientSecret,
        GOOGLE_REFRESH_TOKEN: googleRefreshToken,
        EMAIL_USER: emailUser,
        EMAIL_FROM: emailFrom,
      }),
    };
  }

  if (provider === "smtp") {
    return {
      provider,
      configured: smtpConfigured,
      missing: missingVars({
        EMAIL_HOST: emailHost,
        EMAIL_PORT: Number.isFinite(emailPort) ? String(emailPort) : undefined,
        EMAIL_USER: emailUser,
        EMAIL_PASSWORD: emailPassword,
        EMAIL_FROM: emailFrom,
      }),
    };
  }

  return { provider, configured: false, missing: ["EMAIL_PROVIDER"] };
}

async function sendMail({ to, subject, text, html }: MailMessage) {
  const {
    emailDeliveryMethod,
    emailHost,
    emailPort,
    emailSecure,
    emailForceIpv4,
    emailConnectionTimeoutMs,
    emailUser,
    emailPassword,
    emailFrom,
    googleClientId,
    googleClientSecret,
    googleRefreshToken,
    googleGmailUser,
  } = mailConfig();
  const provider = selectedEmailProvider();

  if (
    provider === "gmail-api" &&
    googleClientId &&
    googleClientSecret &&
    googleRefreshToken &&
    emailUser &&
    emailFrom
  ) {
    const response = await sendGmailApiMail({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      refreshToken: googleRefreshToken,
      gmailUser: googleGmailUser,
      from: emailFrom,
      to,
      subject,
      text,
      html,
    });
    return { provider: "gmail-api", response } satisfies EmailSendResult;
  }

  if (
    provider === "smtp" &&
    emailHost &&
    Number.isFinite(emailPort) &&
    emailUser &&
    emailPassword &&
    emailFrom
  ) {
    const response = await sendSmtpMail({
      host: emailHost,
      port: emailPort,
      secure: emailSecure,
      forceIpv4: emailForceIpv4,
      connectionTimeoutMs: emailConnectionTimeoutMs,
      user: emailUser,
      password: emailPassword,
      from: emailFrom,
      to,
      subject,
      text,
      html,
    });
    return { provider: "smtp", response } satisfies EmailSendResult;
  }

  {
    const status = getEmailProviderStatus();
    console.warn(
      `Email not sent to ${to}: ${status.provider} is missing ${status.missing.join(
        ", ",
      )}.`,
    );
    return { provider: status.provider, skipped: true } satisfies EmailSendResult;
  }
}

function selectedEmailProvider(): EmailProvider {
  const { emailDeliveryMethod } = mailConfig();
  if (emailDeliveryMethod === "gmail-api" || emailDeliveryMethod === "smtp") {
    return emailDeliveryMethod;
  }

  const { googleClientId, googleClientSecret, googleRefreshToken } = mailConfig();
  if (googleClientId && googleClientSecret && googleRefreshToken) {
    return "gmail-api";
  }
  return "smtp";
}

function normalizeEmailProvider(value: string | undefined): "auto" | "gmail-api" | "smtp" {
  const normalized = (value || "auto").trim().toLowerCase().replace("_", "-");
  if (normalized === "gmail-api" || normalized === "smtp") return normalized;
  return "auto";
}

function missingVars(vars: Record<string, unknown>) {
  return Object.entries(vars)
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

async function sendGmailApiMail({
  clientId,
  clientSecret,
  refreshToken,
  gmailUser,
  from,
  to,
  subject,
  text,
  html,
}: MailMessage & {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  gmailUser: string;
  from: string;
}) {
  const accessToken = await getGmailAccessToken({
    clientId,
    clientSecret,
    refreshToken,
  });
  const raw = buildRawEmail({ from, to, subject, text, html });
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(
      gmailUser,
    )}/messages/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    const error = parseGoogleError(detail);
    throw new EmailProviderError(
      "gmail-api",
      `Gmail API send failed: ${response.status}${error ? ` ${error}` : ""}`,
      error,
    );
  }

  return response.json();
}

async function getGmailAccessToken({
  clientId,
  clientSecret,
  refreshToken,
}: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}) {
  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("refresh_token", refreshToken);
  body.set("grant_type", "refresh_token");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = parseGoogleError(detail);
    throw new EmailProviderError(
      "gmail-api",
      `Gmail API token failed: ${response.status}${error ? ` ${error}` : ""}`,
      error,
    );
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new EmailProviderError(
      "gmail-api",
      "Gmail API token response did not include access_token",
    );
  }
  return payload.access_token;
}

function buildRawEmail({ from, to, subject, text, html }: MailMessage & { from: string }) {
  const boundary = `soccer-stats-${Date.now().toString(36)}`;
  const headers = [
    `From: ${sanitizeHeader(from)}`,
    `To: ${sanitizeHeader(to)}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    toBase64Lines(text),
  ];

  if (html) {
    parts.push(
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      toBase64Lines(html),
    );
  }

  parts.push(`--${boundary}--`, "");
  const message = [...headers, "", ...parts].join("\r\n");
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(sanitizeHeader(value), "utf8").toString(
    "base64",
  )}?=`;
}

function toBase64Lines(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/.{1,76}/g, "$&\r\n")
    .trim();
}

function parseGoogleError(detail: string) {
  try {
    const parsed = JSON.parse(detail) as {
      error?: string | { status?: string; message?: string };
      error_description?: string;
    };
    if (typeof parsed.error === "string") return parsed.error;
    if (parsed.error?.status) return parsed.error.status;
    if (parsed.error?.message) return parsed.error.message;
    return undefined;
  } catch {
    return undefined;
  }
}

async function sendSmtpMail({
  host,
  port,
  secure,
  forceIpv4,
  connectionTimeoutMs,
  user,
  password,
  from,
  to,
  subject,
  text,
  html,
}: MailMessage & {
  host: string;
  port: number;
  secure: boolean;
  forceIpv4: boolean;
  connectionTimeoutMs: number;
  user: string;
  password: string;
  from: string;
}) {
  const transportOptions: SMTPTransport.Options & { family?: 4 | 6 } = {
    host,
    port,
    secure,
    family: forceIpv4 ? 4 : undefined,
    connectionTimeout: connectionTimeoutMs,
    greetingTimeout: connectionTimeoutMs,
    socketTimeout: connectionTimeoutMs,
    auth: {
      user,
      pass: password,
    },
  };

  const transporter = nodemailer.createTransport(transportOptions);

  return transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    admin: "Administrador",
    tournament_manager: "Gestor de torneos",
    team_captain: "Capitan/Lider de equipo",
    team: "Capitan/Lider de equipo",
    referee: "Arbitro",
    public: "Publico",
  };
  return labels[role] || role;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function baseTemplate(title: string, body: string) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>
      ${body}
      <p style="margin-top:24px">
        <a href="${escapeHtml(appUrl)}" style="background:#16a34a;color:white;padding:10px 14px;border-radius:6px;text-decoration:none">
          Abrir ${escapeHtml(appName)}
        </a>
      </p>
    </div>
  `;
}

export async function notifyAccessRequested(input: {
  name: string;
  email: string;
  requestedRole: string;
}) {
  const { adminNotifyEmail } = mailConfig();
  if (!adminNotifyEmail) return { skipped: true };

  const role = roleLabel(input.requestedRole);
  return sendMail({
    to: adminNotifyEmail,
    subject: `Nueva solicitud de acceso - ${appName}`,
    text: `${input.name} (${input.email}) solicito acceso como ${role}. Revisa la lista de espera en ${appUrl}.`,
    html: baseTemplate(
      "Nueva solicitud de acceso",
      `<p><strong>${escapeHtml(input.name)}</strong> (${escapeHtml(
        input.email,
      )}) solicito acceso como <strong>${escapeHtml(role)}</strong>.</p>
       <p>Revisa la lista de espera para aprobar o rechazar la solicitud.</p>`,
    ),
  });
}

export async function notifyAccessApproved(input: {
  name: string;
  email: string;
  role: string;
}) {
  const role = roleLabel(input.role);
  return sendMail({
    to: input.email,
    subject: `Tu cuenta de ${appName} fue aprobada`,
    text: `Hola ${input.name}. Tu cuenta fue aprobada como ${role}. Ya puedes iniciar sesion en ${appUrl} con el correo y la contrasena que registraste.`,
    html: baseTemplate(
      `Tu acceso fue aprobado`,
      `<p>Hola ${escapeHtml(input.name)},</p>
       <p>Tu cuenta fue aprobada como <strong>${escapeHtml(role)}</strong>.</p>
       <p>Ya puedes iniciar sesion con el correo y la contrasena que registraste.</p>`,
    ),
  });
}

export async function notifyAccessRejected(input: {
  name: string;
  email: string;
}) {
  return sendMail({
    to: input.email,
    subject: `Tu solicitud de acceso a ${appName} fue revisada`,
    text: `Hola ${input.name}. Tu solicitud de acceso fue rechazada. Si crees que fue un error, contacta al administrador del torneo.`,
    html: baseTemplate(
      "Solicitud revisada",
      `<p>Hola ${escapeHtml(input.name)},</p>
       <p>Tu solicitud de acceso fue rechazada.</p>
       <p>Si crees que fue un error, contacta al administrador del torneo.</p>`,
    ),
  });
}

export async function notifyUserCreated(input: {
  name: string;
  email: string;
  role: string;
}) {
  const role = roleLabel(input.role);
  return sendMail({
    to: input.email,
    subject: `Tu cuenta en ${appName} esta lista`,
    text: `Hola ${input.name}. Un administrador creo tu cuenta como ${role}. Puedes iniciar sesion en ${appUrl}. Si no conoces tu contrasena, pidela al administrador.`,
    html: baseTemplate(
      "Tu cuenta esta lista",
      `<p>Hola ${escapeHtml(input.name)},</p>
       <p>Un administrador creo tu cuenta como <strong>${escapeHtml(role)}</strong>.</p>
       <p>Puedes iniciar sesion en la app. Si no conoces tu contrasena, pidela al administrador.</p>`,
    ),
  });
}

export async function trySendEmail(operation: string, send: () => Promise<unknown>) {
  try {
    const result = await send();
    if (isSkippedEmail(result)) {
      return {
        status: "skipped",
        success: false,
        provider: result.provider,
        message:
          "El correo no se envio porque el proveedor de email no esta configurado.",
      } satisfies EmailDeliveryResult;
    }
    return {
      status: "sent",
      success: true,
      provider: emailProviderFromResult(result),
    } satisfies EmailDeliveryResult;
  } catch (error) {
    console.error(`Failed to send ${operation} email`, error);
    return {
      status: "failed",
      success: false,
      provider: emailProviderFromError(error),
      message: emailFailureMessage(error),
    } satisfies EmailDeliveryResult;
  }
}

function isSkippedEmail(result: unknown): result is { skipped: true; provider: EmailProvider } {
  return Boolean(
    result &&
      typeof result === "object" &&
      "skipped" in result &&
      (result as { skipped?: unknown }).skipped === true,
  );
}

function emailProviderFromResult(result: unknown): EmailProvider {
  if (result && typeof result === "object" && "provider" in result) {
    const provider = (result as { provider?: unknown }).provider;
    if (provider === "gmail-api" || provider === "smtp") return provider;
  }
  return selectedEmailProvider();
}

function emailProviderFromError(error: unknown): EmailProvider {
  if (error instanceof EmailProviderError) return error.provider;
  return selectedEmailProvider();
}

function emailFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const reason =
    error instanceof EmailProviderError ? error.reason || "" : "";
  if (message.includes("Gmail API token failed")) {
    if (reason === "invalid_client") {
      return "La cuenta fue aprobada, pero Google rechazo las credenciales OAuth: GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET no son validos o no corresponden entre si.";
    }
    if (reason === "invalid_grant") {
      return "La cuenta fue aprobada, pero Google rechazo GOOGLE_REFRESH_TOKEN. Genera un refresh token nuevo para la misma cuenta y el mismo cliente OAuth.";
    }
    return "La cuenta fue aprobada, pero Gmail API rechazo la autenticacion OAuth. Revisa GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN.";
  }
  if (message.includes("Gmail API send failed")) {
    if (reason === "PERMISSION_DENIED") {
      return "La cuenta fue aprobada, pero Gmail API no tiene permisos suficientes para enviar correos. Revisa que el refresh token tenga el alcance de Gmail para enviar mensajes.";
    }
    return "La cuenta fue aprobada, pero Gmail API no pudo enviar el correo. Revisa permisos OAuth de Gmail y el remitente configurado.";
  }
  if (
    message.includes("Invalid login") ||
    message.includes("Username and Password not accepted") ||
    message.includes("535")
  ) {
    return "La cuenta fue aprobada, pero Gmail rechazo el envio. Verifica que EMAIL_USER use una cuenta Gmail valida y que EMAIL_PASSWORD sea una contrasena de aplicacion.";
  }
  if (
    message.includes("Connection timeout") ||
    message.includes("ETIMEDOUT") ||
    message.includes("ENETUNREACH")
  ) {
    return "La cuenta fue aprobada, pero Render no pudo conectarse a Gmail SMTP. En servicios free de Render los puertos SMTP 25, 465 y 587 pueden estar bloqueados; cambia el servicio a un plan pago o usa un proveedor con API HTTP.";
  }
  return "La cuenta fue aprobada, pero no se pudo enviar el correo de notificacion. Revisa la configuracion SMTP de Gmail.";
}
