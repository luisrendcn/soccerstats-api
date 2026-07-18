import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  matches,
  teams,
  tournamentTeams,
  tournaments,
  worldCupGroups,
  worldCupGroupTeams,
  type Match,
  type Team,
  type Tournament,
} from "@shared/schema";

async function getDb() {
  return (await import("./db")).db;
}

export const CLASSIC_WORLD_CUP_TEAM_COUNT = 32;
export const WORLD_CUP_GROUP_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H"];
export const WORLD_CUP_PHASES = [
  "group_stage",
  "round_of_16",
  "quarterfinals",
  "semifinals",
  "third_place",
  "final",
] as const;

export type WorldCupPhase = (typeof WORLD_CUP_PHASES)[number];
export type VictoryMethod =
  | "regular_time"
  | "extra_time"
  | "penalties"
  | "walkover"
  | "manual_decision";

export type GenerateClassicWorldCupInput = {
  startAt: Date;
  intervalDays: number;
  location?: string | null;
};

export type GroupStanding = {
  teamId: number;
  teamName: string;
  groupName: string;
  position: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  tieBreakNote?: string;
  unresolvedTie?: boolean;
};

type GroupWithTeams = {
  id: number;
  name: string;
  sortOrder: number;
  status: string;
  teams: Array<Team & { seed: number }>;
  standings: GroupStanding[];
  matches: Match[];
};

export type ClassicWorldCupSummary = {
  tournament: Tournament;
  groups: GroupWithTeams[];
  knockoutMatches: Match[];
  finalClassification: {
    championTeamId: number | null;
    runnerUpTeamId: number | null;
    thirdPlaceTeamId: number | null;
    fourthPlaceTeamId: number | null;
  };
};

const groupPairings = [
  [
    [0, 1],
    [2, 3],
  ],
  [
    [0, 2],
    [1, 3],
  ],
  [
    [0, 3],
    [1, 2],
  ],
] as const;

const roundOf16Slots = [
  ["O1", "1A", "2B"],
  ["O2", "1C", "2D"],
  ["O3", "1E", "2F"],
  ["O4", "1G", "2H"],
  ["O5", "1B", "2A"],
  ["O6", "1D", "2C"],
  ["O7", "1F", "2E"],
  ["O8", "1H", "2G"],
] as const;

const knockoutPlan = [
  ["C1", "quarterfinals", "O1", "O2"],
  ["C2", "quarterfinals", "O3", "O4"],
  ["C3", "quarterfinals", "O5", "O6"],
  ["C4", "quarterfinals", "O7", "O8"],
  ["S1", "semifinals", "C1", "C2"],
  ["S2", "semifinals", "C3", "C4"],
  ["TP", "third_place", "S1", "S2"],
  ["F", "final", "S1", "S2"],
] as const;

