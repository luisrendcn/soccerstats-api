import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Teams
  app.get(api.teams.list.path, async (req, res) => {
    const teams = await storage.getTeams();
    res.json(teams);
  });

  app.get(api.teams.get.path, async (req, res) => {
    const team = await storage.getTeam(Number(req.params.id));
    if (!team) return res.status(404).json({ message: "Team not found" });
    res.json(team);
  });

  app.post(api.teams.create.path, async (req, res) => {
    try {
      const input = api.teams.create.input.parse(req.body);
      const team = await storage.createTeam(input);
      res.status(201).json(team);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Players
  app.get(api.players.list.path, async (req, res) => {
    const players = await storage.getPlayers(Number(req.params.teamId));
    res.json(players);
  });

  app.post(api.players.create.path, async (req, res) => {
    try {
      const input = api.players.create.input.parse(req.body);
      const player = await storage.createPlayer(input);
      res.status(201).json(player);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Matches
  app.get(api.matches.list.path, async (req, res) => {
    const matches = await storage.getMatches();
    res.json(matches);
  });

  app.get(api.matches.get.path, async (req, res) => {
    const match = await storage.getMatch(Number(req.params.id));
    if (!match) return res.status(404).json({ message: "Match not found" });
    res.json(match);
  });

  app.post(api.matches.create.path, async (req, res) => {
    try {
      const input = api.matches.create.input.parse(req.body);
      // Ensure dates are parsed correctly
      if (typeof input.date === 'string') {
        input.date = new Date(input.date);
      }
      const match = await storage.createMatch(input);
      res.status(201).json(match);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.matches.update.path, async (req, res) => {
    try {
      const input = api.matches.update.input.parse(req.body);
      const match = await storage.updateMatch(Number(req.params.id), input);
      res.json(match);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Goals
  app.post(api.goals.create.path, async (req, res) => {
    try {
      const input = api.goals.create.input.parse(req.body);
      const goal = await storage.createGoal(input);
      
      // Update match score automatically
      const match = await storage.getMatch(input.matchId);
      if (match) {
        const isHome = match.homeTeamId === input.teamId;
        await storage.updateMatch(input.matchId, {
          homeScore: isHome ? (match.homeScore || 0) + 1 : match.homeScore,
          awayScore: !isHome ? (match.awayScore || 0) + 1 : match.awayScore,
        });
      }
      
      res.status(201).json(goal);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get(api.goals.list.path, async (req, res) => {
    const goals = await storage.getGoals(Number(req.params.matchId));
    res.json(goals);
  });

  // Seed Data
  const teams = await storage.getTeams();
  if (teams.length === 0) {
    const teamA = await storage.createTeam({ name: "Thunder FC", color: "#3b82f6" });
    const teamB = await storage.createTeam({ name: "Lightning United", color: "#ef4444" });
    const teamC = await storage.createTeam({ name: "Storm Breakers", color: "#22c55e" });

    await storage.createPlayer({ teamId: teamA.id, name: "John Doe", number: 10 });
    await storage.createPlayer({ teamId: teamA.id, name: "Jane Smith", number: 7 });
    await storage.createPlayer({ teamId: teamB.id, name: "Mike Johnson", number: 9 });

    await storage.createMatch({
      homeTeamId: teamA.id,
      awayTeamId: teamB.id,
      date: new Date(Date.now() - 86400000), // Yesterday
      homeScore: 2,
      awayScore: 1,
      status: "finished"
    });

    await storage.createMatch({
      homeTeamId: teamC.id,
      awayTeamId: teamA.id,
      date: new Date(Date.now() + 86400000), // Tomorrow
      status: "scheduled"
    });
  }

  return httpServer;
}
