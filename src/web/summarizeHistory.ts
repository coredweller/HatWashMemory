import { SECONDS_PER_DAY } from "./dates.js";
import type { WashLogRow } from "./queryHistory.js";
import type { RankedHat } from "./rankHats.js";

export interface HistoryStats {
  totalWashes: number;
  washesThisYear: number;
  /** Mean gap between consecutive washes of the same hat; null until some hat has two. */
  averageDaysBetweenWashes: number | null;
  mostWashed: { name: string; count: number } | null;
  longestUnwashed: { name: string; days: number | null } | null;
}

/**
 * Derived in TypeScript rather than SQL: the inputs are already loaded for rendering, and
 * a pure function is directly unit-testable without a database.
 */
export function summarizeHistory(log: WashLogRow[], queue: RankedHat[], now: Date): HistoryStats {
  const currentYear = now.getFullYear();

  const washesByHat = new Map<number, { name: string; dates: number[] }>();
  for (const wash of log) {
    const entry = washesByHat.get(wash.hat_id) ?? { name: wash.hat_name, dates: [] };
    entry.dates.push(wash.washed_at);
    washesByHat.set(wash.hat_id, entry);
  }

  // Gaps are measured per hat, so two hats washed on the same day never look like a "gap".
  let gapTotalDays = 0;
  let gapCount = 0;
  for (const { dates } of washesByHat.values()) {
    const ascending = [...dates].sort((a, b) => a - b);
    for (let index = 1; index < ascending.length; index += 1) {
      gapTotalDays += (ascending[index] - ascending[index - 1]) / SECONDS_PER_DAY;
      gapCount += 1;
    }
  }

  let mostWashed: HistoryStats["mostWashed"] = null;
  for (const { name, dates } of washesByHat.values()) {
    if (mostWashed === null || dates.length > mostWashed.count) {
      mostWashed = { name, count: dates.length };
    }
  }

  return {
    totalWashes: log.length,
    washesThisYear: log.filter((wash) => new Date(wash.washed_at * 1000).getFullYear() === currentYear).length,
    averageDaysBetweenWashes: gapCount === 0 ? null : Math.round(gapTotalDays / gapCount),
    mostWashed,
    // The queue is already sorted most-overdue first, so its head is the answer.
    longestUnwashed: queue.length === 0 ? null : { name: queue[0].name, days: queue[0].daysSince },
  };
}
