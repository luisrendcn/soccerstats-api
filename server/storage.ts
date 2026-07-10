import { db } from "./db";
import {
  teams,
  players,
  matches,
  goals,
  matchHighlights,
  users,
  registrationRequests,
  tournaments,
  tournamentTeams,
  type InsertTeam,
  type InsertPlayer,
  type InsertMatch,
  type InsertGoal,
  type InsertMatchHighlight,
  type InsertUser,
  type Team,
  type Player,
  type Match,
  type Goal,
  type MatchHighlight,
  type User,
  type RegistrationRequest,
  type Tournament,
  type InsertTournament,
  type TournamentTeam,
} from "@shared/schema";
import { eq, desc, isNull, and, or, inArray, ne } from "drizzle-orm";
import { calculateStandings, type Standing } from "./standings";

/* =======================
   TYPES
======================= */

export type TeamVideogameTournament = {
  tournamentId: number;
  tournamentName: string;
  twitchChannel: string | null;
};

export type TeamWithTournamentMeta = Team & {
  isVideogameTournamentTeam: boolean;
  videogameTournaments: TeamVideogameTournament[];
};

export interface IStorage {
  // Teams
  getTeams(): Promise<TeamWithTournamentMeta[]>;
  getTeam(id: number): Promise<TeamWithTournamentMeta | undefined>;
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

  // Match highlights
  getMatchHighlights(
    matchId: number,
    options?: { includeAll?: boolean; uploadedBy?: number },
  ): Promise<MatchHighlight[]>;
  getMatchHighlight(id: number): Promise<MatchHighlight | undefined>;
  createMatchHighlight(highlight: InsertMatchHighlight): Promise<MatchHighlight>;
  updateMatchHighlight(
    id: number,
    updates: Partial<InsertMatchHighlight>,
  ): Promise<MatchHighlight | undefined>;
  deleteMatchHighlight(id: number): Promise<void>;

  // Standings
  getStandings(tournamentId: number): Promise<Standing[]>;

  // Users
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;
  getRegistrationRequestByEmail(email: string): Promise<RegistrationRequest | undefined>;
  getPendingRegistrationRequests(): Promise<RegistrationRequest[]>;
  createRegistrationRequest(request: {
    email: string;
    password: string;
    name: string;
    requestedRole: string;
  }): Promise<RegistrationRequest>;
  approveRegistrationRequest(id: number, adminId: number): Promise<User | undefined>;
  rejectRegistrationRequest(id: number, adminId: number): Promise<RegistrationRequest | undefined>;
  deleteRegistrationRequestsByEmail(email: string): Promise<void>;

  // Tournaments
  getTournaments(): Promise<Tournament[]>;
  getTournamentById(id: number): Promise<Tournament | undefined>;
  createTournament(tournament: InsertTournament): Promise<Tournament>;
  updateTournament(id: number, updates: Partial<InsertTournament>): Promise<Tournament>;
  deleteTournament(id: number): Promise<void>;
  addTeamToTournament(
    tournamentId: number,
    teamId: number,
    data?: { twitchChannel?: string | null },
  ): Promise<TournamentTeam>;
  removeTeamFromTournament(tournamentId: number, teamId: number): Promise<void>;
  getTournamentTeams(
    tournamentId: number,
  ): Promise<Array<Team & { tournamentId: number; twitchChannel: string | null }>>;
}

export class DatabaseStorage implements IStorage {
  /* =======================
     TEAMS
  ======================= */

  private async attachTeamTournamentMeta<T extends Team>(
    teamList: T[],
  ): Promise<Array<T & TeamWithTournamentMeta>> {
    if (teamList.length === 0) return [];

    const teamIds = teamList.map((team) => team.id);
    const videogameRows = await db
      .select({
        teamId: tournamentTeams.teamId,
        tournamentId: tournaments.id,
        tournamentName: tournaments.name,
        twitchChannel: tournamentTeams.twitchChannel,
      })
      .from(tournamentTeams)
      .innerJoin(tournaments, eq(tournamentTeams.tournamentId, tournaments.id))
      .where(
        and(
          inArray(tournamentTeams.teamId, teamIds),
          eq(tournaments.tournamentType, "videogame"),
          isNull(tournaments.deletedAt),
        ),
      );

    const tournamentsByTeam = new Map<number, TeamVideogameTournament[]>();
    for (const row of videogameRows) {
      const current = tournamentsByTeam.get(row.teamId) || [];
      current.push({
        tournamentId: row.tournamentId,
        tournamentName: row.tournamentName,
        twitchChannel: row.twitchChannel ?? null,
      });
      tournamentsByTeam.set(row.teamId, current);
    }

    return teamList.map((team) => {
      const videogameTournaments = tournamentsByTeam.get(team.id) || [];
      return {
        ...team,
        isVideogameTournamentTeam: videogameTournaments.length > 0,
        videogameTournaments,
      };
    });
  }

