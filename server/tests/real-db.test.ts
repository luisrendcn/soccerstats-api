import 'dotenv/config';
// The real-db integration tests will run against the configured DATABASE_URL
// make sure your .env or environment points to a transient/test database.

import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import express from 'express';
import session from 'express-session';
import MemoryStore from 'memorystore';
import { createServer } from 'http';
import request from 'supertest';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { storage } from '../storage';
import { registerRoutes } from '../routes';

let app: express.Express;
let server: ReturnType<typeof createServer>;

// store ids for cleanup
let createdTeamId: number | null = null;
let createdPlayerId: number | null = null;
let createdMatchId: number | null = null;
let createdUserId: number | null = null;
let createdTournamentId: number | null = null;
let createdGoalId: number | null = null;


// helper to build an express instance wired to routes with a given role/teamId
function makeApp(role: string, teamId?: number|null) {
  const instance = express();
  instance.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  instance.use(express.urlencoded({ extended: false }));

  const MemoryStoreClass = MemoryStore(session);
  const sessionStore = new MemoryStoreClass({});
  instance.use(
    session({
      store: sessionStore,
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    }),
  );

  instance.use((req: any, _res, next) => {
    (req.session as any).userRole = role;
    if (teamId !== undefined) {
      (req.session as any).teamId = teamId;
    }
    if (role === 'admin') {
      (req.session as any).userId = 1;
    }
    next();
  });

  const srv = createServer(instance);
  void registerRoutes(srv as any, instance);
  return instance;
}

