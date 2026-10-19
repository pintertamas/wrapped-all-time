import { beforeEach, describe, expect, it } from "vitest";
import { isUnlocked } from "./entitlement";

describe("isUnlocked", () => {
  beforeEach(() => localStorage.clear());
  it("is false without a record or with junk", () => {
    expect(isUnlocked()).toBe(false);
    localStorage.setItem("lv.unlock.v1", "nope");
    expect(isUnlocked()).toBe(false);
  });
  it("is true for a valid record", () => {
    localStorage.setItem("lv.unlock.v1", JSON.stringify({ v: 1, keyLast4: "ABCD" }));
    expect(isUnlocked()).toBe(true);
  });
});
