import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/domain/safe-next";
import { emailVerificationRequired } from "@/lib/server/config";
export const metadata = { title: "Your account" };
export default async function Auth({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; flow?: string; error?: string }>;
}) {
  const p = await searchParams;
  return (
    <main
      id="main"
      tabIndex={-1}
      className="max-w-lg mx-auto px-4 py-10 sm:py-16"
    >
      <section className="rounded-3xl bg-paper border border-stone p-6 sm:p-8 shadow-xs">
        <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-manilla border border-stone text-[11px] font-mono uppercase tracking-wider text-ink font-semibold">
          Student account
        </span>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight mt-5 mb-3">
          Your practice. Your progress.
        </h1>
        <p className="text-sm text-graphite leading-relaxed mb-6">
          Keep your transcripts, scorecards, and next practice actions together.
          Sign in before entering the room.
        </p>
        <AuthForm
          next={safeNext(p.next ?? "/practice")}
          flow={p.flow ?? "login"}
          linkError={!!p.error}
          emailRecoveryEnabled={emailVerificationRequired()}
        />
      </section>
      <p className="text-xs text-graphite mt-5 leading-relaxed">
        Samvaad stores transcripts and feedback, not raw audio.{" "}
        <Link href="/privacy" className="editorial-link">
          Read about your data.
        </Link>
      </p>
    </main>
  );
}