beforeAll(async () => {
  app = makeApp('admin');
  server = createServer(app);
  // routes already registered in makeApp
  // ensure the tournament_id column exists in the real database as well
  await db.execute(sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_id integer`);
});

afterAll(async () => {
  // cleanup created records if possible
  if (createdGoalId) {
    // no soft delete for goals; just ignore
  }
  if (createdMatchId) {
    await storage.softDeleteMatch(createdMatchId);
  }
  if (createdPlayerId) {
    await storage.softDeletePlayer(createdPlayerId);
  }
  if (createdTournamentId && createdTeamId) {
    await storage.removeTeamFromTournament(createdTournamentId, createdTeamId);
    await storage.deleteTournament(createdTournamentId);
  }
  if (createdTeamId) {
    await storage.softDeleteTeam(createdTeamId);
  }
  if (createdUserId) {
    await storage.deleteUser(createdUserId);
  }
  server.close();
});

describe('Integration with real sqlite DB', () => {
  it('can create and list teams', async () => {
    // list existing teams (may not be empty on shared DB)
    const initial = await request(app).get('/api/teams');
    expect(initial.status).toBe(200);

    // create team
    const res = await request(app).post('/api/teams').send({ name: 'Real Team', color: '#123456' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    createdTeamId = res.body.id;

    // ensure new team appears
    const after = await request(app).get('/api/teams');
    expect(after.status).toBe(200);
    expect(after.body.some((t: any) => t.id === createdTeamId)).toBe(true);
  });

  it('can create player linked to team', async () => {
    expect(createdTeamId).not.toBeNull();
    const res = await request(app).post('/api/players').send({ teamId: createdTeamId, name: 'Real Player', number: 5 });
    expect(res.status).toBe(201);
    expect(res.body.teamId).toBe(createdTeamId);
    createdPlayerId = res.body.id;

    const list = await request(app).get(`/api/teams/${createdTeamId}/players`);
    expect(list.status).toBe(200);
    expect(list.body.some((p: any) => p.id === createdPlayerId)).toBe(true);
  });

  it('team-role user can manage only own players (real db)', async () => {
    expect(createdTeamId).not.toBeNull();
    // create an app as team owner
    const teamApp = makeApp('team', createdTeamId || undefined);
    // try creating for own team
    const ok = await request(teamApp).post('/api/players').send({ teamId: createdTeamId, name: 'Owned', number: 7 });
    expect(ok.status).toBe(201);
    // attempt to create for different team
    const forbidden = await request(teamApp).post('/api/players').send({ teamId: (createdTeamId || 0) + 1, name: 'Other', number: 8 });
    expect(forbidden.status).toBe(403);
  });


  it('can create and update a match, add goal influences score and finish it', async () => { // longer operations


    expect(createdTeamId).not.toBeNull();
      // Standings assertions below depend on the match belonging to a real
      // tournament. If `createdTournamentId` is null (which it is at this point)
      // the query string becomes `tournamentId=null`, parseInt() yields NaN and
      // the backend will ignore the filter, returning global standings. To avoid
      // that we create a tournament explicitly here and keep its id.
      const tRes1 = await request(app)
        .post('/api/tournaments')
        .send({ name: 'First Tour', startDate: new Date().toISOString() });
      expect(tRes1.status).toBe(201);
      const firstTourId = tRes1.body.id;
      createdTournamentId = firstTourId;

      const create = await request(app)
        .post('/api/matches')
        .send({ homeTeamId: createdTeamId, awayTeamId: createdTeamId, date: new Date().toISOString(), tournamentId: firstTourId });
    expect(create.status).toBe(201);
    createdMatchId = create.body.id;

    // add a goal by the home team
    const goalRes = await request(app).post('/api/goals').send({ matchId: createdMatchId, teamId: createdTeamId, minute: 10 });
    expect(goalRes.status).toBe(201);
    createdGoalId = goalRes.body.id;

    // fetch match to ensure score updated
    const get = await request(app).get(`/api/matches/${createdMatchId}`);
    expect(get.status).toBe(200);
    expect(get.body.homeScore).toBe(1);

    // mark match as finished with final score
    const update = await request(app).put(`/api/matches/${createdMatchId}`).send({ homeScore: 2, awayScore: 1, status: 'finished' });
    expect(update.status).toBe(200);
    expect(update.body.homeScore).toBe(2);

    // check standings reflect the finished match (belongs to first tournament)
    const stand = await request(app).get('/api/standings');
    expect(stand.status).toBe(200);
    expect(Array.isArray(stand.body)).toBe(true);
    expect(stand.body.some((s: any) => s.teamId === createdTeamId && s.points > 0)).toBe(true);

    // now create a second tournament and another finished match to differentiate totals
    const tRes2 = await request(app).post('/api/tournaments').send({ name: 'Second Tour', startDate: new Date().toISOString() });
    expect(tRes2.status).toBe(201);
    const secondTourId = tRes2.body.id;

    const create2 = await request(app).post('/api/matches').send({ homeTeamId: createdTeamId, awayTeamId: createdTeamId, date: new Date().toISOString(), tournamentId: secondTourId });
    expect(create2.status).toBe(201);
    const secondMatchId = create2.body.id;
    await request(app).put(`/api/matches/${secondMatchId}`).send({ homeScore: 1, awayScore: 0, status: 'finished' });

    // global standings should now show 6 points for our team
    const globalStand = await request(app).get('/api/standings');
    expect(globalStand.body.some((s: any) => s.teamId === createdTeamId && s.points >= 6)).toBe(true);

    // filtered standings for first tournament only include 3 points
    const standT1 = await request(app).get(`/api/standings?tournamentId=${createdTournamentId}`);
    expect(standT1.body.some((s: any) => s.teamId === createdTeamId && s.points === 3)).toBe(true);

    const standT2 = await request(app).get(`/api/standings?tournamentId=${secondTourId}`);
    expect(standT2.body.some((s: any) => s.teamId === createdTeamId && s.points === 3)).toBe(true);
  }, 10000);

  it('can create an admin user and list via admin endpoint', async () => {
    const payload = { email: 'testuser@example.com', password: 'Password123', name: 'Test User', role: 'public' };
    const res = await request(app).post('/api/admin/users').send(payload);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    createdUserId = res.body.id;

    const list = await request(app).get('/api/admin/users');
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.some((u: any) => u.id === createdUserId)).toBe(true);

    // update user name
    const newName = 'Updated Name';
    const upd = await request(app).put(`/api/admin/users/${createdUserId}`).send({ name: newName });
    expect(upd.status).toBe(200);
    expect(upd.body.name).toBe(newName);
  });

  it('can create a tournament and add team', async () => {
    // increase complexity/significantly longer operations
    const tourPayload = { name: 'Test Tournament', startDate: new Date().toISOString() };
    const tRes = await request(app).post('/api/tournaments').send(tourPayload);
    expect(tRes.status).toBe(201);
    expect(tRes.body).toHaveProperty('id');
    createdTournamentId = tRes.body.id;

    // add team to tournament
    const rel = await request(app).post(`/api/tournaments/${createdTournamentId}/teams`).send({ teamId: createdTeamId });
    expect(rel.status).toBe(201);

    // fetch tournament teams
    const teamsList = await request(app).get(`/api/tournaments/${createdTournamentId}/teams`);
    expect(teamsList.status).toBe(200);
    expect(Array.isArray(teamsList.body)).toBe(true);
    expect(teamsList.body.some((t: any) => t.id === createdTeamId)).toBe(true);

    // now delete tournament
    const del = await request(app).delete(`/api/tournaments/${createdTournamentId}`);
    expect(del.status).toBe(200);

    const getDel = await request(app).get(`/api/tournaments/${createdTournamentId}`);
    // deletedAt should be set after deletion
    expect(getDel.status).toBe(200);
    expect(getDel.body.deletedAt).not.toBeNull();
  }, 15000);
});
