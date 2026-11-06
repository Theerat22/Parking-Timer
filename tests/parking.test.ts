import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateParking,
  bangkokDate,
  summarize,
  fromBangkokInput,
  localInput,
  timer,
  type ParkingSession,
} from "../lib/parking";
const start = "2026-11-06T01:00:00Z";
for (const [milliseconds, expected] of [
  [0, 0],
  [120 * 60000 - 1, 0],
  [120 * 60000, 2000],
  [120 * 60000 + 1, 2000],
  [135 * 60000, 2000],
  [180 * 60000 - 1, 2000],
  [180 * 60000, 4000],
  [180 * 60000 + 1, 4000],
  [240 * 60000 - 1, 4000],
  [240 * 60000, 6000],
  [300 * 60000, 8000],
])
  test(`hourly step at ${milliseconds}ms = ${expected} satang`, () =>
    assert.equal(
      calculateParking(start, Date.parse(start) + milliseconds).costSatang,
      expected,
    ));
test("legacy minute pricing stays on its saved rule", () =>
  assert.equal(
    calculateParking(
      start,
      Date.parse(start) + 135 * 60000,
      120,
      2000,
      "minute",
    ).costSatang,
    500,
  ));
test("clock rollback never produces negative cost", () =>
  assert.equal(
    calculateParking(start, Date.parse(start) - 1000).costSatang,
    0,
  ));
test("stored rate snapshots are respected", () =>
  assert.equal(
    calculateParking(start, Date.parse(start) + 180 * 60000, 60, 3000)
      .costSatang,
    9000,
  ));
test("Bangkok dates group UTC evenings into next day", () =>
  assert.equal(bangkokDate("2026-11-06T18:00:00Z"), "2026-11-07"));
test("editing preserves seconds and milliseconds in Bangkok", () =>
  assert.equal(
    fromBangkokInput(localInput("2026-11-06T01:23:45.678Z")),
    "2026-11-06T01:23:45.678Z",
  ));
test("minute-only datetime input is accepted", () =>
  assert.equal(
    fromBangkokInput("2026-11-06T08:30"),
    "2026-11-06T01:30:00.000Z",
  ));
test("stats sum rounded per-session money, exclude active sessions, count occupied days", () => {
  const base = { free_minutes: 120, hourly_rate_satang: 2000, source: "web" };
  const rows: ParkingSession[] = [
    {
      ...base,
      id: "1",
      started_at: start,
      ended_at: "2026-11-06T03:01:00Z",
      cost_satang: 33,
    },
    {
      ...base,
      id: "2",
      started_at: "2026-11-06T05:00:00Z",
      ended_at: "2026-11-06T07:01:00Z",
      cost_satang: 33,
    },
    {
      ...base,
      id: "3",
      started_at: "2026-11-07T01:00:00Z",
      ended_at: null,
      cost_satang: null,
    },
  ];
  const result = summarize(rows);
  assert.equal(result.totalSatang, 66);
  assert.equal(result.count, 2);
  assert.equal(result.days, 1);
  assert.equal(result.averageDailySatang, 66);
});
test("empty stats never divide by zero", () =>
  assert.equal(summarize([]).averageDailySatang, 0));
test("timer keeps hours exceeding 24", () =>
  assert.deepEqual(timer(26 * 3600000 + 62000), ["26", "01", "02"]));
