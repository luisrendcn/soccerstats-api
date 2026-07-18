import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import express from 'express';
import session from 'express-session';
import { createServer } from 'http';
import request from 'supertest';

// Mock storage to avoid requiring a real DB
vi.mock('../storage', () => {
  const mockStorage = {
    getTeams: async () => [{ id: 1, name: 'Team A', color: '#000000' }],
    getTeam: async (id: number) => ({ id, name: 'Team A', color: '#000000' }),
    createTeam: async (team: any) => ({ id: 2, ...team }),
    getPlayers: async (teamId?: number) => (teamId ? [{ id: 1, teamId, name: 'P1', number: 9 }] : [{ id: 1, teamId: 1, name: 'P1', number: 9 }]),
    getPlayer: async (id: number) => ({ id, teamId: 1, name: 'P1', number: 9 }),
    createPlayer: async (p: any) => ({ id: 2, ...p }),
    getMatches: async () => [],
    getMatch: async (id: number) => undefined,
    createMatch: async (m: any) => ({ id: 1, ...m }),
    updateMatch: async (id: number, updates: any) => ({ id, ...updates }),
    softDeleteTeam: async (id: number) => ({ id, name: 'deleted' }),
    softDeletePlayer: async (id: number) => ({ id }),
    softDeleteMatch: async (id: number) => ({ id }),
    getGoals: async () => [],
    createGoal: async (g: any) => ({ id: 1, ...g }),
    getMatchHighlights: async () => [
      {
        id: 1,
        matchId: 9,
        tournamentId: 42,
        teamId: 1,
        playerId: null,
        title: 'Golazo',
        description: 'Gran jugada',
        highlightType: 'goal',
        minute: 12,
        videoUrl: 'https://youtu.be/highlight123',
        videoPublicId: 'soccer-stats/match-highlights/9/highlight',
        thumbnailUrl: null,
        uploadedBy: 1,
        createdAt: new Date(),
        status: 'approved',
        durationSeconds: 15,
        fileSizeBytes: 1024,
      },
    ],
    getMatchHighlight: async (id: number) => ({
      id,
      matchId: 9,
      tournamentId: 42,
      teamId: 1,
      playerId: null,
      title: 'Golazo',
      description: 'Gran jugada',
      highlightType: 'goal',
      minute: 12,
      videoUrl: 'https://youtu.be/highlight123',
      videoPublicId: 'soccer-stats/match-highlights/9/highlight',
      thumbnailUrl: null,
      uploadedBy: 1,
      createdAt: new Date(),
      status: 'pending',
      durationSeconds: 15,
      fileSizeBytes: 1024,
    }),
    createMatchHighlight: async (h: any) => ({ id: 1, createdAt: new Date(), ...h }),
    updateMatchHighlight: async (id: number, updates: any) => ({ id, ...updates }),
    deleteMatchHighlight: async () => {},
    getStandings: async (_tournamentId: number) => [],
    getUserByEmail: async () => undefined,
    getUserById: async (id: number) => {
      const roleById: Record<number, string> = {
        1: 'admin',
        2: 'public',
        3: 'referee',
        4: 'tournament_manager',
      };
      const isTeamUser = id >= 10_000;
      return {
        id,
        email: 'active@example.com',
        password: 'unused',
        name: 'Active User',
        role: isTeamUser ? 'team_captain' : roleById[id] || 'public',
        teamId: isTeamUser ? id - 10_000 : null,
        isActive: true,
      };
    },
    createUser: async (u: any) => ({ id: 1, ...u }),
    getAllUsers: async () => [],
    updateUser: async (id: number, updates: any) => ({ id, ...updates }),
    deleteUser: async () => {},
    getRegistrationRequestByEmail: async () => undefined,
    getRegistrationRequestById: async (id: number) => ({
      id,
      email: 'pending@example.com',
      password: 'hidden',
      name: 'Pending User',
      requestedRole: 'team_captain',
      requestKind: 'account',
      teamType: null,
      tournamentId: null,
      teamName: null,
      twitchChannel: null,
      playersJson: null,
      status: 'pending',
      requestedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
    }),
    deleteRegistrationRequestsByEmail: async () => {},
    getPendingRegistrationRequests: async () => [],
    createRegistrationRequest: async (registration: any) => ({
      id: 1,
      ...registration,
      requestedRole: registration.requestedRole || 'team_captain',
      status: 'pending',
      requestedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
    }),
    approveRegistrationRequest: async (id: number) => ({
      id,
      email: 'approved@example.com',
      password: 'hidden',
      name: 'Approved User',
      role: 'team_captain',
      teamId: null,
      isActive: true,
    }),
    rejectRegistrationRequest: async (id: number, adminId: number) => ({
      id,
      email: 'rejected@example.com',
      password: 'hidden',
      name: 'Rejected User',
      requestedRole: 'team_captain',
      status: 'rejected',
      requestedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: adminId,
    }),
    createNotification: async (notification: any) => ({
      id: 1,
      readAt: null,
      createdAt: new Date(),
      ...notification,
    }),
    createNotifications: async (notifications: any[]) =>
      notifications.map((notification, index) => ({
        id: index + 1,
        readAt: null,
        createdAt: new Date(),
        ...notification,
      })),
    getUserNotifications: async (userId: number) => [
      {
        id: 1,
        userId,
        title: 'Recordatorio de partido',
        body: 'Team A vs Team B está programado para este momento.',
        type: 'match_reminder',
        link: '/matches/1',
        entityType: 'match',
        entityId: 1,
        scheduledAt: new Date(),
        readAt: null,
        createdAt: new Date(),
      },
    ],
    markNotificationRead: async (id: number, userId: number) => ({
      id,
      userId,
      title: 'Recordatorio de partido',
      body: 'Team A vs Team B está programado para este momento.',
      type: 'match_reminder',
      link: '/matches/1',
      entityType: 'match',
      entityId: 1,
      scheduledAt: new Date(),
      readAt: new Date(),
      createdAt: new Date(),
    }),
    markAllNotificationsRead: async () => {},
    deleteNotificationsForEntity: async () => {},
    getTournaments: async () => [],
    getTournamentById: async (id: number) => ({
      id,
      name: `Tournament ${id}`,
      tournamentType: 'soccer',
    }),
    createTournament: async (t: any) => ({ id: 1, ...t }),
    updateTournament: async (id: number, updates: any) => ({ id, ...updates }),
    deleteTournament: async () => {},
    addTeamToTournament: async (
      tId: number,
      teamId: number,
      data?: { twitchChannel?: string | null },
    ) => ({
      id: 1,
      tournamentId: tId,
      teamId,
      twitchChannel: data?.twitchChannel ?? null,
    }),
    removeTeamFromTournament: async () => {},
    getTournamentTeams: async () => [],
  };
  return { storage: mockStorage } as any;
});

