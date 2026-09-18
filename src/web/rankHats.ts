import { daysSince } from "./dates.js";
import type { HatWithLastWash } from "./queryHats.js";

export interface RankedHat extends HatWithLastWash {
  /** 1-based place in the wash queue; 0 for retired hats, which are not queued. */
  position: number;
  daysSince: number | null;
}

export interface RankedHats {
  queue: RankedHat[];
  retired: RankedHat[];
}

/**
 * Orders the wash queue: hats you have never washed come first (oldest-owned first, so the
 * order is stable), then the rest by how long it has been, longest first. Retired hats are
 * pulled out entirely — they keep their history but should not nag you to wash them.
 */
export function rankHats(hats: HatWithLastWash[], now: Date): RankedHats {
  const active = hats.filter((hat) => hat.retired_at === null);
  const retired = hats.filter((hat) => hat.retired_at !== null);

  const queue = [...active]
    .sort((a, b) => {
      if (a.last_washed === null && b.last_washed === null) return a.created_at - b.created_at;
      if (a.last_washed === null) return -1;
      if (b.last_washed === null) return 1;
      if (a.last_washed !== b.last_washed) return a.last_washed - b.last_washed;
      return a.created_at - b.created_at;
    })
    .map((hat, index) => toRankedHat(hat, index + 1, now));

  return {
    queue,
    retired: [...retired]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((hat) => toRankedHat(hat, 0, now)),
  };
}

function toRankedHat(hat: HatWithLastWash, position: number, now: Date): RankedHat {
  return {
    ...hat,
    position,
    daysSince: hat.last_washed === null ? null : daysSince(hat.last_washed, now),
  };
}
