"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";
import { orbGeometry } from "./geometry";
import type { BaseThinkingOrbProps } from "./types";

function bounded(value: number, fallback: number, min: number, max: number) {
  return Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export function BaseThinkingOrb({
  mode,
  surface = "auto",
  size = 240,
  speed = 1,
  scale = 0.72,
  playback = "play",
  caption = "Thinking",
  summary = "An illustrative particle orb.",
  showCaption = true,
  className,
  style,
  frame,
}: BaseThinkingOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const captionId = useId();
  const safeSize = bounded(size, 240, 48, 1600);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const dark = matchMedia("(prefers-color-scheme: dark)");
    let visible = true;
    let animation = 0;
    let last = 0;
    let drawnAt = 0;
    let width = 0;
    let height = 0;
    const draw = () => {
      if (!width || !height) return;
      const css = getComputedStyle(canvas);
      const isDark =
        surface === "dark" ||
        (surface === "auto" &&
          (css.colorScheme === "dark" ||
            (css.colorScheme === "light dark" && dark.matches)));
      const ink =
        css
          .getPropertyValue(isDark ? "--surface-paper" : "--ink-slate")
          .trim() || (isDark ? "#faf9f5" : "#141413");
      const clay = css.getPropertyValue("--accent-clay").trim() || "#d97757";
      const radius =
        Math.min(width, height) * 0.45 * bounded(scale, 0.72, 0.1, 1);
      const t = timeRef.current;
      const clayPulse = (Math.sin(t * 0.8) + 1) / 2;
      // Fixed viewpoint; only the synthetic geometry moves. No pan, zoom or pointer input.
      const yaw = t * 0.12 + 0.6;
      const tilt = -0.32;
      const projected = orbGeometry(mode, t)
        .map((point) => {
          const x = point.x * Math.cos(yaw) - point.z * Math.sin(yaw);
          const z = point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
          const y = point.y * Math.cos(tilt) - z * Math.sin(tilt);
          const depth = point.y * Math.sin(tilt) + z * Math.cos(tilt);
          const perspective = 3.8 / (3.8 - depth);
          return {
            x: width / 2 + x * radius * perspective,
            y: height / 2 + y * radius * perspective,
            depth,
            accent: point.accent,
          };
        })
        .sort((a, b) => a.depth - b.depth);
      context.clearRect(0, 0, width, height);
      const halo = context.createRadialGradient(
        width * 0.52,
        height * 0.48,
        0,
        width / 2,
        height / 2,
        radius * 1.4,
      );
      halo.addColorStop(
        0,
        `rgba(217,119,87,${(isDark ? 0.09 : 0.07) + clayPulse * 0.04})`,
      );
      halo.addColorStop(1, "rgba(217,119,87,0)");
      context.fillStyle = halo;
      context.fillRect(0, 0, width, height);
      for (const point of projected) {
        const depth = (point.depth + 1.2) / 2.4;
        context.globalAlpha =
          (0.12 + depth * 0.78) * (point.accent ? 0.82 + clayPulse * 0.18 : 1);
        context.fillStyle = point.accent ? clay : ink;
        context.beginPath();
        context.arc(
          point.x,
          point.y,
          ((0.42 + depth * 0.65) * width) / 440,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
      context.globalAlpha = 1;
    };
    const tick = (now: number) => {
      if (last)
        timeRef.current +=
          (Math.min(now - last, 64) / 1000) *
          bounded(speed, 1, 0, 4) *
          (reduced.matches ? 0.12 : 1);
      last = now;
      if (now - drawnAt >= 1000 / 30) {
        draw();
        drawnAt = now;
      }
      animation = requestAnimationFrame(tick);
    };
    const restart = () => {
      cancelAnimationFrame(animation);
      last = 0;
      draw();
      if (visible && !document.hidden && playback === "play" && speed !== 0)
        animation = requestAnimationFrame(tick);
    };
    const resize = new ResizeObserver(() => {
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      const ratio = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    });
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      restart();
    });
    resize.observe(canvas);
    intersection.observe(canvas);
    document.addEventListener("visibilitychange", restart);
    reduced.addEventListener("change", restart);
    dark.addEventListener("change", restart);
    restart();
    return () => {
      cancelAnimationFrame(animation);
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", restart);
      reduced.removeEventListener("change", restart);
      dark.removeEventListener("change", restart);
    };
  }, [mode, surface, speed, scale, playback]);

  return (
    <figure
      className={cn("thinking-orb", className)}
      style={{ width: safeSize, maxWidth: "100%", margin: 0, ...style }}
      aria-label={summary}
      aria-describedby={showCaption ? captionId : undefined}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          width: "100%",
          display: "block",
          aspectRatio: frame ? `${frame[0]} / ${frame[1]}` : "1",
        }}
      />
      {showCaption && (
        <figcaption
          id={captionId}
          className="text-center text-sm text-muted-foreground"
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
