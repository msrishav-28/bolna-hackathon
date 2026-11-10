import type { CSSProperties } from "react";

export type ThinkingOrbVariant =
  | "working"
  | "searching"
  | "solving"
  | "listening"
  | "connecting"
  | "weaving"
  | "composing"
  | "breathing"
  | "shaping";
export type ThinkingOrbMode =
  | "orbits"
  | "globe"
  | "rubik"
  | "wave"
  | "web"
  | "braid"
  | "ribbon"
  | "ring"
  | "morph";
export type ThinkingOrbSurface = "auto" | "light" | "dark";
export interface ThinkingOrbDescriptor {
  id: string;
  name: string;
  variant: ThinkingOrbVariant;
  mode: ThinkingOrbMode;
  caption: string;
  frame: [number, number];
  summary: string;
}
export interface OrbProps {
  surface?: ThinkingOrbSurface;
  size?: number;
  speed?: number;
  scale?: number;
  playback?: "play" | "pause";
  className?: string;
  style?: CSSProperties;
  caption?: string;
  summary?: string;
  /** Hide the caption when composing the orb into a larger labelled figure. */
  showCaption?: boolean;
}
export interface ThinkingOrbProps extends OrbProps {
  variant?: ThinkingOrbVariant | ThinkingOrbMode;
}
export interface BaseThinkingOrbProps extends OrbProps {
  mode: ThinkingOrbMode;
  frame?: [number, number];
}
