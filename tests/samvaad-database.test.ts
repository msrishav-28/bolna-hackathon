import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

let db: PGlite;
let topicId: string;
const alice = "20000000-0000-4000-8000-000000000001";
const bob = "20000000-0000-4000-8000-000000000002";
const migration = "supabase/migrations/202610260001_samvaad.sql";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  await db.exec(await readFile(migration, "utf8"));
  await db.exec(
    await readFile(
      "supabase/migrations/202610280001_session_operations.sql",
      "utf8",
    ),
  );
  await db.query("insert into auth.users values($1),($2)", [alice, bob]);
  await db.query(
    "insert into samvaad.profiles(id,display_name) values($1,'Alice'),($2,'Bob')",
    [alice, bob],
  );
  const topic = await db.query<{ id: string }>(
    "select id from samvaad.topics order by sort_order limit 1",
  );
  topicId = topic.rows[0].id;
}, 30000);

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec(
    "reset role;truncate samvaad.sessions cascade;update samvaad.topics set is_active=true",
  );
});

async function createSession(
  owner = alice,
  key = crypto.randomUUID(),
  duration = 300,
) {
  const result = await db.query<{ id: string }>(
    "insert into samvaad.sessions(user_id,topic_id,difficulty,planned_duration_seconds,creation_key) values($1,$2,'standard',$3,$4) returning id",
    [owner, topicId, duration, key],
  );
  return result.rows[0].id;
}

async function asUser(user: string) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("set role authenticated");
}

async function resetRole() {
  await db.exec("reset role");
}

