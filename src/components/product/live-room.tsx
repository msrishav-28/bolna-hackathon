"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GnaniVoice } from "@/lib/client/gnani-voice";
import { ApiError } from "@/lib/client/api";
import { productRequest } from "@/lib/client/product-api";
import {
  sessionResponseSchema,
  type ProductSession,
} from "@/lib/product-contracts";
import { productHref, setupQuery } from "./shared";
import { QuietRoomOrb } from "./quiet-room-orb";
import { modeLabels } from "@/lib/practice-contracts";
import { actorLabels, type Actor } from "@/lib/voice/protocol";

const voiceErrors: Record<string, string> = {
  microphone_denied:
    "Microphone access is blocked. Allow it in your browser’s site settings and return to the microphone check.",
  at_capacity: "All practice rooms are busy. Please try again shortly.",
  autoplay_blocked:
    "Your browser blocked the panel’s audio. Allow audio for this site and try again.",
  mint_failed: "We couldn’t open your practice room. Please try again.",
  connect_failed:
    "The voice connection was interrupted. Check your connection before trying again.",
  call_rejected: "The panel couldn’t join this round. Please try again.",
};
export default function LiveRoom({
  session,
  preview = false,
}: {
  session: ProductSession;
  preview?: boolean;
}) {
  const [state, setState] = useState<
    "idle" | "connecting" | "active" | "ending" | "error"
  >(preview ? "active" : "idle");
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(preview ? 0.35 : 0);
  const [remaining, setRemaining] = useState(
    preview ? Math.min(222, session.durationSeconds) : session.durationSeconds,
  );
  const [error, setError] = useState("");
  const [activeActor, setActiveActor] = useState<Actor>("student");
  const [voiceState, setVoiceState] = useState("listening");
  const call = useRef<GnaniVoice | null>(null);
  const mounted = useRef(false);
  const finishing = useRef(false);
  const opening = useRef(false);
  const deadline = useRef<number | null>(null);
  const hadAudio = useRef(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const generation = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const processing = `/practice/session/${session.id}/processing${preview ? `?${setupQuery(session)}` : ""}`;
  const recoverOnly =
    !preview &&
    [
      "awaiting_voice",
      "in_progress",
      "processing",
      "completed",
      "failed",
      "expired",
    ].includes(session.status);
  async function finish() {
    if (finishing.current) return;
    if (preview) {
      router.push(productHref(processing, true));
      return;
    }
    finishing.current = true;
    generation.current += 1;
    setState("ending");
    setError("");
    await call.current?.stop().catch(() => {});
    if (!mounted.current) return;
    try {
      await productRequest(
        `/api/sessions/${session.id}/complete`,
        sessionResponseSchema,
        { body: {} },
      );
      router.push(processing);
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "SESSION_NOT_READY")
        router.push(processing);
      else {
        setError(
          cause instanceof ApiError
            ? cause.message
            : "We couldn’t confirm the session ended. Check its status before starting another round.",
        );
        setState("error");
      }
    } finally {
      finishing.current = false;
    }
  }
  async function start() {
    if (opening.current || recoverOnly || preview || attempted) return;
    setAttempted(true);
    opening.current = true;
    const run = ++generation.current;
    setState("connecting");
    setError("");
    try {
      if (!mounted.current || run !== generation.current) return;
      if (call.current) await call.current.stop().catch(() => {});
      if (!mounted.current || run !== generation.current) return;
      const voice = new GnaniVoice({
        sessionUrl: `/api/sessions/${session.id}/voice-session`,
        debug: false,
      });
      call.current = voice;
      voice.on("call-start", (info) => {
        if (!mounted.current || run !== generation.current) return;
        hadAudio.current = true;
        setHasStarted(true);
        deadline.current = performance.now() + info.remainingMilliseconds;
        setState("active");
      });
      voice.on("state", (info) => {
        if (!mounted.current || run !== generation.current) return;
        if (info.actor !== "student") setActiveActor(info.actor);
        setVoiceState(info.state);
      });
      voice.on("volume-level", (level) => {
        if (mounted.current && run === generation.current)
          setVolume(Math.max(0, Math.min(1, level)));
      });
      voice.on("error", (problem) => {
        if (!mounted.current || finishing.current || run !== generation.current)
          return;
        setError(
          voiceErrors[problem.code] ??
            "The connection could not complete. Please try again.",
        );
        setState("error");
      });
      voice.on("call-end", (info) => {
        if (!mounted.current || finishing.current || run !== generation.current)
          return;
        if (info.reason === "failed") {
          setError(
            "The voice connection ended unexpectedly. Check this round’s status before starting another.",
          );
          setState("error");
        } else if (hadAudio.current) void finish();
      });
      await voice.start();
      if (!mounted.current || run !== generation.current) await voice.stop();
    } catch {
      if (mounted.current && run === generation.current) {
        setState("error");
        setError(
          (previous) =>
            previous || "We couldn’t connect the panel. Please try again.",
        );
      }
    } finally {
      opening.current = false;
    }
  }
  useEffect(() => {
    mounted.current = true;
    const offline = () => {
      if (call.current) {
        generation.current += 1;
        setError(
          "You’re offline. Your audio connection has stopped. Reconnect, then check the round’s status.",
        );
        setState("error");
        void call.current.stop().catch(() => {});
      }
    };
    const leaving = (event: BeforeUnloadEvent) => {
      if (call.current?.getState() === "active") event.preventDefault();
    };
    window.addEventListener("offline", offline);
    window.addEventListener("beforeunload", leaving);
    return () => {
      mounted.current = false;
      generation.current += 1;
      window.removeEventListener("offline", offline);
      window.removeEventListener("beforeunload", leaving);
      void call.current?.stop().catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (preview || state !== "active") return;
    const timer = setInterval(() => {
      const seconds = Math.max(
        0,
        Math.ceil(
          ((deadline.current ?? performance.now()) - performance.now()) / 1000,
        ),
      );
      setRemaining(seconds);
      if (!seconds) void finish();
    }, 1000);
    return () => clearInterval(timer);
    // The timer is scoped to this mounted call; finish reads current refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, preview]);
  const status =
    state === "active"
      ? volume > 0.04
        ? `${actorLabels[activeActor]} is speaking`
        : muted
          ? "Microphone muted"
          : voiceState === "thinking"
            ? `${actorLabels[activeActor]} is thinking`
            : "Microphone active"
      : state === "connecting"
        ? "Connecting to your panel…"
        : state === "ending"
          ? "Ending your discussion…"
          : state === "error"
            ? "Connection needs attention"
            : "Your room is ready";
  return (
    <main id="main" tabIndex={-1} className="live-main">
      <div className="live-topbar">
        <div>
          <span className="eyebrow">
            {modeLabels[session.mode ?? "group_discussion"]} ·{" "}
            {session.durationSeconds / 60} minutes
          </span>
          <h1>{session.topic.title}</h1>
        </div>
        <span
          className="live-timer"
          aria-label={`${remaining} seconds remaining`}
        >
          {Math.floor(remaining / 60)
            .toString()
            .padStart(2, "0")}
          :{(remaining % 60).toString().padStart(2, "0")}
        </span>
      </div>
      <section className="voice-stage" aria-label="Discussion room">
        <span className="tag">
          {session.mode === "group_discussion"
            ? "AI moderator + two peers"
            : "AI practice partner"}
        </span>
        <QuietRoomOrb active={state === "active"} volume={volume} />
        <p className="voice-state" role="status">
          {status}
        </p>
        <p className="voice-hint">
          {state === "active"
            ? "Listen. Find your point. Take the floor."
            : "No scores. No distractions. Just the discussion."}
        </p>
        {(state === "idle" || state === "connecting") && (
          <p className="voice-hint">
            The voice service may take about a minute to wake after inactivity.
            Your practice timer starts only when connected.
          </p>
        )}
        {error && (
          <div className="live-error" role="alert">
            {error}
          </div>
        )}
        {recoverOnly && (
          <div className="live-error">
            <p>
              This round has already started or ended. Check its latest status
              to continue safely.
            </p>
            <Link className="button" href={processing}>
              Check round status
            </Link>
          </div>
        )}
      </section>
      <div className="voice-controls">
        {(state === "idle" || state === "error") &&
          !recoverOnly &&
          !attempted && (
            <button className="button" onClick={() => void start()}>
              Start discussion <span aria-hidden="true">↗</span>
            </button>
          )}
        {state === "active" && (
          <>
            <button
              className="button secondary"
              aria-pressed={speakerMuted}
              onClick={() => {
                call.current?.setOutputMuted(!speakerMuted);
                setSpeakerMuted(!speakerMuted);
              }}
            >
              {speakerMuted ? "Unmute speaker" : "Mute speaker"}
            </button>
            <button
              className="button secondary"
              aria-pressed={muted}
              onClick={() => {
                call.current?.setMuted(!muted);
                setMuted(!muted);
              }}
            >
              {muted ? "Unmute microphone" : "Mute microphone"}
            </button>
            <button
              className="button"
              onClick={() => {
                dialog.current?.showModal();
                dialog.current
                  ?.querySelector<HTMLButtonElement>(".keep-speaking")
                  ?.focus();
              }}
            >
              End round <span aria-hidden="true">↗</span>
            </button>
          </>
        )}
        {state === "error" && (hasStarted || attempted) && (
          <button className="button" onClick={() => void finish()}>
            Check round status
          </button>
        )}
        {state === "connecting" && (
          <button className="button secondary" onClick={() => void finish()}>
            Cancel connection
          </button>
        )}
        {state === "ending" && <p role="status">Saving your place…</p>}
        {state === "idle" && (
          <Link
            className="text-link"
            href={productHref(`/practice/session/${session.id}/check`, preview)}
          >
            Back to microphone check
          </Link>
        )}
      </div>
      <dialog ref={dialog} className="end-dialog" aria-labelledby="end-title">
        <h2 id="end-title">End this round?</h2>
        <p>
          We’ll check whether there’s enough conversation for useful feedback.
          You can start a new round afterwards.
        </p>
        <form method="dialog">
          <button className="button secondary keep-speaking">
            Keep speaking
          </button>
          <button className="button" onClick={() => void finish()}>
            End round
          </button>
        </form>
      </dialog>
    </main>
  );
}