  async getTeams(): Promise<TeamWithTournamentMeta[]> {
    const teamList = await db.select().from(teams).where(isNull(teams.deletedAt));
    return this.attachTeamTournamentMeta(teamList);
  }

  async getTeam(id: number): Promise<TeamWithTournamentMeta | undefined> {
    const [team] = await db
      .select()
      .from(teams)
      .where(and(eq(teams.id, id), isNull(teams.deletedAt)));
    if (!team) return undefined;
    const [teamWithMeta] = await this.attachTeamTournamentMeta([team]);
    return teamWithMeta;
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [newTeam] = await db.insert(teams).values(team).returning();
    return newTeam;
  }

  /* =======================
     PLAYERS
  ======================= */

  async getPlayers(teamId?: number): Promise<Player[]> {
    const conditions = [isNull(players.deletedAt)];
    if (typeof teamId === "number") conditions.push(eq(players.teamId, teamId));
    return db.select().from(players).where(and(...conditions));
  }

  async getPlayer(id: number): Promise<Player | undefined> {
    const [player] = await db
      .select()
      .from(players)
      .where(and(eq(players.id, id), isNull(players.deletedAt)));
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
     MATCH HIGHLIGHTS
  ======================= */

  async getMatchHighlights(
    matchId: number,
    options: { includeAll?: boolean; uploadedBy?: number } = {},
  ): Promise<MatchHighlight[]> {
    const conditions = [eq(matchHighlights.matchId, matchId)];
    if (!options.includeAll) {
      conditions.push(eq(matchHighlights.status, "approved"));
      if (options.uploadedBy) {
        return db
          .select()
          .from(matchHighlights)
          .where(
            and(
              eq(matchHighlights.matchId, matchId),
              or(
                eq(matchHighlights.status, "approved"),
                eq(matchHighlights.uploadedBy, options.uploadedBy),
              ),
            ),
          )
          .orderBy(desc(matchHighlights.createdAt));
      }
    }

    return db
      .select()
      .from(matchHighlights)
      .where(and(...conditions))
      .orderBy(desc(matchHighlights.createdAt));
  }

  async getMatchHighlight(id: number): Promise<MatchHighlight | undefined> {
    const [highlight] = await db
      .select()
      .from(matchHighlights)
      .where(eq(matchHighlights.id, id));
    return highlight;
  }

  async createMatchHighlight(
    highlight: InsertMatchHighlight,
  ): Promise<MatchHighlight> {
    const [created] = await db
      .insert(matchHighlights)
      .values(highlight)
      .returning();
    return created;
  }

  async updateMatchHighlight(
    id: number,
    updates: Partial<InsertMatchHighlight>,
  ): Promise<MatchHighlight | undefined> {
    const [updated] = await db
      .update(matchHighlights)
      .set(updates)
      .where(eq(matchHighlights.id, id))
      .returning();
    return updated;
  }

  async deleteMatchHighlight(id: number): Promise<void> {
    await db.delete(matchHighlights).where(eq(matchHighlights.id, id));
  }

  /* =======================
     STANDINGS
  ======================= */

  async getStandings(tournamentId: number): Promise<Standing[]> {
    const tournamentParticipants = await this.getTournamentTeams(tournamentId);
    const conditions = [
      eq(matches.status, "finished"),
      isNull(matches.deletedAt),
      eq(matches.tournamentId, tournamentId),
    ];
    const finishedMatches = await db
      .select()
      .from(matches)
      .where(and(...conditions));

    return calculateStandings(tournamentParticipants, finishedMatches);
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

  async getRegistrationRequestByEmail(email: string): Promise<RegistrationRequest | undefined> {
    const [request] = await db
      .select()
      .from(registrationRequests)
      .where(eq(registrationRequests.email, email));
    return request;
  }

  async getPendingRegistrationRequests(): Promise<RegistrationRequest[]> {
    return db
      .select()
      .from(registrationRequests)
      .where(eq(registrationRequests.status, "pending"))
      .orderBy(desc(registrationRequests.requestedAt));
  }

  async createRegistrationRequest(request: {
    email: string;
    password: string;
    name: string;
    requestedRole: string;
  }): Promise<RegistrationRequest> {
    const [created] = await db
      .insert(registrationRequests)
      .values({ ...request, status: "pending" })
      .returning();
    return created;
  }

  async approveRegistrationRequest(
    id: number,
    adminId: number,
  ): Promise<User | undefined> {
    return db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(registrationRequests)
        .where(
          and(
            eq(registrationRequests.id, id),
            eq(registrationRequests.status, "pending"),
          ),
        );
      if (!request) return undefined;

      const [existingUser] = await tx
        .select()
        .from(users)
        .where(eq(users.email, request.email));
      if (existingUser) {
        await tx
          .update(registrationRequests)
          .set({
            status: "rejected",
            reviewedAt: new Date(),
            reviewedBy: adminId,
          })
          .where(eq(registrationRequests.id, id));
        return undefined;
      }

      const [user] = await tx
        .insert(users)
        .values({
          email: request.email,
          password: request.password,
          name: request.name,
          role:
            request.requestedRole === "team"
              ? "team_captain"
              : request.requestedRole || "team_captain",
          isActive: true,
        })
        .returning();

      await tx
        .update(registrationRequests)
        .set({
          status: "approved",
          reviewedAt: new Date(),
          reviewedBy: adminId,
        })
        .where(eq(registrationRequests.id, id));

      return user;
    });
  }

