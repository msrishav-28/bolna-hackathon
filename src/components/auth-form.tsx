"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { request, errorText } from "@/lib/client/api";
import { content } from "@/lib/content";

type Action = "login" | "signup" | "reset" | "update";
const labels: Record<
  Action,
  { title: string; submit: string; pending: string }
> = {
  login: { title: "Welcome back.", submit: "Sign in", pending: "Signing in…" },
  signup: {
    title: "Make room for practice.",
    submit: "Create account",
    pending: "Creating account…",
  },
  reset: {
    title: "Reset your password.",
    submit: "Send reset link",
    pending: "Sending reset link…",
  },
  update: {
    title: "A fresh start.",
    submit: "Save password",
    pending: "Saving password…",
  },
};
export function AuthForm({
  next,
  flow,
  linkError,
  preview = false,
  emailRecoveryEnabled = true,
}: {
  next: string;
  flow: string;
  linkError: boolean;
  preview?: boolean;
  emailRecoveryEnabled?: boolean;
}) {
  const [action, setAction] = useState<Action>(
    flow === "update" ||
      flow === "signup" ||
      (flow === "reset" && emailRecoveryEnabled)
      ? flow
      : "login",
  );
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<string>(
    flow === "reset" && !emailRecoveryEnabled
      ? "Email recovery is not enabled. Sign in to change your password from Account."
      : linkError
        ? content.auth.linkError
        : "",
  );
  const [failed, setFailed] = useState(linkError);
  const feedback = useRef<HTMLParagraphElement>(null);
  const pending = useRef(false);
  const router = useRouter();
  useEffect(() => {
    if (message) feedback.current?.focus();
  }, [message]);

  return (
    <form
      className="app-form"
      aria-label={labels[action].title}
      aria-busy={busy}
      onSubmit={async (event) => {
        event.preventDefault();
        if (preview) {
          setFailed(false);
          setMessage("Preview only. No account request was sent.");
          return;
        }
        if (pending.current) return;
        pending.current = true;
        const data = new FormData(event.currentTarget);
        setBusy(true);
        setMessage("");
        setFailed(false);
        try {
          const result = await request<{ message: string; next: string }>(
            "/api/auth",
            {
              action,
              email: action === "update" ? undefined : data.get("email"),
              password: action === "reset" ? undefined : data.get("password"),
              next,
            },
          );
          if (result.message) setMessage(result.message);
          else {
            router.push(result.next);
            router.refresh();
          }
        } catch (error) {
          setFailed(true);
          setMessage(errorText(error));
        } finally {
          pending.current = false;
          setBusy(false);
        }
      }}
    >
      <h2>{labels[action].title}</h2>
      {!emailRecoveryEnabled && action === "signup" && (
        <p className="fine-print">
          Use any valid email address and a password. Email ownership is not
          verified. Automated password recovery is not enabled, so keep your
          password safe.
        </p>
      )}
      {action !== "update" && (
        <label htmlFor="email">
          Email
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            disabled={busy}
          />
        </label>
      )}
      {action !== "reset" && (
        <div className="password-control">
          <label htmlFor="password">
            {action === "update" ? "New password" : "Password"}
          </label>
          <div className="password-field">
            <input
              id="password"
              name="password"
              type={visible ? "text" : "password"}
              minLength={10}
              maxLength={128}
              autoComplete={
                action === "login" ? "current-password" : "new-password"
              }
              aria-describedby="password-hint"
              required
              disabled={busy}
            />
            <button
              className="password-toggle"
              type="button"
              aria-controls="password"
              aria-label={visible ? "Hide password" : "Show password"}
              disabled={busy}
              onClick={() => setVisible(!visible)}
            >
              {visible ? "Hide" : "Show"}
            </button>
          </div>
          <small id="password-hint">At least 10 characters.</small>
        </div>
      )}
      <button className="button" disabled={busy}>
        {busy ? labels[action].pending : labels[action].submit}
        <span aria-hidden="true">↗</span>
      </button>
      {message && (
        <p
          className="form-message"
          role={failed ? "alert" : "status"}
          tabIndex={-1}
          ref={feedback}
        >
          {message}
        </p>
      )}
      {action !== "update" && (
        <div className="form-links">
          {(["login", "signup", "reset"] as const)
            .filter(
              (item) =>
                item !== action && (item !== "reset" || emailRecoveryEnabled),
            )
            .map((item) => (
              <button
                type="button"
                className="text-button"
                disabled={busy}
                key={item}
                onClick={() => {
                  setAction(item);
                  setMessage("");
                  setFailed(false);
                  setVisible(false);
                }}
              >
                {item === "login"
                  ? "Sign in"
                  : item === "signup"
                    ? "Create account"
                    : "Forgot password?"}
              </button>
            ))}
        </div>
      )}
      <small>Your account keeps your rounds and feedback in one place.</small>
    </form>
  );
}
