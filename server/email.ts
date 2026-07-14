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
    mailgunApiKey: process.env.MAILGUN_API_KEY,
    mailgunDomain: process.env.MAILGUN_DOMAIN,
    mailgunFrom: process.env.MAILGUN_FROM,
    resendApiKey: process.env.RESEND_API_KEY,
    emailFrom: process.env.EMAIL_FROM,
    adminNotifyEmail: process.env.ADMIN_NOTIFY_EMAIL,
  };
}

export function isEmailConfigured() {
  const { mailgunApiKey, mailgunDomain, mailgunFrom, resendApiKey, emailFrom } =
    mailConfig();
  return Boolean(
    (mailgunApiKey && mailgunDomain && mailgunFrom) ||
      (resendApiKey && emailFrom),
  );
}

async function sendMail({ to, subject, text, html }: MailMessage) {
  const {
    mailgunApiKey,
    mailgunDomain,
    mailgunFrom,
    resendApiKey,
    emailFrom,
  } = mailConfig();

  if (resendApiKey && emailFrom) {
    return sendResendMail({
      apiKey: resendApiKey,
      from: emailFrom,
      to,
      subject,
      text,
      html,
    });
  }

  if (mailgunApiKey && mailgunDomain && mailgunFrom) {
    return sendMailgunMail({
      apiKey: mailgunApiKey,
      domain: mailgunDomain,
      from: mailgunFrom,
      to,
      subject,
      text,
      html,
    });
  }

  {
    console.warn(
      `Email not sent to ${to}: configure RESEND_API_KEY and EMAIL_FROM.`,
    );
    return { skipped: true };
  }
}

async function sendMailgunMail({
  apiKey,
  domain,
  from,
  to,
  subject,
  text,
  html,
}: MailMessage & {
  apiKey: string;
  domain: string;
  from: string;
}) {
  const body = new URLSearchParams();
  body.set("from", from);
  body.set("to", to);
  body.set("subject", subject);
  body.set("text", text);
  if (html) body.set("html", html);

  const auth = Buffer.from(`api:${apiKey}`).toString("base64");
  const response = await fetch(
    `https://api.mailgun.net/v3/${encodeURIComponent(domain)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Mailgun failed: ${response.status} ${detail}`);
  }

  return response.json();
}

async function sendResendMail({
  apiKey,
  from,
  to,
  subject,
  text,
  html,
}: MailMessage & {
  apiKey: string;
  from: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email provider failed: ${response.status} ${detail}`);
  }

  return response.json();
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
  if (message.includes("You can only send testing emails")) {
    return "La cuenta fue aprobada, pero Resend no envio el correo porque el remitente de prueba solo permite enviar al correo verificado. Verifica un dominio en Resend y usa EMAIL_FROM con un correo de ese dominio.";
  }
  return "La cuenta fue aprobada, pero no se pudo enviar el correo de notificacion. Revisa la configuracion del proveedor de email.";
}
