import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  status: text("status").notNull().default("scheduled"), // "scheduled", "finished"
  location: text("location"),
  deletedAt: timestamp("deleted_at"),
});

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull(),
  teamId: integer("team_id").notNull(),
  playerId: integer("player_id"), // Nullable for unknown scorers
  minute: integer("minute"),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("public"), // admin, tournament_manager, team, referee, public
  teamId: integer("team_id"), // For team and referee roles
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
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

export const usersRelations = relations(users, ({ one }) => ({
  team: one(teams, {
    fields: [users.teamId],
    references: [teams.id],
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
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTournamentSchema = createInsertSchema(tournaments).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });

// Zod validation schemas
export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Contraseña debe tener al menos 6 caracteres"),
});

export const registerSchema = insertUserSchema.omit({ role: true, teamId: true, isActive: true }).extend({
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

export const createTournamentSchema = z.object({
  name: z.string().min(2, "El nombre es requerido").max(100),
  description: z.string().optional(),
  startDate: z.date().or(z.string().datetime()),
  endDate: z.date().or(z.string().datetime()).optional(),
  status: z.enum(["draft", "active", "finished"]).default("draft"),
});

export const updateTournamentSchema = createTournamentSchema.partial();

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UserRole = "admin" | "tournament_manager" | "team" | "referee" | "public";
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Match = typeof matches.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Goal = typeof goals.$inferSelect;
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Tournament = typeof tournaments.$inferSelect;
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>;
export type TournamentTeam = typeof tournamentTeams.$inferSelect;
