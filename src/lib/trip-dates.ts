const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  januari: 0,
  feb: 1,
  februari: 1,
  mar: 2,
  maret: 2,
  apr: 3,
  april: 3,
  mei: 4,
  jun: 5,
  juni: 5,
  jul: 6,
  juli: 6,
  agu: 7,
  agt: 7,
  agustus: 7,
  sep: 8,
  sept: 8,
  september: 8,
  okt: 9,
  oktober: 9,
  nov: 10,
  november: 10,
  des: 11,
  desember: 11,
};

type TripDateRange = {
  startDate: Date;
  endDate: Date;
};

function toUtcDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day));
}

function normalizeYear(input: string | undefined, fallbackYear: number) {
  if (!input) return fallbackYear;
  const value = Number(input);
  if (!Number.isFinite(value)) return fallbackYear;
  if (value < 100) return 2000 + value;
  return value;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function parseMonthToken(token: string | undefined) {
  if (!token) return null;
  return MONTH_INDEX[token.trim().toLowerCase()] ?? null;
}

function isValidDate(date: Date) {
  return !Number.isNaN(date.getTime());
}

function firstDateWithSlash(text: string, fallbackYear: number) {
  const match = text.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = normalizeYear(match[3], fallbackYear);
  const date = toUtcDate(year, month, day);
  if (!isValidDate(date)) return null;
  return date;
}

function firstDateWithMonthName(text: string, fallbackYear: number) {
  const match = text.match(/(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))?/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = parseMonthToken(match[2]);
  if (month === null) return null;
  const year = normalizeYear(match[3], fallbackYear);

  const date = toUtcDate(year, month, day);
  if (!isValidDate(date)) return null;
  return date;
}

/**
 * Parse user-friendly Indonesian trip date text into start/end dates.
 * Handles common patterns such as:
 * - "12-15 Juli 2026"
 * - "12/07/2026 - 15/07/2026"
 * - "12 Juli 2026 4 hari"
 * - "Juli 2026 4 hari"
 */
export function parseTripDateRangeFromWhen(whenText: string | undefined | null): TripDateRange | null {
  const raw = String(whenText ?? "").trim();
  if (!raw) return null;

  const text = raw.toLowerCase();
  const fallbackYear = new Date().getUTCFullYear();

  // Pattern: 12-15 Juli 2026
  const sameMonthRange = text.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))?/);
  if (sameMonthRange) {
    const startDay = Number(sameMonthRange[1]);
    const endDay = Number(sameMonthRange[2]);
    const month = parseMonthToken(sameMonthRange[3]);
    if (month !== null) {
      const year = normalizeYear(sameMonthRange[4], fallbackYear);
      const startDate = toUtcDate(year, month, startDay);
      const endDate = toUtcDate(year, month, endDay);
      if (isValidDate(startDate) && isValidDate(endDate) && endDate >= startDate) {
        return { startDate, endDate };
      }
    }
  }

  // Pattern: 12/07/2026 - 15/07/2026
  const slashRange = text.match(
    /(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\s*[-–]\s*(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/,
  );
  if (slashRange) {
    const startDay = Number(slashRange[1]);
    const startMonth = Number(slashRange[2]) - 1;
    const startYear = normalizeYear(slashRange[3], fallbackYear);

    const endDay = Number(slashRange[4]);
    const endMonth = Number(slashRange[5]) - 1;
    const endYear = normalizeYear(slashRange[6], startYear);

    const startDate = toUtcDate(startYear, startMonth, startDay);
    const endDate = toUtcDate(endYear, endMonth, endDay);
    if (isValidDate(startDate) && isValidDate(endDate) && endDate >= startDate) {
      return { startDate, endDate };
    }
  }

  const durationMatch = text.match(/(\d+)\s*hari/);
  const durationDays = durationMatch ? Number(durationMatch[1]) : null;

  // Pattern: explicit start date + duration
  if (durationDays && durationDays >= 1) {
    const explicitStart =
      firstDateWithSlash(text, fallbackYear) ?? firstDateWithMonthName(text, fallbackYear);
    if (explicitStart) {
      const endDate = addDays(explicitStart, durationDays - 1);
      return { startDate: explicitStart, endDate };
    }

    // Pattern: month year + duration (fallback to day 1)
    const monthYear = text.match(/([a-zA-Z]+)\s+(\d{4})/);
    if (monthYear) {
      const month = parseMonthToken(monthYear[1]);
      if (month !== null) {
        const year = normalizeYear(monthYear[2], fallbackYear);
        const startDate = toUtcDate(year, month, 1);
        const endDate = addDays(startDate, durationDays - 1);
        return { startDate, endDate };
      }
    }
  }

  // Pattern: single explicit date (assume 1 day trip)
  const singleDate =
    firstDateWithSlash(text, fallbackYear) ?? firstDateWithMonthName(text, fallbackYear);
  if (singleDate) {
    return { startDate: singleDate, endDate: singleDate };
  }

  return null;
}

export function toIsoDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}
