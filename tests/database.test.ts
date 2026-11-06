import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { calculateParking } from "../lib/parking";
let db: PGlite;
beforeEach((context) => {
  if ("diagnostic" in context)
    context.diagnostic("PostgreSQL: " + context.name);
});
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222";
type Result = {
  state: string;
  session: {
    id: string;
    started_at: string;
    ended_at: string;
    cost_satang: number;
  } | null;
};
async function command(
  user: string,
  action: string,
  key: string | null = null,
  payload: object = {},
  source = "web",
  token: string | null = null,
) {
  const result = await db.query<{ result: Result }>(
    "select parking_command($1,$2,$3::jsonb,$4,$5,$6) as result",
    [user, action, JSON.stringify(payload), key, source, token],
  );
  return result.rows[0].result;
}
before(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    "create schema auth;create schema extensions;create role anon;create role authenticated;create role service_role;create table auth.users(id uuid primary key);",
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202611060001_parking.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query("insert into auth.users(id) values($1),($2)", [alice, bob]);
  await db.exec(
    "insert into auth.users(id) values('77777777-7777-4777-8777-777777777777'); insert into parking_sessions(user_id,started_at,ended_at,cost_satang) values('77777777-7777-4777-8777-777777777777','2026-01-01T01:00:00Z','2026-01-01T03:15:00Z',500); insert into parking_sessions(user_id,started_at) values('77777777-7777-4777-8777-777777777777',now()-interval '134 minutes 30 seconds')",
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202611070001_hourly_steps.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
after(async () => {
  await db?.close();
});
test("migration compiles, SQL pricing matches TypeScript at exact boundaries", async () => {
  for (const ms of [
    0,
    119 * 60000,
    120 * 60000 - 1,
    120 * 60000,
    120 * 60000 + 1,
    120 * 60000 + 1000,
    135 * 60000,
    150 * 60000,
    180 * 60000 - 1,
    180 * 60000,
    181 * 60000,
    240 * 60000 - 1,
    240 * 60000,
  ]) {
    const start = "2026-10-01T01:00:00.000Z",
      end = new Date(Date.parse(start) + ms).toISOString();
    const result = await db.query<{ cost: number }>(
      "select parking_cost($1,$2,120,2000,'hourly_step') as cost",
      [start, end],
    );
    assert.equal(
      Number(result.rows[0].cost),
      calculateParking(start, end).costSatang,
    );
  }
});
test("repeated and simultaneous starts keep original session and one active row", async () => {
  const results = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      command(alice, "start", `concurrent-start-${i}`),
    ),
  );
  assert.equal(new Set(results.map((r) => r.session!.id)).size, 1);
  assert.equal(results.filter((r) => r.state === "started").length, 1);
  const original = results[0].session!;
  assert.equal(
    (await command(alice, "start", "concurrent-start-0")).session!.started_at,
    original.started_at,
  );
});
test("user data is isolated; bootstrap does not return token hashes", async () => {
  const { rows } = await db.query<{
    result: { sessions: unknown[]; tokens: unknown[] };
  }>("select parking_bootstrap($1) as result", [bob]);
  assert.equal(rows[0].result.sessions.length, 0);
  const status = await command(bob, "status");
  assert.equal(status.session, null);
});
test("stop replay cannot close a newer session and keys cannot change operation", async () => {
  const stopped = await command(alice, "stop", "stop-request-00001");
  assert.equal(stopped.state, "stopped");
  const newer = await command(alice, "start", "new-start-request-01");
  const replay = await command(alice, "stop", "stop-request-00001");
  assert.equal(replay.session!.id, stopped.session!.id);
  assert.equal((await command(alice, "status")).session!.id, newer.session!.id);
  await assert.rejects(
    command(alice, "stop", "new-start-request-01"),
    /PT_KEY/,
  );
  await command(alice, "stop", "final-stop-request-01");
  assert.equal(
    (await command(alice, "stop", "empty-stop-request-01")).state,
    "idle",
  );
});
test("edit recalculates saved cost; rejects overlap, future times, other users; delete updates history", async () => {
  const ids = await db.query<{ id: string }>(
    "select id from parking_sessions where user_id=$1 order by started_at",
    [alice],
  );
  const id = ids.rows[0].id;
  const second = ids.rows[1].id;
  const edited = await command(alice, "edit", null, {
    id,
    started_at: "2026-01-01T01:00:00Z",
    ended_at: "2026-01-01T03:15:00Z",
  });
  assert.equal(Number(edited.session!.cost_satang), 2000);
  await assert.rejects(
    command(bob, "edit", null, {
      id,
      started_at: "2026-01-01T01:00:00Z",
      ended_at: "2026-01-01T02:00:00Z",
    }),
    /PT_NOT_FOUND/,
  );
  await assert.rejects(
    command(alice, "edit", null, {
      id: second,
      started_at: "2026-01-01T02:00:00Z",
      ended_at: "2026-01-01T04:00:00Z",
    }),
    /no_overlapping_parking/,
  );
  await assert.rejects(
    command(alice, "edit", null, {
      id,
      started_at: "2099-01-01T00:00:00Z",
      ended_at: "2099-01-01T01:00:00Z",
    }),
    /PT_TIME/,
  );
  await assert.rejects(
    command(alice, "edit", null, {
      id,
      started_at: "2026-01-01T02:00:00Z",
      ended_at: "2026-01-01T01:00:00Z",
    }),
    /PT_TIME/,
  );
  await command(alice, "delete", null, { id });
  await assert.rejects(command(alice, "delete", null, { id }), /PT_NOT_FOUND/);
});
test("revoked tokens cannot execute or replay commands; tokens cannot edit history", async () => {
  const token = "33333333-3333-4333-8333-333333333333";
  await db.query(
    "insert into shortcut_tokens(id,user_id,name,token_hash,prefix) values($1,$2,'test','hashed-test','pt_test')",
    [token, bob],
  );
  await command(bob, "start", "shortcut-start-0001", {}, "shortcut", token);
  await assert.rejects(
    command(bob, "delete", null, { id: token }, "shortcut", token),
    /PT_TOKEN/,
  );
  const bootstrap = await db.query<{ result: object }>(
    "select parking_bootstrap($1) as result",
    [bob],
  );
  assert.ok(!JSON.stringify(bootstrap.rows[0].result).includes("hashed-test"));
  await db.query("select revoke_shortcut_token($1,$2)", [bob, token]);
  await assert.rejects(
    command(bob, "start", "shortcut-start-0001", {}, "shortcut", token),
    /PT_TOKEN/,
  );
});
test("rate limit is persistent and rejects after configured quota", async () => {
  const a = await db.query<{ ok: boolean }>(
    "select consume_rate_limit('test-user',2) as ok",
  );
  assert.equal(a.rows[0].ok, true);
  await db.query("select consume_rate_limit('test-user',2)");
  const c = await db.query<{ ok: boolean }>(
    "select consume_rate_limit('test-user',2) as ok",
  );
  assert.equal(c.rows[0].ok, false);
});
test("browser roles cannot write tables or impersonate another user through RPC", async () => {
  await db.exec("set role authenticated");
  try {
    await assert.rejects(
      db.query("select * from shortcut_tokens"),
      /permission denied/,
    );
    await assert.rejects(command(bob, "status"), /permission denied/);
    await assert.rejects(
      db.query(
        "insert into parking_sessions(user_id,started_at) values($1,now())",
        [bob],
      ),
      /permission denied/,
    );
  } finally {
    await db.exec("reset role");
  }
});

test("migration preserves legacy completed and active session pricing", async () => {
  const snapshot = await db.query<{
    billing_model: string;
    cost_satang: number;
  }>(
    "select billing_model,cost_satang from parking_sessions where user_id='77777777-7777-4777-8777-777777777777' and ended_at is not null",
  );
  assert.equal(snapshot.rows[0].billing_model, "minute");
  assert.equal(Number(snapshot.rows[0].cost_satang), 500);
  const legacyStop = await command(
    "77777777-7777-4777-8777-777777777777",
    "stop",
    "legacy-stop-request-01",
  );
  assert.equal(Number(legacyStop.session!.cost_satang), 500);
  const status = await command(
    "77777777-7777-4777-8777-777777777777",
    "start",
    "hourly-new-session-001",
  );
  const row = await db.query<{ billing_model: string }>(
    "select billing_model from parking_sessions where id=$1",
    [status.session!.id],
  );
  assert.equal(row.rows[0].billing_model, "hourly_step");
});
