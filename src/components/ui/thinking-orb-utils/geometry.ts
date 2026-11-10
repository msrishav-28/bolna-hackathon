import type { ThinkingOrbMode } from "./types";

const TAU = Math.PI * 2;
export interface OrbPoint {
  x: number;
  y: number;
  z: number;
  accent: boolean;
}

/** Deterministic, synthetic geometry. Never derived from microphone or student data. */
export function orbGeometry(mode: ThinkingOrbMode, time: number): OrbPoint[] {
  const points: OrbPoint[] = [];
  const lanes = mode === "braid" ? 3 : 22;
  const steps = 160;
  for (let lane = 0; lane < lanes; lane++) {
    const v = lane / (lanes - 1);
    for (let step = 0; step < steps; step++) {
      const u = step / steps;
      const angle = u * TAU;
      let latitude = (v - 0.5) * Math.PI * 0.94;
      let longitude = angle;
      let radius = 1;
      switch (mode) {
        case "ribbon":
          latitude =
            (v - 0.5) * Math.PI * 0.94 +
            Math.sin(angle * 2 + time * 0.38) *
              0.23 *
              Math.cos((v - 0.5) * Math.PI);
          longitude += v * 0.55;
          radius += Math.sin(angle * 3 + v * 5 - time * 0.3) * 0.055;
          break;
        case "wave":
          radius +=
            Math.sin(angle * 3 + time) * 0.06 +
            Math.sin(v * 8 - time * 0.8) * 0.06;
          break;
        case "orbits":
          latitude = Math.sin(angle * 2 + v * TAU) * 0.7;
          longitude += v * Math.PI;
          break;
        case "braid":
          latitude = (u - 0.5) * Math.PI;
          longitude = angle * 2 + v * TAU + time * 0.25;
          break;
        case "ring":
          latitude = (v - 0.5) * 0.22;
          radius = 0.9 + Math.sin(angle * 4 + time * 0.5) * 0.04;
          break;
        case "morph": {
          latitude = (v - 0.5) * 0.12;
          const square =
            1 / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)));
          const blend = (Math.sin(time * 0.35) + 1) / 2;
          radius = 0.8 * (1 + (square - 1) * blend);
          break;
        }
        case "web":
          if (step % 8 !== 0) continue;
          latitude += Math.sin(angle * 7 + lane + time * 0.25) * 0.08;
          break;
        case "rubik":
          longitude +=
            Math.floor(v * 4) % 2 === 0
              ? (Math.sin(time * 0.5) * Math.PI) / 2
              : 0;
          break;
      }
      const cos = Math.cos(latitude);
      points.push({
        x: Math.cos(longitude) * cos * radius,
        y: Math.sin(latitude) * radius,
        z: Math.sin(longitude) * cos * radius,
        accent:
          mode === "globe"
            ? Math.cos(longitude - time * 0.5) > 0.96
            : lane >= Math.floor(lanes * 0.72),
      });
    }
  }
  return points;
}