  async rejectRegistrationRequest(
    id: number,
    adminId: number,
  ): Promise<RegistrationRequest | undefined> {
    const [request] = await db
      .update(registrationRequests)
      .set({
        status: "rejected",
        reviewedAt: new Date(),
        reviewedBy: adminId,
      })
      .where(
        and(
          eq(registrationRequests.id, id),
          eq(registrationRequests.status, "pending"),
        ),
      )
      .returning();
    return request;
  }

  async deleteRegistrationRequestsByEmail(email: string): Promise<void> {
    await db
      .delete(registrationRequests)
      .where(eq(registrationRequests.email, email));
  }

  /* =======================
     TOURNAMENTS
  ======================= */

  async getTournaments(): Promise<Tournament[]> {
    return db.select().from(tournaments).where(isNull(tournaments.deletedAt)).orderBy(desc(tournaments.createdAt));
  }

  async getTournamentById(id: number): Promise<Tournament | undefined> {
    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(and(eq(tournaments.id, id), isNull(tournaments.deletedAt)));
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
    await db.transaction(async (tx) => {
      const deletedAt = new Date();
      const tournamentTeamRows = await tx
        .select({ teamId: tournamentTeams.teamId })
        .from(tournamentTeams)
        .where(eq(tournamentTeams.tournamentId, id));
      const tournamentTeamIds = tournamentTeamRows.map((row) => row.teamId);

      await tx
        .update(tournaments)
        .set({ deletedAt, updatedAt: deletedAt })
        .where(eq(tournaments.id, id));

      await tx
        .update(matches)
        .set({ deletedAt })
        .where(and(eq(matches.tournamentId, id), isNull(matches.deletedAt)));

      if (tournamentTeamIds.length > 0) {
        const otherActiveTournamentRows = await tx
          .select({ teamId: tournamentTeams.teamId })
          .from(tournamentTeams)
          .innerJoin(tournaments, eq(tournamentTeams.tournamentId, tournaments.id))
          .where(
            and(
              inArray(tournamentTeams.teamId, tournamentTeamIds),
              ne(tournamentTeams.tournamentId, id),
              isNull(tournaments.deletedAt),
            ),
          );
        const teamIdsInOtherActiveTournaments = new Set(
          otherActiveTournamentRows.map((row) => row.teamId),
        );
        const teamIdsToDelete = tournamentTeamIds.filter(
          (teamId) => !teamIdsInOtherActiveTournaments.has(teamId),
        );

        if (teamIdsToDelete.length > 0) {
          await tx
            .update(teams)
            .set({ deletedAt })
            .where(and(inArray(teams.id, teamIdsToDelete), isNull(teams.deletedAt)));

          await tx
            .update(players)
            .set({ deletedAt })
            .where(and(inArray(players.teamId, teamIdsToDelete), isNull(players.deletedAt)));
        }
      }

      await tx
        .delete(tournamentTeams)
        .where(eq(tournamentTeams.tournamentId, id));
    });
  }

  async addTeamToTournament(
    tournamentId: number,
    teamId: number,
    data?: { twitchChannel?: string | null },
  ): Promise<TournamentTeam> {
    const [relation] = await db
      .insert(tournamentTeams)
      .values({ tournamentId, teamId, twitchChannel: data?.twitchChannel ?? null })
      .returning();
    return relation;
  }

  async removeTeamFromTournament(tournamentId: number, teamId: number): Promise<void> {
    await db
      .delete(tournamentTeams)
      .where(and(eq(tournamentTeams.tournamentId, tournamentId), eq(tournamentTeams.teamId, teamId)));
  }

  async getTournamentTeams(
    tournamentId: number,
  ): Promise<Array<Team & { tournamentId: number; twitchChannel: string | null }>> {
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
      twitchChannel: row.tournament.twitchChannel ?? null,
    }));
  }
}

export const storage = new DatabaseStorage();
