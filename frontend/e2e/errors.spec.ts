import { expect, test, type Page } from "@playwright/test";
import { fixture } from "./helpers.ts";

// Bad inputs end in a readable message and a usable page, never a crash.
async function load(page: Page, file: string | { name: string; mimeType: string; buffer: Buffer }) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(e.message));
  await page.goto("#/import");
  await page.getByTestId("file-input").setInputFiles(file);
  return problems;
}

test("a wrong package (no streaming history) shows the no-history message", async ({ page }) => {
  const problems = await load(page, {
    name: "Userdata.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ username: "someone" })),
  });
  await expect(page.getByText("These files do not contain streaming history", { exact: false })).toBeVisible({ timeout: 15_000 });
  expect(problems).toEqual([]);
});

test("an unrecognised file shows an error and the page stays usable", async ({ page }) => {
  const problems = await load(page, { name: "holiday.png", mimeType: "image/png", buffer: Buffer.from("not an export") });
  await expect(page.getByRole("alert").or(page.getByText(/do not contain streaming history|could not/i)).first()).toBeVisible({ timeout: 15_000 });
  expect(problems).toEqual([]);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Load your Spotify data");
});

test("a corrupt ZIP shows the damaged-file message", async ({ page }) => {
  const problems = await load(page, fixture("corrupt.zip"));
  await expect(page.getByRole("heading", { name: "That ZIP could not be opened" })).toBeVisible({ timeout: 15_000 });
  expect(problems).toEqual([]);
});
