import crypto from "crypto";

/**
 * Hash de contraseña usando PBKDF2
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, "sha512")
    .toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verificar contraseña contra hash
 */
export function verifyPassword(password: string, hashedPassword: string): boolean {
  const [salt, hash] = hashedPassword.split(":");
  const testHash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, "sha512")
    .toString("hex");
  return hash === testHash;
}

/**
 * Tipos de roles disponibles
 */
export const ROLES = {
  ADMIN: "admin",
  TOURNAMENT_MANAGER: "tournament_manager",
  TEAM: "team",
  REFEREE: "referee",
  PUBLIC: "public",
} as const;

/**
 * Permisos por rol
 */
export const ROLE_PERMISSIONS = {
  admin: {
    users: ["create", "read", "update", "delete"],
    teams: ["create", "read", "update", "delete"],
    players: ["create", "read", "update", "delete"],
    goals: ["create", "read", "update", "delete"],
    matches: ["create", "read", "update", "delete"],
    tournaments: ["create", "read", "update", "delete"],
  },
  tournament_manager: {
    users: ["read"],
    teams: ["create", "read", "update"],
    players: ["create", "read", "update"],
    goals: ["create", "read", "update"],
    matches: ["create", "read", "update"],
    tournaments: ["create", "read", "update"],
  },
  team: {
    users: ["read"],
    teams: ["read", "update"], // Solo su equipo (lectura + edición)
    players: ["create", "read", "update", "delete"], // puede gestionar su propia plantilla
    matches: ["read"],
    tournaments: ["read"],
  },
  referee: {
    users: ["read"],
    teams: ["read"],
    matches: ["read", "update"], // Actualizar resultados
    players: ["read"],
    goals: ["read", "create"],
    tournaments: ["read"],
  },
  public: {
    users: [],
    teams: ["read"],
    players: ["read"],
    matches: ["read"],
    tournaments: ["read"],
  },
};

export type UserRole = keyof typeof ROLE_PERMISSIONS;

/**
 * Verificar si un rol tiene permiso para una acción
 */
export function hasPermission(
  role: UserRole,
  resource: string,
  action: string
): boolean {
  const permissions = (ROLE_PERMISSIONS[role] as Record<string, string[]>)[resource];
  return permissions ? permissions.includes(action) : false;
}