export function buildClassicWorldCupFixturePlan(teamIds: number[]) {
  const uniqueTeamIds = [...new Set(teamIds)];
  if (
    teamIds.length !== CLASSIC_WORLD_CUP_TEAM_COUNT ||
    uniqueTeamIds.length !== CLASSIC_WORLD_CUP_TEAM_COUNT
  ) {
    throw new Error(
      "Para generar un Mundial clásico deben estar registrados exactamente 32 equipos.",
    );
  }

  const groups = WORLD_CUP_GROUP_NAMES.map((name, index) => ({
    name,
    teamIds: teamIds.slice(index * 4, index * 4 + 4),
  }));
  const groupMatches = groups.flatMap((group) =>
    groupPairings.flatMap((roundPairs, roundIndex) =>
      roundPairs.map(([homeIndex, awayIndex], pairIndex) => ({
        groupName: group.name,
        roundNumber: roundIndex + 1,
        homeTeamId: group.teamIds[homeIndex],
        awayTeamId: group.teamIds[awayIndex],
        code: `${group.name}${roundIndex + 1}-${pairIndex + 1}`,
      })),
    ),
  );
  const knockoutMatches = [
    ...roundOf16Slots.map(([code, homeSource, awaySource]) => ({
      code,
      phase: "round_of_16",
      homeSource,
      awaySource,
    })),
    ...knockoutPlan.map(([code, phase, homeSource, awaySource]) => ({
      code,
      phase,
      homeSource,
      awaySource,
    })),
  ];

  return {
    groups,
    groupMatches,
    knockoutMatches,
    totalMatches: groupMatches.length + knockoutMatches.length,
  };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function isGroupStageMatch(match: Match) {
  return match.tournamentPhase === "group_stage";
}

function getMatchGoals(match: Match) {
  return {
    home: match.regulationHomeScore ?? match.homeScore ?? 0,
    away: match.regulationAwayScore ?? match.awayScore ?? 0,
  };
}

function compareGroupStanding(
  a: GroupStanding,
  b: GroupStanding,
  manualRanks = new Map<number, number>(),
) {
  const manualRankA = manualRanks.get(a.teamId);
  const manualRankB = manualRanks.get(b.teamId);
  return (
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    (manualRankA != null && manualRankB != null ? manualRankA - manualRankB : 0) ||
    (a.teamName || "").localeCompare(b.teamName || "")
  );
}

export function calculateGroupStandings(
  groupName: string,
  groupTeams: Team[],
  groupMatches: Match[],
  manualRanks = new Map<number, number>(),
): GroupStanding[] {
  const table = new Map<number, GroupStanding>();
  for (const team of groupTeams) {
    table.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      groupName,
      position: 0,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  }

  for (const match of groupMatches.filter((item) => item.status === "finished")) {
    if (!match.homeTeamId || !match.awayTeamId) continue;
    const home = table.get(match.homeTeamId);
    const away = table.get(match.awayTeamId);
    if (!home || !away) continue;
    const score = getMatchGoals(match);

    home.played += 1;
    away.played += 1;
    home.goalsFor += score.home;
    home.goalsAgainst += score.away;
    away.goalsFor += score.away;
    away.goalsAgainst += score.home;

    if (score.home > score.away) {
      home.wins += 1;
      home.points += 3;
      away.losses += 1;
    } else if (score.away > score.home) {
      away.wins += 1;
      away.points += 3;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  const ordered = [...table.values()]
    .map((team) => ({
      ...team,
      goalDifference: team.goalsFor - team.goalsAgainst,
    }))
    .sort((a, b) => compareGroupStanding(a, b, manualRanks));

  for (const [index, team] of ordered.entries()) {
    team.position = index + 1;
    team.tieBreakNote =
      index > 0 && team.points !== ordered[index - 1].points
        ? "points"
        : index > 0 && team.goalDifference !== ordered[index - 1].goalDifference
          ? "goal_difference"
          : index > 0 && team.goalsFor !== ordered[index - 1].goalsFor
            ? "goals_for"
            : undefined;
  }

  const unresolvedGroups = new Map<string, GroupStanding[]>();
  for (const team of ordered) {
    const key = `${team.points}:${team.goalDifference}:${team.goalsFor}`;
    unresolvedGroups.set(key, [...(unresolvedGroups.get(key) || []), team]);
  }
  for (const tiedTeams of unresolvedGroups.values()) {
    if (tiedTeams.length > 1) {
      const manualRankValues = tiedTeams.map((team) => manualRanks.get(team.teamId));
      const hasCompleteManualDecision = manualRankValues.every(
        (rank) => typeof rank === "number",
      );
      const hasUniqueManualDecision =
        hasCompleteManualDecision &&
        new Set(manualRankValues.filter((rank): rank is number => rank != null)).size ===
          tiedTeams.length;
      tiedTeams.forEach((team) => {
        team.unresolvedTie = !hasUniqueManualDecision;
        team.tieBreakNote = hasUniqueManualDecision
          ? "manual_decision"
          : "manual_decision_required";
      });
    }
  }

  return ordered;
}

export async function setClassicWorldCupGroupManualRanks(
  tournamentId: number,
  groupId: number,
  ranks: Array<{ teamId: number; manualRank: number }>,
) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [group] = await tx
      .select()
      .from(worldCupGroups)
      .where(
        and(
          eq(worldCupGroups.id, groupId),
          eq(worldCupGroups.tournamentId, tournamentId),
        ),
      );
    if (!group) throw new Error("Grupo no encontrado");

    const groupTeams = await tx
      .select()
      .from(worldCupGroupTeams)
      .where(
        and(
          eq(worldCupGroupTeams.groupId, groupId),
          eq(worldCupGroupTeams.tournamentId, tournamentId),
        ),
      );
    const allowedTeamIds = new Set(groupTeams.map((team) => team.teamId));
    const rankValues = ranks.map((rank) => rank.manualRank);
    if (new Set(rankValues).size !== rankValues.length) {
      throw new Error("Los puestos manuales no se pueden repetir");
    }
    for (const rank of ranks) {
      if (!allowedTeamIds.has(rank.teamId)) {
        throw new Error("Solo se pueden ordenar equipos del grupo seleccionado");
      }
    }

    for (const rank of ranks) {
      await tx
        .update(worldCupGroupTeams)
        .set({ manualRank: rank.manualRank })
        .where(
          and(
            eq(worldCupGroupTeams.groupId, groupId),
            eq(worldCupGroupTeams.teamId, rank.teamId),
          ),
        );
    }
  });
}

