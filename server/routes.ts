import type { Express } from "express";
import type { Server } from "http";
import type { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import { storage } from "./storage";
import { api } from "@shared/routes";
import {
  hashPassword,
  verifyPassword,
  passwordNeedsRehash,
  hasPermission,
  ROLE_PERMISSIONS,
} from "./auth";
import {
  loginSchema,
  registerSchema,
  createTournamentSchema,
  updateTournamentSchema,
  createMatchHighlightSchema,
  updateMatchHighlightSchema,
} from "@shared/schema";
import { z } from "zod/v4";

const userRoleSchema = z.enum([
  "admin",
  "tournament_manager",
  "team_captain",
  "team",
  "referee",
  "public",
]);

type KnownUserRole = z.infer<typeof userRoleSchema>;

const normalizeUserRole = (role: KnownUserRole): KnownUserRole =>
  role === "team" ? "team_captain" : role;

const normalizeStoredUserRole = (role: string) =>
  role === "team" ? "team_captain" : role;

const isTeamCaptainRole = (role: string) =>
  role === "team_captain" || role === "team";

const MAX_HIGHLIGHT_MINUTE = Number(process.env.MATCH_MAX_MINUTE || 130);
const MAX_HIGHLIGHT_THUMBNAIL_FILE_SIZE_BYTES =
  Number(process.env.HIGHLIGHT_THUMBNAIL_MAX_FILE_SIZE_MB || 5) * 1024 * 1024;
const TWITCH_STREAM_GRACE_MS = 60 * 60 * 1000;
const twitchTokenCache: { token: string | null; expiresAt: number } = {
  token: null,
  expiresAt: 0,
};
const twitchStreamState = new Map<
  string,
  { offlineSince: number | null; lastLiveAt: number | null }
>();

function normalizeTwitchChannel(value?: string | null) {
  const input = value?.trim();
  if (!input) return null;
  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "twitch.tv" && host !== "m.twitch.tv") return null;
    const channel = url.pathname.split("/").filter(Boolean)[0];
    return channel || null;
  } catch {
    return input.replace(/^@/, "");
  }
}

function isValidTwitchChannel(channel?: string | null) {
  return !!channel && /^[a-zA-Z0-9_]{3,25}$/.test(channel);
}

function buildTwitchUrl(channel?: string | null) {
  return channel ? `https://www.twitch.tv/${channel}` : null;
}

async function getTwitchAppAccessToken() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  if (twitchTokenCache.token && Date.now() < twitchTokenCache.expiresAt) {
    return twitchTokenCache.token;
  }

  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  twitchTokenCache.token = payload.access_token;
  twitchTokenCache.expiresAt =
    Date.now() + Math.max(payload.expires_in - 60, 60) * 1000;
  return twitchTokenCache.token;
}

async function getTwitchStreamStatus(channel: string) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const token = await getTwitchAppAccessToken();
  if (!clientId || !token) {
    return {
      configured: false,
      channel,
      isLive: null,
      stream: null,
      offlineSince: null,
      graceExpiresAt: null,
    };
  }

  const response = await fetch(
    `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`,
    {
      headers: {
        "Client-Id": clientId,
        Authorization: `Bearer ${token}`,
      },
    },
  );
  if (!response.ok) return null;

  const payload = (await response.json()) as { data?: any[] };
  const stream = payload.data?.[0] ?? null;
  const now = Date.now();
  const previous = twitchStreamState.get(channel) || {
    offlineSince: null,
    lastLiveAt: null,
  };

  if (stream) {
    twitchStreamState.set(channel, { offlineSince: null, lastLiveAt: now });
    return {
      configured: true,
      channel,
      isLive: true,
      stream,
      offlineSince: null,
      graceExpiresAt: null,
    };
  }

  const offlineSince = previous.offlineSince ?? now;
  twitchStreamState.set(channel, {
    offlineSince,
    lastLiveAt: previous.lastLiveAt,
  });

  return {
    configured: true,
    channel,
    isLive: false,
    stream: null,
    offlineSince: new Date(offlineSince).toISOString(),
    graceExpiresAt: new Date(offlineSince + TWITCH_STREAM_GRACE_MS).toISOString(),
  };
}

function normalizeMatchStreamFields<T extends Record<string, any>>(input: T): T {
  const next: Record<string, any> = { ...input };
  const channel = normalizeTwitchChannel(next.streamChannel || next.streamUrl);
  if (channel) {
    next.streamPlatform = "twitch";
    next.streamChannel = channel;
    next.streamUrl = buildTwitchUrl(channel);
  }
  if (next.streamPlatform === "twitch" && !channel) {
    next.streamPlatform = null;
    next.streamChannel = null;
    next.streamUrl = null;
  }
  return next as T;
}

function getTournamentTeamTwitchChannel(
  req: Request,
  tournament: { tournamentType?: string | null },
) {
  const channel = normalizeTwitchChannel(req.body.twitchChannel);
  if (tournament.tournamentType === "videogame" && !isValidTwitchChannel(channel)) {
    return {
      ok: false as const,
      message:
        "El canal de Twitch es obligatorio para equipos en torneos de videojuego",
    };
  }
  if (channel && !isValidTwitchChannel(channel)) {
    return { ok: false as const, message: "El canal de Twitch no es válido" };
  }
  return { ok: true as const, twitchChannel: channel || null };
}

