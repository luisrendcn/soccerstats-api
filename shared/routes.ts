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
    delete: {
      method: 'DELETE' as const,
      path: '/api/teams/:id',
      responses: {
        200: z.object({ success: z.boolean() }),
        404: errorSchemas.notFound,
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
    delete: {
      method: 'DELETE' as const,
      path: '/api/players/:id',
      responses: {
        200: z.object({ success: z.boolean() }),
        404: errorSchemas.notFound,
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
    delete: {
      method: 'DELETE' as const,
      path: '/api/matches/:id',
      responses: {
        200: z.object({ success: z.boolean() }),
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

// Export input types inferred from the Zod schemas used by the API
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type InsertGoal = z.infer<typeof insertGoalSchema>;

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
