import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
const migrations = [
  "202611060001_parking.sql",
  "202611070001_hourly_steps.sql",
  "202611070002_single_owner.sql",
];
async function setup() {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    "create schema auth;create schema extensions;create role anon;create role authenticated;create role service_role;create table auth.users(id uuid primary key);",
  );
  for (const name of migrations.slice(0, 2))
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + name, import.meta.url),
        "utf8",
      ),
    );
  return db;
}
async function migrate(db: PGlite) {
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/" + migrations[2], import.meta.url),
      "utf8",
    ),
  );
}
test("fresh single-owner database needs no auth account and accepts parking", async () => {
  const db = await setup();
  try {
    await migrate(db);
    const owner = await db.query<{ id: string }>(
      "select id from parking_owner",
    );
    assert.equal(owner.rows.length, 1);
    const auth = await db.query("select * from auth.users");
    assert.equal(auth.rows.length, 0);
    const started = await db.query<{ result: { state: string } }>(
      "select parking_command($1,'start','{}','single-owner-start-001','web',null) as result",
      [owner.rows[0].id],
    );
    assert.equal(started.rows[0].result.state, "started");
    await assert.rejects(
      db.exec("insert into parking_owner(id) values(gen_random_uuid())"),
      /duplicate key/,
    );
    await db.exec("set role anon");
    await assert.rejects(
      db.exec("select * from parking_owner"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
test("single-owner migration preserves prior records and tokens independently of auth", async () => {
  const db = await setup();
  try {
    const id = "88888888-8888-4888-8888-888888888888";
    await db.query("insert into auth.users(id) values($1)", [id]);
    await db.query(
      "select parking_command($1,'start','{}','existing-owner-start-01','web',null)",
      [id],
    );
    await db.query(
      "insert into shortcut_tokens(user_id,name,token_hash,prefix) values($1,'Siri','savedhash','pt_saved')",
      [id],
    );
    await migrate(db);
    await db.query("delete from auth.users where id=$1", [id]);
    const owner = await db.query<{ id: string }>(
      "select id from parking_owner",
    );
    assert.equal(owner.rows[0].id, id);
    assert.equal(
      (await db.query("select * from parking_sessions")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from shortcut_tokens")).rows.length,
      1,
    );
  } finally {
    await db.close();
  }
});
test("migration refuses to silently merge multiple existing owners", async () => {
  const db = await setup();
  try {
    await db.exec(
      "insert into auth.users(id) values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');insert into parking_sessions(user_id,started_at) select id,now() from auth.users",
    );
    await assert.rejects(migrate(db), /Multiple existing owners/);
    await db.exec("rollback");
    assert.equal(
      (await db.query("select * from parking_sessions")).rows.length,
      2,
    );
  } finally {
    await db.close();
  }
});