export async function generateClassicWorldCup(
  tournamentId: number,
  input: GenerateClassicWorldCupInput,
) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [tournament] = await tx
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId));
    if (!tournament) throw new Error("Torneo no encontrado");
    if (tournament.tournamentFormat !== "classic_world_cup") {
      throw new Error("Este calendario solo aplica para Mundial clásico");
    }

    const participants = await tx
      .select({ team: teams })
      .from(tournamentTeams)
      .innerJoin(teams, eq(tournamentTeams.teamId, teams.id))
      .where(eq(tournamentTeams.tournamentId, tournamentId));
    if (participants.length !== CLASSIC_WORLD_CUP_TEAM_COUNT) {
      throw new Error(
        "Para generar un Mundial clásico deben estar registrados exactamente 32 equipos.",
      );
    }

    const existingMatches = await tx
      .select()
      .from(matches)
      .where(
        and(eq(matches.tournamentId, tournamentId), isNull(matches.deletedAt)),
      );
    if (existingMatches.length > 0) {
      return {
        rounds: 7,
        matches: existingMatches,
        alreadyGenerated: true,
      };
    }

    const shuffledTeams = shuffle(participants.map((row) => row.team));
    const createdGroups = [];
    for (const [index, name] of WORLD_CUP_GROUP_NAMES.entries()) {
      const [group] = await tx
        .insert(worldCupGroups)
        .values({
          tournamentId,
          name,
          sortOrder: index + 1,
          status: "scheduled",
        })
        .returning();
      createdGroups.push(group);

      const groupTeams = shuffledTeams.slice(index * 4, index * 4 + 4);
      await tx.insert(worldCupGroupTeams).values(
        groupTeams.map((team, seedIndex) => ({
          tournamentId,
          groupId: group.id,
          teamId: team.id,
          seed: seedIndex + 1,
        })),
      );
    }

    const createdMatches: Match[] = [];
    for (const [groupIndex, group] of createdGroups.entries()) {
      const groupTeams = shuffledTeams.slice(groupIndex * 4, groupIndex * 4 + 4);
      for (const [roundIndex, roundPairs] of groupPairings.entries()) {
        const date = addDays(input.startAt, roundIndex * input.intervalDays);
        for (const [pairIndex, [homeIndex, awayIndex]] of roundPairs.entries()) {
          const [match] = await tx
            .insert(matches)
            .values({
              tournamentId,
              homeTeamId: groupTeams[homeIndex].id,
              awayTeamId: groupTeams[awayIndex].id,
              date,
              location: input.location || null,
              status: "scheduled",
              tournamentPhase: "group_stage",
              groupId: group.id,
              roundNumber: roundIndex + 1,
              bracketCode: `${group.name}${roundIndex + 1}-${pairIndex + 1}`,
              matchOrder: createdMatches.length + 1,
            })
            .returning();
          createdMatches.push(match);
        }
      }
    }

    const knockoutByCode = new Map<string, Match>();
    const phaseDayOffset: Record<string, number> = {
      round_of_16: 3,
      quarterfinals: 4,
      semifinals: 5,
      third_place: 6,
      final: 6,
    };
    for (const [index, [code, homeSource, awaySource]] of roundOf16Slots.entries()) {
      const [match] = await tx
        .insert(matches)
        .values({
          tournamentId,
          homeTeamId: null,
          awayTeamId: null,
          date: addDays(input.startAt, phaseDayOffset.round_of_16 * input.intervalDays),
          location: input.location || null,
          status: "scheduled",
          tournamentPhase: "round_of_16",
          bracketCode: code,
          matchOrder: 49 + index,
          homeSourceType: homeSource,
          awaySourceType: awaySource,
        })
        .returning();
      knockoutByCode.set(code, match);
      createdMatches.push(match);
    }

    for (const [index, [code, phase, homeCode, awayCode]] of knockoutPlan.entries()) {
      const [match] = await tx
        .insert(matches)
        .values({
          tournamentId,
          homeTeamId: null,
          awayTeamId: null,
          date: addDays(input.startAt, phaseDayOffset[phase] * input.intervalDays),
          location: input.location || null,
          status: "scheduled",
          tournamentPhase: phase,
          bracketCode: code,
          matchOrder: 57 + index,
          homeSourceMatchId: knockoutByCode.get(homeCode)?.id || null,
          awaySourceMatchId: knockoutByCode.get(awayCode)?.id || null,
          homeSourceType: phase === "third_place" ? "loser" : "winner",
          awaySourceType: phase === "third_place" ? "loser" : "winner",
        })
        .returning();
      knockoutByCode.set(code, match);
      createdMatches.push(match);
    }

    const updates: Array<{
      code: string;
      winnerTo?: string;
      winnerSlot?: "home" | "away";
      loserTo?: string;
      loserSlot?: "home" | "away";
    }> = [
      { code: "O1", winnerTo: "C1", winnerSlot: "home" },
      { code: "O2", winnerTo: "C1", winnerSlot: "away" },
      { code: "O3", winnerTo: "C2", winnerSlot: "home" },
      { code: "O4", winnerTo: "C2", winnerSlot: "away" },
      { code: "O5", winnerTo: "C3", winnerSlot: "home" },
      { code: "O6", winnerTo: "C3", winnerSlot: "away" },
      { code: "O7", winnerTo: "C4", winnerSlot: "home" },
      { code: "O8", winnerTo: "C4", winnerSlot: "away" },
      { code: "C1", winnerTo: "S1", winnerSlot: "home" },
      { code: "C2", winnerTo: "S1", winnerSlot: "away" },
      { code: "C3", winnerTo: "S2", winnerSlot: "home" },
      { code: "C4", winnerTo: "S2", winnerSlot: "away" },
      { code: "S1", winnerTo: "F", winnerSlot: "home", loserTo: "TP", loserSlot: "home" },
      { code: "S2", winnerTo: "F", winnerSlot: "away", loserTo: "TP", loserSlot: "away" },
    ];

    for (const update of updates) {
      const source = knockoutByCode.get(update.code);
      if (!source) continue;
      await tx
        .update(matches)
        .set({
          winnerAdvancesToMatchId: update.winnerTo
            ? knockoutByCode.get(update.winnerTo)?.id || null
            : null,
          winnerAdvancesToSlot: update.winnerSlot || null,
          loserAdvancesToMatchId: update.loserTo
            ? knockoutByCode.get(update.loserTo)?.id || null
            : null,
          loserAdvancesToSlot: update.loserSlot || null,
        })
        .where(eq(matches.id, source.id));
    }

    await tx
      .update(tournaments)
      .set({ status: "scheduled", updatedAt: new Date() })
      .where(eq(tournaments.id, tournamentId));

    return { rounds: 7, matches: createdMatches, alreadyGenerated: false };
  });
}