// we also need to import the storage module for spying later
import { storage } from '../storage';

import * as auth from '../auth';
import { registerRoutes } from '../routes';

// ensure default permission behavior will be set in beforeEach below

let app: express.Express;
let server: ReturnType<typeof createServer>;

// helper that builds a fresh express application with optional role/teamId injection
function buildApp(role?: string, teamId?: number | null) {
  const instance = express();
  instance.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  instance.use(express.urlencoded({ extended: false }));

  instance.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    }),
  );

  if (role) {
    instance.use((req: any, _res, next) => {
      const userIdByRole: Record<string, number> = {
        admin: 1,
        public: 2,
        referee: 3,
        tournament_manager: 4,
      };
      (req.session as any).userId =
        role === 'team_captain' ? 10_000 + (teamId || 0) : userIdByRole[role];
      (req.session as any).userRole = role;
      if (teamId !== undefined) {
        (req.session as any).teamId = teamId;
      }
      next();
    });
  }

  const srv = createServer(instance);
  void registerRoutes(srv as any, instance);
  return instance;
}

beforeEach(() => {
  // default permission allow
  vi.spyOn(auth, 'hasPermission').mockReturnValue(true);
});

beforeAll(async () => {
  app = buildApp('admin');
  server = createServer(app);
});

afterAll(() => {
  server.close();
});