describe("Samvaad migration", () => {
  async function atomicCreate(
    key = crypto.randomUUID(),
    duration = 180,
    limit = 1,
  ) {
    return db.query<{ id: string }>(
      "select samvaad.create_session($1,$2,'standard',$3,$4,$5,300) as id",
      [alice, topicId, duration, key, limit],
    );
  }

  it("replays creation before checking quota and rejects changed input", async () => {
    const key = crypto.randomUUID();
    const first = await atomicCreate(key);
    expect((await atomicCreate(key)).rows).toEqual(first.rows);
    await expect(atomicCreate(key, 300)).rejects.toThrow(
      "IDEMPOTENCY_CONFLICT",
    );
    await expect(atomicCreate()).rejects.toThrow("RATE_LIMITED");
  });

  it("rejects inactive topics and invalid server limits", async () => {
    await expect(atomicCreate(crypto.randomUUID(), 180, 0)).rejects.toThrow(
      "VALIDATION_ERROR",
    );
    await db.query("update samvaad.topics set is_active=false where id=$1", [
      topicId,
    ]);
    await expect(atomicCreate()).rejects.toThrow("VALIDATION_ERROR");
  });

  it("denies browser access to privileged creation and aggregate functions", async () => {
    await asUser(bob);
    await expect(atomicCreate()).rejects.toThrow("permission denied");
    await expect(
      db.query("select samvaad.history_stats($1)", [alice]),
    ).rejects.toThrow("permission denied");
    await resetRole();
  });

  it("returns honest empty history statistics", async () => {
    const result = await db.query<{ stats: unknown }>(
      "select samvaad.history_stats($1) as stats",
      [alice],
    );
    expect(result.rows[0].stats).toEqual({
      completed: 0,
      averageScore: null,
      focus: null,
      trend: [],
    });
  });
  it("seeds exactly the five topics in order", async () => {
    const result = await db.query<{ title: string; sort_order: number }>(
      "select title,sort_order from samvaad.topics order by sort_order",
    );
    expect(result.rows).toHaveLength(5);
    expect(result.rows.map((row) => row.sort_order)).toEqual([1, 2, 3, 4, 5]);
    expect(result.rows[0].title).toBe(
      "Should colleges allow AI tools for assignments?",
    );
  });

  it("stores a valid session and rejects invalid durations, scores and statuses", async () => {
    await expect(createSession()).resolves.toBeTruthy();
    await expect(
      createSession(alice, crypto.randomUUID(), 240),
    ).rejects.toThrow("check");
    await expect(
      db.query(
        "insert into samvaad.sessions(user_id,topic_id,difficulty,planned_duration_seconds,creation_key,overall_score) values($1,$2,'standard',300,$3,0)",
        [alice, topicId, crypto.randomUUID()],
      ),
    ).rejects.toThrow("check");
    await expect(
      db.query(
        "insert into samvaad.sessions(user_id,topic_id,difficulty,planned_duration_seconds,creation_key,status) values($1,$2,'standard',300,$3,'done')",
        [alice, topicId, crypto.randomUUID()],
      ),
    ).rejects.toThrow();
  });

  it("returns the same session for a duplicate creation key but not across users", async () => {
    const key = crypto.randomUUID();
    const first = await createSession(alice, key);
    await expect(createSession(alice, key)).rejects.toThrow("duplicate");
    const other = await createSession(bob, key);
    expect(other).not.toBe(first);
  });

  it("keeps one feedback row per dimension and bounds the score", async () => {
    const id = await createSession();
    await db.query(
      "insert into samvaad.session_feedback(session_id,dimension,score,reason) values($1,'clarity',4,'A sufficiently detailed and grounded reason.')",
      [id],
    );
    await expect(
      db.query(
        "insert into samvaad.session_feedback(session_id,dimension,score,reason) values($1,'clarity',3,'Another sufficiently detailed reason here.')",
        [id],
      ),
    ).rejects.toThrow("duplicate");
    await expect(
      db.query(
        "insert into samvaad.session_feedback(session_id,dimension,score,reason) values($1,'structure',6,'A sufficiently detailed and grounded reason.')",
        [id],
      ),
    ).rejects.toThrow("check");
  });

  it("keeps Gnani identifiers unique while allowing nulls", async () => {
    const first = await createSession();
    await db.query(
      "update samvaad.sessions set voice_run_id='run-1',voice_execution_id='exec-1' where id=$1",
      [first],
    );
    const second = await createSession();
    await expect(
      db.query("update samvaad.sessions set voice_run_id='run-1' where id=$1", [
        second,
      ]),
    ).rejects.toThrow("duplicate");
    await expect(
      db.query(
        "update samvaad.sessions set voice_execution_id='exec-1' where id=$1",
        [second],
      ),
    ).rejects.toThrow("duplicate");
    await expect(createSession()).resolves.toBeTruthy();
  });

  it("hides other owners and blocks client mutations", async () => {
    const id = await createSession();
    await db.query(
      "insert into samvaad.session_feedback(session_id,dimension,score,reason) values($1,'clarity',4,'A sufficiently detailed and grounded reason.')",
      [id],
    );

    await asUser(alice);
    expect(
      (await db.query("select id from samvaad.sessions")).rows,
    ).toHaveLength(1);
    expect(
      (await db.query("select id from samvaad.session_feedback")).rows,
    ).toHaveLength(1);
    await expect(
      db.query("update samvaad.sessions set status='completed'"),
    ).rejects.toThrow("permission denied");
    await expect(
      db.query(
        "insert into samvaad.sessions(user_id,topic_id,difficulty,planned_duration_seconds,creation_key) values($1,$2,'standard',300,$3)",
        [alice, topicId, crypto.randomUUID()],
      ),
    ).rejects.toThrow("permission denied");

    await resetRole();
    await asUser(bob);
    expect(
      (await db.query("select id from samvaad.sessions")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select id from samvaad.session_feedback")).rows,
    ).toHaveLength(0);
    await resetRole();
  });

  it("lets anonymous readers see only active topics", async () => {
    await db.exec("set role anon");
    expect((await db.query("select id from samvaad.topics")).rows).toHaveLength(
      5,
    );
    await db.exec("reset role");
    await db.query("update samvaad.topics set is_active=false where id=$1", [
      topicId,
    ]);
    await db.exec("set role anon");
    expect((await db.query("select id from samvaad.topics")).rows).toHaveLength(
      4,
    );
    await expect(
      db.query(
        "insert into samvaad.topics(title,category,description,sort_order) values('A new topic','Policy','A long enough description for the new topic.',9)",
      ),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role");
  });

  it("restricts profile updates to the owner", async () => {
    await asUser(alice);
    await db.query("update samvaad.profiles set display_name='Alice Updated'");
    expect(
      (
        await db.query<{ display_name: string }>(
          "select display_name from samvaad.profiles",
        )
      ).rows,
    ).toEqual([{ display_name: "Alice Updated" }]);
    await resetRole();
    expect(
      (
        await db.query<{ display_name: string }>(
          "select display_name from samvaad.profiles where id=$1",
          [bob],
        )
      ).rows[0].display_name,
    ).toBe("Bob");
  });
});
