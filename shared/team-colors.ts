const TEAM_COLOR_MAP: Record<string, string> = {
  amarillo: "#facc15",
  amber: "#f59e0b",
  azul: "#2563eb",
  azulclaro: "#38bdf8",
  azuloscuro: "#1e3a8a",
  black: "#000000",
  blanco: "#ffffff",
  blue: "#2563eb",
  celeste: "#38bdf8",
  cyan: "#06b6d4",
  dorado: "#f59e0b",
  fucsia: "#d946ef",
  gray: "#6b7280",
  green: "#16a34a",
  gris: "#6b7280",
  indigo: "#4f46e5",
  magenta: "#d946ef",
  morado: "#7c3aed",
  naranja: "#f97316",
  navy: "#1e3a8a",
  negro: "#000000",
  orange: "#f97316",
  pink: "#ec4899",
  purple: "#7c3aed",
  red: "#dc2626",
  rojo: "#dc2626",
  rosado: "#ec4899",
  rosa: "#ec4899",
  skyblue: "#38bdf8",
  verde: "#16a34a",
  verdeoscuro: "#166534",
  violet: "#7c3aed",
  white: "#ffffff",
  yellow: "#facc15",
};

function normalizeColorName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function normalizeTeamColor(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return undefined;

  const hex = raw.match(/^#?([0-9a-fA-F]{6})$/);
  if (hex) return `#${hex[1].toLowerCase()}`;

  const shortHex = raw.match(/^#?([0-9a-fA-F]{3})$/);
  if (shortHex) {
    return `#${shortHex[1]
      .split("")
      .map((character) => character + character)
      .join("")
      .toLowerCase()}`;
  }

  return TEAM_COLOR_MAP[normalizeColorName(raw)];
}

export const supportedTeamColorNames = Object.freeze([
  "rojo",
  "azul",
  "azul claro",
  "azul oscuro",
  "verde",
  "verde oscuro",
  "amarillo",
  "naranja",
  "morado",
  "rosado",
  "negro",
  "blanco",
  "gris",
  "dorado",
]);