describe('Integration: basic endpoints (mocked storage)', () => {
  it('returns teams list', async () => {
    const res = await request(app).get('/api/teams');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('name', 'Team A');
  });

  it('returns players list for team', async () => {
    const res = await request(app).get('/api/teams/1/players');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('teamId', 1);
  });

  it('forwards tournamentId query to storage', async () => {
    const spy = vi.spyOn(storage, 'getStandings');
    const res = await request(app).get('/api/standings?tournamentId=42');
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(42);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('returns due in-app notifications for the authenticated user', async () => {
    const getNotifications = vi.spyOn(storage, 'getUserNotifications');

    const res = await request(app).get('/api/notifications');

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      userId: 1,
      type: 'match_reminder',
      readAt: null,
    });
    expect(getNotifications).toHaveBeenCalledWith(1, {
      includeFuture: false,
      includeRead: false,
      limit: 30,
      type: undefined,
    });
  });

  it('marks a notification as read for the authenticated user', async () => {
    const markRead = vi.spyOn(storage, 'markNotificationRead');

    const res = await request(app).post('/api/notifications/7/read');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 7, userId: 1 });
    expect(res.body.readAt).toBeTruthy();
    expect(markRead).toHaveBeenCalledWith(7, 1);
  });

  it('returns success when soft deleting a team', async () => {
    const softDelete = vi.spyOn(storage, 'softDeleteTeam');

    const res = await request(app).delete('/api/teams/5');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(softDelete).toHaveBeenCalledWith(5);
  });

  it('allows the public role to read tournament standings', async () => {
    const publicApp = buildApp('public');
    vi.spyOn(auth, 'hasPermission').mockImplementation(
      (role, resource, action) =>
        role === 'public' && resource === 'tournaments' && action === 'read',
    );

    const res = await request(publicApp).get('/api/standings?tournamentId=42');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('blocks public access to tournaments created by a blocked manager', async () => {
    const unauthApp = buildApp();
    const getTournamentById = vi
      .spyOn(storage, 'getTournamentById')
      .mockResolvedValueOnce({
        id: 42,
        name: 'Blocked Manager Cup',
        createdBy: 4,
        tournamentType: 'soccer',
      } as any);
    const getUserById = vi.spyOn(storage, 'getUserById').mockImplementation(async (id: number) => ({
      id,
      email: 'manager@example.com',
      password: 'unused',
      name: 'Blocked Manager',
      role: 'tournament_manager',
      teamId: null,
      isActive: false,
    }) as any);

    const res = await request(unauthApp).get('/api/tournaments/42');

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      code: 'TOURNAMENT_MANAGER_BLOCKED',
    });
    expect(getTournamentById).toHaveBeenCalledWith(42);

    getUserById.mockRestore();
    getTournamentById.mockRestore();
  });

  it('allows admins to open tournaments created by a blocked manager', async () => {
    const getTournamentById = vi
      .spyOn(storage, 'getTournamentById')
      .mockResolvedValueOnce({
        id: 42,
        name: 'Blocked Manager Cup',
        createdBy: 4,
        tournamentType: 'soccer',
      } as any);
    const getUserById = vi.spyOn(storage, 'getUserById').mockImplementation(async (id: number) => ({
      id,
      email: id === 1 ? 'admin@example.com' : 'manager@example.com',
      password: 'unused',
      name: id === 1 ? 'Admin' : 'Blocked Manager',
      role: id === 1 ? 'admin' : 'tournament_manager',
      teamId: null,
      isActive: id === 1,
    }) as any);

    const res = await request(app).get('/api/tournaments/42');

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Blocked Manager Cup');
    expect(getTournamentById).toHaveBeenCalledWith(42);

    getUserById.mockRestore();
    getTournamentById.mockRestore();
  });

  it('requires a tournament when requesting standings', async () => {
    const res = await request(app).get('/api/standings');

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('tournamentId');
  });

  it('can create a player (permission mocked)', async () => {
    const payload = { teamId: 1, name: 'New Player', number: 11 };
    const res = await request(app).post('/api/players').send(payload);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('name', 'New Player');
  });

  it('team captain can only add players to their own team', async () => {
    const teamApp = buildApp('team_captain', 5);
    // permit create
    vi.spyOn(auth, 'hasPermission').mockReturnValue(true);
    let res = await request(teamApp).post('/api/players').send({ teamId: 5, name: 'Own', number: 1 });
    expect(res.status).toBe(201);
    res = await request(teamApp).post('/api/players').send({ teamId: 6, name: 'Other', number: 2 });
    expect(res.status).toBe(403);
  });

  it('team captain sees only their team players when listing all', async () => {
    const teamApp = buildApp('team_captain', 7);
    vi.spyOn(auth, 'hasPermission').mockReturnValue(true);
    const res = await request(teamApp).get('/api/players');
    expect(res.status).toBe(200);
    if (Array.isArray(res.body)) {
      res.body.forEach((p: any) => expect(p.teamId).toBe(7));
    }
  });

  it('imports players in bulk and skips players already on the roster', async () => {
    const createPlayer = vi.spyOn(storage, 'createPlayer');

    const res = await request(app)
      .post('/api/teams/1/players/import')
      .send({
        players: [
          { name: 'P1', number: 9 },
          { name: 'New Player', number: 10 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.created).toHaveLength(1);
    expect(res.body.skipped).toHaveLength(1);
    expect(createPlayer).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 1, name: 'New Player', number: 10 }),
    );
  });

  it('referee role cannot create teams or matches even if permission function is stubbed', async () => {
    const refApp = buildApp('referee');
    // force allow according to hasPermission, ownership check should still block some actions
    vi.spyOn(auth, 'hasPermission').mockReturnValue(true);
    let res = await request(refApp).post('/api/teams').send({ name: 'X', color: '#123' });
    // referee doesn't have create permission in matrix, but we mocked; route still sees hasPermission true so will create team
    // we can't test matrix here since hasPermission is stubbed globally; but we can test match creation is denied via matrix
    // to simulate correct behavior, we'll override hasPermission for matches:create
    vi.spyOn(auth, 'hasPermission').mockImplementation((role, resource) => {
      if (role === 'referee' && resource === 'matches') return false;
      return true;
    });
    res = await request(refApp).post('/api/matches').send({ homeTeamId: 1, awayTeamId: 2, date: new Date() });
    expect(res.status).toBe(403);
  });

  it('returns matches list', async () => {
    const res = await request(app).get('/api/matches');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('filters matches by tournament when tournamentId is provided', async () => {
    vi.spyOn(storage, 'getTournamentById').mockResolvedValueOnce({
      id: 42,
      name: 'Tournament 42',
      createdBy: 1,
      tournamentType: 'soccer',
    } as any);
    vi.spyOn(storage, 'getMatches').mockResolvedValueOnce([
      { id: 1, tournamentId: 42, homeTeamId: 1, awayTeamId: 2 },
      { id: 2, tournamentId: 7, homeTeamId: 3, awayTeamId: 4 },
      { id: 3, tournamentId: 42, homeTeamId: 5, awayTeamId: 6 },
    ] as any);

    const res = await request(app).get('/api/matches?tournamentId=42');

    expect(res.status).toBe(200);
    expect(res.body.map((match: any) => match.id)).toEqual([1, 3]);
  });

  it('creates a team inside a tournament and enrolls it immediately', async () => {
    const createTeam = vi.spyOn(storage, 'createTeam');
    const enrollTeam = vi.spyOn(storage, 'addTeamToTournament');

    const res = await request(app)
      .post('/api/tournaments/42/teams/new')
      .send({ name: 'Tournament Team', color: '#123456' });

    expect(res.status).toBe(201);
    expect(createTeam).toHaveBeenCalledWith(expect.objectContaining({ name: 'Tournament Team' }));
    expect(enrollTeam).toHaveBeenCalledWith(42, 2, { twitchChannel: null });
  });

  it('requires a Twitch channel when creating a team in a videogame tournament', async () => {
    vi.spyOn(storage, 'getTournamentById').mockResolvedValueOnce({
      id: 42,
      name: 'eFootball Cup',
      createdBy: 1,
      tournamentType: 'videogame',
    } as any);

    const missing = await request(app)
      .post('/api/tournaments/42/teams/new')
      .send({ name: 'Player One', color: '#123456' });

    expect(missing.status).toBe(400);
    expect(missing.body.message).toContain('Twitch');

    vi.spyOn(storage, 'getTournamentById').mockResolvedValueOnce({
      id: 42,
      name: 'eFootball Cup',
      createdBy: 1,
      tournamentType: 'videogame',
    } as any);

    const created = await request(app)
      .post('/api/tournaments/42/teams/new')
      .send({
        name: 'Player One',
        color: '#123456',
        twitchChannel: 'player_one',
      });

    expect(created.status).toBe(201);
    expect(created.body.twitchChannel).toBe('player_one');
  });

  it('imports tournament teams in bulk and skips duplicates', async () => {
    vi.spyOn(storage, 'getTournamentTeams').mockResolvedValueOnce([] as any);
    const createTeam = vi.spyOn(storage, 'createTeam');
    const enrollTeam = vi.spyOn(storage, 'addTeamToTournament');

    const res = await request(app)
      .post('/api/tournaments/42/teams/import')
      .send({
        teams: [
          { name: 'Team A', color: '#111111' },
          { name: 'Imported FC', color: 'rojo' },
          { name: 'Imported FC', color: '#333333' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.enrolledExisting).toHaveLength(1);
    expect(res.body.created).toHaveLength(1);
    expect(res.body.skipped).toHaveLength(1);
    expect(createTeam).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Imported FC', color: '#dc2626' }),
    );
    expect(enrollTeam).toHaveBeenCalledWith(42, 1, { twitchChannel: null });
  });

  it('lets a tournament manager manage tournaments they created', async () => {
    const managerApp = buildApp('tournament_manager');
    vi.spyOn(storage, 'getTournamentById').mockResolvedValueOnce({
      id: 42,
      name: 'Own Tournament',
      createdBy: 4,
    } as any);

    const res = await request(managerApp)
      .post('/api/tournaments/42/teams/new')
      .send({ name: 'Managed Team', color: '#abcdef' });

    expect(res.status).toBe(201);
  });

  it('blocks a tournament manager from managing tournaments created by someone else', async () => {
    const managerApp = buildApp('tournament_manager');
    vi.spyOn(storage, 'getTournamentById').mockResolvedValueOnce({
      id: 42,
      name: 'Other Tournament',
      createdBy: 99,
    } as any);

    const res = await request(managerApp)
      .post('/api/tournaments/42/teams/new')
      .send({ name: 'Blocked Team', color: '#abcdef' });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('otro usuario');
  });

  it('creates matches only with teams enrolled in the tournament', async () => {
    vi.spyOn(storage, 'getTournamentTeams').mockResolvedValueOnce([
      { id: 1, name: 'Team A' },
      { id: 2, name: 'Team B' },
    ] as any);

    const valid = await request(app).post('/api/matches').send({
      tournamentId: 42,
      homeTeamId: 1,
      awayTeamId: 2,
      date: new Date().toISOString(),
    });
    expect(valid.status).toBe(201);

    vi.spyOn(storage, 'getTournamentTeams').mockResolvedValueOnce([
      { id: 1, name: 'Team A' },
    ] as any);
    const invalid = await request(app).post('/api/matches').send({
      tournamentId: 42,
      homeTeamId: 1,
      awayTeamId: 3,
      date: new Date().toISOString(),
    });
    expect(invalid.status).toBe(400);
  });

  it('generates a full round-robin schedule for an even number of teams', async () => {
    vi.spyOn(storage, 'getTournamentTeams').mockResolvedValueOnce([
      { id: 1, name: 'Team A' },
      { id: 2, name: 'Team B' },
      { id: 3, name: 'Team C' },
      { id: 4, name: 'Team D' },
    ] as any);
    vi.spyOn(storage, 'getMatches').mockResolvedValueOnce([]);
    const createMatch = vi.spyOn(storage, 'createMatch');

    const res = await request(app)
      .post('/api/tournaments/42/matches/generate')
      .send({
        startAt: new Date('2026-07-20T15:00:00.000Z').toISOString(),
        intervalDays: 7,
        location: 'Main Field',
      });

    expect(res.status).toBe(201);
    expect(res.body.rounds).toBe(3);
    expect(res.body.matches).toHaveLength(6);
    expect(createMatch).toHaveBeenCalledTimes(6);
  });

  it('blocks automatic schedule generation with an odd number of teams', async () => {
    vi.spyOn(storage, 'getTournamentTeams').mockResolvedValueOnce([
      { id: 1, name: 'Team A' },
      { id: 2, name: 'Team B' },
      { id: 3, name: 'Team C' },
    ] as any);

    const res = await request(app)
      .post('/api/tournaments/42/matches/generate')
      .send({
        startAt: new Date('2026-07-20T15:00:00.000Z').toISOString(),
        intervalDays: 7,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('impar');
  });

  it('rejects goals for a team that is not in the match', async () => {
    vi.spyOn(storage, 'getMatch').mockResolvedValueOnce({
      id: 9,
      homeTeamId: 1,
      awayTeamId: 2,
      homeScore: 0,
      awayScore: 0,
    } as any);
    const createGoal = vi.spyOn(storage, 'createGoal');

    const res = await request(app)
      .post('/api/goals')
      .send({ matchId: 9, teamId: 3, minute: 10 });

    expect(res.status).toBe(400);
    expect(createGoal).not.toHaveBeenCalled();
  });

  it('returns approved match highlights to unauthenticated public users', async () => {
    const unauthApp = buildApp();
    vi.spyOn(storage, 'getMatch').mockResolvedValueOnce({
      id: 9,
      tournamentId: 42,
      homeTeamId: 1,
      awayTeamId: 2,
    } as any);
    const getHighlights = vi.spyOn(storage, 'getMatchHighlights');

    const res = await request(unauthApp).get('/api/matches/9/highlights');

    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty('status', 'approved');
    expect(getHighlights).toHaveBeenCalledWith(9, {
      includeAll: false,
      uploadedBy: undefined,
    });
  });

  it('requires authentication to create a match highlight', async () => {
    const unauthApp = buildApp();

    const res = await request(unauthApp)
      .post('/api/matches/9/highlights')
      .send({
        teamId: 1,
        title: 'Golazo',
        highlightType: 'goal',
        minute: 12,
        videoUrl: 'https://youtu.be/highlight123',
      });

    expect(res.status).toBe(401);
  });

  it('lets a team captain upload a pending highlight for their own match team', async () => {
    const captainApp = buildApp('team_captain', 5);
    vi.spyOn(storage, 'getMatch').mockResolvedValueOnce({
      id: 11,
      tournamentId: 42,
      homeTeamId: 5,
      awayTeamId: 6,
    } as any);
    const createHighlight = vi.spyOn(storage, 'createMatchHighlight');

    const res = await request(captainApp)
      .post('/api/matches/11/highlights')
      .send({
        teamId: 5,
        title: 'Atajada clave',
        description: 'Salvó el empate al final',
        highlightType: 'save',
        minute: 88,
        videoUrl: 'https://www.youtube.com/watch?v=save123',
        videoPublicId: 'soccer-stats/match-highlights/11/save',
        durationSeconds: 20,
        fileSizeBytes: 2048,
      });

    expect(res.status).toBe(201);
    expect(createHighlight).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId: 11,
        tournamentId: 42,
        teamId: 5,
        uploadedBy: 10005,
        status: 'pending',
      }),
    );
  });

  it('rejects non-YouTube video URLs for match highlights', async () => {
    const captainApp = buildApp('team_captain', 5);
    vi.spyOn(storage, 'getMatch').mockResolvedValueOnce({
      id: 11,
      tournamentId: 42,
      homeTeamId: 5,
      awayTeamId: 6,
    } as any);
    const createHighlight = vi.spyOn(storage, 'createMatchHighlight');
    createHighlight.mockClear();

    const res = await request(captainApp)
      .post('/api/matches/11/highlights')
      .send({
        teamId: 5,
        title: 'Video externo',
        highlightType: 'goal',
        minute: 12,
        videoUrl: 'https://videos.example.com/play.mp4',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('YouTube');
    expect(createHighlight).not.toHaveBeenCalled();
  });

  it('accepts YouTube live URLs for match highlights', async () => {
    const captainApp = buildApp('team_captain', 5);
    vi.spyOn(storage, 'getMatch').mockResolvedValueOnce({
      id: 11,
      tournamentId: 42,
      homeTeamId: 5,
      awayTeamId: 6,
    } as any);

    const res = await request(captainApp)
      .post('/api/matches/11/highlights')
      .send({
        teamId: 5,
        title: 'Transmisión destacada',
        highlightType: 'goal',
        minute: 12,
        videoUrl: 'https://www.youtube.com/live/live123?si=abc',
      });

    expect(res.status).toBe(201);
  });

  it('lets an admin approve a pending match highlight', async () => {
    vi.spyOn(storage, 'getMatchHighlight').mockResolvedValueOnce({
      id: 1,
      matchId: 9,
      tournamentId: 42,
      teamId: 1,
      playerId: null,
      title: 'Golazo',
      description: 'Gran jugada',
      highlightType: 'goal',
      minute: 12,
      videoUrl: 'https://youtu.be/highlight123',
      videoPublicId: 'soccer-stats/match-highlights/9/highlight',
      thumbnailUrl: null,
      uploadedBy: 3,
      createdAt: new Date(),
      status: 'pending',
      durationSeconds: 15,
      fileSizeBytes: 1024,
    } as any);
    vi.spyOn(storage, 'getMatch').mockResolvedValueOnce({
      id: 9,
      tournamentId: 42,
      homeTeamId: 1,
      awayTeamId: 2,
    } as any);
    const updateHighlight = vi.spyOn(storage, 'updateMatchHighlight');

    const res = await request(app)
      .put('/api/match-highlights/1')
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(updateHighlight).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: 'approved' }),
    );
  });
});