async function setAdvancingTeam(
  matchId: number | null,
  slot: string | null,
  teamId: number | null,
) {
  if (!matchId || !slot || !teamId) return;
  const db = await getDb();
  const field = slot === "home" ? { homeTeamId: teamId } : { awayTeamId: teamId };
  await db.update(matches).set(field).where(eq(matches.id, matchId));
}

export function resolveKnockoutResult(match: Match) {
  if (!match.homeTeamId || !match.awayTeamId) {
    throw new Error("La eliminatoria aún no tiene ambos equipos definidos");
  }
  const home = match.homeScore ?? 0;
  const away = match.awayScore ?? 0;
  let winnerTeamId: number | null = null;
  let victoryMethod: VictoryMethod | null = null;

  if (match.victoryMethod === "walkover" || match.victoryMethod === "manual_decision") {
    if (!match.winnerTeamId) {
      throw new Error("Selecciona el ganador de la eliminatoria");
    }
    return {
      winnerTeamId: match.winnerTeamId,
      victoryMethod: match.victoryMethod as VictoryMethod,
    };
  }

  if (home > away) {
    winnerTeamId = match.homeTeamId;
    victoryMethod = match.extraTimeHomeScore != null ? "extra_time" : "regular_time";
  } else if (away > home) {
    winnerTeamId = match.awayTeamId;
    victoryMethod = match.extraTimeAwayScore != null ? "extra_time" : "regular_time";
  } else {
    const homePenalties = match.penaltyHomeScore;
    const awayPenalties = match.penaltyAwayScore;
    if (homePenalties == null || awayPenalties == null || homePenalties === awayPenalties) {
      throw new Error("Una eliminatoria no puede finalizar empatada. Registra penales o decisión manual.");
    }
    winnerTeamId = homePenalties > awayPenalties ? match.homeTeamId : match.awayTeamId;
    victoryMethod = "penalties";
  }

  return { winnerTeamId, victoryMethod };
}

