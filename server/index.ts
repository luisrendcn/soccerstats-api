import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { db } from "./db";
import { sql } from "drizzle-orm";

const app = express();
const httpServer = createServer(app);

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

// Configurar sesión
const MemoryStoreClass = MemoryStore(session);
const sessionStore = new MemoryStoreClass({});
app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 // 24 horas
    },
  })
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
      if (capturedJsonResponse) {
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
    const count = await db.execute(sql`SELECT count(*) FROM teams`);
    console.log("Migration complete, teams count query result:", count);
  } catch (err) {
    console.error("Migration error", err);
    throw err;
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
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