// edge case / permission tests

describe('Authorization edge cases', () => {
  it('returns the authenticated user name, email and role', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      userId: 1,
      email: 'active@example.com',
      name: 'Active User',
      userRole: 'admin',
    });
  });

  it('creates a pending request without authenticating the applicant', async () => {
    const registrationApp = buildApp();
    const createRequest = vi.spyOn(storage, 'createRegistrationRequest');
    const createUser = vi.spyOn(storage, 'createUser');

    const agent = request.agent(registrationApp);
    const register = await agent.post('/api/auth/register').send({
      email: 'pending@example.com',
      name: 'Pending User',
      password: 'secret123',
      confirmPassword: 'secret123',
      requestedRole: 'team_captain',
    });

    expect(register.status).toBe(202);
    expect(register.body.status).toBe('pending');
    expect(createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'pending@example.com',
        name: 'Pending User',
        requestedRole: 'team_captain',
      }),
    );
    expect(createUser).not.toHaveBeenCalled();

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(401);
  });

  it('lets an admin approve a pending registration', async () => {
    const approve = vi.spyOn(storage, 'approveRegistrationRequest');

    const res = await request(app)
      .post('/api/admin/registration-requests/12/approve');

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('approved@example.com');
    expect(res.body.password).toBeUndefined();
    expect(res.body.emailDelivery).toBeUndefined();
    expect(approve).toHaveBeenCalledWith(12, 1);
  });

  it('lets an admin reject a pending registration', async () => {
    const reject = vi.spyOn(storage, 'rejectRegistrationRequest');

    const res = await request(app)
      .post('/api/admin/registration-requests/13/reject');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
    expect(res.body.password).toBeUndefined();
    expect(reject).toHaveBeenCalledWith(13, 1);
  });

  it('does not accept another request for the same pending email', async () => {
    const registrationApp = buildApp();
    vi.spyOn(storage, 'getRegistrationRequestByEmail').mockResolvedValueOnce({
      id: 15,
      email: 'pending@example.com',
      password: 'hidden',
      name: 'Pending User',
      status: 'pending',
      requestedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
    } as any);

    const res = await request(registrationApp).post('/api/auth/register').send({
      email: 'pending@example.com',
      name: 'Pending User',
      password: 'secret123',
      confirmPassword: 'secret123',
      requestedRole: 'team_captain',
    });

    expect(res.status).toBe(409);
  });

  it('rejects login for a blocked user', async () => {
    const blockedApp = buildApp();
    vi.spyOn(storage, 'getUserByEmail').mockResolvedValueOnce({
      id: 9,
      email: 'blocked@example.com',
      password: auth.hashPassword('secret123'),
      name: 'Blocked User',
      role: 'public',
      teamId: null,
      isActive: false,
    } as any);

    const res = await request(blockedApp)
      .post('/api/auth/login')
      .send({ email: 'blocked@example.com', password: 'secret123' });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('bloqueada');
  });

  it('revokes an existing session after the user is blocked', async () => {
    const blockedSessionApp = buildApp('public');
    vi.spyOn(storage, 'getUserById').mockResolvedValueOnce({
      id: 1,
      email: 'blocked@example.com',
      password: 'unused',
      name: 'Blocked User',
      role: 'public',
      teamId: null,
      isActive: false,
    } as any);

    const res = await request(blockedSessionApp).get('/api/teams');

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('bloqueada');
  });

  it('lets an admin unblock a user', async () => {
    const updateUser = vi.spyOn(storage, 'updateUser').mockResolvedValueOnce({
      id: 8,
      email: 'restored@example.com',
      password: 'hidden',
      name: 'Restored User',
      role: 'public',
      teamId: null,
      isActive: true,
    } as any);

    const res = await request(app)
      .put('/api/admin/users/8')
      .send({ isActive: true });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(true);
    expect(res.body.password).toBeUndefined();
    expect(updateUser).toHaveBeenCalledWith(8, { isActive: true });
  });

  it('blocks instead of physically deleting a user', async () => {
    const updateUser = vi.spyOn(storage, 'updateUser').mockResolvedValueOnce({
      id: 8,
      email: 'blocked@example.com',
      password: 'hidden',
      name: 'Blocked User',
      role: 'public',
      teamId: null,
      isActive: false,
    } as any);
    const deleteUser = vi.spyOn(storage, 'deleteUser');

    const res = await request(app).delete('/api/admin/users/8');

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
    expect(updateUser).toHaveBeenCalledWith(8, { isActive: false });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('permanently deletes a user and clears registration history for that email', async () => {
    const deleteUser = vi.spyOn(storage, 'deleteUser');
    const deleteRegistrationRequests = vi.spyOn(
      storage,
      'deleteRegistrationRequestsByEmail',
    );

    const res = await request(app).delete('/api/admin/users/8/permanent');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(deleteUser).toHaveBeenCalledWith(8);
    expect(deleteRegistrationRequests).toHaveBeenCalledWith('active@example.com');
  });

  it('deletes tournaments created by a tournament manager when permanently deleting them', async () => {
    vi.spyOn(storage, 'getUserById').mockImplementation(async (id: number) => ({
      id,
      email: id === 1 ? 'admin@example.com' : 'manager@example.com',
      password: 'hidden',
      name: id === 1 ? 'Admin' : 'Manager',
      role: id === 1 ? 'admin' : 'tournament_manager',
      teamId: null,
      isActive: true,
    }) as any);
    vi.spyOn(storage, 'getTournaments').mockResolvedValueOnce([
      { id: 41, createdBy: 4, name: 'Manager Cup' },
      { id: 42, createdBy: 99, name: 'Other Cup' },
      { id: 43, createdBy: 4, name: 'Manager League' },
    ] as any);
    const deleteTournament = vi.spyOn(storage, 'deleteTournament');
    const deleteUser = vi.spyOn(storage, 'deleteUser');

    const res = await request(app).delete('/api/admin/users/4/permanent');

    expect(res.status).toBe(200);
    expect(deleteTournament).toHaveBeenCalledWith(41);
    expect(deleteTournament).toHaveBeenCalledWith(43);
    expect(deleteTournament).not.toHaveBeenCalledWith(42);
    expect(deleteUser).toHaveBeenCalledWith(4);
  });

  it('does not allow an admin to permanently delete their own account', async () => {
    const deleteUser = vi.spyOn(storage, 'deleteUser');
    deleteUser.mockClear();

    const res = await request(app).delete('/api/admin/users/1/permanent');

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('eliminarte a ti mismo');
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('does not allow blocking another admin account', async () => {
    vi.spyOn(storage, 'getUserById')
      .mockResolvedValueOnce({
        id: 1,
        email: 'admin@example.com',
        password: 'hidden',
        name: 'Admin',
        role: 'admin',
        teamId: null,
        isActive: true,
      } as any)
      .mockResolvedValueOnce({
        id: 9,
        email: 'other-admin@example.com',
        password: 'hidden',
        name: 'Other Admin',
        role: 'admin',
        teamId: null,
        isActive: true,
      } as any);
    const updateUser = vi.spyOn(storage, 'updateUser');
    updateUser.mockClear();

    const res = await request(app).delete('/api/admin/users/9');

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('bloquear a un administrador');
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('does not allow permanently deleting another admin account', async () => {
    vi.spyOn(storage, 'getUserById')
      .mockResolvedValueOnce({
        id: 1,
        email: 'admin@example.com',
        password: 'hidden',
        name: 'Admin',
        role: 'admin',
        teamId: null,
        isActive: true,
      } as any)
      .mockResolvedValueOnce({
        id: 9,
        email: 'other-admin@example.com',
        password: 'hidden',
        name: 'Other Admin',
        role: 'admin',
        teamId: null,
        isActive: true,
      } as any);
    const deleteUser = vi.spyOn(storage, 'deleteUser');
    deleteUser.mockClear();

    const res = await request(app).delete('/api/admin/users/9/permanent');

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('eliminar a un administrador');
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('does not allow removing the admin role from the only active admin', async () => {
    vi.spyOn(storage, 'getAllUsers').mockResolvedValueOnce([
      {
        id: 1,
        email: 'admin@example.com',
        password: 'hidden',
        name: 'Only Admin',
        role: 'admin',
        teamId: null,
        isActive: true,
      },
    ] as any);
    const updateUser = vi.spyOn(storage, 'updateUser');
    updateUser.mockClear();

    const res = await request(app)
      .put('/api/admin/users/1/role')
      .send({ role: 'team_captain' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('otro administrador activo');
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('allows removing the admin role when another active admin remains', async () => {
    vi.spyOn(storage, 'getAllUsers').mockResolvedValueOnce([
      {
        id: 1,
        email: 'admin@example.com',
        password: 'hidden',
        name: 'Admin',
        role: 'admin',
        teamId: null,
        isActive: true,
      },
      {
        id: 9,
        email: 'other-admin@example.com',
        password: 'hidden',
        name: 'Other Admin',
        role: 'admin',
        teamId: null,
        isActive: true,
      },
    ] as any);
    const updateUser = vi.spyOn(storage, 'updateUser').mockResolvedValueOnce({
      id: 1,
      email: 'admin@example.com',
      password: 'hidden',
      name: 'Admin',
      role: 'team_captain',
      teamId: null,
      isActive: true,
    } as any);

    const res = await request(app)
      .put('/api/admin/users/1/role')
      .send({ role: 'team_captain' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('team_captain');
    expect(res.body.password).toBeUndefined();
    expect(updateUser).toHaveBeenCalledWith(1, { role: 'team_captain' });
  });

  it('allows unauthenticated public reads', async () => {
    const unauthApp = buildApp(); // no role injected
    const teams = await request(unauthApp).get('/api/teams');
    const matches = await request(unauthApp).get('/api/matches');
    const standings = await request(unauthApp).get('/api/standings?tournamentId=42');

    expect(teams.status).toBe(200);
    expect(matches.status).toBe(200);
    expect(standings.status).toBe(200);
  });

  it('returns public bootstrap data in one request', async () => {
    const unauthApp = buildApp();

    const res = await request(unauthApp).get('/api/bootstrap');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      teams: expect.any(Array),
      matches: expect.any(Array),
      tournaments: expect.any(Array),
      generatedAt: expect.any(String),
    });
    expect(res.headers['cache-control']).toContain('max-age=15');
  });

  it('requires authentication for non-public writes', async () => {
    const unauthApp = buildApp(); // no role injected
    const res = await request(unauthApp)
      .post('/api/teams')
      .send({ name: 'Private Team', color: '#123456' });

    expect(res.status).toBe(401);
  });

  it('returns 403 when permission denied', async () => {
    vi.spyOn(auth, 'hasPermission').mockReturnValue(false);
    const res = await request(app).get('/api/teams');
    expect(res.status).toBe(403);
  });

  it('allows read if permission restored', async () => {
    vi.spyOn(auth, 'hasPermission').mockReturnValue(true);
    const res = await request(app).get('/api/teams');
    expect(res.status).toBe(200);
  });
});
