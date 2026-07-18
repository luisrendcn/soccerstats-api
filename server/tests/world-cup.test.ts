import { describe, expect, it } from "vitest";
import type { Match, Team } from "@shared/schema";
import {
  buildClassicWorldCupFixturePlan,
  calculateGroupStandings,
  resolveKnockoutResult,
} from "../world-cup";

const teams = Array.from({ length: 32 }, (_, index) => ({
  id: index + 1,
  name: `Team ${index + 1}`,
  color: "#000000",
  deletedAt: null,
})) satisfies Team[];

function finishedMatch(
  homeTeamId: number,
  awayTeamId: number,
  homeScore: number,
  awayScore: number,
): Match {
  return {
    id: homeTeamId * 100 + awayTeamId,
    tournamentId: 1,
    homeTeamId,
    awayTeamId,
    homeScore,
    awayScore,
    date: new Date(),
    status: "finished",
    location: null,
    streamPlatform: null,
    streamChannel: null,
    streamUrl: null,
    tournamentPhase: "group_stage",
    groupId: 1,
    roundNumber: 1,
    bracketCode: null,
    matchOrder: null,
    regulationHomeScore: null,
    regulationAwayScore: null,
    extraTimeHomeScore: null,
    extraTimeAwayScore: null,
    penaltyHomeScore: null,
    penaltyAwayScore: null,
    winnerTeamId: null,
    victoryMethod: null,
    homeSourceMatchId: null,
    awaySourceMatchId: null,
    homeSourceType: null,
    awaySourceType: null,
    winnerAdvancesToMatchId: null,
    loserAdvancesToMatchId: null,
    winnerAdvancesToSlot: null,
    loserAdvancesToSlot: null,
    deletedAt: null,
  };
}

describe("classic world cup fixture plan", () => {
  it("requires exactly 32 unique teams", () => {
    expect(() => buildClassicWorldCupFixturePlan(teams.slice(0, 31).map((team) => team.id))).toThrow(
      "exactamente 32 equipos",
    );
    expect(() => buildClassicWorldCupFixturePlan([...teams.map((team) => team.id).slice(0, 31), 31])).toThrow(
      "exactamente 32 equipos",
    );
  });

  it("creates 8 groups of 4 teams and no duplicate team assignments", () => {
    const plan = buildClassicWorldCupFixturePlan(teams.map((team) => team.id));
    expect(plan.groups).toHaveLength(8);
    expect(plan.groups.every((group) => group.teamIds.length === 4)).toBe(true);
    expect(new Set(plan.groups.flatMap((group) => group.teamIds)).size).toBe(32);
  });

  it("creates 48 group matches, each team plays 3 times, and each pair meets once", () => {
    const plan = buildClassicWorldCupFixturePlan(teams.map((team) => team.id));
    expect(plan.groupMatches).toHaveLength(48);

    const appearances = new Map<number, number>();
    const pairKeys = new Set<string>();
    for (const match of plan.groupMatches) {
      appearances.set(match.homeTeamId, (appearances.get(match.homeTeamId) || 0) + 1);
      appearances.set(match.awayTeamId, (appearances.get(match.awayTeamId) || 0) + 1);
      pairKeys.add([match.homeTeamId, match.awayTeamId].sort((a, b) => a - b).join("-"));
    }

    expect([...appearances.values()].every((count) => count === 3)).toBe(true);
    expect(pairKeys.size).toBe(48);
  });

  it("creates the expected knockout structure and 64 total matches", () => {
    const plan = buildClassicWorldCupFixturePlan(teams.map((team) => team.id));
    const roundOf16 = plan.knockoutMatches.filter((match) => match.phase === "round_of_16");
    expect(roundOf16).toHaveLength(8);
    expect(roundOf16[0]).toMatchObject({
      code: "O1",
      homeSource: "1A",
      awaySource: "2B",
    });
    expect(plan.knockoutMatches).toHaveLength(16);
    expect(plan.totalMatches).toBe(64);
  });
});

describe("classic world cup standings and knockout rules", () => {
  it("calculates points, goal difference, and group qualifiers", () => {
    const groupTeams = teams.slice(0, 4);
    const standings = calculateGroupStandings("A", groupTeams, [
      finishedMatch(1, 2, 2, 0),
      finishedMatch(1, 3, 1, 1),
      finishedMatch(1, 4, 3, 0),
      finishedMatch(2, 3, 1, 0),
      finishedMatch(2, 4, 2, 2),
      finishedMatch(3, 4, 1, 0),
    ]);

    expect(standings[0]).toMatchObject({
      teamId: 1,
      points: 7,
      goalDifference: 5,
    });
    expect(standings.slice(0, 2).map((team) => team.teamId)).toEqual([1, 3]);
  });

  it("requires a manual decision when automatic group tiebreakers are exhausted", () => {
    const groupTeams = teams.slice(0, 4);
    const matches = [
      finishedMatch(1, 2, 0, 0),
      finishedMatch(1, 3, 0, 0),
      finishedMatch(1, 4, 0, 0),
      finishedMatch(2, 3, 0, 0),
      finishedMatch(2, 4, 0, 0),
      finishedMatch(3, 4, 0, 0),
    ];

    const unresolvedStandings = calculateGroupStandings("A", groupTeams, matches);
    expect(unresolvedStandings.every((team) => team.unresolvedTie)).toBe(true);

    const decidedStandings = calculateGroupStandings(
      "A",
      groupTeams,
      matches,
      new Map([
        [2, 1],
        [1, 2],
        [4, 3],
        [3, 4],
      ]),
    );
    expect(decidedStandings.map((team) => team.teamId)).toEqual([2, 1, 4, 3]);
    expect(decidedStandings.every((team) => team.unresolvedTie === false)).toBe(true);
  });

  it("does not allow a definitive knockout draw", () => {
    const match = {
      ...finishedMatch(1, 2, 1, 1),
      tournamentPhase: "round_of_16",
      bracketCode: "O1",
    } satisfies Match;
    expect(() => resolveKnockoutResult(match)).toThrow("no puede finalizar empatada");
  });

  it("resolves penalty shootouts with a single winner", () => {
    const match = {
      ...finishedMatch(1, 2, 1, 1),
      tournamentPhase: "round_of_16",
      bracketCode: "O1",
      penaltyHomeScore: 4,
      penaltyAwayScore: 3,
    } satisfies Match;
    expect(resolveKnockoutResult(match)).toEqual({
      winnerTeamId: 1,
      victoryMethod: "penalties",
    });
  });
});
