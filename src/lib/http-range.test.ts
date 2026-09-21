import { describe, expect, it } from "vitest";
import { parseByteRange } from "./http-range";

describe("parseByteRange", () => {
  it("parses open ended range", () => {
    expect(parseByteRange("bytes=100-", 1000)).toEqual({ start: 100, end: 999, partial: true });
  });

  it("parses bounded range", () => {
    expect(parseByteRange("bytes=100-199", 1000)).toEqual({ start: 100, end: 199, partial: true });
  });

  it("falls back to full content when no range is present", () => {
    expect(parseByteRange(null, 1000)).toEqual({ start: 0, end: 999, partial: false });
  });

  it("rejects unsatisfiable ranges", () => {
    expect(parseByteRange("bytes=1000-1200", 1000)).toBeNull();
  });
});
