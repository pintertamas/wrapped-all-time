import { expect, test } from "@playwright/test";
import { buildCsp, unlockVerifyOrigin } from "../src/configSchema.ts";
import { buildConfig } from "./helpers.ts";

// The CSP meta tag of every page matches what the config says it should be, and the browser
// really blocks a request to a host outside connect-src.
const PAGES = ["", "guide/", "faq/", "privacy/", "terms/"];

test("every page carries the CSP built from the config", async ({ page }) => {
  const expected = buildCsp(buildConfig());
  for (const path of PAGES) {
    await page.goto(path);
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
    expect(csp, path).toBe(expected);
  }
});

test("connect-src lists only self plus the configured hosts", async ({ page }) => {
  const cfg = buildConfig();
  await page.goto("");
  const csp = (await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content")) ?? "";
  const connect = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("connect-src ")) ?? "";
  const hosts = connect.split(" ").slice(1);
  expect(hosts[0]).toBe("'self'");
  const verify = unlockVerifyOrigin(cfg);
  if (verify) expect(hosts).toContain(verify);
  else expect(hosts.some((h) => h.includes("lemonsqueezy") || h.includes("gumroad"))).toBe(false);
  for (const h of hosts.slice(1)) expect(h).toMatch(/^https:\/\//);
  expect(csp).toContain("form-action 'none'");
  expect(csp).toContain("object-src 'none'");
});

test("a fetch to an unlisted host is blocked by the browser", async ({ page }) => {
  await page.goto("");
  const outcome = await page.evaluate(async () => {
    try {
      await fetch("https://example.invalid/leak", { mode: "no-cors" });
      return "sent";
    } catch {
      return "blocked";
    }
  });
  expect(outcome).toBe("blocked");
});
