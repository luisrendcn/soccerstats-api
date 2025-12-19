import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#000000"),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  name: text("name").notNull(),
  number: integer("number"),
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  homeTeamId: integer("home_team_id").notNull(),
  awayTeamId: integer("away_team_id").notNull(),
  homeScore: integer("home_score").default(0),
  awayScore: integer("away_score").default(0),
  date: timestamp("date").notNull(),
  status: text("status").notNull().default("scheduled"), // "scheduled", "finished"
  location: text("location"),
});

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull(),
  teamId: integer("team_id").notNull(),
  playerId: integer("player_id"), // Nullable for unknown scorers
  minute: integer("minute"),
});

// Relations
export const teamsRelations = relations(teams, ({ many }) => ({
  players: many(players),
  homeMatches: many(matches, { relationName: "homeMatches" }),
  awayMatches: many(matches, { relationName: "awayMatches" }),
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

// Schemas
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true });
export const insertPlayerSchema = createInsertSchema(players).omit({ id: true });
export const insertMatchSchema = createInsertSchema(matches).omit({ id: true });
export const insertGoalSchema = createInsertSchema(goals).omit({ id: true });

// Types
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Match = typeof matches.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Goal = typeof goals.$inferSelect;
export type InsertGoal = z.infer<typeof insertGoalSchema>;
