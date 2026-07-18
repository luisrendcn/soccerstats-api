import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#000000"),
  deletedAt: timestamp("deleted_at"),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  name: text("name").notNull(),
  number: integer("number"),
  deletedAt: timestamp("deleted_at"),
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  homeTeamId: integer("home_team_id").notNull(),
  awayTeamId: integer("away_team_id").notNull(),
  // optionally associate a match with a tournament
  tournamentId: integer("tournament_id"),
  homeScore: integer("home_score").default(0),
  awayScore: integer("away_score").default(0),
  date: timestamp("date").notNull(),
  status: text("status").notNull().default("scheduled"), // scheduled, live, finished
  location: text("location"),
  streamPlatform: text("stream_platform"),
  streamChannel: text("stream_channel"),
  streamUrl: text("stream_url"),
  deletedAt: timestamp("deleted_at"),
});

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull(),
  teamId: integer("team_id").notNull(),
  playerId: integer("player_id"), // Nullable for unknown scorers
  minute: integer("minute"),
});

export const matchHighlights = pgTable("match_highlights", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull(),
  tournamentId: integer("tournament_id").notNull(),
  teamId: integer("team_id").notNull(),
  playerId: integer("player_id"),
  title: text("title").notNull(),
  description: text("description"),
  highlightType: text("highlight_type").notNull(),
  minute: integer("minute").notNull(),
  videoUrl: text("video_url").notNull(),
  videoPublicId: text("video_public_id"),
  thumbnailUrl: text("thumbnail_url"),
  uploadedBy: integer("uploaded_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  status: text("status").notNull().default("pending"),
  durationSeconds: integer("duration_seconds"),
  fileSizeBytes: integer("file_size_bytes"),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("public"), // admin, tournament_manager, team_captain, referee, public
  teamId: integer("team_id"), // For team_captain and referee roles
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const registrationRequests = pgTable("registration_requests", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  requestedRole: text("requested_role").notNull().default("team_captain"),
  status: text("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: integer("reviewed_by"),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull().default("system"),
  link: text("link"),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  scheduledAt: timestamp("scheduled_at").notNull().defaultNow(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  tournamentType: text("tournament_type").notNull().default("soccer"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  status: text("status").notNull().default("draft"), // draft, active, finished
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const tournamentTeams = pgTable("tournament_teams", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull(),
  teamId: integer("team_id").notNull(),
  twitchChannel: text("twitch_channel"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const teamsRelations = relations(teams, ({ many }) => ({
  players: many(players),
  homeMatches: many(matches, { relationName: "homeMatches" }),
  awayMatches: many(matches, { relationName: "awayMatches" }),
  users: many(users),
}));

export const playersRelations = relations(players, ({ one, many }) => ({
  team: one(teams, {
    fields: [players.teamId],
    references: [teams.id],
  }),
  goals: many(goals),
  highlights: many(matchHighlights),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  homeTeam: one(teams, {
    fields: [matches.homeTeamId],
    references: [teams.id],
    relationName: "homeMatches"
  }),
  awayTeam: one(teams, {
    fields: [matches.awayTeamId],
    references: [teams.id],
    relationName: "awayMatches"
  }),
  tournament: one(tournaments, {
    fields: [matches.tournamentId],
    references: [tournaments.id],
  }),
  goals: many(goals),
  highlights: many(matchHighlights),
}));

export const goalsRelations = relations(goals, ({ one }) => ({
  match: one(matches, {
    fields: [goals.matchId],
    references: [matches.id],
  }),
  player: one(players, {
    fields: [goals.playerId],
    references: [players.id],
  }),
  team: one(teams, {
    fields: [goals.teamId],
    references: [teams.id],
  }),
}));

export const matchHighlightsRelations = relations(matchHighlights, ({ one }) => ({
  match: one(matches, {
    fields: [matchHighlights.matchId],
    references: [matches.id],
  }),
  tournament: one(tournaments, {
    fields: [matchHighlights.tournamentId],
    references: [tournaments.id],
  }),
  team: one(teams, {
    fields: [matchHighlights.teamId],
    references: [teams.id],
  }),
  player: one(players, {
    fields: [matchHighlights.playerId],
    references: [players.id],
  }),
  uploader: one(users, {
    fields: [matchHighlights.uploadedBy],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  team: one(teams, {
    fields: [users.teamId],
    references: [teams.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const tournamentsRelations = relations(tournaments, ({ many }) => ({
  tournamentTeams: many(tournamentTeams),
}));

export const tournamentTeamsRelations = relations(tournamentTeams, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [tournamentTeams.tournamentId],
    references: [tournaments.id],
  }),
  team: one(teams, {
    fields: [tournamentTeams.teamId],
    references: [teams.id],
  }),
}));

// Schemas
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true });
export const insertPlayerSchema = createInsertSchema(players).omit({ id: true });
export const insertMatchSchema = createInsertSchema(matches).omit({ id: true });
export const insertGoalSchema = createInsertSchema(goals).omit({ id: true });
export const insertMatchHighlightSchema = createInsertSchema(matchHighlights).omit({
  id: true,
  createdAt: true,
});
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRegistrationRequestSchema = createInsertSchema(registrationRequests).omit({
  id: true,
  requestedAt: true,
  reviewedAt: true,
  reviewedBy: true,
});
export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  readAt: true,
  createdAt: true,
});
export const insertTournamentSchema = createInsertSchema(tournaments).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });

// Zod validation schemas
export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Contraseña debe tener al menos 6 caracteres"),
});

export const registerSchema = insertUserSchema.omit({ role: true, teamId: true, isActive: true }).extend({
  confirmPassword: z.string(),
  requestedRole: z.enum(["tournament_manager", "team_captain", "referee"], {
    message: "Selecciona un rol válido",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

export const createTournamentSchema = z.object({
  name: z.string().min(2, "El nombre es requerido").max(100),
  description: z.string().optional(),
  tournamentType: z.enum(["soccer", "videogame"]).default("soccer"),
  startDate: z.date().or(z.string().datetime()),
  endDate: z.date().or(z.string().datetime()).optional(),
  status: z.enum(["draft", "active", "finished"]).default("draft"),
});

export const updateTournamentSchema = createTournamentSchema.partial();

const twitchChannelSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_]{3,25}$/, "El canal de Twitch no es válido");

const streamUrlSchema = z
  .string()
  .trim()
  .url("La URL del directo no es válida")
  .refine((value) => {
    try {
      const url = new URL(value);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      return host === "twitch.tv" || host === "m.twitch.tv";
    } catch {
      return false;
    }
  }, "Pega un enlace válido de Twitch");

export const matchStatusSchema = z.enum(["scheduled", "live", "finished"]);

export const createMatchSchema = insertMatchSchema.extend({
  status: matchStatusSchema.default("scheduled"),
  streamPlatform: z.enum(["twitch"]).optional().nullable(),
  streamChannel: twitchChannelSchema.optional().nullable(),
  streamUrl: streamUrlSchema.optional().nullable(),
});

export const updateMatchSchema = createMatchSchema.partial();

export const highlightTypeSchema = z.enum([
  "goal",
  "save",
  "assist",
  "foul",
  "penalty",
  "free_kick",
  "celebration",
  "other",
]);

export const highlightStatusSchema = z.enum(["pending", "approved", "rejected"]);

const youtubeVideoUrlSchema = z
  .string()
  .url("La URL del video no es válida")
  .refine((value) => {
    try {
      const url = new URL(value);
      const host = url.hostname.replace(/^www\./, "");
      if (host === "youtu.be") return url.pathname.length > 1;
      if (
        host === "youtube.com" ||
        host === "m.youtube.com" ||
        host === "youtube-nocookie.com"
      ) {
        return (
          url.searchParams.has("v") ||
          url.pathname.startsWith("/shorts/") ||
          url.pathname.startsWith("/embed/") ||
          url.pathname.startsWith("/live/")
        );
      }
      return false;
    } catch {
      return false;
    }
  }, "Pega un enlace válido de YouTube");

export const createMatchHighlightSchema = z.object({
  teamId: z.number().int().positive("El equipo es requerido"),
  playerId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1, "El título es obligatorio").max(120),
  description: z.string().trim().max(500).optional().nullable(),
  highlightType: highlightTypeSchema,
  minute: z.number().int().min(0).max(130),
  videoUrl: youtubeVideoUrlSchema,
  videoPublicId: z.string().trim().min(1).optional().nullable(),
  thumbnailUrl: z.string().url().optional().nullable(),
  durationSeconds: z.number().int().positive().optional().nullable(),
  fileSizeBytes: z.number().int().positive().optional().nullable(),
});

export const updateMatchHighlightSchema = createMatchHighlightSchema.partial().extend({
  status: highlightStatusSchema.optional(),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type RegistrationRequest = typeof registrationRequests.$inferSelect;
export type InsertRegistrationRequest = z.infer<typeof insertRegistrationRequestSchema>;
export type AppNotification = typeof notifications.$inferSelect;
export type InsertAppNotification = z.infer<typeof insertNotificationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UserRole = "admin" | "tournament_manager" | "team_captain" | "team" | "referee" | "public";
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Match = typeof matches.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Goal = typeof goals.$inferSelect;
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type MatchHighlight = typeof matchHighlights.$inferSelect;
export type InsertMatchHighlight = z.infer<typeof insertMatchHighlightSchema>;
export type CreateMatchHighlightInput = z.infer<typeof createMatchHighlightSchema>;
export type UpdateMatchHighlightInput = z.infer<typeof updateMatchHighlightSchema>;
export type Tournament = typeof tournaments.$inferSelect;
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>;
export type TournamentTeam = typeof tournamentTeams.$inferSelect;
