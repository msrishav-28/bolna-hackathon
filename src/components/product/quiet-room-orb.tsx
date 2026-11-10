"use client";
import { useEffect, useRef } from "react";

export function QuietRoomOrb({
  active,
  volume,
}: {
  active: boolean;
  volume: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const signal = useRef({ active, volume });
  useEffect(() => {
    signal.current = { active, volume };
  }, [active, volume]);
  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const draw = (now: number) => {
      const motion = !reduced.matches && signal.current.active;
      const time = motion ? now / 1000 : 0;
      const amplitude = motion ? 2 + signal.current.volume * 12 : 0;
      ctx.clearRect(0, 0, 300, 240);
      for (const radius of [52, 86, 118]) {
        ctx.beginPath();
        ctx.arc(150, 120, radius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(20,20,19,.08)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      for (let ring = 0; ring < 3; ring++) {
        ctx.beginPath();
        for (let i = 0; i <= 96; i++) {
          const angle = (i / 96) * Math.PI * 2;
          const radius =
            56 +
            ring * 20 +
            Math.sin(angle * 5 + time * 3.2 + ring) * amplitude;
          const x = 150 + Math.cos(angle) * radius,
            y = 120 + Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = ring === 0 ? "#141413" : "rgba(20,20,19,.32)";
        ctx.lineWidth = ring === 0 ? 2.2 : 1.2;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(
        150,
        120,
        32 + Math.sin(time * 3.2) * amplitude * 0.2,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = "#141413";
      ctx.fill();
      if (!document.hidden && !reduced.matches)
        frame = requestAnimationFrame(draw);
    };
    const resume = () => {
      cancelAnimationFrame(frame);
      draw(performance.now());
    };
    resume();
    document.addEventListener("visibilitychange", resume);
    reduced.addEventListener("change", resume);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", resume);
      reduced.removeEventListener("change", resume);
    };
  }, []);
  return (
    <div
      className="rounded-3xl bg-manilla/60 border border-stone p-4"
      aria-hidden="true"
    >
      <canvas
        ref={canvas}
        width={300}
        height={240}
        className="w-[240px] h-[192px] sm:w-[280px] sm:h-[220px]"
      />
    </div>
  );
}
