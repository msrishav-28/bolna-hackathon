import { reasoningProfile } from "@/lib/reasoning-config.mjs";

export const metadata = { title: "Data and privacy" };

export default function Privacy() {
  let provider: string | undefined;
  try {
    provider = reasoningProfile(process.env).label;
  } catch {
    /* Unconfigured disclosure below. */
  }
  const contact = process.env.PRIVACY_CONTACT_EMAIL;
  return (
    <main id="main" tabIndex={-1} className="app-shell narrow">
      <p className="eyebrow">Clear before you speak</p>
      <h1>
        Your data.
        <br />
        Explained.
      </h1>
      <p className="lead">
        Understand what your microphone sends, what your account keeps and how
        feedback uses your words.
      </p>
      <div className="outlined prose">
        <h2>What a session sends</h2>
        <p>
          During a live session, microphone audio passes through Samvaad’s
          gateway to Gnani for speech recognition. Gnani also turns the AI
          participants’ replies into audio. Samvaad controls the conversation.
          Your account name, email and account history are not included in these
          speech requests. Anything you say aloud can be processed by the
          providers.
        </p>
        <p>
          During the round, final transcript segments and the selected topic go
          to the configured reasoning provider to generate replies. After the
          round, the finalized transcript goes to that provider for scoring.
          Avoid sharing passwords, identifying documents or confidential
          information in a practice session.
        </p>

        <h2>What we keep</h2>
        <p>
          Supabase holds your account, session settings, transcript, eight
          dimension scores, strongest and weakest moment, and three practice
          actions. Samvaad buffers audio temporarily in memory while streaming;
          it does not persist or replay raw audio, and there is no recording
          library.
        </p>

        <h2>What we do not do</h2>
        <ul>
          <li>We do not claim live transcription or live captions.</li>
          <li>
            We do not infer emotion, confidence or pronunciation from text.
          </li>
          <li>
            We do not score you during the call or rank you against others.
          </li>
          <li>We do not sell practice data.</li>
        </ul>

        <h2>Provider processing</h2>
        {provider && (
          <p>
            Reasoning service: {provider}. Speech processing: Gnani. Account and
            database: Supabase.
          </p>
        )}
        {!provider && (
          <p>
            Speech processing: Gnani. Account and database: Supabase. The
            reasoning service information is currently unavailable.
          </p>
        )}
        <p>
          Provider retention and training terms depend on the configured
          accounts and plans. This is not a promise of zero retention by
          external providers.
        </p>

        <h2>Your controls</h2>
        <p>
          Session deletion and self-service account deletion are not part of
          this version. For a data request, contact the operator
          {contact ? (
            <>
              {" "}
              at <a href={"mailto:" + contact}>{contact}</a>
            </>
          ) : (
            ". Contact information is currently unavailable"
          )}
          .
        </p>

        <h2>Coaching limits</h2>
        <p>
          AI feedback can be wrong. Scores are practice guidance, not hiring,
          academic or exam assessment. Every score needs a reason. Quotes are
          included only when they can be traced to the transcript.
        </p>
      </div>
    </main>
  );
}
