import { describe, expect, it } from "vitest";
import type { Match, Team } from "@shared/schema";
import { calculateStandings } from "../standings";

describe("tournament standings", () => {
  it("includes only enrolled teams and ignores matches with outsiders", () => {
    const participants = [
      { id: 1, name: "Alpha", color: "#111111", deletedAt: null },
      { id: 2, name: "Beta", color: "#222222", deletedAt: null },
    ] satisfies Team[];
    const matches = [
      {
        id: 1,
        tournamentId: 10,
        homeTeamId: 1,
        awayTeamId: 2,
        homeScore: 2,
        awayScore: 0,
        date: new Date(),
        status: "finished",
        location: null,
        deletedAt: null,
      },
      {
        id: 2,
        tournamentId: 10,
        homeTeamId: 1,
        awayTeamId: 99,
        homeScore: 5,
        awayScore: 0,
        date: new Date(),
        status: "finished",
        location: null,
        deletedAt: null,
      },
    ] satisfies Match[];

    const standings = calculateStandings(participants, matches);

    expect(standings.map((team) => team.teamId)).toEqual([1, 2]);
    expect(standings[0]).toMatchObject({
      teamId: 1,
      played: 1,
      points: 3,
      goalsFor: 2,
    });
    expect(standings.some((team) => team.teamId === 99)).toBe(false);
  });
});
