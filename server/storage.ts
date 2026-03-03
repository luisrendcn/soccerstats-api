import { db } from "./db";
import {
  teams,
  players,
  matches,
  goals,
  users,
  tournaments,
  tournamentTeams,
  type InsertTeam,
  type InsertPlayer,
  type InsertMatch,
  type InsertGoal,
  type InsertUser,
  type Team,
  type Player,
  type Match,
  type Goal,
  type User,
  type Tournament,
  type InsertTournament,
  type TournamentTeam,
} from "@shared/schema";
import { eq, desc, isNull, and } from "drizzle-orm";

/* =======================
   TYPES
======================= */

export interface Standing {
  teamId: number;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface IStorage {
  // Teams
  getTeams(): Promise<Team[]>;
  getTeam(id: number): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;

  // Players
  getPlayers(teamId?: number): Promise<Player[]>;
  getPlayer(id: number): Promise<Player | undefined>;
  createPlayer(player: InsertPlayer): Promise<Player>;

  // Matches
  getMatches(): Promise<Match[]>;
  getMatch(id: number): Promise<Match | undefined>;
  createMatch(match: InsertMatch): Promise<Match>;
  updateMatch(id: number, updates: Partial<InsertMatch>): Promise<Match>;
  // Soft delete
  softDeleteTeam(id: number): Promise<Team>;
  softDeletePlayer(id: number): Promise<Player>;
  softDeleteMatch(id: number): Promise<Match>;

  // Goals
  getGoals(matchId: number): Promise<Goal[]>;
  createGoal(goal: InsertGoal): Promise<Goal>;

  // Standings
  getStandings(tournamentId?: number): Promise<Standing[]>;

  // Users
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;

  // Tournaments
  getTournaments(): Promise<Tournament[]>;
  getTournamentById(id: number): Promise<Tournament | undefined>;
  createTournament(tournament: InsertTournament): Promise<Tournament>;
  updateTournament(id: number, updates: Partial<InsertTournament>): Promise<Tournament>;
  deleteTournament(id: number): Promise<void>;
  addTeamToTournament(tournamentId: number, teamId: number): Promise<TournamentTeam>;
  removeTeamFromTournament(tournamentId: number, teamId: number): Promise<void>;
  getTournamentTeams(tournamentId: number): Promise<Array<Team & { tournamentId: number }>>;
}

export class DatabaseStorage implements IStorage {
  /* =======================
     TEAMS
  ======================= */

  async getTeams(): Promise<Team[]> {
    return db.select().from(teams).where(isNull(teams.deletedAt));
  }

  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [newTeam] = await db.insert(teams).values(team).returning();
    return newTeam;
  }

  /* =======================
     PLAYERS
  ======================= */

  async getPlayers(teamId?: number): Promise<Player[]> {
    let q: any = db.select().from(players);
    q = q.where(isNull(players.deletedAt));
    if (typeof teamId === "number") {
      q = q.where(eq(players.teamId, teamId));
    }
    return q;
  }

