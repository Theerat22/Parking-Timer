/** Real Next.js HTTP handlers + real PostgreSQL (PGlite).
 * Supabase PostgREST transport is emulated locally; no hosted credentials or real user data.
 */
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { chromium } from "@playwright/test";
const db = new PGlite({ extensions: { btree_gist } });
const uid = "44444444-4444-4444-8444-444444444444";
const other = "55555555-5555-4555-8555-555555555555";
await db.exec(
  "create schema auth;create schema extensions;create role anon;create role authenticated;create role service_role;create table auth.users(id uuid primary key);",
);
await db.exec(
  await readFile("supabase/migrations/202611060001_parking.sql", "utf8"),
);
await db.exec(
  await readFile("supabase/migrations/202611070001_hourly_steps.sql", "utf8"),
);
await db.query("insert into auth.users(id) values($1),($2)", [uid, other]);
const token = "pt_" + "a".repeat(43);
const tokenId = "66666666-6666-4666-8666-666666666666";
await db.query(
  "insert into shortcut_tokens(id,user_id,name,token_hash,prefix) values($1,$2,'Test fixture',$3,'pt_aaaaaaa')",
  [tokenId, uid, createHash("sha256").update(token).digest("hex")],
);
await db.exec(
  await readFile("supabase/migrations/202611070002_single_owner.sql", "utf8"),
);
let transportError = "";
const transport = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url!, "http://localhost:54329");
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length
        ? JSON.parse(Buffer.concat(chunks).toString())
        : {};
      res.setHeader("content-type", "application/json");
      if (url.pathname.startsWith("/auth/v1/"))
        throw new Error("Auth must not be called in single-owner mode");
      if (url.pathname === "/rest/v1/parking_owner") {
        const result = await db.query("select id from parking_owner");
        res.end(JSON.stringify(result.rows[0]));
        return;
      }
      if (req.headers.authorization !== "Bearer test-service-role") {
        res.statusCode = 401;
        res.end("{}");
        return;
      }
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        const fn = url.pathname.split("/").pop();
        const names: Record<string, string[]> = {
          consume_rate_limit: ["p_key", "p_limit"],
          parking_command: [
            "p_user",
            "p_action",
            "p_payload",
            "p_key",
            "p_source",
            "p_token_id",
          ],
          parking_bootstrap: ["p_user"],
          revoke_shortcut_token: ["p_user", "p_id"],
        };
        if (!fn || !names[fn]) throw new Error("Unknown RPC");
        const keys = names[fn];
        const params = keys.map((k) =>
          k === "p_payload" ? JSON.stringify(body[k]) : body[k],
        );
        try {
          const result = await db.query<{ result: unknown }>(
            `select ${fn}(${keys.map((k, i) => "$" + (i + 1) + (k === "p_payload" ? "::jsonb" : "")).join(",")}) as result`,
            params,
          );
          res.end(JSON.stringify(result.rows[0].result));
        } catch (e) {
          const error = e as { message: string; code: string };
          res.statusCode = 400;
          res.end(JSON.stringify({ message: error.message, code: error.code }));
        }
        return;
      }
      if (url.pathname === "/rest/v1/shortcut_tokens") {
        if (req.method === "GET") {
          const hash = url.searchParams.get("token_hash")?.slice(3);
          const user = url.searchParams.get("user_id")?.slice(3);
          const result = hash
            ? await db.query(
                "select id,user_id from shortcut_tokens where token_hash=$1 and revoked_at is null",
                [hash],
              )
            : await db.query(
                "select id from shortcut_tokens where user_id=$1 and revoked_at is null",
                [user],
              );
          if (req.method === "GET" && url.searchParams.has("select")) {
            res.setHeader(
              "content-range",
              `0-${Math.max(0, result.rows.length - 1)}/${result.rows.length}`,
            );
          }
          res.end(JSON.stringify(result.rows));
          return;
        }
        if (req.method === "HEAD") {
          const user = url.searchParams.get("user_id")?.slice(3);
          const result = await db.query(
            "select id from shortcut_tokens where user_id=$1 and revoked_at is null",
            [user],
          );
          res.setHeader("content-range", `*/${result.rows.length}`);
          res.end();
          return;
        }
        if (req.method === "PATCH") {
          await db.query(
            "update shortcut_tokens set last_used_at=$1 where id=$2 and revoked_at is null",
            [body.last_used_at, url.searchParams.get("id")!.slice(3)],
          );
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method === "POST") {
          const result = await db.query(
            "insert into shortcut_tokens(user_id,name,token_hash,prefix) values($1,$2,$3,$4) returning id,name,prefix,created_at,last_used_at,revoked_at",
            [body.user_id, body.name, body.token_hash, body.prefix],
          );
          res.statusCode = 201;
          res.end(JSON.stringify(result.rows[0]));
          return;
        }
      }
      res.statusCode = 404;
      res.end("{}");
    } catch (e) {
      transportError = (e as Error).message;
      res.statusCode = 500;
      res.end(JSON.stringify({ message: transportError }));
    }
  },
);
await new Promise<void>((resolve) =>
  transport.listen(54329, "127.0.0.1", resolve),
);
const app = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--webpack",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3001",
  ],
  {
    env: {
      ...process.env,
      PARKING_TEST_BUILD: "1",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
      APP_ORIGIN: "http://127.0.0.1:3001",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "";
app.stdout.on("data", (c) => (logs += c));
app.stderr.on("data", (c) => (logs += c));
const base = "http://127.0.0.1:3001";
let checks = 0;
const results: string[] = [];
async function api(
  path: string,
  method = "GET",
  headers: Record<string, string> = {},
  body?: object,
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    data: await response.json(),
    headers: response.headers,
  };
}
async function commandCurrent() {
  const data = await db.query<{ id: string }>(
    "select id from parking_sessions where user_id=$1 and ended_at is null",
    [uid],
  );
  return data.rows[0];
}
function pass(name: string) {
  checks++;
  results.push(name);
}
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
    if (i === 89) throw new Error("Next not ready: " + logs);
  }
  let r = await api("/api/parking/status");
  assert.equal(r.status, 200);
  pass("Single-owner status works without login");
  const bearer = { Authorization: `Bearer ${token}` };
  r = await api("/api/parking/status", "GET", bearer);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.state, "idle");
  pass("Bearer status uses real handler and PostgreSQL");
  r = await api("/api/parking/start", "POST", bearer);
  assert.equal(r.status, 400);
  pass("Idempotency key required");
  r = await api("/api/parking/start", "POST", {
    ...bearer,
    "Idempotency-Key": "api-start-request-001",
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.state, "started");
  assert.match(r.data.message, /เริ่มบันทึก.*นาฬิกา.*นาที/);
  assert.doesNotMatch(r.data.message, /ชม\.|น\./);
  const firstId = r.data.session.id;
  pass("Start returns Thai confirmation");
  const concurrent = await Promise.all(
    Array.from({ length: 4 }, (_, i) =>
      api("/api/parking/start", "POST", {
        ...bearer,
        "Idempotency-Key": `api-parallel-start-${i}`,
      }),
    ),
  );
  assert.ok(concurrent.every((r) => r.data.session.id === firstId));
  pass("Concurrent HTTP starts keep one session");
  r = await api("/api/parking/stop", "POST", {
    ...bearer,
    "Idempotency-Key": "api-stop-request-001",
  });
  assert.equal(r.data.state, "stopped");
  assert.match(r.data.message, /นาที.*บาท/);
  assert.doesNotMatch(r.data.message, /ชม\.|น\./);
  r = await api("/api/parking/start", "POST", {
    ...bearer,
    "Idempotency-Key": "api-start-request-002",
  });
  const newId = r.data.session.id;
  r = await api("/api/parking/stop", "POST", {
    ...bearer,
    "Idempotency-Key": "api-stop-request-001",
  });
  assert.equal(r.data.session.id, firstId);
  assert.equal(
    (await api("/api/parking/status", "GET", bearer)).data.session.id,
    newId,
  );
  pass("HTTP stop replay does not stop newer session");
  assert.equal((await api("/api/bootstrap", "GET", bearer)).status, 401);
  assert.equal((await api("/api/tokens", "POST", bearer)).status, 401);
  pass("Scoped token denied bootstrap and token administration");
  assert.equal(
    (await fetch(base + "/api/auth/login", { method: "POST" })).status,
    404,
  );
  pass("Login API removed");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base, { waitUntil: "networkidle" });
  await page
    .getByRole("button", { name: "สิ้นสุดการจอด", exact: true })
    .waitFor();
  assert.equal(await page.locator('input[type="password"]').count(), 0);
  assert.equal(await page.getByText("เข้าสู่ระบบ", { exact: true }).count(), 0);
  pass("Browser opens active parking directly without a login form");
  assert.equal((await page.context().cookies()).length, 0);
  pass("No authentication cookie required");
  const cross = await page.request.post(base + "/api/tokens", {
    headers: { Origin: "https://evil.example" },
  });
  assert.equal(cross.status(), 403);
  pass("Origin guard protects browser mutations");
  const originProbe = await page.request.post(base + "/api/parking/stop", {
    headers: { Origin: base, "Idempotency-Key": "diagnostic" },
  });
  assert.equal(originProbe.status(), 400);
  assert.equal((await commandCurrent()).id, newId);
  pass("Same-origin stop reaches validation without changing active parking");

  // Seed only the in-memory test database for visual and history checks.
  await db.query(
    "update parking_sessions set started_at=now()-interval '3 days 1 hour',ended_at=now()-interval '3 days' where id=$1",
    [firstId],
  );
  await db.query(
    "update parking_sessions set started_at=now()-interval '4 hours 14 minutes 30 seconds' where id=$1",
    [newId],
  );
  await db.query(
    "insert into parking_sessions(user_id,started_at,ended_at,cost_satang) values($1,now()-interval '1 day 6 hours',now()-interval '1 day 1 hour',8000),($1,now()-interval '2 days 8 hours',now()-interval '2 days 1 hour',12000)",
    [uid],
  );
  await page.getByRole("button", { name: "อัปเดตข้อมูล", exact: true }).click();
  await page.getByText("60", { exact: false }).first().waitFor();
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: "docs/screenshots/desktop-active-test-fixture.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/screenshots/mobile-paid-test-fixture.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload({ waitUntil: "networkidle" });
  await page
    .getByRole("button", { name: "สิ้นสุดการจอด", exact: true })
    .waitFor();
  pass("Reload restores active parking");
  await page
    .getByRole("button", { name: "สิ้นสุดการจอด", exact: true })
    .click();
  await page.getByRole("button", { name: "เริ่มจอดรถ", exact: true }).waitFor();
  pass("Browser stop persists and returns idle state");
  for (const tab of ["history", "stats", "siri"]) {
    await page.locator(`nav:visible a[href="#${tab}"]`).click();
    await page.screenshot({
      path: `docs/screenshots/desktop-${tab}-test-fixture.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "สร้างโทเคน", exact: true }).click();
  await page.locator(".secret-box code").waitFor();
  const generated = await page.locator(".secret-box code").textContent();
  assert.match(generated!, /^pt_/);
  pass("Create token reveals secret once");
  await page.locator('nav:visible a[href="#today"]').click();
  await page.locator('nav:visible a[href="#siri"]').click();
  assert.equal(await page.locator(".secret-box").count(), 0);
  pass("Leaving Siri clears revealed secret");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('nav:visible a[href="#today"]').click();
  await page.getByRole("button", { name: "เริ่มจอดรถ", exact: true }).click();
  await page
    .getByRole("button", { name: "สิ้นสุดการจอด", exact: true })
    .waitFor();
  await page.screenshot({
    path: "docs/screenshots/mobile-active-test-fixture.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  pass("Mobile active screen has no horizontal overflow");
  for (const tab of ["history", "stats", "siri"]) {
    await page.locator(`nav:visible a[href="#${tab}"]`).click();
    await page.screenshot({
      path: `docs/screenshots/mobile-${tab}-test-fixture.png`,
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  await page.locator('nav:visible a[href="#history"]').click();
  await page
    .getByRole("button", { name: /แก้ไขรายการ/ })
    .first()
    .click();
  await page.locator("dialog[open] input").first().fill("2099-01-01T08:00");
  await page.locator("dialog[open] input").last().fill("2099-01-01T09:00");
  await page
    .getByRole("button", { name: "บันทึกการแก้ไข", exact: true })
    .click();
  await page.locator("dialog[open]").getByRole("alert").waitFor();
  pass("Future history edits show an actionable validation error");
  await page
    .getByRole("button", { name: "ปิดหน้าต่างแก้ไข", exact: true })
    .click();
  await page
    .getByRole("button", { name: /แก้ไขรายการ/ })
    .first()
    .click();
  await page.locator("dialog[open] input").first().fill("2026-01-01T08:00");
  await page.locator("dialog[open] input").last().fill("2026-01-01T10:15");
  await page
    .getByRole("button", { name: "บันทึกการแก้ไข", exact: true })
    .click();
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  const edited = await db.query<{ cost_satang: number }>(
    "select cost_satang from parking_sessions where user_id=$1 and started_at='2026-01-01T01:00:00Z'",
    [uid],
  );
  assert.equal(Number(edited.rows[0].cost_satang), 2000);
  pass("Browser history edit persists and recalculates cost");
  const countBefore = await page.locator(".history-row").count();
  await page
    .getByRole("button", { name: /ลบรายการ/ })
    .first()
    .click();
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: "ลบรายการ", exact: true })
    .click();
  await page.waitForFunction(
    (n) => document.querySelectorAll(".history-row").length === n,
    countBefore - 1,
  );
  pass("Confirmed deletion removes record and refreshes history");
  await page.context().setOffline(true);
  await page.locator('nav:visible a[href="#today"]').click();
  assert.equal(
    await page
      .getByRole("button", { name: "สิ้นสุดการจอด", exact: true })
      .isDisabled(),
    true,
  );
  await page.context().setOffline(false);
  pass("Offline state disables mutations");
  await page
    .getByRole("button", { name: "สิ้นสุดการจอด", exact: true })
    .click();
  await page.getByRole("button", { name: "เริ่มจอดรถ", exact: true }).waitFor();
  await page.route("**/api/parking/start", async (route) => {
    await route.fetch();
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "เริ่มจอดรถ", exact: true }).click();
  await page
    .getByRole("button", { name: "ยืนยันคำสั่งเดิมอีกครั้ง", exact: true })
    .waitFor();
  const lostId = (await commandCurrent()).id;
  await page.unroute("**/api/parking/start");
  await page.reload({ waitUntil: "networkidle" });
  await page
    .getByRole("button", { name: "ยืนยันคำสั่งเดิมอีกครั้ง", exact: true })
    .click();
  await page
    .getByRole("button", { name: "สิ้นสุดการจอด", exact: true })
    .waitFor();
  assert.equal((await commandCurrent()).id, lostId);
  pass(
    "Lost response retains request key across reload and retry creates no duplicate",
  );
  assert.deepEqual(errors, []);
  pass("No browser runtime errors");
  await db.query("select revoke_shortcut_token($1,$2)", [uid, tokenId]);
  r = await api("/api/parking/status", "GET", bearer);
  assert.equal(r.status, 401);
  pass("Revoked bearer rejected by real HTTP handler");
  assert.equal(transportError, "");
  await writeFile(
    "docs/screenshots/integration-results.json",
    JSON.stringify(
      {
        checks,
        results,
        scope:
          "Real Next HTTP + PGlite PostgreSQL; locally emulated Supabase PostgREST. Synthetic screenshots only.",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ checks, results }, null, 2));
} catch (error) {
  console.error("FAIL", error);
  console.error("Transport:", transportError);
  console.error(logs.slice(-5000));
  process.exitCode = 1;
} finally {
  await browser?.close();
  app.kill("SIGTERM");
  await new Promise<void>((resolve) => transport.close(() => resolve()));
  await db.close();
}
