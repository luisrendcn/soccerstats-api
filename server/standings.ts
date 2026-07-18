import type { Match, Team } from "@shared/schema";

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

export function calculateStandings(
  tournamentParticipants: Team[],
  finishedMatches: Match[],
): Standing[] {
  const table: Record<number, Standing> = {};

  for (const team of tournamentParticipants) {
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
    if (!match.homeTeamId || !match.awayTeamId) continue;
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
      home.points++;
      away.points++;
    }
  }

  return Object.values(table)
    .map((team) => ({
      ...team,
      goalDifference: team.goalsFor - team.goalsAgainst,
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor,
    );
}
