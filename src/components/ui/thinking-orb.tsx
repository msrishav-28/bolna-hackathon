"use client";

import { BaseThinkingOrb } from "./thinking-orb-utils/base-orb";
import type {
  ThinkingOrbDescriptor,
  ThinkingOrbMode,
  ThinkingOrbProps,
  ThinkingOrbVariant,
} from "./thinking-orb-utils/types";

export * from "./thinking-orb-utils/types";
export { BaseThinkingOrb };
export { OrbWorking } from "./thinking-orb-utils/orb-working";
export { OrbSearching } from "./thinking-orb-utils/orb-searching";
export { OrbSolving } from "./thinking-orb-utils/orb-solving";
export { OrbListening } from "./thinking-orb-utils/orb-listening";
export { OrbConnecting } from "./thinking-orb-utils/orb-connecting";
export { OrbWeaving } from "./thinking-orb-utils/orb-weaving";
export { OrbComposing } from "./thinking-orb-utils/orb-composing";
export { OrbBreathing } from "./thinking-orb-utils/orb-breathing";
export { OrbShaping } from "./thinking-orb-utils/orb-shaping";

// Recreated renderer; these descriptors describe the local geometry, not missing upstream source.
export const THINKING_ORBS: ThinkingOrbDescriptor[] = [
  {
    id: "orb-working",
    name: "Working Orb",
    variant: "working",
    mode: "orbits",
    caption: "Working",
    frame: [240, 240],
    summary: "Particles tracing tilted orbital rings around a ghosted sphere.",
  },
  {
    id: "orb-searching",
    name: "Searching Orb",
    variant: "searching",
    mode: "globe",
    caption: "Searching",
    frame: [240, 240],
    summary: "A dotted globe swept by a rotating scan band.",
  },
  {
    id: "orb-solving",
    name: "Solving Orb",
    variant: "solving",
    mode: "rubik",
    caption: "Solving",
    frame: [240, 240],
    summary: "A point-cloud sphere permuted by slice rotations.",
  },
  {
    id: "orb-listening",
    name: "Listening Orb",
    variant: "listening",
    mode: "wave",
    caption: "Listening",
    frame: [240, 240],
    summary: "Latitude rings breathing in and out on two detuned sine waves.",
  },
  {
    id: "orb-connecting",
    name: "Connecting Orb",
    variant: "connecting",
    mode: "web",
    caption: "Connecting",
    frame: [240, 240],
    summary: "A drifting field of nodes.",
  },
  {
    id: "orb-weaving",
    name: "Weaving Orb",
    variant: "weaving",
    mode: "braid",
    caption: "Weaving",
    frame: [240, 240],
    summary: "Three helical strands braiding around a sphere.",
  },
  {
    id: "orb-composing",
    name: "Composing Orb",
    variant: "composing",
    mode: "ribbon",
    caption: "Composing",
    frame: [240, 240],
    summary: "A rippling multi-lane ribbon wrapped over a sphere.",
  },
  {
    id: "orb-breathing",
    name: "Breathing Orb",
    variant: "breathing",
    mode: "ring",
    caption: "Thinking",
    frame: [240, 240],
    summary: "A ring pulsing with a slow radial ripple.",
  },
  {
    id: "orb-shaping",
    name: "Shaping Orb",
    variant: "shaping",
    mode: "morph",
    caption: "Shaping",
    frame: [240, 240],
    summary: "A dotted outline morphing between a circle and square.",
  },
];

export const VARIANT_TO_MODE_MAP: Record<
  ThinkingOrbVariant | ThinkingOrbMode,
  ThinkingOrbMode
> = {
  working: "orbits",
  orbits: "orbits",
  searching: "globe",
  globe: "globe",
  solving: "rubik",
  rubik: "rubik",
  listening: "wave",
  wave: "wave",
  connecting: "web",
  web: "web",
  weaving: "braid",
  braid: "braid",
  composing: "ribbon",
  ribbon: "ribbon",
  breathing: "ring",
  ring: "ring",
  shaping: "morph",
  morph: "morph",
};

export function ThinkingOrb({
  variant = "working",
  ...props
}: ThinkingOrbProps) {
  const mode = VARIANT_TO_MODE_MAP[variant] ?? "orbits";
  const desc =
    THINKING_ORBS.find((item) => item.mode === mode) ?? THINKING_ORBS[0];
  return (
    <BaseThinkingOrb
      mode={desc.mode}
      caption={desc.caption}
      summary={desc.summary}
      frame={desc.frame}
      {...props}
    />
  );
}

export default ThinkingOrb;
