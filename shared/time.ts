export const APP_TIME_ZONE = "America/Bogota";

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME_RE = /^\d{2}:\d{2}$/;

function readTimeZoneParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function zonedLocalDateTimeToUtcDate(
  localDate: string,
  localTime: string,
  timeZone = APP_TIME_ZONE,
) {
  if (!LOCAL_DATE_RE.test(localDate) || !LOCAL_TIME_RE.test(localTime)) {
    throw new Error("La fecha y hora del partido no son válidas");
  }

  const [year, month, day] = localDate.split("-").map(Number);
  const [hour, minute] = localTime.split(":").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const zonedParts = readTimeZoneParts(new Date(utcGuess), timeZone);
  const zonedAsUtc = Date.UTC(
    zonedParts.year,
    zonedParts.month - 1,
    zonedParts.day,
    zonedParts.hour,
    zonedParts.minute,
    zonedParts.second,
  );

  return new Date(utcGuess - (zonedAsUtc - utcGuess));
}

export function zonedLocalDateTimeToUtcIso(
  localDate: string,
  localTime: string,
  timeZone = APP_TIME_ZONE,
) {
  return zonedLocalDateTimeToUtcDate(localDate, localTime, timeZone).toISOString();
}