  async getPlayer(id: number): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.id, id));
    return player;
  }

  async createPlayer(player: InsertPlayer): Promise<Player> {
    const [newPlayer] = await db.insert(players).values(player).returning();
    return newPlayer;
  }

  /* =======================
     MATCHES
  ======================= */

  async getMatches(): Promise<Match[]> {
    return db.select().from(matches).where(isNull(matches.deletedAt)).orderBy(desc(matches.date));
  }

  async getMatch(id: number): Promise<Match | undefined> {
    const [match] = await db.select()
      .from(matches)
      .where(and(eq(matches.id, id), isNull(matches.deletedAt)));
    return match;
  }

  async createMatch(match: InsertMatch): Promise<Match> {
    const [newMatch] = await db.insert(matches).values(match).returning();
    return newMatch;
  }

  async updateMatch(
    id: number,
    updates: Partial<InsertMatch>
  ): Promise<Match> {
    const [updatedMatch] = await db
      .update(matches)
      .set(updates)
      .where(eq(matches.id, id))
      .returning();

    return updatedMatch;
  }

  async softDeleteTeam(id: number): Promise<Team> {
    const [updated] = await db.update(teams).set({ deletedAt: new Date() }).where(eq(teams.id, id)).returning();
    return updated;
  }

  async softDeletePlayer(id: number): Promise<Player> {
    const [updated] = await db.update(players).set({ deletedAt: new Date() }).where(eq(players.id, id)).returning();
    return updated;
  }

  async softDeleteMatch(id: number): Promise<Match> {
    const [updated] = await db.update(matches).set({ deletedAt: new Date() }).where(eq(matches.id, id)).returning();
    return updated;
  }

  /* =======================
     GOALS
  ======================= */

  async getGoals(matchId: number): Promise<Goal[]> {
    return db.select().from(goals).where(eq(goals.matchId, matchId));
  }

  async createGoal(goal: InsertGoal): Promise<Goal> {
    const [newGoal] = await db.insert(goals).values(goal).returning();
    return newGoal;
  }

  /* =======================
     STANDINGS
  ======================= */

  async getStandings(tournamentId?: number): Promise<Standing[]> {
    const allTeams = await this.getTeams();
    let finishedMatchesQuery = db
      .select()
      .from(matches)
      .where(eq(matches.status, "finished"));
    if (tournamentId !== undefined) {
      finishedMatchesQuery = finishedMatchesQuery.where(eq(matches.tournamentId, tournamentId));
    }
    const finishedMatches = await finishedMatchesQuery;

    const table: Record<number, Standing> = {};

    // Initialize table
    for (const team of allTeams) {
      table[team.id] = {
        teamId: team.id,
        teamName: team.name,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      };
    }

    for (const match of finishedMatches) {
      // skip invalid records
      if (match.homeTeamId == null || match.awayTeamId == null) continue;
      const home = table[match.homeTeamId];
      const away = table[match.awayTeamId];
      if (!home || !away) continue;

      home.played++;
      away.played++;

      const homeGoals = match.homeScore ?? 0;
      const awayGoals = match.awayScore ?? 0;

      home.goalsFor += homeGoals;
      home.goalsAgainst += awayGoals;
      away.goalsFor += awayGoals;
      away.goalsAgainst += homeGoals;

      if (homeGoals > awayGoals) {
        home.wins++;
        home.points += 3;
        away.losses++;
      } else if (awayGoals > homeGoals) {
        away.wins++;
        away.points += 3;
        home.losses++;
      } else {
        home.draws++;
        away.draws++;
        home.points += 1;
        away.points += 1;
      }
    }

    return Object.values(table)
      .map((t) => ({
        ...t,
        goalDifference: t.goalsFor - t.goalsAgainst,
      }))
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.goalDifference - a.goalDifference ||
          b.goalsFor - a.goalsFor
      );
  }

  /* =======================
     USERS
  ======================= */

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  /* =======================
     TOURNAMENTS
  ======================= */

  async getTournaments(): Promise<Tournament[]> {
    return db.select().from(tournaments).where(isNull(tournaments.deletedAt)).orderBy(desc(tournaments.createdAt));
  }

  async getTournamentById(id: number): Promise<Tournament | undefined> {
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    return tournament;
  }

  async createTournament(tournament: InsertTournament): Promise<Tournament> {
    const [newTournament] = await db.insert(tournaments).values(tournament).returning();
    return newTournament;
  }

  async updateTournament(id: number, updates: Partial<InsertTournament>): Promise<Tournament> {
    const [updatedTournament] = await db
      .update(tournaments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tournaments.id, id))
      .returning();
    return updatedTournament;
  }

  async deleteTournament(id: number): Promise<void> {
    await db
      .update(tournaments)
      .set({ deletedAt: new Date() })
      .where(eq(tournaments.id, id));
  }

  async addTeamToTournament(tournamentId: number, teamId: number): Promise<TournamentTeam> {
    const [relation] = await db
      .insert(tournamentTeams)
      .values({ tournamentId, teamId })
      .returning();
    return relation;
  }

  async removeTeamFromTournament(tournamentId: number, teamId: number): Promise<void> {
    await db
      .delete(tournamentTeams)
      .where(and(eq(tournamentTeams.tournamentId, tournamentId), eq(tournamentTeams.teamId, teamId)));
  }

  async getTournamentTeams(tournamentId: number): Promise<Array<Team & { tournamentId: number }>> {
    const results: any = await db
      .select({
        tournament: tournamentTeams,
        team: teams,
      })
      .from(tournamentTeams)
      .innerJoin(teams, eq(tournamentTeams.teamId, teams.id))
      .where(eq(tournamentTeams.tournamentId, tournamentId));
    return results.map((row: any) => ({
      ...row.team,
      tournamentId: row.tournament.tournamentId,
    }));
  }
}

export const storage = new DatabaseStorage();
