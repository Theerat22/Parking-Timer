import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRequestId } from "../lib/idempotency";
test("missing header has a distinct recovery", () =>
  assert.match(validateRequestId(null).error!, /ไม่ได้รับ/));
test("shortened header name is identified", () =>
  assert.match(validateRequestId(null, true).error!, /ชื่อ Idempotency แต่/));
test("literal variable name reports actual length", () =>
  assert.match(validateRequestId("RequestID").error!, /9 ตัวอักษร/));
test("random number alone reports actual length", () =>
  assert.match(validateRequestId("427").error!, /3 ตัวอักษร/));
test("formatted date punctuation and newlines are rejected distinctly", () => {
  assert.match(validateRequestId("07/11/2026 01:12:00-427").error!, /อักขระ/);
  assert.match(validateRequestId("20261107011200123\n-427").error!, /อักขระ/);
});
test("timestamp key and UUID pass without changing their identity", () => {
  for (const key of [
    "20261107011200123-427",
    "550e8400-e29b-41d4-a716-446655440000",
  ])
    assert.deepEqual(validateRequestId(key), { key, error: null });
});
test("header edge whitespace is trimmed, oversized keys rejected", () => {
  assert.equal(
    validateRequestId(" 20261107011200123-427 ").key,
    "20261107011200123-427",
  );
  assert.match(validateRequestId("a".repeat(129)).error!, /129/);
});
