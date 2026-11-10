import { z } from "zod";
import { endpoint, origin, json, response, fail } from "@/lib/server/http";
import { authClient } from "@/lib/server/supabase";
import { safeNext } from "@/lib/domain/safe-next";
import { emailVerificationRequired } from "@/lib/server/config";
const schema = z
  .object({
    action: z.enum(["login", "signup", "reset", "update", "logout"]),
    email: z.email().optional(),
    password: z.string().min(10).max(128).optional(),
    next: z.string().optional(),
  })
  .strict();
export const POST = (r: Request) =>
  endpoint(async () => {
    origin(r);
    const b = schema.parse(await json(r));
    const client = await authClient();
    const next = safeNext(b.next ?? null);
    const base = process.env.APP_ORIGIN || new URL(r.url).origin;
    let error: unknown = null;
    let message = "";
    if (b.action === "login") {
      if (!b.email || !b.password) fail("VALIDATION_ERROR");
      ({ error } = await client.auth.signInWithPassword({
        email: b.email,
        password: b.password,
      }));
    }
    if (b.action === "signup") {
      if (!b.email || !b.password) fail("VALIDATION_ERROR");
      const signup = await client.auth.signUp({
        email: b.email,
        password: b.password,
        options: {
          emailRedirectTo:
            base + "/auth/callback?next=" + encodeURIComponent(next),
        },
      });
      error = signup.error;
      if (emailVerificationRequired())
        message =
          "Check your email to verify your account. If it already exists, sign in or reset your password.";
      else if (!error && !signup.data?.session)
        error = new Error("AUTH_SESSION_UNAVAILABLE");
    }
    if (b.action === "reset") {
      if (!emailVerificationRequired()) fail("EMAIL_RECOVERY_UNAVAILABLE", 409);
      if (!b.email) fail("VALIDATION_ERROR");
      ({ error } = await client.auth.resetPasswordForEmail(b.email, {
        redirectTo:
          base +
          "/auth/callback?next=" +
          encodeURIComponent("/auth?flow=update"),
      }));
      message =
        "If the account can receive email, a reset link will arrive shortly.";
    }
    if (b.action === "update") {
      const { data } = await client.auth.getUser();
      if (!data.user) fail("UNAUTHENTICATED", 401);
      if (!b.password) fail("VALIDATION_ERROR");
      ({ error } = await client.auth.updateUser({ password: b.password }));
    }
    if (b.action === "logout") ({ error } = await client.auth.signOut());
    if (error)
      return response(
        {
          error: {
            code: "AUTH",
            message:
              "Authentication could not complete. Check your details, email verification and try again.",
          },
        },
        400,
      );
    return response({ message, next: b.action === "logout" ? "/" : next });
  });
