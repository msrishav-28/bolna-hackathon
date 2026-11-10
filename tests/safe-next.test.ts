import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/domain/safe-next";

describe("safeNext", () => {
  it("keeps an internal path", () => {
    expect(safeNext("/sessions/123")).toBe("/sessions/123");
  });

  it("falls back to the home page when no path is supplied", () => {
    expect(safeNext(null)).toBe("/");
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
  });

  it("rejects backslashes and line breaks", () => {
    expect(safeNext("/sessions\\123")).toBe("/");
    expect(safeNext("/sessions\n123")).toBe("/");
    expect(safeNext("/sessions\r123")).toBe("/");
  });
});
