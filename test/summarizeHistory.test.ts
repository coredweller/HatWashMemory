import { describe, expect, it } from "vitest";
import { localNoonSeconds } from "../src/web/dates.js";
import type { WashLogRow } from "../src/web/queryHistory.js";
import { rankHats } from "../src/web/rankHats.js";
import { summarizeHistory } from "../src/web/summarizeHistory.js";

const NOW = new Date(2026, 8, 3, 9, 0, 0);

function wash(overrides: Partial<WashLogRow> = {}): WashLogRow {
  return {
    id: 1,
    washed_at: localNoonSeconds(2026, 9, 1),
    notes: null,
    hat_id: 1,
    hat_name: "A Hat",
    image_file: null,
    ...overrides,
  };
}

describe("summarizeHistory", () => {
  it("counts total washes and those in the current year", () => {
    const stats = summarizeHistory(
      [
        wash({ id: 1, washed_at: localNoonSeconds(2026, 9, 1) }),
        wash({ id: 2, washed_at: localNoonSeconds(2026, 1, 4) }),
        wash({ id: 3, washed_at: localNoonSeconds(2025, 12, 30) }),
      ],
      [],
      NOW,
    );

    expect(stats.totalWashes).toBe(3);
    expect(stats.washesThisYear).toBe(2);
  });

  it("averages the gap between consecutive washes of the same hat", () => {
    const stats = summarizeHistory(
      [
        wash({ id: 1, hat_id: 1, washed_at: localNoonSeconds(2026, 9, 1) }),
        wash({ id: 2, hat_id: 1, washed_at: localNoonSeconds(2026, 8, 22) }),
        wash({ id: 3, hat_id: 1, washed_at: localNoonSeconds(2026, 8, 2) }),
      ],
      [],
      NOW,
    );

    // Gaps of 20 and 10 days.
    expect(stats.averageDaysBetweenWashes).toBe(15);
  });

  it("never treats two different hats washed on separate days as a gap", () => {
    const stats = summarizeHistory(
      [
        wash({ id: 1, hat_id: 1, hat_name: "One", washed_at: localNoonSeconds(2026, 9, 1) }),
        wash({ id: 2, hat_id: 2, hat_name: "Two", washed_at: localNoonSeconds(2026, 1, 1) }),
      ],
      [],
      NOW,
    );

    expect(stats.averageDaysBetweenWashes).toBeNull();
  });

  it("reports the most-washed hat", () => {
    const stats = summarizeHistory(
      [
        wash({ id: 1, hat_id: 1, hat_name: "Busy" }),
        wash({ id: 2, hat_id: 1, hat_name: "Busy" }),
        wash({ id: 3, hat_id: 2, hat_name: "Quiet" }),
      ],
      [],
      NOW,
    );

    expect(stats.mostWashed).toEqual({ name: "Busy", count: 2 });
  });

  it("takes the longest-unwashed hat from the head of the queue", () => {
    const { queue } = rankHats(
      [
        {
          id: 1,
          name: "Overdue",
          image_file: null,
          notes: null,
          retired_at: null,
          created_at: localNoonSeconds(2024, 1, 1),
          last_washed: localNoonSeconds(2026, 5, 30),
          wash_count: 1,
        },
      ],
      NOW,
    );

    const stats = summarizeHistory([wash({ hat_id: 1, hat_name: "Overdue" })], queue, NOW);

    expect(stats.longestUnwashed).toEqual({ name: "Overdue", days: 96 });
  });

  it("returns empty-state values when nothing has been logged", () => {
    const stats = summarizeHistory([], [], NOW);

    expect(stats).toEqual({
      totalWashes: 0,
      washesThisYear: 0,
      averageDaysBetweenWashes: null,
      mostWashed: null,
      longestUnwashed: null,
    });
  });
});
