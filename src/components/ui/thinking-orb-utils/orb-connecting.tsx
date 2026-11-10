"use client";

import { BaseThinkingOrb } from "./base-orb";
import type { OrbProps } from "./types";

export function OrbConnecting(props: OrbProps) {
  return (
    <BaseThinkingOrb
      mode="web"
      caption="Connecting"
      summary="A drifting field of nodes."
      frame={[240, 240]}
      {...props}
    />
  );
}