function isVideogameTournamentTeam(team?: {
  isVideogameTournamentTeam?: boolean | null;
}) {
  return team?.isVideogameTournamentTeam === true;
}

async function establishSession(
  req: Request,
  user: { id: number; role: string; teamId?: number | null },
) {
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
  (req.session as any).userId = user.id;
  (req.session as any).userRole = user.role;
  (req.session as any).teamId = user.teamId ?? null;
  await new Promise<void>((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

async function destroySession(req: Request, res: Response) {
  await new Promise<void>((resolve) => {
    req.session.destroy(() => resolve());
  });
  res.clearCookie("soccer.sid");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  /* =======================
     AUTHENTICATION
  ======================= */

  app.post("/api/auth/register", async (req, res) => {
    try {
      const input = registerSchema.parse(req.body);
      const email = input.email.trim().toLowerCase();
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email ya está registrado" });
      }

      const existingRequest = await storage.getRegistrationRequestByEmail(email);
      if (existingRequest?.status === "pending") {
        return res.status(409).json({
          message: "Ya existe una solicitud pendiente para este correo",
        });
      }
      if (existingRequest?.status === "rejected") {
        return res.status(403).json({
          message: "Esta solicitud fue rechazada. Contacta al administrador.",
        });
      }
      if (existingRequest) {
        return res.status(400).json({ message: "Email ya está registrado" });
      }

      await storage.createRegistrationRequest({
        email,
        name: input.name.trim(),
        password: hashPassword(input.password),
        requestedRole: input.requestedRole,
      });

      res.status(202).json({
        status: "pending",
        message:
          "Solicitud enviada. Un administrador debe aprobar el rol solicitado antes de que puedas ingresar.",
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.issues[0].message });
      }
      throw err;
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const input = loginSchema.parse(req.body);

      const user = await storage.getUserByEmail(input.email);
      if (!user || !verifyPassword(input.password, user.password)) {
        return res.status(401).json({ message: "Email o contraseña incorrectos" });
      }

      if (!user.isActive) {
        return res.status(403).json({
          message: "Tu cuenta está bloqueada. Contacta al administrador.",
          code: "ACCOUNT_BLOCKED",
        });
      }

      if (passwordNeedsRehash(user.password)) {
        await storage.updateUser(user.id, {
          password: hashPassword(input.password),
        });
      }

      const normalizedUser = { ...user, role: normalizeStoredUserRole(user.role) };
      await establishSession(req, normalizedUser);
      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: normalizedUser.role,
        teamId: user.teamId ?? null,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.issues[0].message });
      }
      throw err;
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Error al cerrar sesión" });
      }
      res.clearCookie("soccer.sid");
      res.json({ message: "Sesión cerrada" });
    });
  });

  const requireActiveSession = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = await storage.getUserById(userId);
    if (!user || !user.isActive) {
      await destroySession(req, res);
      return res.status(403).json({
        message: "Tu cuenta está bloqueada. Contacta al administrador.",
        code: "ACCOUNT_BLOCKED",
      });
    }

    (req.session as any).userRole = normalizeStoredUserRole(user.role);
    (req.session as any).teamId = user.teamId ?? null;
    res.locals.authUser = user;
    next();
  };

  app.get("/api/auth/me", requireActiveSession, (req, res) => {
    const user = res.locals.authUser;
    res.json({
      userId: (req.session as any).userId,
      email: user.email,
      name: user.name,
      userRole: normalizeStoredUserRole((req.session as any).userRole),
      teamId: (req.session as any).teamId || null,
    });
  });

  app.get("/api/bootstrap", async (_req, res) => {
    const [teams, matches, tournaments] = await Promise.all([
      storage.getTeams(),
      storage.getMatches(),
      storage.getTournaments(),
    ]);

    res.set("Cache-Control", "private, max-age=15, stale-while-revalidate=60");
    res.json({
      teams,
      matches,
      tournaments,
      generatedAt: new Date().toISOString(),
    });
  });

  /* =======================
     USER MANAGEMENT (ADMIN ONLY)
  ======================= */

  // Middleware para verificar rol admin
  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    requireActiveSession(req, res, () => {
      if ((req.session as any).userRole !== "admin") {
        return res.status(403).json({ message: "Acceso denegado. Se requiere rol admin." });
      }
      next();
    }).catch(next);
  };

  // Middleware para verificar permisos basado en recurso y acción
  const hasPublicPermission = (resource: string, action: string) => {
    const permissions = (ROLE_PERMISSIONS.public as Record<string, string[]>)[resource];
    return permissions ? permissions.includes(action) : false;
  };

  const requirePermission = (resource: string, action: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const userId = (req.session as any).userId;
      if (!userId) {
        if (hasPublicPermission(resource, action)) {
          return next();
        }
        return res.status(401).json({ message: "No autenticado" });
      }

      requireActiveSession(req, res, () => {
        const userRole = (req.session as any).userRole;
        if (!hasPermission(userRole, resource, action)) {
          return res.status(403).json({ message: `No tienes permiso para ${action} ${resource}` });
        }
        next();
      }).catch(next);
    };
  };

  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      // No devolver contraseñas
      const safeUsers = allUsers.map(({ password, ...rest }) => rest);
      res.json(safeUsers);
    } catch (err) {
      throw err;
    }
  });

  app.get("/api/admin/registration-requests", requireAdmin, async (_req, res) => {
    const requests = await storage.getPendingRegistrationRequests();
    const safeRequests = requests.map(({ password, ...request }) => request);
    res.json(safeRequests);
  });

  app.post(
    "/api/admin/registration-requests/:id/approve",
    requireAdmin,
    async (req, res) => {
      const requestId = Number(req.params.id);
      if (!Number.isInteger(requestId) || requestId <= 0) {
        return res.status(400).json({ message: "Solicitud inválida" });
      }

      const user = await storage.approveRegistrationRequest(
        requestId,
        (req.session as any).userId,
      );
      if (!user) {
        return res.status(404).json({
          message: "Solicitud no encontrada, ya procesada o correo registrado",
        });
      }

      const { password, ...safeUser } = user;
      res.status(201).json(safeUser);
    },
  );

  app.post(
    "/api/admin/registration-requests/:id/reject",
    requireAdmin,
    async (req, res) => {
      const requestId = Number(req.params.id);
      if (!Number.isInteger(requestId) || requestId <= 0) {
        return res.status(400).json({ message: "Solicitud inválida" });
      }

      const request = await storage.rejectRegistrationRequest(
        requestId,
        (req.session as any).userId,
      );
      if (!request) {
        return res.status(404).json({
          message: "Solicitud no encontrada o ya procesada",
        });
      }

      const { password, ...safeRequest } = request;
      res.json(safeRequest);
    },
  );

  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      // Validate input fields
      const { email, password, name } = req.body;
      
      if (!email || !password || !name) {
        return res.status(400).json({ message: "Email, contraseña y nombre son requeridos" });
      }

      const emailSchema = z.string().email("Email inválido");
      const passwordSchema = z.string().min(6, "Contraseña debe tener al menos 6 caracteres");
      const nameSchema = z.string().min(1, "El nombre es requerido");
      
      const validEmail = emailSchema.safeParse(email);
      const validPassword = passwordSchema.safeParse(password);
      const validName = nameSchema.safeParse(name);
      const validRole = userRoleSchema.safeParse(req.body.role || "public");
      
      if (!validEmail.success) {
        return res.status(400).json({ message: validEmail.error.issues[0].message });
      }
      if (!validPassword.success) {
        return res.status(400).json({ message: validPassword.error.issues[0].message });
      }
      if (!validName.success) {
        return res.status(400).json({ message: validName.error.issues[0].message });
      }
      if (!validRole.success) {
        return res.status(400).json({ message: "Rol inválido" });
      }
      
      // Verificar si el usuario ya existe
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email ya está registrado" });
      }

      const user = await storage.createUser({
        email: email,
        password: hashPassword(password),
        name: name,
        role: normalizeUserRole(validRole.data),
        teamId: req.body.teamId ?? null,
      });

      const { password: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.issues[0].message });
      }
      throw err;
    }
  });

  app.put("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const updateSchema = z
        .object({
          role: userRoleSchema.optional(),
          teamId: z.number().int().positive().nullable().optional(),
          isActive: z.boolean().optional(),
          name: z.string().min(1).optional(),
          email: z.string().email().optional(),
        })
        .strict();
      const updates = updateSchema.parse(req.body);

      if ((req.session as any).userId === userId && updates.isActive === false) {
        return res.status(400).json({ message: "No puedes bloquearte a ti mismo" });
      }

      const existingUser = await storage.getUserById(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      if (existingUser.role === "admin" && updates.isActive === false) {
        return res.status(400).json({ message: "No puedes bloquear a un administrador" });
      }
      if (existingUser.role === "admin" && updates.role && updates.role !== "admin") {
        const allUsers = await storage.getAllUsers();
        const hasAnotherActiveAdmin = allUsers.some(
          (user) =>
            user.id !== userId &&
            user.role === "admin" &&
            user.isActive !== false,
        );
        if (!hasAnotherActiveAdmin) {
          return res.status(400).json({
            message:
              "Debe existir al menos otro administrador activo antes de cambiar este rol",
          });
        }
      }

      const normalizedUpdates = { ...updates };
      if (updates.role) {
        normalizedUpdates.role = normalizeUserRole(updates.role);
      }
      const user = await storage.updateUser(userId, normalizedUpdates);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      throw err;
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);

      // El borrado desde la interfaz bloquea la cuenta de forma reversible.
      if ((req.session as any).userId === userId) {
        return res.status(400).json({ message: "No puedes bloquearte a ti mismo" });
      }

      const existingUser = await storage.getUserById(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      if (existingUser.role === "admin") {
        return res.status(400).json({ message: "No puedes bloquear a un administrador" });
      }

      const user = await storage.updateUser(userId, { isActive: false });
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      throw err;
    }
  });

  app.delete("/api/admin/users/:id/permanent", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);

      if ((req.session as any).userId === userId) {
        return res.status(400).json({ message: "No puedes eliminarte a ti mismo" });
      }

      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      if (user.role === "admin") {
        return res.status(400).json({ message: "No puedes eliminar a un administrador" });
      }

      await storage.deleteUser(userId);
      await storage.deleteRegistrationRequestsByEmail(user.email);
      res.json({ success: true });
    } catch (err) {
      throw err;
    }
  });

  app.put("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { role } = req.body;

      const parsedRole = userRoleSchema.safeParse(role);
      if (!parsedRole.success) {
        return res.status(400).json({ message: "Rol inválido" });
      }

      const existingUser = await storage.getUserById(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      if (existingUser.role === "admin" && parsedRole.data !== "admin") {
        const allUsers = await storage.getAllUsers();
        const hasAnotherActiveAdmin = allUsers.some(
          (user) =>
            user.id !== userId &&
            user.role === "admin" &&
            user.isActive !== false,
        );
        if (!hasAnotherActiveAdmin) {
          return res.status(400).json({
            message:
              "Debe existir al menos otro administrador activo antes de cambiar este rol",
          });
        }
      }

      const user = await storage.updateUser(userId, {
        role: normalizeUserRole(parsedRole.data),
      });
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      throw err;
    }
  });

  /* =======================
     TEAMS
  ======================= */

  app.get(api.teams.list.path, requirePermission("teams", "read"), async (_req, res) => {
    const teams = await storage.getTeams();
    res.json(teams);
  });

  app.get(api.teams.get.path, requirePermission("teams", "read"), async (req, res) => {
    const teamId = Number(req.params.id);
    const team = await storage.getTeam(teamId);

    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    res.json(team);
  });

  app.post(api.teams.create.path, requirePermission("teams", "create"), async (req, res) => {
    try {
      const input = api.teams.create.input.parse(req.body);
      const team = await storage.createTeam(input);
      res.status(201).json(team);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.issues[0].message });
      }
      throw err;
    }
  });

  /* =======================
     TOURNAMENTS
  ======================= */

  // Middleware para verificar tournament_manager o admin
  const requireTournamentManager = (req: Request, res: Response, next: NextFunction) => {
    requireActiveSession(req, res, () => {
      if (!["admin", "tournament_manager"].includes((req.session as any).userRole)) {
        return res.status(403).json({ message: "Acceso denegado" });
      }
      next();
    }).catch(next);
  };

  const getManageableTournament = async (
    req: Request,
    res: Response,
    tournamentId: number,
  ) => {
    const tournament = await storage.getTournamentById(tournamentId);
    if (!tournament) {
      res.status(404).json({ message: "Torneo no encontrado" });
      return null;
    }

    const userRole = (req.session as any).userRole;
    if (
      userRole === "admin" ||
      tournament.createdBy === (req.session as any).userId
    ) {
      return tournament;
    }

    res.status(403).json({
      message: "No puedes gestionar un torneo creado por otro usuario",
    });
    return null;
  };

  app.get("/api/tournaments", async (_req, res) => {
    try {
      const tournaments = await storage.getTournaments();
      res.json(tournaments);
    } catch (err) {
      throw err;
    }
  });

  app.get("/api/tournaments/:id", async (req, res) => {
    try {
      const tournamentId = Number(req.params.id);
      const tournament = await storage.getTournamentById(tournamentId);

      if (!tournament) {
        return res.status(404).json({ message: "Torneo no encontrado" });
      }

      res.json(tournament);
    } catch (err) {
      throw err;
    }
  });

  app.post("/api/tournaments", requireTournamentManager, async (req, res) => {
    try {
      const input = createTournamentSchema.parse(req.body);
      const userId = (req.session as any).userId;

      // Convertir strings a Date si es necesario
      const startDate = typeof input.startDate === "string" ? new Date(input.startDate) : input.startDate;
      const endDate = input.endDate ? (typeof input.endDate === "string" ? new Date(input.endDate) : input.endDate) : undefined;

      const tournament = await storage.createTournament({
        ...input,
        startDate,
        endDate,
        createdBy: userId,
      } as any);

      res.status(201).json(tournament);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.issues[0].message });
      }
      throw err;
    }
  });

  app.put("/api/tournaments/:id", requireTournamentManager, async (req, res) => {
    try {
      const tournamentId = Number(req.params.id);
      const manageableTournament = await getManageableTournament(req, res, tournamentId);
      if (!manageableTournament) return;

      const input = updateTournamentSchema.parse(req.body);

      // Convertir strings a Date si es necesario
      const updateData: any = { ...input };
      if (updateData.startDate && typeof updateData.startDate === "string") {
        updateData.startDate = new Date(updateData.startDate);
      }
      if (updateData.endDate && typeof updateData.endDate === "string") {
        updateData.endDate = new Date(updateData.endDate);
      }

      const tournament = await storage.updateTournament(tournamentId, updateData);
      res.json(tournament);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.issues[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/tournaments/:id", requireTournamentManager, async (req, res) => {
    try {
      const tournamentId = Number(req.params.id);
      const tournament = await storage.getTournamentById(tournamentId);
      if (!tournament) {
        return res.status(404).json({ message: "Torneo no encontrado" });
      }

      await storage.deleteTournament(tournamentId);
      res.json({ success: true });
    } catch (err) {
      throw err;
    }
  });

  app.post("/api/tournaments/:id/teams", requireTournamentManager, async (req, res) => {
    try {
      const tournamentId = Number(req.params.id);
      const tournament = await getManageableTournament(req, res, tournamentId);
      if (!tournament) return;

      const { teamId } = req.body;

      if (!teamId) {
        return res.status(400).json({ message: "teamId es requerido" });
      }

      const twitch = getTournamentTeamTwitchChannel(req, tournament);
      if (!twitch.ok) {
        return res.status(400).json({ message: twitch.message });
      }

      const relation = await storage.addTeamToTournament(tournamentId, teamId, {
        twitchChannel: twitch.twitchChannel,
      });
      res.status(201).json(relation);
    } catch (err) {
      throw err;
    }
  });

  app.post("/api/tournaments/:id/teams/new", requireTournamentManager, async (req, res) => {
    try {
      const tournamentId = Number(req.params.id);
      const tournament = await getManageableTournament(req, res, tournamentId);
      if (!tournament) return;

      const twitch = getTournamentTeamTwitchChannel(req, tournament);
      if (!twitch.ok) {
        return res.status(400).json({ message: twitch.message });
      }

      const { twitchChannel: _twitchChannel, ...teamBody } = req.body;
      const input = api.teams.create.input.parse(teamBody);
      const team = await storage.createTeam(input);
      const relation = await storage.addTeamToTournament(tournamentId, team.id, {
        twitchChannel: twitch.twitchChannel,
      });
      res.status(201).json({ ...team, twitchChannel: relation.twitchChannel ?? null });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.issues[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/tournaments/:id/teams/:teamId", requireTournamentManager, async (req, res) => {
    try {
      const tournamentId = Number(req.params.id);
      const tournament = await getManageableTournament(req, res, tournamentId);
      if (!tournament) return;

      const teamId = Number(req.params.teamId);

      await storage.removeTeamFromTournament(tournamentId, teamId);
      res.json({ success: true });
    } catch (err) {
      throw err;
    }
  });

  app.get("/api/tournaments/:id/teams", async (req, res) => {
    try {
      const tournamentId = Number(req.params.id);
      const teams = await storage.getTournamentTeams(tournamentId);
      res.json(teams);
    } catch (err) {
      throw err;
    }
  });

  /* =======================
     PLAYERS
  ======================= */

  // List ALL players (team users only see their own roster)
  app.get("/api/players", requirePermission("players", "read"), async (req, res) => {
    const userRole = (req.session as any).userRole;
    if (isTeamCaptainRole(userRole)) {
      const teamId = (req.session as any).teamId;
      if (teamId) {
        const players = await storage.getPlayers(teamId);
        return res.json(players);
      }
      return res.json([]);
    }
    const players = await storage.getPlayers();
    res.json(players);
  });

  // List players by team
  app.get(api.players.list.path, requirePermission("players", "read"), async (req, res) => {
    const teamId = Number(req.params.teamId);
    const team = await storage.getTeam(teamId);
    if (isVideogameTournamentTeam(team)) {
      return res.json([]);
    }
    const userRole = (req.session as any).userRole;
    if (isTeamCaptainRole(userRole)) {
      const myTeam = (req.session as any).teamId;
      if (teamId !== myTeam) {
        return res.status(403).json({ message: "No puedes ver jugadores de otro equipo" });
      }
    }
    const players = await storage.getPlayers(teamId);
    res.json(players);
  });

  app.post(api.players.create.path, requirePermission("players", "create"), async (req, res) => {
    try {
      const input = api.players.create.input.parse(req.body);
      const team = await storage.getTeam(input.teamId);
      if (isVideogameTournamentTeam(team)) {
        return res.status(400).json({
          message:
            "Los equipos de torneos de videojuego no manejan jugadores ni alineación",
        });
      }
      // ownership: team captain may only add to their own team
      const userRole = (req.session as any).userRole;
      if (isTeamCaptainRole(userRole)) {
        const myTeam = (req.session as any).teamId;
        if (input.teamId !== myTeam) {
          return res.status(403).json({ message: "No puedes crear jugadores para otro equipo" });
        }
      }
      const player = await storage.createPlayer(input);
      res.status(201).json(player);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.issues[0].message });
      }
      throw err;
    }
  });

  /* =======================
     MATCHES
  ======================= */

  app.get("/api/twitch/streams/:channel", async (req, res) => {
    const channel = normalizeTwitchChannel(req.params.channel);
    if (!channel) {
      return res.status(400).json({ message: "Canal de Twitch inválido" });
    }

    const streamStatus = await getTwitchStreamStatus(channel);
    if (!streamStatus) {
      return res.status(502).json({ message: "No se pudo consultar Twitch" });
    }
    res.json(streamStatus);
  });

  app.get(api.matches.list.path, requirePermission("matches", "read"), async (_req, res) => {
    const matches = await storage.getMatches();
    res.json(matches);
  });

  app.get(api.matches.get.path, requirePermission("matches", "read"), async (req, res) => {
    const matchId = Number(req.params.id);
    const match = await storage.getMatch(matchId);

    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    res.json(match);
  });

  app.post(api.matches.create.path, requirePermission("matches", "create"), async (req, res) => {
    try {
      // Coerce `date` string to Date before parsing/validation
      const rawBody = { ...req.body };
      if (typeof rawBody.date === "string") {
        rawBody.date = new Date(rawBody.date);
      }

      const input = api.matches.create.input.parse(
        normalizeMatchStreamFields(rawBody),
      );
      if (!input.tournamentId) {
        return res.status(400).json({ message: "El torneo es requerido" });
      }
      const tournament = await storage.getTournamentById(input.tournamentId);
      if (!tournament) {
        return res.status(404).json({ message: "Torneo no encontrado" });
      }
      if (
        (req.session as any).userRole === "tournament_manager" &&
        tournament.createdBy !== (req.session as any).userId
      ) {
        return res.status(403).json({
          message: "No puedes crear partidos en un torneo creado por otro usuario",
        });
      }
      const tournamentTeams = await storage.getTournamentTeams(input.tournamentId);
      const participantIds = new Set(tournamentTeams.map((team) => team.id));
      if (
        !participantIds.has(input.homeTeamId) ||
        !participantIds.has(input.awayTeamId)
      ) {
        return res.status(400).json({
          message: "Ambos equipos deben estar inscritos en el torneo",
        });
      }

      const matchInput = { ...input };
      if (tournament.tournamentType === "videogame") {
        const homeTournamentTeam = tournamentTeams.find(
          (team) => team.id === input.homeTeamId,
        );
        const awayTournamentTeam = tournamentTeams.find(
          (team) => team.id === input.awayTeamId,
        );
        const allowedChannels = [
          homeTournamentTeam?.twitchChannel,
          awayTournamentTeam?.twitchChannel,
        ].filter(isValidTwitchChannel);
        if (allowedChannels.length < 2) {
          return res.status(400).json({
            message:
              "Los equipos de un torneo de videojuego deben tener canal de Twitch",
          });
        }
        const requestedChannel =
          normalizeTwitchChannel(matchInput.streamChannel || matchInput.streamUrl) ||
          homeTournamentTeam?.twitchChannel;
        if (!allowedChannels.includes(requestedChannel || "")) {
          return res.status(400).json({
            message:
              "El canal de transmisión debe pertenecer a uno de los equipos del partido",
          });
        }
        matchInput.status = matchInput.status || "scheduled";
        matchInput.streamPlatform = "twitch";
        matchInput.streamChannel = requestedChannel!;
        matchInput.streamUrl = buildTwitchUrl(requestedChannel);
      }

      const match = await storage.createMatch(matchInput);
      res.status(201).json(match);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.issues[0].message });
      }
      throw err;
    }
  });

  // Soft delete endpoints
  app.delete('/api/teams/:id', requirePermission("teams", "delete"), async (req, res) => {
    const id = Number(req.params.id);
    const updated = await storage.softDeleteTeam(id);
    res.json(updated);
  });

  app.delete('/api/players/:id', requirePermission("players", "delete"), async (req, res) => {
    const id = Number(req.params.id);
    // if team owner, ensure player belongs to their team
    const userRole = (req.session as any).userRole;
    if (isTeamCaptainRole(userRole)) {
      const myTeam = (req.session as any).teamId;
      const player = await storage.getPlayer(id);
      if (player && player.teamId !== myTeam) {
        return res.status(403).json({ message: "No puedes eliminar jugadores de otro equipo" });
      }
    }
    const updated = await storage.softDeletePlayer(id);
    res.json(updated);
  });

  app.delete('/api/matches/:id', requirePermission("matches", "delete"), async (req, res) => {
    const id = Number(req.params.id);
    const updated = await storage.softDeleteMatch(id);
    res.json(updated);
  });

  app.put(api.matches.update.path, requirePermission("matches", "update"), async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      // Coerce `date` string to Date before parsing/validation (partial schema)
      const rawBody = { ...req.body };
      if (typeof rawBody.date === "string") {
        rawBody.date = new Date(rawBody.date);
      }

      const input = api.matches.update.input.parse(
        normalizeMatchStreamFields(rawBody),
      );
      const existingMatch = await storage.getMatch(matchId);
      if (!existingMatch) {
        return res.status(404).json({ message: "Match not found" });
      }
      if ((req.session as any).userRole === "tournament_manager") {
        if (!existingMatch.tournamentId) {
          return res.status(403).json({
            message: "No puedes actualizar partidos sin torneo asociado",
          });
        }
        const tournament = await getManageableTournament(
          req,
          res,
          existingMatch.tournamentId,
        );
        if (!tournament) return;
      }
      const match = await storage.updateMatch(matchId, input);
      res.json(match);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.issues[0].message });
      }
      throw err;
    }
  });

  /* =======================
     MATCH HIGHLIGHTS
  ======================= */

  const getOptionalAuthUser = async (req: Request) => {
    const userId = (req.session as any).userId;
    if (!userId) return null;
    const user = await storage.getUserById(userId);
    if (!user || !user.isActive) return null;
    (req.session as any).userRole = normalizeStoredUserRole(user.role);
    (req.session as any).teamId = user.teamId ?? null;
    return user;
  };

  const canUploadHighlight = async (req: Request, match: any) => {
    const userRole = (req.session as any).userRole;
    const userId = (req.session as any).userId;
    const teamId = (req.session as any).teamId;

    if (userRole === "admin" || userRole === "referee") return true;
    if (isTeamCaptainRole(userRole)) {
      return teamId === match.homeTeamId || teamId === match.awayTeamId;
    }
    if (userRole === "tournament_manager" && match.tournamentId) {
      const tournament = await storage.getTournamentById(match.tournamentId);
      return tournament?.createdBy === userId;
    }
    return false;
  };

  const canReviewHighlight = async (req: Request, tournamentId?: number | null) => {
    const userRole = (req.session as any).userRole;
    const userId = (req.session as any).userId;
    if (userRole === "admin") return true;
    if (userRole !== "tournament_manager" || !tournamentId) return false;
    const tournament = await storage.getTournamentById(tournamentId);
    return tournament?.createdBy === userId;
  };

  const validateHighlightInput = async (
    input: z.infer<typeof createMatchHighlightSchema>,
    match: any,
    res: Response,
  ) => {
    if (!match.tournamentId) {
      res.status(400).json({
        message: "El partido debe estar asociado a un torneo",
      });
      return false;
    }
    if (![match.homeTeamId, match.awayTeamId].includes(input.teamId)) {
      res.status(400).json({
        message: "El equipo relacionado no participa en este partido",
      });
      return false;
    }
    if (input.playerId) {
      const player = await storage.getPlayer(input.playerId);
      if (!player || player.teamId !== input.teamId) {
        res.status(400).json({
          message: "El jugador no pertenece al equipo indicado",
        });
        return false;
      }
    }
    if (input.minute > MAX_HIGHLIGHT_MINUTE) {
      res.status(400).json({
        message: `El minuto debe estar entre 0 y ${MAX_HIGHLIGHT_MINUTE}`,
      });
      return false;
    }
    if (
      input.fileSizeBytes &&
      input.fileSizeBytes > MAX_HIGHLIGHT_THUMBNAIL_FILE_SIZE_BYTES
    ) {
      res.status(400).json({
        message: `La miniatura supera el tamaño máximo permitido`,
      });
      return false;
    }
    if (input.thumbnailUrl) {
      const thumbnailUrl = new URL(input.thumbnailUrl);
      if (thumbnailUrl.hostname !== "res.cloudinary.com") {
        res.status(400).json({
          message: "La miniatura debe estar alojada en Cloudinary",
        });
        return false;
      }
    }
    return true;
  };

  app.get("/api/matches/:matchId/highlights", async (req, res) => {
    const matchId = Number(req.params.matchId);
    if (!Number.isInteger(matchId) || matchId <= 0) {
      return res.status(400).json({ message: "Partido inválido" });
    }

    const match = await storage.getMatch(matchId);
    if (!match) {
      return res.status(404).json({ message: "Partido no encontrado" });
    }

    const user = await getOptionalAuthUser(req);
    const includeAll = user
      ? await canReviewHighlight(req, match.tournamentId)
      : false;
    const highlights = await storage.getMatchHighlights(matchId, {
      includeAll,
      uploadedBy: includeAll ? undefined : user?.id,
    });
    res.json(highlights);
  });

  app.post(
    "/api/matches/:matchId/highlights/thumbnail-signature",
    requireActiveSession,
    async (req, res) => {
      const matchId = Number(req.params.matchId);
      const match = await storage.getMatch(matchId);
      if (!match) {
        return res.status(404).json({ message: "Partido no encontrado" });
      }
      if (!(await canUploadHighlight(req, match))) {
        return res.status(403).json({
          message: "No tienes permiso para subir jugadas de este partido",
        });
      }

      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (!cloudName || !apiKey || !apiSecret) {
        return res.status(503).json({
          message:
            "El almacenamiento de miniaturas no está configurado. Define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.",
        });
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const folder = `soccer-stats/match-highlight-thumbnails/${matchId}`;
      const signature = crypto
        .createHash("sha1")
        .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
        .digest("hex");

      res.json({
        cloudName,
        apiKey,
        timestamp,
        folder,
        signature,
        resourceType: "image",
        maxFileSizeBytes: MAX_HIGHLIGHT_THUMBNAIL_FILE_SIZE_BYTES,
      });
    },
  );

  app.post(
    "/api/matches/:matchId/highlights",
    requireActiveSession,
    async (req, res) => {
      try {
        const matchId = Number(req.params.matchId);
        const match = await storage.getMatch(matchId);
        if (!match) {
          return res.status(404).json({ message: "Partido no encontrado" });
        }
        if (!(await canUploadHighlight(req, match))) {
          return res.status(403).json({
            message: "No tienes permiso para subir jugadas de este partido",
          });
        }

        const input = createMatchHighlightSchema.parse(req.body);
        if (!(await validateHighlightInput(input, match, res))) return;

        const highlight = await storage.createMatchHighlight({
          ...input,
          matchId,
          tournamentId: match.tournamentId!,
          uploadedBy: (req.session as any).userId,
          status: "pending",
          description: input.description || null,
          playerId: input.playerId || null,
          thumbnailUrl: input.thumbnailUrl || null,
          videoPublicId: input.videoPublicId || null,
          durationSeconds: input.durationSeconds || null,
          fileSizeBytes: input.fileSizeBytes || null,
        });
        res.status(201).json(highlight);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: err.issues[0].message });
        }
        throw err;
      }
    },
  );

  app.put(
    "/api/match-highlights/:id",
    requireActiveSession,
    async (req, res) => {
      try {
        const highlightId = Number(req.params.id);
        const existing = await storage.getMatchHighlight(highlightId);
        if (!existing) {
          return res.status(404).json({ message: "Jugada no encontrada" });
        }
        if (!(await canReviewHighlight(req, existing.tournamentId))) {
          return res.status(403).json({
            message: "No tienes permiso para modificar esta jugada",
          });
        }

        const input = updateMatchHighlightSchema.parse(req.body);
        const match = await storage.getMatch(existing.matchId);
        if (!match) {
          return res.status(404).json({ message: "Partido no encontrado" });
        }
        const merged = createMatchHighlightSchema.parse({
          ...existing,
          ...input,
        });
        if (!(await validateHighlightInput(merged, match, res))) return;

        const updated = await storage.updateMatchHighlight(highlightId, {
          ...input,
          description: input.description === undefined ? undefined : input.description || null,
          playerId: input.playerId === undefined ? undefined : input.playerId || null,
          thumbnailUrl: input.thumbnailUrl === undefined ? undefined : input.thumbnailUrl || null,
          videoPublicId: input.videoPublicId === undefined ? undefined : input.videoPublicId || null,
          durationSeconds:
            input.durationSeconds === undefined ? undefined : input.durationSeconds || null,
          fileSizeBytes:
            input.fileSizeBytes === undefined ? undefined : input.fileSizeBytes || null,
        });
        res.json(updated);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: err.issues[0].message });
        }
        throw err;
      }
    },
  );

  app.delete(
    "/api/match-highlights/:id",
    requireActiveSession,
    async (req, res) => {
      const highlightId = Number(req.params.id);
      const existing = await storage.getMatchHighlight(highlightId);
      if (!existing) {
        return res.status(404).json({ message: "Jugada no encontrada" });
      }
      if (!(await canReviewHighlight(req, existing.tournamentId))) {
        return res.status(403).json({
          message: "No tienes permiso para eliminar esta jugada",
        });
      }
      await storage.deleteMatchHighlight(highlightId);
      res.json({ success: true });
    },
  );

  /* =======================
     GOALS
  ======================= */

  app.get(api.goals.list.path, requirePermission("goals", "read"), async (req, res) => {
    const matchId = Number(req.params.matchId);
    const goals = await storage.getGoals(matchId);
    res.json(goals);
  });

  app.post(api.goals.create.path, requirePermission("matches", "update"), async (req, res) => {
    try {
      const input = api.goals.create.input.parse(req.body);
      const match = await storage.getMatch(input.matchId);
      if (!match) {
        return res.status(404).json({ message: "Partido no encontrado" });
      }
      if ((req.session as any).userRole === "tournament_manager") {
        if (!match.tournamentId) {
          return res.status(403).json({
            message: "No puedes registrar goles en partidos sin torneo asociado",
          });
        }
        const tournament = await getManageableTournament(
          req,
          res,
          match.tournamentId,
        );
        if (!tournament) return;
      }
      if (![match.homeTeamId, match.awayTeamId].includes(input.teamId)) {
        return res.status(400).json({ message: "El equipo no participa en este partido" });
      }
      if (input.playerId) {
        const player = await storage.getPlayer(input.playerId);
        if (!player || player.teamId !== input.teamId) {
          return res.status(400).json({ message: "El jugador no pertenece al equipo indicado" });
        }
      }

      const goal = await storage.createGoal(input);
      const isHome = match.homeTeamId === input.teamId;
      await storage.updateMatch(input.matchId, {
        homeScore: isHome ? (match.homeScore ?? 0) + 1 : match.homeScore,
        awayScore: isHome ? match.awayScore : (match.awayScore ?? 0) + 1,
      });

      res.status(201).json(goal);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.issues[0].message });
      }
      throw err;
    }
  });

  // Standings
  app.get("/api/standings", requirePermission("tournaments", "read"), async (req, res) => {
    res.set("Cache-Control", "no-store");
    const tournamentId = Number(req.query.tournamentId);
    if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
      return res.status(400).json({ message: "tournamentId válido es requerido" });
    }

    const tournament = await storage.getTournamentById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: "Torneo no encontrado" });
    }

    const standings = await storage.getStandings(tournamentId);
    res.json(standings);
  });   

  /* =======================
     SEED DATA
  ======================= */

  const bootstrapAdminEmail = process.env.ADMIN_EMAIL;
  const bootstrapAdminPassword = process.env.ADMIN_PASSWORD;
  if (bootstrapAdminEmail && bootstrapAdminPassword) {
    if (bootstrapAdminPassword.length < 12) {
      throw new Error("ADMIN_PASSWORD must contain at least 12 characters");
    }
    const adminUser = await storage.getUserByEmail(bootstrapAdminEmail);
    if (!adminUser) {
      await storage.createUser({
        email: bootstrapAdminEmail,
        name: process.env.ADMIN_NAME || "Administrador",
        password: hashPassword(bootstrapAdminPassword),
        role: "admin",
        isActive: true,
      });
      console.log(`Admin user created: ${bootstrapAdminEmail}`);
    }
  }

  const existingTeams = await storage.getTeams();

  if (process.env.SEED_DEMO_DATA === "true" && existingTeams.length === 0) {
    const teamA = await storage.createTeam({ name: "Thunder FC", color: "#3b82f6" });
    const teamB = await storage.createTeam({ name: "Lightning United", color: "#ef4444" });
    const teamC = await storage.createTeam({ name: "Storm Breakers", color: "#22c55e" });

    await storage.createPlayer({ teamId: teamA.id, name: "John Doe", number: 10 });
    await storage.createPlayer({ teamId: teamA.id, name: "Jane Smith", number: 7 });
    await storage.createPlayer({ teamId: teamB.id, name: "Mike Johnson", number: 9 });

    await storage.createMatch({
      homeTeamId: teamA.id,
      awayTeamId: teamB.id,
      date: new Date(Date.now() - 86400000),
      homeScore: 2,
      awayScore: 1,
      status: "finished",
    });

    await storage.createMatch({
      homeTeamId: teamC.id,
      awayTeamId: teamA.id,
      date: new Date(Date.now() + 86400000),
      status: "scheduled",
    });
  }

  return httpServer;
}
