import crypto from "crypto";

const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
  });

  return [
    "scrypt",
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt,
    hash.toString("hex"),
  ].join("$");
}

export function verifyPassword(password: string, hashedPassword: string): boolean {
  try {
    if (hashedPassword.startsWith("scrypt$")) {
      const [, cost, blockSize, parallelization, salt, hashHex] =
        hashedPassword.split("$");
      const storedHash = Buffer.from(hashHex, "hex");
      const testHash = crypto.scryptSync(password, salt, storedHash.length, {
        N: Number(cost),
        r: Number(blockSize),
        p: Number(parallelization),
      });
      return crypto.timingSafeEqual(storedHash, testHash);
    }

    // Backward compatibility for hashes created by older releases.
    const [salt, hashHex] = hashedPassword.split(":");
    if (!salt || !hashHex) return false;
    const storedHash = Buffer.from(hashHex, "hex");
    const testHash = crypto.pbkdf2Sync(
      password,
      salt,
      1000,
      storedHash.length,
      "sha512",
    );
    return crypto.timingSafeEqual(storedHash, testHash);
  } catch {
    return false;
  }
}

export function passwordNeedsRehash(hashedPassword: string): boolean {
  return !hashedPassword.startsWith("scrypt$");
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
    goals: ["read"],
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
