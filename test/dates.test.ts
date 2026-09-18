import { describe, expect, it } from "vitest";
import {
  daysSince,
  formatDate,
  formatDaysSince,
  localNoonSeconds,
  parseWashDate,
  toDateInputValue,
  todayNoonSeconds,
} from "../src/web/dates.js";

const NOW = new Date(2026, 8, 3, 9, 0, 0);

describe("parseWashDate", () => {
  it("stores a date at local noon so it cannot slip a day when formatted back", () => {
    const parsed = parseWashDate("2026-08-05", NOW);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toBe(localNoonSeconds(2026, 8, 5));

    const roundTripped = new Date(parsed.value * 1000);
    expect(roundTripped.getFullYear()).toBe(2026);
    expect(roundTripped.getMonth()).toBe(7);
    expect(roundTripped.getDate()).toBe(5);
  });

  it("accepts today", () => {
    const parsed = parseWashDate("2026-09-03", NOW);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value).toBe(todayNoonSeconds(NOW));
  });

  it("rejects a date in the future", () => {
    const parsed = parseWashDate("2026-09-04", NOW);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error.message).toMatch(/future/);
  });

  it("rejects a malformed value", () => {
    for (const value of ["", "03/09/2026", "2026-9-3", "yesterday"]) {
      expect(parseWashDate(value, NOW).ok).toBe(false);
    }
  });

  it("rejects a day that does not exist rather than rolling it over", () => {
    const parsed = parseWashDate("2026-02-31", NOW);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error.message).toMatch(/not a real date/);
  });

  it("rejects an implausibly old year", () => {
    expect(parseWashDate("0202-05-01", NOW).ok).toBe(false);
  });
});

describe("daysSince", () => {
  it("counts whole days between local-noon anchors", () => {
    expect(daysSince(localNoonSeconds(2026, 9, 3), NOW)).toBe(0);
    expect(daysSince(localNoonSeconds(2026, 9, 2), NOW)).toBe(1);
    expect(daysSince(localNoonSeconds(2026, 5, 30), NOW)).toBe(96);
  });

  it("stays exact across a daylight-saving boundary", () => {
    // US DST ended 2025-11-02, so this span contains an extra clock hour.
    expect(daysSince(localNoonSeconds(2025, 10, 30), new Date(2025, 10, 5, 9, 0, 0))).toBe(6);
  });
});

describe("formatDaysSince", () => {
  it("describes each case in plain words", () => {
    expect(formatDaysSince(null)).toBe("Never washed");
    expect(formatDaysSince(0)).toBe("Washed today");
    expect(formatDaysSince(1)).toBe("Washed yesterday");
    expect(formatDaysSince(96)).toBe("Washed 96 days ago");
  });
});

describe("toDateInputValue", () => {
  it("zero-pads month and day", () => {
    expect(toDateInputValue(new Date(2026, 0, 5, 9, 0, 0))).toBe("2026-01-05");
    expect(toDateInputValue(NOW)).toBe("2026-09-03");
  });
});

describe("formatDate", () => {
  it("renders the same calendar day that was stored", () => {
    expect(formatDate(localNoonSeconds(2026, 1, 1))).toContain("2026");
    expect(formatDate(localNoonSeconds(2026, 1, 1))).toContain("1");
  });
});
