"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { request, errorText } from "@/lib/client/api";
import { PageHeading } from "./shared";

export function Account({
  email,
  preview = false,
  emailRecoveryEnabled = true,
}: {
  email?: string;
  preview?: boolean;
  emailRecoveryEnabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <main id="main" tabIndex={-1} className="product-main account-main">
      <PageHeading eyebrow="Your account" title="Your room. Your controls.">
        Keep your account secure and understand how your practice data is used.
      </PageHeading>
      <div className="account-grid">
        <section className="account-panel">
          <span className="tag">Account access</span>
          <h2>A fresh password?</h2>
          <p>
            {email
              ? `Signed in as ${email}`
              : "Manage access to your practice account."}
          </p>
          <p>
            {emailRecoveryEnabled
              ? "We’ll send a reset link to your email. Choose a new password from that link."
              : "Change your password while signed in. Automated email recovery is not enabled."}
          </p>
          <Link
            className="button secondary"
            href={
              emailRecoveryEnabled
                ? "/auth?flow=reset"
                : "/auth?flow=update&next=%2Faccount"
            }
          >
            {emailRecoveryEnabled ? "Reset password ↗" : "Change password ↗"}
          </Link>
        </section>
        <section className="account-panel">
          <span className="tag">Your practice data</span>
          <h2>Know what stays.</h2>
          <p>
            Your transcript and feedback help you reflect on your rounds.
            Samvaad does not store or replay raw audio.
          </p>
          <Link className="text-link" href="/privacy">
            Read about your data ↗
          </Link>
          <p className="fine-print">
            See the privacy page for data-request contact information.
          </p>
        </section>
      </div>
      <button
        className="button"
        disabled={busy || preview}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            await request("/api/auth", { action: "logout" });
            router.push("/");
            router.refresh();
          } catch (error) {
            setMessage(errorText(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {message && (
        <p className="form-message" role="alert">
          {message}
        </p>
      )}
    </main>
  );
}
