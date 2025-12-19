import { db } from "./db";
import {
  teams, players, matches, goals,
  type InsertTeam, type InsertPlayer, type InsertMatch, type InsertGoal,
  type Team, type Player, type Match, type Goal
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // Teams
  getTeams(): Promise<Team[]>;
  getTeam(id: number): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;

  // Players
  getPlayers(teamId: number): Promise<Player[]>;
  createPlayer(player: InsertPlayer): Promise<Player>;

  // Matches
  getMatches(): Promise<Match[]>;
  getMatch(id: number): Promise<Match | undefined>;
  createMatch(match: InsertMatch): Promise<Match>;
  updateMatch(id: number, updates: Partial<InsertMatch>): Promise<Match>;

  // Goals
  getGoals(matchId: number): Promise<Goal[]>;
  createGoal(goal: InsertGoal): Promise<Goal>;
}

export class DatabaseStorage implements IStorage {
  // Teams
  async getTeams(): Promise<Team[]> {
    return await db.select().from(teams);
  }

  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [newTeam] = await db.insert(teams).values(team).returning();
    return newTeam;
  }

  // Players
  async getPlayers(teamId: number): Promise<Player[]> {
    return await db.select().from(players).where(eq(players.teamId, teamId));
  }

  async createPlayer(player: InsertPlayer): Promise<Player> {
    const [newPlayer] = await db.insert(players).values(player).returning();
    return newPlayer;
  }

  // Matches
  async getMatches(): Promise<Match[]> {
    return await db.select().from(matches).orderBy(desc(matches.date));
  }

  async getMatch(id: number): Promise<Match | undefined> {
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    return match;
  }

  async createMatch(match: InsertMatch): Promise<Match> {
    const [newMatch] = await db.insert(matches).values(match).returning();
    return newMatch;
  }

  async updateMatch(id: number, updates: Partial<InsertMatch>): Promise<Match> {
    const [updated] = await db.update(matches)
      .set(updates)
      .where(eq(matches.id, id))
      .returning();
    return updated;
  }

  // Goals
  async getGoals(matchId: number): Promise<Goal[]> {
    return await db.select().from(goals).where(eq(goals.matchId, matchId));
  }

  async createGoal(goal: InsertGoal): Promise<Goal> {
    const [newGoal] = await db.insert(goals).values(goal).returning();
    return newGoal;
  }
}

export const storage = new DatabaseStorage();
