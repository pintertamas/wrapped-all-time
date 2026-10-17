import { describe, expect, it } from "vitest";
import { parseHash, routeToHash, type Route } from "./router";

describe("parseHash", () => {
  it.each<[string, Route]>([
    ["", { view: "landing" }],
    ["#", { view: "landing" }],
    ["#/", { view: "landing" }],
    ["#/import", { view: "import" }],
    ["#/import/", { view: "import" }],
    ["#/recap", { view: "recap", period: "12m" }],
    ["#/recap/4w", { view: "recap", period: "4w" }],
    ["#/recap/6m", { view: "recap", period: "6m" }],
    ["#/recap/12m", { view: "recap", period: "12m" }],
    ["#/recap/2016", { view: "recap", period: "2016" }],
    ["#/recap/all", { view: "recap", period: "all" }],
    ["#/unlock", { view: "unlock", code: null }],
    ["#/unlock?code=ABCD-1234", { view: "unlock", code: "ABCD-1234" }],
    ["#/unlock?code=", { view: "unlock", code: null }],
  ])("%s", (hash, route) => {
    expect(parseHash(hash)).toEqual(route);
  });

  it.each(["#/nope", "#/recap/3w", "#/recap/16", "#/recap/2016/extra", "#/import/x"])(
    "falls back to landing for %s",
    (hash) => {
      expect(parseHash(hash)).toEqual({ view: "landing" });
    },
  );

  it("caps the unlock code length", () => {
    const route = parseHash(`#/unlock?code=${"x".repeat(500)}`);
    expect(route.view === "unlock" && route.code?.length).toBe(128);
  });
});

describe("routeToHash", () => {
  it.each<Route>([
    { view: "landing" },
    { view: "import" },
    { view: "recap", period: "4w" },
    { view: "recap", period: "2019" },
    { view: "recap", period: "all" },
    { view: "unlock", code: null },
    { view: "unlock", code: "AB CD&x" },
  ])("round-trips %o", (route) => {
    expect(parseHash(routeToHash(route))).toEqual(route);
  });
});
