import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

export function secretMatches(actual: string | null, expected: string) {
  if (!actual || actual.length > 1024) return false;
  return timingSafeEqual(
    createHash("sha256").update(actual).digest(),
    createHash("sha256").update(expected).digest(),
  );
}
