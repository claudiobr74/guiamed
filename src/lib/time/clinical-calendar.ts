export const DEFAULT_ORGANIZATION_TIME_ZONE = "America/Sao_Paulo";

type CalendarParts = { year: number; month: number; day: number };

function localCalendarParts(at: Date, timeZone: string): CalendarParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.get("year")),
    month: Number(values.get("month")),
    day: Number(values.get("day")),
  };
}

function offsetAt(instantMs: number, timeZone: string): number {
  const instant = new Date(instantMs);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.get("year")),
    Number(values.get("month")) - 1,
    Number(values.get("day")),
    Number(values.get("hour")),
    Number(values.get("minute")),
    Number(values.get("second")),
  );
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/** Converte meia-noite do calendário local para o instante UTC correspondente. */
export function localMidnightUtc(parts: CalendarParts, timeZone = DEFAULT_ORGANIZATION_TIME_ZONE): Date {
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0);
  let resolved = localAsUtc;
  // Duas iterações acomodam mudanças de offset próximas à fronteira de data.
  for (let iteration = 0; iteration < 2; iteration += 1) {
    resolved = localAsUtc - offsetAt(resolved, timeZone);
  }
  return new Date(resolved);
}

function addCalendarDays(parts: CalendarParts, days: number): CalendarParts {
  const value = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

export function clinicalDayRange(at = new Date(), timeZone = DEFAULT_ORGANIZATION_TIME_ZONE) {
  const local = localCalendarParts(at, timeZone);
  return {
    start: localMidnightUtc(local, timeZone),
    end: localMidnightUtc(addCalendarDays(local, 1), timeZone),
  };
}

export function clinicalMonthRange(at = new Date(), timeZone = DEFAULT_ORGANIZATION_TIME_ZONE) {
  const local = localCalendarParts(at, timeZone);
  const nextMonth = local.month === 12
    ? { year: local.year + 1, month: 1, day: 1 }
    : { year: local.year, month: local.month + 1, day: 1 };
  return {
    start: localMidnightUtc({ year: local.year, month: local.month, day: 1 }, timeZone),
    end: localMidnightUtc(nextMonth, timeZone),
  };
}
