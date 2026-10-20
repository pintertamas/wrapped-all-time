import { expect, test } from "@playwright/test";
import { fixture } from "./helpers.ts";

// After the app has loaded, importing and rendering the recap needs no network at all.
test("import and recap work with the network switched off", async ({ page, context }) => {
  // Online warm-up: load the worker, the recap and the share chunks once, as a real visit would.
  await page.goto("#/import");
  await page.getByRole("button", { name: "Try with sample data" }).click();
  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "See my recap" }).click();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByTestId("preview-story").locator("img")).toBeVisible({ timeout: 20_000 });
  await page.goto("#/import");
  // Cancelling replaces the worker with a fresh one, fetched now, while still online.
  await page.getByTestId("file-input").setInputFiles(fixture("perf.zip"));
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByTestId("file-input")).toBeAttached();
  await expect.poll(() => page.workers().length).toBeGreaterThan(0);

  await context.setOffline(true);
  await page.getByTestId("file-input").setInputFiles(fixture("extended.zip"));
  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "See my recap" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/12 months/i);
  await expect(page.getByRole("button", { name: "Share", exact: true })).toBeVisible();
  await expect(page.getByTestId("no-data")).toHaveCount(0);
});
