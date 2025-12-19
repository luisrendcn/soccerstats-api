import { z } from 'zod';
import { insertTeamSchema, insertPlayerSchema, insertMatchSchema, insertGoalSchema, teams, players, matches, goals } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  teams: {
    list: {
      method: 'GET' as const,
      path: '/api/teams',
      responses: {
        200: z.array(z.custom<typeof teams.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/teams/:id',
      responses: {
        200: z.custom<typeof teams.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/teams',
      input: insertTeamSchema,
      responses: {
        201: z.custom<typeof teams.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  players: {
    list: {
      method: 'GET' as const,
      path: '/api/teams/:teamId/players',
      responses: {
        200: z.array(z.custom<typeof players.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/players',
      input: insertPlayerSchema,
      responses: {
        201: z.custom<typeof players.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  matches: {
    list: {
      method: 'GET' as const,
      path: '/api/matches',
      responses: {
        200: z.array(z.custom<typeof matches.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/matches/:id',
      responses: {
        200: z.custom<typeof matches.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/matches',
      input: insertMatchSchema,
      responses: {
        201: z.custom<typeof matches.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/matches/:id',
      input: insertMatchSchema.partial(),
      responses: {
        200: z.custom<typeof matches.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  goals: {
    create: {
      method: 'POST' as const,
      path: '/api/goals',
      input: insertGoalSchema,
      responses: {
        201: z.custom<typeof goals.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/matches/:matchId/goals',
      responses: {
        200: z.array(z.custom<typeof goals.$inferSelect>()),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
