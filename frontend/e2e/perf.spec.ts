import { expect, test } from "@playwright/test";
import { fixture } from "./helpers.ts";

// ~50 MB of uncompressed history JSON must import in under 15 s.
test("50 MB import finishes in under 15 s", async ({ page }) => {
  await page.goto("#/import");
  const start = Date.now();
  await page.getByTestId("file-input").setInputFiles(fixture("perf.zip"));
  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible({ timeout: 15_000 });
  expect(Date.now() - start).toBeLessThan(15_000);
});
