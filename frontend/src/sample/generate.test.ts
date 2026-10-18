import { describe, expect, it } from "vitest";
import { adaptExtendedAudio } from "../import/adapters/extended";
import { generate } from "./generate";

describe("generate", () => {
  it("is deterministic per seed and differs across seeds", () => {
    expect(generate(1)).toEqual(generate(1));
    expect(generate(1)).not.toEqual(generate(2));
  });
  it("covers about six years", () => {
    const rows = generate(7);
    const first = Date.parse(rows[0]!.ts);
    const last = Date.parse(rows[rows.length - 1]!.ts);
    expect((last - first) / (365.25 * 86400000)).toBeGreaterThan(5.8);
    expect(rows.length).toBeGreaterThan(10000);
  });
  it("rows pass the Extended adapter without skips", () => {
    const rows = generate(3, { years: 1 });
    const { plays, skippedRows } = adaptExtendedAudio(rows);
    expect(skippedRows).toBe(0);
    expect(plays).toHaveLength(rows.length);
    expect(plays.some((p) => p.kind === "podcast")).toBe(true);
    expect(plays.some((p) => p.skipped)).toBe(true);
  });
});
