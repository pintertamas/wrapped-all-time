import { describe, expect, it } from "vitest";
import { ROLES, checkBudgets, roleOf } from "./size-budgets.mjs";

describe("roleOf", () => {
  it.each([
    ["index-C-Lyy-RB.js", "entry"],
    ["parse.worker-Ab12.js", "worker"],
    ["guide-x1.js", "staticJs"],
    ["index-DFqlhLQb.css", "mainCss"],
    ["static-C7tcvvnm.css", "staticCss"],
    ["ShareSheet-a1.js", "lazy"],
    ["share-a1.js", "lazy"],
    ["UnlockSheet-a1.js", "lazy"],
    ["space-grotesk-latin-700-normal-x.woff2", "font"],
    ["vendor-x.js", null],
  ])("%s -> %s", (name, role) => {
    expect(roleOf(name)).toBe(role);
  });
});

describe("budgets", () => {
  it("match eng/frontend.md § Size budgets", () => {
    expect(Object.fromEntries(Object.entries(ROLES).map(([k, r]) => [k, r.budgetKb]))).toEqual({
      entry: 100,
      worker: 25,
      staticJs: 6,
      mainCss: 15,
      staticCss: 6,
      lazy: 20,
      font: 30,
    });
  });

  it("passes a build within budget", () => {
    expect(
      checkBudgets([
        { name: "index-a.js", gzip: 70_000 },
        { name: "index-a.css", gzip: 1_000 },
        { name: "static-a.css", gzip: 400 },
      ]),
    ).toEqual([]);
  });

  it("fails on an over-budget file of any role and on a missing entry", () => {
    const failures = checkBudgets([
      { name: "index-a.css", gzip: 1_000 },
      { name: "parse.worker-a.js", gzip: 25_001 },
      { name: "guide-a.js", gzip: 6_500 },
      { name: "ShareSheet-a.js", gzip: 21_000 },
    ]);
    expect(failures).toHaveLength(4);
    expect(failures.join("\n")).toMatch(/no entry index-\*\.js file found/);
    expect(failures.join("\n")).toMatch(/parse\.worker-a\.js .* 25 kB/);
    expect(failures.join("\n")).toMatch(/guide-a\.js .* 6 kB/);
    expect(failures.join("\n")).toMatch(/ShareSheet-a\.js .* 20 kB/);
  });
});
