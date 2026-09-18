import assert from "node:assert/strict";
import test from "node:test";

import {
  cellKey,
  findNewlyAvailable,
  getAllowedWeekStarts,
  getAmsterdamToday,
  getMonitoringDates,
  getWeekStart,
  isMomentSelected,
  periodForTime,
  selectionKey,
  weeklySelectionKey
} from "../shared/domain.js";

test("uses the Netherlands date across a UTC day boundary", () => {
  assert.equal(getAmsterdamToday(new Date("2026-09-17T22:30:00Z")), "2026-09-18");
});

test("returns weekdays from a 60-calendar-day window including today", () => {
  const dates = getMonitoringDates("2026-09-18");

  assert.equal(dates[0], "2026-09-18");
  assert.equal(dates.at(-1), "2026-11-16");
  assert.equal(dates.length, 42);
  assert.ok(dates.every((date) => ![0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())));
});

test("derives only week starts that intersect the monitoring window", () => {
  assert.equal(getWeekStart("2026-09-18"), "2026-09-14");
  assert.deepEqual(getAllowedWeekStarts("2026-09-18"), [
    "2026-09-14",
    "2026-09-21",
    "2026-09-28",
    "2026-10-05",
    "2026-10-12",
    "2026-10-19",
    "2026-10-26",
    "2026-11-02",
    "2026-11-09",
    "2026-11-16"
  ]);
});

test("maps source times to the agreed periods", () => {
  assert.equal(periodForTime("10:00:00"), "morning");
  assert.equal(periodForTime("13:00:00"), "afternoon");
  assert.equal(periodForTime("15:30:00"), "afternoon");
  assert.equal(periodForTime("18:30:00"), "evening");
});

test("only reports selected zero-to-available transitions", () => {
  const previous = new Map([
    [cellKey("2026-10-14", "10:00:00"), 0],
    [cellKey("2026-10-14", "13:00:00"), 0]
  ]);
  const selected = new Set([selectionKey("2026-10-14", "morning")]);
  const cells = [
    { date: "2026-10-14", time: "10:00:00", places: 1, closed: false, tooSoon: false },
    { date: "2026-10-14", time: "13:00:00", places: 2, closed: false, tooSoon: false },
    { date: "2026-10-14", time: "15:30:00", places: 1, closed: false, tooSoon: false }
  ];

  assert.deepEqual(findNewlyAvailable(previous, cells, selected), [cells[0]]);
});

test("a weekly Friday afternoon selection only matches Friday afternoons", () => {
  const selected = new Set();
  const weeklySelected = new Set([weeklySelectionKey(5, "afternoon")]);
  const previous = new Map([
    [cellKey("2026-09-24", "13:00:00"), 0],
    [cellKey("2026-09-25", "10:00:00"), 0],
    [cellKey("2026-09-25", "13:00:00"), 0]
  ]);
  const cells = [
    { date: "2026-09-24", time: "13:00:00", places: 1, closed: false, tooSoon: false },
    { date: "2026-09-25", time: "10:00:00", places: 1, closed: false, tooSoon: false },
    { date: "2026-09-25", time: "13:00:00", places: 1, closed: false, tooSoon: false }
  ];

  assert.equal(isMomentSelected("2026-09-25", "afternoon", selected, weeklySelected), true);
  assert.equal(isMomentSelected("2026-09-24", "afternoon", selected, weeklySelected), false);
  assert.deepEqual(findNewlyAvailable(previous, cells, selected, weeklySelected), [cells[2]]);
});

test("does not report availability without an earlier observation", () => {
  const selected = new Set([selectionKey("2026-10-14", "morning")]);
  const cells = [
    { date: "2026-10-14", time: "10:00:00", places: 1, closed: false, tooSoon: false }
  ];

  assert.deepEqual(findNewlyAvailable(new Map(), cells, selected), []);
});

test("does not report cells that cannot be booked", () => {
  const previous = new Map([[cellKey("2026-10-14", "10:00:00"), 0]]);
  const selected = new Set([selectionKey("2026-10-14", "morning")]);
  const cells = [
    { date: "2026-10-14", time: "10:00:00", places: 1, closed: true, tooSoon: false }
  ];

  assert.deepEqual(findNewlyAvailable(previous, cells, selected), []);
});