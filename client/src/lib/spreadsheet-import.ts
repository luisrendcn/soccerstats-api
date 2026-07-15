import { normalizeTeamColor } from "@shared/team-colors";

type SpreadsheetRow = Record<string, string>;

export type TeamImportRow = {
  name: string;
  color?: string;
  twitchChannel?: string;
};

export type PlayerImportRow = {
  name: string;
  number?: number;
};

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function cellToString(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function get(row: SpreadsheetRow, keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeHeader(key)];
    if (value) return value.trim();
  }
  return "";
}

export async function readSpreadsheetRows(file: File): Promise<SpreadsheetRow[]> {
  const { readSheet } = await import("read-excel-file/browser");
  const sheetRows = await readSheet(file, 1);
  const [headerRow, ...dataRows] = sheetRows;
  if (!headerRow) return [];

  const normalizedHeaders = headerRow.map((value: unknown) =>
    normalizeHeader(cellToString(value).trim()),
  );

  return dataRows.reduce<SpreadsheetRow[]>((rows: SpreadsheetRow[], row) => {
    const record: SpreadsheetRow = {};
    row.forEach((cell: unknown, index: number) => {
      const header = normalizedHeaders[index] || `col${index + 1}`;
      record[header] = cellToString(cell).trim();
    });
    if (Object.values(record).some(Boolean)) rows.push(record);
    return rows;
  }, []);
}

export async function parseTeamImportFile(file: File): Promise<TeamImportRow[]> {
  const rows = await readSpreadsheetRows(file);
  return rows
    .map((row) => {
      const color = get(row, ["color", "team color", "color equipo"]);
      return {
        name: get(row, ["equipo", "nombre equipo", "team", "team name", "nombre"]),
        color: color ? normalizeTeamColor(color) || color : undefined,
        twitchChannel:
          get(row, [
            "twitch",
            "canal twitch",
            "twitch channel",
            "canal",
            "stream",
          ]) || undefined,
      };
    })
    .filter((row) => row.name);
}

export async function parsePlayerImportFile(file: File): Promise<PlayerImportRow[]> {
  const rows = await readSpreadsheetRows(file);
  return rows
    .map((row) => {
      const rawNumber = get(row, [
        "numero",
        "número",
        "dorsal",
        "camiseta",
        "number",
        "jersey",
      ]);
      const number = rawNumber ? Number(rawNumber) : undefined;
      return {
        name: get(row, ["jugador", "nombre jugador", "player", "player name", "nombre"]),
        number: Number.isInteger(number) ? number : undefined,
      };
    })
    .filter((row) => row.name);
}
