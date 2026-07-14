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
  message?: string;
};

const appName = process.env.APP_NAME || "Soccer Stats";
const appUrl =
  process.env.APP_PUBLIC_BASE_URL ||
  process.env.VITE_API_BASE ||
  "https://soccer-stats-api.onrender.com";

function mailConfig() {
  return {
    emailHost: process.env.EMAIL_HOST || "smtp.gmail.com",
    emailPort: Number(process.env.EMAIL_PORT || 465),
    emailSecure: process.env.EMAIL_SECURE !== "false",
    emailForceIpv4: process.env.EMAIL_FORCE_IPV4 !== "false",
    emailConnectionTimeoutMs: Number(
      process.env.EMAIL_CONNECTION_TIMEOUT_MS || 10_000,
    ),
    emailUser: process.env.EMAIL_USER,
    emailPassword: process.env.EMAIL_PASSWORD,
    emailFrom: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    adminNotifyEmail: process.env.ADMIN_NOTIFY_EMAIL,
  };
}

export function isEmailConfigured() {
  const { emailHost, emailPort, emailUser, emailPassword, emailFrom } =
    mailConfig();
  return Boolean(
    emailHost && Number.isFinite(emailPort) && emailUser && emailPassword && emailFrom,
  );
}

async function sendMail({ to, subject, text, html }: MailMessage) {
  const {
    emailHost,
    emailPort,
    emailSecure,
    emailForceIpv4,
    emailConnectionTimeoutMs,
    emailUser,
    emailPassword,
    emailFrom,
  } = mailConfig();

  if (emailHost && Number.isFinite(emailPort) && emailUser && emailPassword && emailFrom) {
    return sendSmtpMail({
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
  }

  {
    console.warn(
      `Email not sent to ${to}: configure EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD and EMAIL_FROM.`,
    );
    return { skipped: true };
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
    subject: `Tu acceso a ${appName} fue aprobado`,
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
        message:
          "El correo no se envio porque el proveedor de email no esta configurado.",
      } satisfies EmailDeliveryResult;
    }
    return { status: "sent" } satisfies EmailDeliveryResult;
  } catch (error) {
    console.error(`Failed to send ${operation} email`, error);
    return {
      status: "failed",
      message: emailFailureMessage(error),
    } satisfies EmailDeliveryResult;
  }
}

function isSkippedEmail(result: unknown): result is { skipped: true } {
  return Boolean(
    result &&
      typeof result === "object" &&
      "skipped" in result &&
      (result as { skipped?: unknown }).skipped === true,
  );
}

function emailFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
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
