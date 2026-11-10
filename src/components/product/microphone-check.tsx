"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ProductSession } from "@/lib/product-contracts";
import { difficultyLabels } from "@/lib/product-contracts";
import { PageHeading, productHref, setupQuery } from "./shared";
import { modeLabels } from "@/lib/practice-contracts";

export function MicrophoneCheck({
  session,
  preview = false,
}: {
  session: ProductSession;
  preview?: boolean;
}) {
  const [state, setState] = useState<
    "idle" | "testing" | "ready" | "silent" | "denied" | "unavailable"
  >("idle");
  const [level, setLevel] = useState(0);
  const stream = useRef<MediaStream | null>(null);
  const context = useRef<AudioContext | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(false);
  function stop() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (context.current) void context.current.close().catch(() => {});
    context.current = null;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop();
    };
  }, []);
  async function test() {
    if (state === "testing") return;
    stop();
    setState("testing");
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (!mounted.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const audio = new AudioContext();
      context.current = audio;
      await audio.resume();
      if (!mounted.current) return;
      const analyser = audio.createAnalyser();
      analyser.fftSize = 256;
      audio.createMediaStreamSource(media).connect(analyser);
      const values = new Uint8Array(analyser.fftSize);
      let ticks = 0;
      let heardSound = false;
      timer.current = setInterval(() => {
        analyser.getByteTimeDomainData(values);
        const rms = Math.sqrt(
          values.reduce(
            (total, value) => total + ((value - 128) / 128) ** 2,
            0,
          ) / values.length,
        );
        setLevel(Math.min(1, rms * 5));
        if (rms > 0.005) heardSound = true;
        if (++ticks >= 40) {
          stop();
          setLevel(0);
          setState(heardSound ? "ready" : "silent");
        }
      }, 100);
    } catch (error) {
      stop();
      if (mounted.current)
        setState(
          error instanceof DOMException &&
            ["NotAllowedError", "SecurityError"].includes(error.name)
            ? "denied"
            : "unavailable",
        );
    }
  }
  const ready = state === "ready";
  return (
    <main id="main" tabIndex={-1} className="product-main check-main">
      <PageHeading
        eyebrow="Before you take the floor"
        title="Check your microphone before entering the room."
      >
        {session.mode && session.mode !== "group_discussion"
          ? `${modeLabels[session.mode]} with one AI voice. ${session.mode === "presentation" ? "Your delivery comes first, followed by questions." : "Listen, respond and develop your reasoning."}`
          : "One AI panel voice plays moderator, supporter and challenger. The panel may interrupt you."}
      </PageHeading>
      <div className="check-grid">
        <section className="round-brief">
          <span className="tag">Your discussion</span>
          <h2>{session.topic.title}</h2>
          <p>{session.topic.description}</p>
          <dl className="summary-details">
            <div>
              <dt>Duration</dt>
              <dd>{session.durationSeconds / 60} minutes</dd>
            </div>
            <div>
              <dt>Pressure</dt>
              <dd>{difficultyLabels[session.difficulty]}</dd>
            </div>
            <div>
              <dt>Language</dt>
              <dd>English</dd>
            </div>
          </dl>
          <ul className="room-rules">
            <li>Make your point. You don’t need a perfect opening.</li>
            <li>Expect a question, a challenge and room to respond.</li>
            <li>Your scorecard comes after the conversation.</li>
          </ul>
        </section>
        <section className="mic-check-panel">
          <span className="mic-emblem" aria-hidden="true">
            ↟
          </span>
          <h2>Let’s hear you.</h2>
          <p>Find a quiet spot. Headphones can help reduce echo.</p>
          <div
            className="mic-level"
            role="meter"
            aria-label="Microphone level"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(level * 100)}
          >
            {Array.from({ length: 16 }, (_, index) => (
              <span key={index} className={index < level * 16 ? "lit" : ""} />
            ))}
          </div>
          <p className="mic-status" role="status">
            {state === "idle"
              ? "Microphone not checked"
              : state === "testing"
                ? "Say a sentence. The bars show your microphone level."
                : state === "ready"
                  ? "Microphone checked. You’re ready to enter."
                  : state === "silent"
                    ? "We couldn’t hear anything. Unmute your microphone, speak a sentence and test again."
                    : state === "denied"
                      ? "Microphone access is blocked. Allow microphone access in your browser’s site settings, then try again."
                      : "No microphone is available. Connect a microphone and check that another app isn’t using it."}
          </p>
          <button
            className="button secondary"
            disabled={state === "testing"}
            onClick={() => void test()}
          >
            {state === "testing"
              ? "Checking microphone…"
              : ready
                ? "Test again"
                : "Test microphone"}
          </button>
          {ready || preview ? (
            <Link
              className="button"
              href={productHref(
                `/practice/session/${session.id}${preview ? `?${setupQuery(session)}` : ""}`,
                preview,
              )}
            >
              Enter practice room <span aria-hidden="true">↗</span>
            </Link>
          ) : (
            <button className="button" disabled>
              Enter practice room ↗
            </button>
          )}
          <p className="fine-print">
            The test lasts four seconds. Audio is not saved. The discussion
            starts only when you choose “Start discussion” in the room.
          </p>
        </section>
      </div>
      <Link className="text-link" href={productHref("/practice", preview)}>
        ← Change your setup
      </Link>
    </main>
  );
}
