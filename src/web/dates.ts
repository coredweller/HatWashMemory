import { fail, ok, type Result } from "../result.js";

export const SECONDS_PER_DAY = 86_400;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Nothing before this is a plausible wash date; it catches typos like "0202-05-01". */
const EARLIEST_YEAR = 2000;

/**
 * Wash dates are stored as the epoch seconds of *local noon* on the day in question.
 * Anchoring at noon rather than midnight means formatting the value back with
 * toLocaleDateString can never slip to the neighbouring day, and day-count arithmetic
 * survives DST transitions.
 */
export function localNoonSeconds(year: number, month: number, day: number): number {
  return Math.floor(new Date(year, month - 1, day, 12, 0, 0, 0).getTime() / 1000);
}

export function todayNoonSeconds(now: Date): number {
  return localNoonSeconds(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Parses a `YYYY-MM-DD` value from a date input into stored epoch seconds. */
export function parseWashDate(value: string, now: Date): Result<number> {
  const match = ISO_DATE_PATTERN.exec(value.trim());
  if (!match) {
    return fail(new Error("Wash date must be in YYYY-MM-DD format"));
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const candidate = new Date(year, month - 1, day, 12, 0, 0, 0);
  // Round-trip check rejects impossible days that Date would silently roll over (e.g. 2026-02-31).
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) {
    return fail(new Error(`"${value}" is not a real date`));
  }
  if (year < EARLIEST_YEAR) {
    return fail(new Error(`Wash date must be ${EARLIEST_YEAR} or later`));
  }

  const seconds = Math.floor(candidate.getTime() / 1000);
  if (seconds > todayNoonSeconds(now)) {
    return fail(new Error("Wash date cannot be in the future"));
  }

  return ok(seconds);
}

/**
 * Whole days between a stored wash date and today. Both ends sit at local noon, so the
 * quotient is a whole number give or take a DST hour — rounding absorbs that.
 */
export function daysSince(washedAt: number, now: Date): number {
  return Math.round((todayNoonSeconds(now) - washedAt) / SECONDS_PER_DAY);
}

export function formatDaysSince(days: number | null): string {
  if (days === null) return "Never washed";
  if (days <= 0) return "Washed today";
  if (days === 1) return "Washed yesterday";
  return `Washed ${days} days ago`;
}

export function formatDate(seconds: number): string {
  return new Date(seconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** `YYYY-MM-DD` for prefilling a date input, in local time. */
export function toDateInputValue(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
