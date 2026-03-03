import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { hashPassword, verifyPassword, hasPermission } from "./auth";
import { loginSchema, registerSchema, createTournamentSchema, updateTournamentSchema } from "@shared/schema";
import { z } from "zod";

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
      
      // Verificar si el usuario ya existe
      const existingUser = await storage.getUserByEmail(input.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email ya está registrado" });
      }

      // Crear nuevo usuario con contraseña hasheada
      const user = await storage.createUser({
        email: input.email,
        name: input.name,
        password: hashPassword(input.password),
        role: "public",
      });

      // Sesión
      (req.session as any).userId = user.id;
      (req.session as any).userRole = user.role;

      // Guardar sesión explícitamente
      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ message: "Error al guardar sesión" });
        }
        res.status(201).json({ 
          id: user.id, 
          email: user.email, 
          name: user.name, 
          role: user.role 
        });
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
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
        return res.status(403).json({ message: "Usuario inactivo" });
      }

      // Sesión
      (req.session as any).userId = user.id;
      (req.session as any).userRole = user.role;
      (req.session as any).teamId = user.teamId || null;

      // Guardar sesión explícitamente
      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ message: "Error al guardar sesión" });
        }
        res.json({ 
          id: user.id, 
          email: user.email, 
          name: user.name, 
          role: user.role,
          teamId: user.teamId || null,
        });
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Error al cerrar sesión" });
      }
      res.json({ message: "Sesión cerrada" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!(req.session as any).userId) {
      return res.status(401).json({ message: "No autenticado" });
    }
    res.json({
      userId: (req.session as any).userId,
      userRole: (req.session as any).userRole,
      teamId: (req.session as any).teamId || null,
    });
  });

  /* =======================
     USER MANAGEMENT (ADMIN ONLY)
  ======================= */

  // Middleware para verificar rol admin
  const requireAdmin = (req: any, res: any, next: any) => {
    if ((req.session as any).userRole !== "admin") {
      return res.status(403).json({ message: "Acceso denegado. Se requiere rol admin." });
    }
    next();
  };

  // Middleware para verificar permisos basado en recurso y acción
  const requirePermission = (resource: string, action: string) => {
    return (req: any, res: any, next: any) => {
      const userRole = (req.session as any).userRole;
      if (!userRole) {
        return res.status(401).json({ message: "No autenticado" });
      }
      if (!hasPermission(userRole, resource, action)) {
        return res.status(403).json({ message: `No tienes permiso para ${action} ${resource}` });
      }
      next();
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

  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      // Validate input fields
      const { email, password, name, role } = req.body;
      
      if (!email || !password || !name) {
        return res.status(400).json({ message: "Email, contraseña y nombre son requeridos" });
      }

      const emailSchema = z.string().email("Email inválido");
      const passwordSchema = z.string().min(6, "Contraseña debe tener al menos 6 caracteres");
      const nameSchema = z.string().min(1, "El nombre es requerido");
      
      const validEmail = emailSchema.safeParse(email);
      const validPassword = passwordSchema.safeParse(password);
      const validName = nameSchema.safeParse(name);
      
      if (!validEmail.success) {
        return res.status(400).json({ message: validEmail.error.errors[0].message });
      }
      if (!validPassword.success) {
        return res.status(400).json({ message: validPassword.error.errors[0].message });
      }
      if (!validName.success) {
        return res.status(400).json({ message: validName.error.errors[0].message });
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
        role: role || "public",
        teamId: req.body.teamId || null,
      });

      const { password: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { role, teamId, isActive, name, email } = req.body;

      const updates: any = {};
      if (name) updates.name = name;
      if (email) updates.email = email;
      if (role) updates.role = role;
      if (teamId !== undefined) updates.teamId = teamId;
      if (isActive !== undefined) updates.isActive = isActive;

      const user = await storage.updateUser(userId, updates);
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      throw err;
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);

      // Evitar que se elimine al mismo admin que está eliminando
      if ((req.session as any).userId === userId) {
        return res.status(400).json({ message: "No puedes eliminarte a ti mismo" });
      }

      await storage.deleteUser(userId);
      res.json({ success: true });
    } catch (err) {
      throw err;
    }
  });

  app.put("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { role } = req.body;

      if (!["admin", "tournament_manager", "team", "referee", "public"].includes(role)) {
        return res.status(400).json({ message: "Rol inválido" });
      }

      const user = await storage.updateUser(userId, { role });
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
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  /* =======================
     TOURNAMENTS
  ======================= */

  // Middleware para verificar tournament_manager o admin
  const requireTournamentManager = (req: any, res: any, next: any) => {
    if (!["admin", "tournament_manager"].includes((req.session as any).userRole)) {
      return res.status(403).json({ message: "Acceso denegado" });
    }
    next();
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
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/tournaments/:id", requireTournamentManager, async (req, res) => {
    try {
      const tournamentId = Number(req.params.id);
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
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/tournaments/:id", requireTournamentManager, async (req, res) => {
    try {
      const tournamentId = Number(req.params.id);
      await storage.deleteTournament(tournamentId);
      res.json({ success: true });
    } catch (err) {
      throw err;
    }
  });

  app.post("/api/tournaments/:id/teams", requireTournamentManager, async (req, res) => {
    try {
      const tournamentId = Number(req.params.id);
      const { teamId } = req.body;

      if (!teamId) {
        return res.status(400).json({ message: "teamId es requerido" });
      }

      const relation = await storage.addTeamToTournament(tournamentId, teamId);
      res.status(201).json(relation);
    } catch (err) {
      throw err;
    }
  });

  app.delete("/api/tournaments/:id/teams/:teamId", requireTournamentManager, async (req, res) => {
    try {
      const tournamentId = Number(req.params.id);
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
    if (userRole === "team") {
      const teamId = (req.session as any).teamId;
      if (teamId) {
        const players = await storage.getPlayers(teamId);
        return res.json(players);
      }
    }
    const players = await storage.getPlayers();
    res.json(players);
  });

  // List players by team
  app.get(api.players.list.path, requirePermission("players", "read"), async (req, res) => {
    const teamId = Number(req.params.teamId);
    const userRole = (req.session as any).userRole;
    if (userRole === "team") {
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
      // ownership: team role may only add to their own team
      const userRole = (req.session as any).userRole;
      if (userRole === "team") {
        const myTeam = (req.session as any).teamId;
        if (input.teamId !== myTeam) {
          return res.status(403).json({ message: "No puedes crear jugadores para otro equipo" });
        }
      }
      const player = await storage.createPlayer(input);
      res.status(201).json(player);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  /* =======================
     MATCHES
  ======================= */

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

      const input = api.matches.create.input.parse(rawBody);

      const match = await storage.createMatch(input);
      res.status(201).json(match);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
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
    if (userRole === "team") {
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

      const input = api.matches.update.input.parse(rawBody);
      const match = await storage.updateMatch(matchId, input);
      res.json(match);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

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
      const goal = await storage.createGoal(input);

      const match = await storage.getMatch(input.matchId);
      if (match) {
        const isHome = match.homeTeamId === input.teamId;

        await storage.updateMatch(input.matchId, {
          homeScore: isHome ? (match.homeScore ?? 0) + 1 : match.homeScore,
          awayScore: !isHome ? (match.awayScore ?? 0) + 1 : match.awayScore,
        });
      }

      res.status(201).json(goal);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Standings
  app.get("/api/standings", async (req, res) => {
    let tId: number | undefined;
    if (req.query.tournamentId !== undefined) {
      const parsed = parseInt(String(req.query.tournamentId), 10);
      if (!isNaN(parsed)) {
        tId = parsed;
      }
    }
    const standings = await storage.getStandings(tId);
    res.json(standings);
  });   

  /* =======================
     SEED DATA
  ======================= */

  // Crear usuario admin si no existe
  const adminUser = await storage.getUserByEmail("admin@inder.gov.co");
  if (!adminUser) {
    await storage.createUser({
      email: "admin@inder.gov.co",
      name: "Administrador INDER",
      password: hashPassword("Admin123456"),
      role: "admin",
      isActive: true,
    });
    console.log("Admin user created: admin@inder.gov.co / Admin123456");
  }

  const existingTeams = await storage.getTeams();

  if (existingTeams.length === 0) {
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
