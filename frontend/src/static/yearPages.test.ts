import { describe, expect, it } from "vitest";
import { FIRST_YEAR, renderYearPage, yearRange } from "./yearPages.ts";

describe("year pages", () => {
  it("lists years newest first down to FIRST_YEAR", () => {
    const years = yearRange(new Date("2026-03-01T00:00:00Z"));
    expect(years[0]).toBe(2026);
    expect(years.at(-1)).toBe(FIRST_YEAR);
  });

  it("renders a self-contained page with title, canonical, CSP and no Spotify branding claims", () => {
    const html = renderYearPage({ year: 2019, productName: "Listening Vault", siteUrl: "https://x.test/", robots: "index", csp: "default-src 'self'", stylesheetTag: "" });
    expect(html).toContain("<title>Your 2019");
    expect(html).toContain('<link rel="canonical" href="https://x.test/year/2019/" />');
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).not.toContain("<script");
    expect(html).not.toMatch(/wrapped/i);
  });
});
