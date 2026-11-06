import { test } from "node:test";
import assert from "node:assert/strict";
import { configurationProblem, databaseProblem } from "../lib/supabase/config";
const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-server-secret",
};
test("placeholder server key is rejected before a database request", () =>
  assert.match(
    configurationProblem({
      ...valid,
      SUPABASE_SERVICE_ROLE_KEY: "YOUR_SERVER_ONLY_SERVICE_ROLE_KEY",
    })!,
    /ค่าตัวอย่าง/,
  ));
test("missing and publishable keys are distinguished", () => {
  assert.match(
    configurationProblem({ ...valid, SUPABASE_SERVICE_ROLE_KEY: undefined })!,
    /ยังไม่ได้ตั้งค่า/,
  );
  assert.match(
    configurationProblem({
      ...valid,
      SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_test",
    })!,
    /ไม่ใช่ publishable/,
  );
});
test("configured credentials pass configuration validation", () =>
  assert.equal(configurationProblem(valid), null));
test("invalid key is never described as missing migration", () =>
  assert.match(
    databaseProblem({ message: "Invalid API key" }, "fallback"),
    /คีย์ Supabase ไม่ถูกต้อง/,
  ));
test("missing tables, missing functions and network failures have distinct recovery", () => {
  assert.match(databaseProblem({ code: "PGRST205" }, "fallback"), /ตาราง/);
  assert.match(databaseProblem({ code: "PGRST202" }, "fallback"), /ฟังก์ชัน/);
  assert.match(
    databaseProblem({ message: "TypeError: fetch failed" }, "fallback"),
    /อินเทอร์เน็ต/,
  );
});
