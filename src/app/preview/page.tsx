import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Setup } from "@/components/product/setup";
import { History } from "@/components/product/history";
import { MicrophoneCheck } from "@/components/product/microphone-check";
import LiveRoom from "@/components/product/live-room";
import { Processing } from "@/components/product/processing";
import { Scorecard } from "@/components/product/scorecard";
import { Account } from "@/components/product/account";
import { AuthForm } from "@/components/auth-form";
import { difficultySchema } from "@/lib/domain/samvaad";
import { PageHeading } from "@/components/product/shared";
export const metadata = {
  title: "Design review",
  robots: { index: false, follow: false },
};
const screens = [
  "setup",
  "check",
  "live",
  "processing",
  "report",
  "history",
  "account",
  "auth",
];
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    screen?: string;
    state?: string;
    topic?: string;
    difficulty?: string;
    duration?: string;
  }>;
}) {
  await connection();
  if (process.env.UI_PREVIEW_ENABLED !== "true") notFound();
  const { previewSession, previewHistory, previewTopics } =
    await import("@/lib/server/preview-data");
  const query = await searchParams;
  const selectedTopic =
    previewTopics.find((topic) => topic.id === query.topic) ?? previewTopics[0];
  const difficulty = difficultySchema.catch("standard").parse(query.difficulty);
  const duration = query.duration === "300" ? 300 : 180;
  const screen = screens.includes(query.screen ?? "") ? query.screen! : "setup";
  const history =
    query.state === "empty"
      ? {
          sessions: [],
          nextCursor: null,
          stats: { completed: 0, averageScore: null, focus: null, trend: [] },
        }
      : previewHistory;
  const session: typeof previewSession = {
    ...previewSession,
    topic: selectedTopic,
    difficulty,
    durationSeconds: duration,
    status: (screen === "check"
      ? "created"
      : screen === "processing"
        ? query.state === "failed"
          ? "failed"
          : query.state === "expired"
            ? "expired"
            : "processing"
        : "completed") as typeof previewSession.status,
    ...(screen === "processing"
      ? {
          scorecard: null,
          overallScore: null,
          error:
            query.state === "failed"
              ? {
                  code: "SCORING_FAILED",
                  message:
                    "We couldn’t prepare feedback for this round. Your transcript is preserved.",
                  retryable: false,
                }
              : null,
        }
      : {}),
  };
  return (
    <>
      <aside className="preview-banner" aria-label="Design review controls">
        <div>
          <strong>Design preview · Synthetic examples</strong>
          <span>
            No real sessions, scores or provider calls. Disabled by default for
            release.
          </span>
        </div>
        <nav aria-label="Preview screens">
          {screens.map((name) => (
            <Link
              key={name}
              href={`/preview?screen=${name}`}
              aria-current={screen === name ? "page" : undefined}
            >
              {name}
            </Link>
          ))}
        </nav>
        <div className="preview-states">
          {["dashboard", "history"].includes(screen) && (
            <Link href={`/preview?screen=${screen}&state=empty`}>
              Empty state
            </Link>
          )}
          {screen === "processing" && (
            <>
              <Link href="/preview?screen=processing&state=failed">
                Scoring failure
              </Link>
              <Link href="/preview?screen=processing&state=expired">
                Expired
              </Link>
            </>
          )}
        </div>
      </aside>
      {screen === "setup" ? (
        <Setup
          sample={previewTopics}
          initial={{ topic: query.topic, difficulty, duration }}
        />
      ) : screen === "check" ? (
        <MicrophoneCheck session={session} preview />
      ) : screen === "live" ? (
        <LiveRoom session={session} preview />
      ) : screen === "processing" ? (
        <Processing session={session} preview />
      ) : screen === "report" ? (
        <Scorecard session={previewSession} preview />
      ) : screen === "history" ? (
        <History sample={history} />
      ) : screen === "account" ? (
        <Account preview />
      ) : (
        <main id="main" tabIndex={-1} className="product-main">
          <PageHeading
            eyebrow="Your account"
            title="A place to find your voice."
          />
          <div className="auth-panel preview-auth">
            <AuthForm
              next="/dashboard"
              flow="signup"
              linkError={false}
              preview
            />
          </div>
        </main>
      )}
    </>
  );
}
