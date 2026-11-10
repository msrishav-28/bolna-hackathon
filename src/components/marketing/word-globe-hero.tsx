"use client";

import { useState } from "react";
import WordGlobe from "@/components/ui/word-globe";

const globeFont = { fontFamily: "inherit", fontWeight: 500, fontSize: 15 };

export function WordGlobeHero() {
  const [paused, setPaused] = useState(false);
  return (
    <div className="word-globe-hero">
      <div className="word-globe-hero-heading font-mono text-ashen">
        <span>Fig. 01 · The space to speak</span>
        <button
          type="button"
          onClick={() => setPaused(!paused)}
          aria-label={
            paused ? "Play word globe animation" : "Pause word globe animation"
          }
          aria-pressed={paused}
          className="word-globe-motion-control"
        >
          <span aria-hidden="true">{paused ? "▷" : "Ⅱ"}</span>
          {paused ? "Play" : "Pause"}
        </button>
      </div>
      <div className="word-globe-hero-stage">
        <WordGlobe
          word="samvaad · speak · reflect · repeat · "
          color="#30302c"
          accentColor="#c47355"
          font={globeFont}
          speed={2}
          twist={50}
          letterSpacing={800}
          playback={paused ? "pause" : "play"}
          style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
        />
      </div>
      <div className="word-globe-hero-caption">
        <span className="font-mono text-xs uppercase tracking-wider text-clay-deep">
          A moment to gather your thoughts
        </span>
        <p className="font-serif text-3xl sm:text-4xl text-ink">
          Find the shape of your answer.
        </p>
        <p className="text-sm text-graphite leading-relaxed">
          A question. A moment to think. Then, your voice.
          <br />
          Make room for practice before the real conversation.
        </p>
        <span className="font-mono text-[10px] uppercase tracking-wider text-ashen">
          Illustrative motion · not live audio
        </span>
      </div>
    </div>
  );
}
