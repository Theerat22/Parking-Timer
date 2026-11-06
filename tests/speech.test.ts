import { test } from "node:test";
import assert from "node:assert/strict";
import {
  spokenClock,
  spokenDuration,
  spokenMoney,
  parkingMessage,
} from "../lib/speech";
import type { ParkingSession } from "../lib/parking";
const row: ParkingSession = {
  id: "test",
  started_at: "2026-11-07T01:30:00Z",
  ended_at: null,
  free_minutes: 120,
  hourly_rate_satang: 2000,
  billing_model: "hourly_step",
  cost_satang: null,
  source: "web",
};
test("clock uses full Thai units and Bangkok time", () => {
  assert.equal(spokenClock(row.started_at), "8 นาฬิกา 30 นาที");
  assert.equal(spokenClock("2026-11-06T17:00:00Z"), "0 นาฬิกา 0 นาที");
});
test("duration speaks minutes and full hours, including more than one day", () => {
  assert.equal(spokenDuration(0), "0 นาที");
  assert.equal(spokenDuration(15 * 60000), "15 นาที");
  assert.equal(spokenDuration(120 * 60000), "2 ชั่วโมง");
  assert.equal(spokenDuration(26 * 3600000 + 15 * 60000), "26 ชั่วโมง 15 นาที");
});
test("money speaks explicit units without decimal ambiguity or grouping punctuation", () => {
  assert.equal(spokenMoney(0), "0 บาท");
  assert.equal(spokenMoney(12000), "120 บาท");
  assert.equal(spokenMoney(2033), "20 บาท 33 สตางค์");
  assert.equal(spokenMoney(100000), "1000 บาท");
});
test("start and repeated start messages contain no time abbreviations", () => {
  const result = {
    state: "started",
    session: row,
    server_time: row.started_at,
  };
  assert.equal(
    parkingMessage("start", result),
    "เริ่มบันทึกเวลาจอดรถแล้ว เวลา 8 นาฬิกา 30 นาที",
  );
  assert.equal(
    parkingMessage("start", { ...result, state: "already_active" }),
    "คุณกำลังจอดรถอยู่ เริ่มเวลา 8 นาฬิกา 30 นาที",
  );
});
test("status and stop messages use full units and keep saved cost", () => {
  const result = {
    state: "active",
    session: row,
    server_time: "2026-11-07T05:45:00Z",
  };
  assert.equal(
    parkingMessage("status", result),
    "จอดไป 4 ชั่วโมง 15 นาที ค่าจอด 60 บาท",
  );
  assert.equal(
    parkingMessage("stop", {
      ...result,
      state: "stopped",
      session: { ...row, ended_at: result.server_time, cost_satang: 6000 },
    }),
    "สิ้นสุดการจอดแล้ว รวม 4 ชั่วโมง 15 นาที ค่าจอด 60 บาท",
  );
});
test("legacy saved fractional cost is spoken in baht and satang", () =>
  assert.equal(
    parkingMessage("stop", {
      state: "stopped",
      session: {
        ...row,
        billing_model: "minute",
        ended_at: "2026-11-07T03:31:00Z",
        cost_satang: 33,
      },
      server_time: "2026-11-07T03:31:00Z",
    }),
    "สิ้นสุดการจอดแล้ว รวม 2 ชั่วโมง 1 นาที ค่าจอด 0 บาท 33 สตางค์",
  ));
test("idle message remains meaningful", () =>
  assert.equal(
    parkingMessage("status", {
      state: "idle",
      session: null,
      server_time: row.started_at,
    }),
    "ยังไม่มีรายการที่กำลังจอด",
  ));
