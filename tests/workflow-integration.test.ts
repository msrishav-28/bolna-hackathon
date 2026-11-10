import {
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  expect,
  it,
  vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";

const mock = vi.hoisted(() => ({ rpc: vi.fn(), read: vi.fn() }));
vi.mock("../src/lib/server/supabase", () => ({
  admin: () => ({
    schema: () => ({
      rpc: mock.rpc,
      from: () => {
        const filters: Record<string, string> = {};
        const builder = {
          select: () => builder,
          eq: (k: string, v: string) => {
            filters[k] = v;
            return builder;
          },
          maybeSingle: () => mock.read(filters),
        };
        return builder;
      },
    }),
  }),
}));
import {
  openVoice,
  processSession,
  requestCompletion,
} from "../src/lib/server/workflow";
import { createSession } from "../src/lib/server/sessions";
import { previewSession } from "../src/lib/server/preview-data";

let db: PGlite, topic: string, id: string, run: string;
const alice = "30000000-0000-4000-8000-000000000001",
  bob = "30000000-0000-4000-8000-000000000002";
const fetchMock = vi.fn();
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;",
  );
  for (const file of [
    "202610260001_samvaad.sql",
    "202610280001_session_operations.sql",
    "202610280002_voice_processing.sql",
    "202611080001_practice_modes.sql",
    "202611090001_direct_speech.sql",
    "202611090002_speech_start_clock.sql",
    "202611100001_speech_empty_finals.sql",
  ])
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await db.query("insert into auth.users values($1),($2)", [alice, bob]);
  topic = (
    await db.query<{ id: string }>(
      "select id from samvaad.topics order by sort_order limit 1",
    )
  ).rows[0].id;
  mock.rpc.mockImplementation(
    async (name: string, args: Record<string, unknown>) => {
      try {
        const entries = Object.entries(args);
        const result = await db.query<{ data: unknown }>(
          `select samvaad.${name}(${entries.map(([k], i) => `${k}=>$${i + 1}`).join(",")}) as data`,
          entries.map(([, v]) => v),
        );
        return { data: result.rows[0].data, error: null };
      } catch (error) {
        return { data: null, error: { message: (error as Error).message } };
      }
    },
  );
  mock.read.mockImplementation(async (filters: Record<string, string>) => {
    const result = await db.query(
      "select s.*,jsonb_build_object('id',t.id,'title',t.title,'category',t.category,'description',t.description) as topic from samvaad.sessions s join samvaad.topics t on t.id=s.topic_id where s.id=$1 and s.user_id=$2",
      [filters.id, filters.user_id],
    );
    return {
      data: result.rows[0] ? JSON.parse(JSON.stringify(result.rows[0])) : null,
      error: null,
    };
  });
}, 30000);
afterAll(async () => db.close());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
beforeEach(async () => {
  await db.exec("reset role;truncate samvaad.sessions cascade");
  for (const [name, value] of Object.entries({
    VOICE_RUNTIME_ENABLED: "true",
    APP_ORIGIN: "http://127.0.0.1:3013",
    SAMVAAD_VOICE_WS_URL: "wss://voice.example.test/speech",
    GNANI_SPEECH_API_KEY: "synthetic",
    REASONING_PROVIDER: "custom",
    REASONING_BASE_URL: "https://score.example.test/v1",
    REASONING_API_KEY: "synthetic",
    REASONING_MODEL: "synthetic",
    MAX_MONTHLY_VOICE_MINUTES: "30",
  }))
    vi.stubEnv(name, value);
  fetchMock.mockReset().mockImplementation(async () =>
    Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify(previewSession.scorecard) },
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const session = await createSession(
    alice,
    {
      topicId: topic,
      durationSeconds: 180,
      difficulty: "standard",
      mode: "group_discussion",
    },
    randomUUID(),
  );
  id = session.id;
});
async function rpc(name: string, args: Record<string, unknown>) {
  const result = await mock.rpc(name, args);
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
async function connect() {
  const grant = await openVoice(alice, id);
  run = grant.runId;
  return {
    grant,
    context: await rpc("consume_speech_grant", {
      p_hash: createHash("sha256").update(grant.grant).digest("hex"),
    }),
  };
}
async function event(action: string, data: unknown = {}) {
  return rpc("speech_event", { p_run: run, p_action: action, p_data: data });
}
async function finalize() {
  await connect();
  await rpc("start_speech", { p_run: run, p_request: "synthetic-request" });
  for (const turn of previewSession.transcript!.turns) {
    if (turn.speaker === "assistant") {
      const a = await event("assistant", {
        actor: "moderator",
        text: turn.text,
      });
      await event("delivery", { id: a.id, state: "sent" });
    } else {
      const index = (
        await db.query<{ n: number }>(
          "select last_segment+1 as n from samvaad.speech_runs where id=$1",
          [run],
        )
      ).rows[0].n;
      await event("student", {
        index,
        segmentId: `synthetic-request-seg-${index}`,
        utteranceId: `utterance-${index}`,
        text: turn.text,
      });
    }
  }
  await event("drain");
  const count = (
    await db.query<{ n: number }>(
      "select last_segment as n from samvaad.speech_runs where id=$1",
      [run],
    )
  ).rows[0].n;
  await event("complete", { segments: count, reason: "manual" });
}
it("binds single-use grants to an owned run without Platform IDs", async () => {
  await expect(openVoice(bob, id)).rejects.toMatchObject({
    code: "SESSION_NOT_FOUND",
  });
  const { grant, context } = await connect();
  expect(context.sessionId).toBe(id);
  expect(grant.protocol).toBe("samvaad-speech-v1");
  await expect(
    rpc("consume_speech_grant", {
      p_hash: createHash("sha256").update(grant.grant).digest("hex"),
    }),
  ).rejects.toThrow("SESSION_NOT_ACTIVE");
  expect(
    (
      await db.query(
        "select voice_agent_id,voice_run_id,voice_execution_id from samvaad.sessions where id=$1",
        [id],
      )
    ).rows[0],
  ).toEqual({
    voice_agent_id: null,
    voice_run_id: null,
    voice_execution_id: null,
  });
  await expect(openVoice(alice, id)).rejects.toMatchObject({
    code: "SESSION_NOT_ACTIVE",
  });
});
it("expires an unconsumed grant and cannot consume it later", async () => {
  const grant = await openVoice(alice, id);
  await db.query(
    "update samvaad.speech_runs set grant_expires_at=now()-interval '1 second' where id=$1",
    [grant.runId],
  );
  await expect(
    rpc("consume_speech_grant", {
      p_hash: createHash("sha256").update(grant.grant).digest("hex"),
    }),
  ).rejects.toThrow();
  await db.query(
    "update samvaad.sessions set next_poll_at=now()-interval '1 second' where id=$1",
    [id],
  );
  await processSession(id);
  expect(
    (
      await db.query<{ status: string }>(
        "select status from samvaad.sessions where id=$1",
        [id],
      )
    ).rows[0].status,
  ).toBe("failed");
});
it("preserves finals, rejects conflicts/gaps and prevents updates", async () => {
  await connect();
  await rpc("start_speech", { p_run: run, p_request: "request" });
  const data = {
    index: 1,
    segmentId: "request-seg-1",
    utteranceId: "utterance",
    text: "Synthetic student evidence.",
  };
  await event("student", data);
  await expect(event("student", data)).resolves.toHaveProperty("id");
  await expect(
    event("student", { ...data, text: "Changed evidence." }),
  ).rejects.toThrow("EVIDENCE_CONFLICT");
  await expect(
    event("student", { ...data, index: 3, segmentId: "request-seg-3" }),
  ).rejects.toThrow("VALIDATION_ERROR");
  await expect(
    db.query("update samvaad.speech_turns set text='changed' where run_id=$1", [
      run,
    ]),
  ).rejects.toThrow("EVIDENCE_IMMUTABLE");
  await event("drain");
  await expect(
    event("complete", { segments: 2, reason: "manual" }),
  ).rejects.toThrow("VALIDATION_ERROR");
  expect(fetchMock).not.toHaveBeenCalled();
});
it("browser completion cannot finalize or score an active partial stream", async () => {
  await connect();
  await requestCompletion(alice, id);
  await processSession(id);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(
    (
      await db.query<{ status: string }>(
        "select status from samvaad.sessions where id=$1",
        [id],
      )
    ).rows[0].status,
  ).toBe("in_progress");
});
it("scores only the immutable completed snapshot and fences repeated workers", async () => {
  await finalize();
  await processSession(id);
  await processSession(id);
  const row = (
    await db.query<{
      status: string;
      score_attempts: number;
      rubric_version: string;
    }>(
      "select status,score_attempts,rubric_version from samvaad.sessions where id=$1",
      [id],
    )
  ).rows[0];
  expect(row).toEqual({
    status: "completed",
    score_attempts: 1,
    rubric_version: "gd-ensemble-v1",
  });
  expect(fetchMock).toHaveBeenCalledOnce();
  await expect(event("student", { index: 99 })).rejects.toThrow(
    "SESSION_NOT_ACTIVE",
  );
});
it("limits scoring to two persisted attempts and preserves evidence on exhaustion", async () => {
  await finalize();
  fetchMock.mockImplementation(async () => Response.json({}, { status: 503 }));
  await processSession(id);
  const row = (
    await db.query<{
      status: string;
      score_attempts: number;
      transcript: unknown;
    }>(
      "select status,score_attempts,transcript from samvaad.sessions where id=$1",
      [id],
    )
  ).rows[0];
  expect(row.status).toBe("failed");
  expect(row.score_attempts).toBe(2);
  expect(row.transcript).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("denies browser writes and grant consumption through SQL roles", async () => {
  await connect();
  await db.exec("set role authenticated");
  await expect(db.query("select * from samvaad.speech_turns")).rejects.toThrow(
    "permission denied",
  );
  await expect(
    db.query("select samvaad.consume_speech_grant($1)", ["a".repeat(64)]),
  ).rejects.toThrow("permission denied");
  await db.exec("reset role");
});
it("never resurrects a run after durable orphan recovery fails it", async () => {
  await connect();
  await db.query(
    "update samvaad.speech_runs set heartbeat_at=now()-interval '60 seconds' where id=$1",
    [run],
  );
  await db.query(
    "update samvaad.sessions set next_poll_at=now()-interval '1 second' where id=$1",
    [id],
  );
  await processSession(id);
  await expect(
    rpc("start_speech", { p_run: run, p_request: "late" }),
  ).rejects.toThrow("SESSION_NOT_ACTIVE");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("starts the full practice clock only after provider readiness and never restarts it", async () => {
  await connect();
  await db.query(
    "update samvaad.speech_runs set consumed_at=now()-interval '15 seconds',started_at=now()-interval '15 seconds',deadline=now()+interval '165 seconds' where id=$1",
    [run],
  );
  const before = (
    await db.query<{ started_at: Date }>(
      "select started_at from samvaad.speech_runs where id=$1",
      [run],
    )
  ).rows[0].started_at;
  const ready = await rpc("start_speech", { p_run: run, p_request: "request" });
  expect(Date.parse(ready.startedAt) - before.getTime()).toBeGreaterThanOrEqual(
    14000,
  );
  expect(Date.parse(ready.deadline) - Date.parse(ready.startedAt)).toBe(180000);
  await expect(
    rpc("start_speech", { p_run: run, p_request: "another" }),
  ).rejects.toThrow("SESSION_NOT_ACTIVE");
});

it("keeps quota and admission atomic across owners and repeated starts", async () => {
  vi.stubEnv("MAX_MONTHLY_VOICE_MINUTES", "3");
  await openVoice(alice, id);
  const second = await createSession(
    bob,
    {
      topicId: topic,
      durationSeconds: 180,
      difficulty: "standard",
      mode: "interview",
    },
    randomUUID(),
  );
  await expect(openVoice(bob, second.id)).rejects.toMatchObject({
    code: "CAPACITY_LIMIT",
  });
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from samvaad.speech_runs",
      )
    ).rows[0].count,
  ).toBe(1);
});

it("fences concurrent scoring claims and expired worker updates", async () => {
  await finalize();
  const first = randomUUID(),
    second = randomUUID();
  expect(
    await rpc("claim_speech_work", { p_session: id, p_token: first }),
  ).toHaveProperty("transcript");
  expect(
    await rpc("claim_speech_work", { p_session: id, p_token: second }),
  ).toBeNull();
  expect(
    await rpc("advance_work", {
      p_session: id,
      p_token: second,
      p_action: "score_attempt",
      p_data: {},
    }),
  ).toBe(false);
  await db.query(
    "update samvaad.sessions set work_until=now()-interval '1 second' where id=$1",
    [id],
  );
  expect(
    await rpc("advance_work", {
      p_session: id,
      p_token: first,
      p_action: "score_attempt",
      p_data: {},
    }),
  ).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("preserves all five mode contracts and creation replay separation", async () => {
  for (const mode of [
    "interview",
    "viva",
    "debate",
    "presentation",
    "group_discussion",
  ] as const) {
    const key = randomUUID(),
      setup = {
        topicId: topic,
        durationSeconds: 180 as const,
        difficulty: "gentle" as const,
        mode,
      };
    const first = await createSession(bob, setup, key),
      second = await createSession(bob, setup, key);
    expect(second.id).toBe(first.id);
    expect(first.rubricVersion).toBe(
      mode === "group_discussion" ? "gd-ensemble-v1" : `${mode}-v1`,
    );
    await expect(
      createSession(
        bob,
        { ...setup, mode: mode === "interview" ? "viva" : "interview" },
        key,
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  }
});

it("retains immutable empty finals but excludes them from dialogue evidence snapshots", async () => {
  await connect();
  await rpc("start_speech", { p_run: run, p_request: "synthetic-request" });
  const empty = {
    index: 1,
    segmentId: "synthetic-request-seg-1",
    utteranceId: "silence",
    text: "",
  };
  const original = await event("student", empty);
  expect(await event("student", empty)).toEqual(original);
  await expect(
    event("student", { ...empty, text: "Invented words" }),
  ).rejects.toThrow("EVIDENCE_CONFLICT");
  await expect(
    db.query("update samvaad.speech_turns set text='changed' where run_id=$1", [
      run,
    ]),
  ).rejects.toThrow("EVIDENCE_IMMUTABLE");
  await event("student", {
    index: 2,
    segmentId: "synthetic-request-seg-2",
    utteranceId: "spoken",
    text: "Synthetic genuine contribution.",
  });
  await event("student", {
    index: 3,
    segmentId: "synthetic-request-seg-3",
    utteranceId: "whitespace",
    text: " \t\n",
  });
  await event("drain");
  await event("complete", { segments: 3, reason: "manual" });
  const row = (
    await db.query<{ transcript: { turns: { text: string }[] } }>(
      "select transcript from samvaad.sessions where id=$1",
      [id],
    )
  ).rows[0];
  expect(row.transcript.turns.map((t) => t.text)).toEqual([
    "Synthetic genuine contribution.",
  ]);
  expect(
    (
      await db.query(
        "select last_segment from samvaad.speech_runs where id=$1",
        [run],
      )
    ).rows[0],
  ).toEqual({ last_segment: 3 });
});
it("refuses to finalize an all-silence conversation", async () => {
  await connect();
  await rpc("start_speech", { p_run: run, p_request: "synthetic-request" });
  await event("student", {
    index: 1,
    segmentId: "synthetic-request-seg-1",
    utteranceId: "empty",
    text: "",
  });
  await event("drain");
  await expect(
    event("complete", { segments: 1, reason: "manual" }),
  ).rejects.toThrow("EVIDENCE_EMPTY");
});
it("replays delivery acknowledgements safely but rejects conflicting outcomes", async () => {
  await connect();
  await rpc("start_speech", { p_run: run, p_request: "synthetic-request" });
  const turn = await event("assistant", {
    actor: "coach",
    text: "Synthetic response.",
  });
  await event("delivery", { id: turn.id, state: "sent" });
  await expect(
    event("delivery", { id: turn.id, state: "sent" }),
  ).resolves.toEqual({});
  await expect(
    event("delivery", { id: turn.id, state: "interrupted" }),
  ).rejects.toThrow("EVIDENCE_CONFLICT");
});

it("wakes a cold gateway before reserving any quota or grant", async () => {
  vi.stubEnv("VOICE_GATEWAY_WARMUP_ENABLED", "true");
  mock.rpc.mockClear();
  fetchMock.mockResolvedValueOnce(
    new Response("Starting service", { status: 503 }),
  );
  await expect(openVoice(alice, id)).rejects.toMatchObject({
    code: "VOICE_WARMING",
  });
  expect(mock.rpc.mock.calls.some(([name]) => name === "reserve_speech")).toBe(
    false,
  );
  fetchMock.mockResolvedValueOnce(Response.json({ status: "ok" }));
  await expect(openVoice(alice, id)).resolves.toHaveProperty("grant");
  expect(
    mock.rpc.mock.calls.filter(([name]) => name === "reserve_speech"),
  ).toHaveLength(1);
});
