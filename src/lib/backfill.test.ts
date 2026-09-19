import { describe, expect, it } from "vitest";
import { normalizeBackfillLimit } from "./backfill";

describe("backfill helpers", () => {
  it("normalizes import history limits safely", () => {
    expect(normalizeBackfillLimit(undefined)).toBe(100);
    expect(normalizeBackfillLimit("25")).toBe(25);
    expect(normalizeBackfillLimit(2000)).toBe(1000);
    expect(normalizeBackfillLimit(-5)).toBe(100);
    expect(normalizeBackfillLimit("bad")).toBe(100);
  });
});
