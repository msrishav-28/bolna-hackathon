import { z } from "zod";
import { after } from "next/server";
import {
  openVoice,
  requestCompletion,
  processSession,
} from "@/lib/server/workflow";
import {
  endpoint,
  fail,
  json,
  origin,
  user,
  response,
} from "@/lib/server/http";
import {
  topics,
  history,
  ownedSession,
  createSession,
} from "@/lib/server/sessions";
import { authConfigured } from "@/lib/server/config";
import { samvaadSetupSchema } from "@/lib/domain/samvaad";

export const runtime = "nodejs";
export const maxDuration = 120;
const id = z.uuid();
export const GET = (
  request: Request,
  context: { params: Promise<{ product: string[] }> },
) =>
  endpoint(async () => {
    const { product: parts } = await context.params;
    const valid =
      (parts.length === 1 && ["topics", "sessions"].includes(parts[0])) ||
      (parts.length === 2 &&
        parts[0] === "sessions" &&
        id.safeParse(parts[1]).success);
    if (!valid) fail("SESSION_NOT_FOUND", 404);
    if (!authConfigured()) fail("SERVICE_UNAVAILABLE", 503);
    if (parts[0] === "topics") return response(await topics());
    const owner = await user();
    const query = new URL(request.url).searchParams;
    if (parts[0] === "sessions" && parts.length === 1) {
      z.coerce
        .number()
        .int()
        .min(1)
        .max(50)
        .parse(query.get("limit") ?? 20);
    }
    if (parts.length === 1) return response(await history(owner.id, query));
    const session = await ownedSession(owner.id, parts[1]);
    if (
      ["awaiting_voice", "in_progress", "processing"].includes(session.status)
    )
      after(() => processSession(parts[1]));
    return response({ session });
  });
export const POST = (
  request: Request,
  context: { params: Promise<{ product: string[] }> },
) =>
  endpoint(async () => {
    origin(request);
    const { product: parts } = await context.params;
    const create = parts.length === 1 && parts[0] === "sessions";
    const action =
      parts.length === 3 &&
      parts[0] === "sessions" &&
      id.safeParse(parts[1]).success &&
      ["voice-session", "complete"].includes(parts[2]);
    if (!create && !action) fail("SESSION_NOT_FOUND", 404);
    if (!authConfigured()) fail("SERVICE_UNAVAILABLE", 503);
    const owner = await user();
    if (create) {
      const setup = samvaadSetupSchema.parse(await json(request));
      const key = id.parse(request.headers.get("Idempotency-Key"));
      return response({ session: await createSession(owner.id, setup, key) });
    } else if (parts[2] === "complete") {
      z.object({})
        .strict()
        .parse(await json(request));
      const session = await requestCompletion(owner.id, parts[1]);
      after(() => processSession(parts[1]));
      return response({ session });
    }
    z.object({})
      .strict()
      .parse(await json(request));
    return response(await openVoice(owner.id, parts[1]));
  });
