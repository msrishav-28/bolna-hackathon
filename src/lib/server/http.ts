import "server-only";
import { ZodError } from "zod";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { authClient } from "./supabase";
import { emailVerificationRequired } from "./config";

export class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
    public retryable = false,
  ) {
    super(code);
  }
}

const messages: Record<string, string> = {
  VOICE_WARMING:
    "The voice service is waking up. The first connection can take about a minute. Your practice timer has not started.",
  SESSION_EXPIRED: "This round has expired. Please start a new round.",
  SESSION_ALREADY_ACTIVE:
    "Another round is already open. Check it in your history first.",
  CAPACITY_LIMIT:
    "Practice is at its current allowance. Your history is still available.",
  SCORING_FAILED:
    "We could not generate feedback for this round. Please try a new round.",
  IDEMPOTENCY_CONFLICT:
    "This request was already used for a different setup. Start a new round.",
  CONFIGURATION:
    "This service is temporarily unavailable. Please try again shortly.",
  SERVICE_UNAVAILABLE:
    "We couldn’t connect to the practice service. Please try again shortly.",
  VERIFY_EMAIL: "Verify your email before continuing.",
  EMAIL_RECOVERY_UNAVAILABLE:
    "Email password recovery is not enabled. If you are signed in, change your password from Account.",
  UNAUTHENTICATED: "Sign in to continue.",
  FORBIDDEN: "This action is not allowed.",
  VALIDATION_ERROR: "Check the supplied fields.",
  SESSION_NOT_FOUND:
    "This practice session does not exist or you do not have access to it.",
  SESSION_NOT_ACTIVE:
    "This practice session is not in a state that allows this action.",
  SESSION_NOT_READY: "The call is not ready yet. Try again in a moment.",
  MICROPHONE_DENIED:
    "Microphone access was denied. Allow it in your browser and retry.",
  GNANI_ERROR: "The voice service could not complete this request. Try again.",
  RATE_LIMITED:
    "Your daily practice allowance is used. It resets at midnight UTC.",
  INTERNAL_ERROR: "The operation could not complete. Try again.",
};

export function fail(code: string, status = 400): never {
  throw new AppError(
    code,
    status,
    ["SESSION_NOT_READY", "SERVICE_UNAVAILABLE", "GNANI_ERROR"].includes(code),
  );
}

export async function user() {
  const client = await authClient();
  const { data, error } = await client.auth.getUser();
  // An unavailable identity service is not evidence that a session is invalid.
  // Deny access for this request while allowing bounded read-only polling retry.
  if (isAuthRetryableFetchError(error)) fail("SERVICE_UNAVAILABLE", 503);
  if (error || !data.user) fail("UNAUTHENTICATED", 401);
  if (emailVerificationRequired() && !data.user.email_confirmed_at)
    fail("VERIFY_EMAIL", 403);
  return data.user;
}

export function origin(request: Request) {
  const actual = request.headers.get("origin");
  const expected = process.env.APP_ORIGIN;
  if (!expected) throw new Error("CONFIGURATION");
  if (!actual || actual !== expected) fail("FORBIDDEN", 403);
}

export async function json(request: Request, max = 32000) {
  const reader = request.body?.getReader();
  if (!reader) fail("VALIDATION_ERROR");
  let n = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const r = await reader.read();
    if (r.done) break;
    n += r.value.length;
    if (n > max) {
      await reader.cancel();
      fail("VALIDATION_ERROR", 413);
    }
    chunks.push(r.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    fail("VALIDATION_ERROR");
  }
}

export function response(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export function endpoint(fn: () => Promise<Response>) {
  return fn().catch((error: unknown) => {
    const e =
      error instanceof AppError
        ? error
        : error instanceof ZodError
          ? new AppError("VALIDATION_ERROR")
          : error instanceof Error && error.message === "CONFIGURATION"
            ? new AppError("CONFIGURATION", 503)
            : new AppError("INTERNAL_ERROR", 500);
    if (e.status >= 500)
      console.warn(
        JSON.stringify({
          event: "request_failed",
          code: e.code,
          status: e.status,
        }),
      );
    return response(
      {
        error: {
          code: e.code,
          message: messages[e.code] ?? messages.INTERNAL_ERROR,
          retryable: e.retryable,
        },
      },
      e.status,
    );
  });
}
