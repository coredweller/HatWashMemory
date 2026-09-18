import { describe, expect, it } from "vitest";
import type { HatWithLastWash } from "../src/web/queryHats.js";
import { rankHats } from "../src/web/rankHats.js";

const NOW = new Date(2026, 8, 3, 9, 0, 0);

/** Local noon on a day `daysAgo` before NOW, matching how washes are stored. */
function daysAgo(days: number): number {
  return Math.floor(new Date(2026, 8, 3 - days, 12, 0, 0).getTime() / 1000);
}

function hat(overrides: Partial<HatWithLastWash> = {}): HatWithLastWash {
  return {
    id: 1,
    name: "A Hat",
    image_file: null,
    notes: null,
    retired_at: null,
    created_at: daysAgo(400),
    last_washed: null,
    wash_count: 0,
    ...overrides,
  };
}

describe("rankHats", () => {
  it("puts never-washed hats above washed ones", () => {
    const { queue } = rankHats(
      [
        hat({ id: 1, name: "Washed recently", last_washed: daysAgo(3), wash_count: 1 }),
        hat({ id: 2, name: "Never washed" }),
      ],
      NOW,
    );

    expect(queue.map((entry) => entry.name)).toEqual(["Never washed", "Washed recently"]);
    expect(queue.map((entry) => entry.position)).toEqual([1, 2]);
  });

  it("orders never-washed hats by the date they were added, oldest first", () => {
    const { queue } = rankHats(
      [
        hat({ id: 1, name: "Added later", created_at: daysAgo(10) }),
        hat({ id: 2, name: "Added first", created_at: daysAgo(90) }),
      ],
      NOW,
    );

    expect(queue.map((entry) => entry.name)).toEqual(["Added first", "Added later"]);
  });

  it("orders washed hats longest-since-washed first", () => {
    const { queue } = rankHats(
      [
        hat({ id: 1, name: "Two weeks", last_washed: daysAgo(14), wash_count: 2 }),
        hat({ id: 2, name: "A year", last_washed: daysAgo(365), wash_count: 1 }),
        hat({ id: 3, name: "Yesterday", last_washed: daysAgo(1), wash_count: 5 }),
      ],
      NOW,
    );

    expect(queue.map((entry) => entry.name)).toEqual(["A year", "Two weeks", "Yesterday"]);
    expect(queue.map((entry) => entry.daysSince)).toEqual([365, 14, 1]);
  });

  it("keeps retired hats out of the queue but still returns them", () => {
    const { queue, retired } = rankHats(
      [
        hat({ id: 1, name: "Active" }),
        hat({ id: 2, name: "Retired", retired_at: daysAgo(5), last_washed: daysAgo(300) }),
      ],
      NOW,
    );

    expect(queue.map((entry) => entry.name)).toEqual(["Active"]);
    expect(retired.map((entry) => entry.name)).toEqual(["Retired"]);
    expect(retired[0].daysSince).toBe(300);
  });

  it("reports null daysSince for a hat that has never been washed", () => {
    const { queue } = rankHats([hat()], NOW);

    expect(queue[0].daysSince).toBeNull();
  });

  it("returns empty lists for no hats", () => {
    expect(rankHats([], NOW)).toEqual({ queue: [], retired: [] });
  });
});
