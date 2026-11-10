"use client";

import { BaseThinkingOrb } from "./base-orb";
import type { OrbProps } from "./types";

export function OrbBreathing(props: OrbProps) {
  return (
    <BaseThinkingOrb
      mode="ring"
      caption="Thinking"
      summary="A ring pulsing with a slow radial ripple."
      frame={[240, 240]}
      {...props}
    />
  );
}