export async function advanceClassicWorldCupMatch(match: Match) {
  if (
    match.tournamentPhase === "group_stage" ||
    !match.tournamentPhase ||
    match.status !== "finished"
  ) {
    return match;
  }

  const { winnerTeamId, victoryMethod } = resolveKnockoutResult(match);
  const db = await getDb();
  const loserTeamId =
    winnerTeamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;

  await db
    .update(matches)
    .set({ winnerTeamId, victoryMethod })
    .where(eq(matches.id, match.id));

  await setAdvancingTeam(
    match.winnerAdvancesToMatchId,
    match.winnerAdvancesToSlot,
    winnerTeamId,
  );
  await setAdvancingTeam(
    match.loserAdvancesToMatchId,
    match.loserAdvancesToSlot,
    loserTeamId || null,
  );

  if (match.bracketCode === "F" && match.tournamentId) {
    await db
      .update(tournaments)
      .set({
        championTeamId: winnerTeamId,
        runnerUpTeamId: loserTeamId || null,
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(tournaments.id, match.tournamentId));
  }
  if (match.bracketCode === "TP" && match.tournamentId) {
    await db
      .update(tournaments)
      .set({
        thirdPlaceTeamId: winnerTeamId,
        fourthPlaceTeamId: loserTeamId || null,
        updatedAt: new Date(),
      })
      .where(eq(tournaments.id, match.tournamentId));
  }

  const [updated] = await db.select().from(matches).where(eq(matches.id, match.id));
  return updated || match;
}

export async function fillRoundOf16FromGroups(tournamentId: number) {
  const summary = await getClassicWorldCupSummary(tournamentId);
  const db = await getDb();
  const groupWinner = new Map<string, number>();
  const groupRunnerUp = new Map<string, number>();
  for (const group of summary.groups) {
    if (group.matches.some((match) => match.status !== "finished")) {
      throw new Error("Completa todos los partidos de fase de grupos antes de generar octavos");
    }
    if (group.standings.slice(0, 2).some((standing) => standing.unresolvedTie)) {
      throw new Error("Hay empates sin resolver manualmente en la fase de grupos");
    }
    groupWinner.set(group.name, group.standings[0]?.teamId);
    groupRunnerUp.set(group.name, group.standings[1]?.teamId);
  }

  const matchesByCode = new Map(
    summary.knockoutMatches.map((match) => [match.bracketCode, match]),
  );
  for (const [code, homeSource, awaySource] of roundOf16Slots) {
    const match = matchesByCode.get(code);
    if (!match) continue;
    const homeGroup = homeSource.slice(1);
    const awayGroup = awaySource.slice(1);
    const homeTeamId = homeSource.startsWith("1")
      ? groupWinner.get(homeGroup)
      : groupRunnerUp.get(homeGroup);
    const awayTeamId = awaySource.startsWith("1")
      ? groupWinner.get(awayGroup)
      : groupRunnerUp.get(awayGroup);
    await db
      .update(matches)
      .set({ homeTeamId: homeTeamId || null, awayTeamId: awayTeamId || null })
      .where(eq(matches.id, match.id));
  }
}

export async function getClassicWorldCupSummary(
  tournamentId: number,
): Promise<ClassicWorldCupSummary> {
  const db = await getDb();
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));
  if (!tournament) throw new Error("Torneo no encontrado");

  const groupRows = await db
    .select()
    .from(worldCupGroups)
    .where(eq(worldCupGroups.tournamentId, tournamentId));
  const groupTeamRows = await db
    .select({
      groupTeam: worldCupGroupTeams,
      team: teams,
    })
    .from(worldCupGroupTeams)
    .innerJoin(teams, eq(worldCupGroupTeams.teamId, teams.id))
    .where(eq(worldCupGroupTeams.tournamentId, tournamentId));
  const matchRows = await db
    .select()
    .from(matches)
    .where(
      and(eq(matches.tournamentId, tournamentId), isNull(matches.deletedAt)),
    );

  const groups: GroupWithTeams[] = groupRows
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((group) => {
      const groupTeams = groupTeamRows
        .filter((row) => row.groupTeam.groupId === group.id)
        .sort((a, b) => a.groupTeam.seed - b.groupTeam.seed)
        .map((row) => ({ ...row.team, seed: row.groupTeam.seed }));
      const manualRanks = new Map(
        groupTeamRows
          .filter(
            (row) =>
              row.groupTeam.groupId === group.id && row.groupTeam.manualRank != null,
          )
          .map((row) => [row.groupTeam.teamId, row.groupTeam.manualRank as number]),
      );
      const groupMatches = matchRows
        .filter((match) => isGroupStageMatch(match) && match.groupId === group.id)
        .sort((a, b) => (a.matchOrder || 0) - (b.matchOrder || 0));
      return {
        id: group.id,
        name: group.name,
        sortOrder: group.sortOrder,
        status: group.status,
        teams: groupTeams,
        standings: calculateGroupStandings(
          group.name,
          groupTeams,
          groupMatches,
          manualRanks,
        ),
        matches: groupMatches,
      };
    });

  return {
    tournament,
    groups,
    knockoutMatches: matchRows
      .filter((match) => match.tournamentPhase && match.tournamentPhase !== "group_stage")
      .sort((a, b) => (a.matchOrder || 0) - (b.matchOrder || 0)),
    finalClassification: {
      championTeamId: tournament.championTeamId || null,
      runnerUpTeamId: tournament.runnerUpTeamId || null,
      thirdPlaceTeamId: tournament.thirdPlaceTeamId || null,
      fourthPlaceTeamId: tournament.fourthPlaceTeamId || null,
    },
  };
}

export function ensureClassicWorldCupMatchCanFinish(match: Match, update: Partial<Match>) {
  const phase = update.tournamentPhase || match.tournamentPhase;
  if (!phase || phase === "group_stage" || update.status !== "finished") return;
  resolveKnockoutResult({ ...match, ...update });
}

export async function hasDownstreamFinishedMatch(match: Match) {
  const downstreamIds = [
    match.winnerAdvancesToMatchId,
    match.loserAdvancesToMatchId,
  ].filter((id): id is number => Number.isInteger(id));
  if (downstreamIds.length === 0) return false;
  const db = await getDb();
  const downstream = await db
    .select()
    .from(matches)
    .where(inArray(matches.id, downstreamIds));
  return downstream.some((item) => item.status === "finished");
}
