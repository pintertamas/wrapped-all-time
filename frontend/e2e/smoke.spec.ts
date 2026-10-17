import { expect, test } from "@playwright/test";

// Smoke test of the built shell: every page loads under its CSP without errors, and the hash
// router serves the app views. The full privacy/offline/perf/errors suites come later.
const PAGES = ["", "guide/", "privacy/", "terms/"];

test("every HTML page has the generated CSP meta tag and loads cleanly", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(msg.text());
  });
  page.on("pageerror", (err) => problems.push(err.message));

  for (const path of PAGES) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
    expect(csp, path).toContain("default-src 'self'");
    expect(csp, path).toMatch(/connect-src 'self'(;| )/);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByText(/not affiliated with/i).first()).toBeVisible();
  }
  expect(problems).toEqual([]);
});

test("hash router serves the app views", async ({ page }) => {
  await page.goto("");
  await expect(page.getByRole("link", { name: "Load my data" })).toBeVisible();
  await page.getByRole("link", { name: "Load my data" }).click();
  await expect(page).toHaveURL(/#\/import$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Load your Spotify data");

  await page.goto("#/recap/all");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("All time");

  await page.getByRole("link", { name: "Restore purchase" }).click();
  await expect(page).toHaveURL(/#\/unlock$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Unlock every year");

  await page.getByRole("link", { name: "Export guide" }).click();
  await expect(page).toHaveURL(/\/guide\/$/);
});

test("guide page is readable without JavaScript and ships SEO files", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}guide/`);
  await expect(page.getByRole("heading", { name: "Extended streaming history" }).first()).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /guide\/$/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /og\.png$/);
  const sitemap = await page.request.get(`${baseURL}sitemap.xml`);
  const xml = await sitemap.text();
  for (const path of ["", "guide/", "privacy/", "terms/"]) expect(xml).toContain(`${path}</loc>`);
  expect((await page.request.get(`${baseURL}robots.txt`)).ok()).toBe(true);
  await context.close();
});
