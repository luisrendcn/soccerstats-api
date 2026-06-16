import "dotenv/config";
import "express-async-errors";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import pgSession from "connect-pg-simple";
import pg from "pg";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { db } from "./db";
import { sql } from "drizzle-orm";

const app = express();
const httpServer = createServer(app);
const isProduction = process.env.NODE_ENV === "production";
const useSecureCookies =
  isProduction && process.env.COOKIE_SECURE?.toLowerCase() !== "false";
const allowedOrigins = new Set(
  (process.env.API_ORIGINS || "http://localhost,http://localhost:5000,http://localhost:5173,https://localhost,capacitor://localhost")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use((req, res, next) => {
  const origin = req.get("origin");
  const requestOrigin = `${req.protocol}://${req.get("host")}`;
  if (origin && origin !== requestOrigin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ message: "Origin not allowed" });
  }
  next();
});
app.use(
  cors({
    credentials: true,
    origin: true,
  }),
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

const MemoryStoreClass = MemoryStore(session);
const sessionSecret = process.env.SESSION_SECRET;
if (isProduction && (!sessionSecret || sessionSecret.length < 32)) {
  throw new Error("SESSION_SECRET must contain at least 32 characters in production");
}

const sessionStore = (() => {
  if (!isProduction) {
    return new MemoryStoreClass({ checkPeriod: 1000 * 60 * 60 * 24 });
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for production sessions");
  }

  const PgSession = pgSession(session);
  const sessionPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return new PgSession({
    pool: sessionPool,
    tableName: "user_sessions",
    createTableIfMissing: true,
  });
})();

app.use(
  session({
    name: "soccer.sid",
    store: sessionStore,
    secret: sessionSecret || "development-only-session-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: useSecureCookies,
      sameSite: useSecureCookies ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);

app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Demasiados intentos. Intenta nuevamente en 15 minutos." },
  }),
);

app.use(
  "/api/auth/register",
  rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    limit: 3,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      message: "Se alcanzó el límite diario de solicitudes de registro.",
    },
  }),
);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && res.statusCode >= 400) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  // ensure soft-delete columns exist in all tables
  try {
    console.log("Running migrations: adding deleted_at columns if missing...");
    await db.execute(sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS deleted_at timestamp`);
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS deleted_at timestamp`);
    await db.execute(sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS deleted_at timestamp`);
    await db.execute(sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_id integer`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS registration_requests (
        id serial PRIMARY KEY,
        email text NOT NULL UNIQUE,
        password text NOT NULL,
        name text NOT NULL,
        requested_role text NOT NULL DEFAULT 'team',
        status text NOT NULL DEFAULT 'pending',
        requested_at timestamp DEFAULT now(),
        reviewed_at timestamp,
        reviewed_by integer
      )
    `);
    await db.execute(sql`
      ALTER TABLE registration_requests
      ADD COLUMN IF NOT EXISTS requested_role text NOT NULL DEFAULT 'team'
    `);
    const count = await db.execute(sql`SELECT count(*) FROM teams`);
    console.log("Migration complete, teams count query result:", count);
  } catch (err) {
    console.error("Migration error", err);
    throw err;
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message =
      status >= 500 && isProduction
        ? "Internal Server Error"
        : err.message || "Internal Server Error";
    if (status >= 500) console.error(err);
    res.status(status).json({ message });
  });

  if (isProduction) {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = Number(process.env.PORT) || 5000;

  httpServer.listen(port, () => {
    log(`Server running on http://localhost:${port}`);
  });
})();
