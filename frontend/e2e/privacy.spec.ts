import { expect, test, type Request } from "@playwright/test";
import { fixture, verifyBase } from "./helpers.ts";

// Privacy canary: a ZIP whose artist/track/album names all start with ZZCANARY is imported, the
// recap is opened, a share card is exported and a license key is verified (provider call mocked).
// Every request the page makes must stay same-origin, except the one verify POST whose body is
// exactly license_key=<key>. The canary string must appear in no URL, header or body.
const CANARY = "ZZCANARY";
const KEY = "AAAA-BBBB-CCCC-DDDD";
const VERIFY_URL = "https://api.lemonsqueezy.com/v1/licenses/validate";

test("canary import, recap, card export and verify never leak file contents", async ({ page }) => {
  const origin = new URL(verifyBase()).origin;
  const requests: Request[] = [];
  page.on("request", (r) => requests.push(r));

  await page.route(VERIFY_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        valid: true,
        license_key: { status: "active" },
        meta: { store_id: 222, product_id: 111, customer_email: "buyer@example.com" },
      }),
    }),
  );

  await page.goto(`${verifyBase()}#/import`);
  await page.getByTestId("file-input").setInputFiles(fixture("canary.zip"));
  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("link", { name: "See my recap" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/12 months/i);
  await expect(page.getByText(CANARY).first()).toBeVisible();

  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByTestId("preview-story").locator("img")).toBeVisible({ timeout: 20_000 });
  const download = page.waitForEvent("download", { timeout: 10_000 }).catch(() => null);
  await page.getByRole("button", { name: "Share story" }).click();
  const saved = await download;
  if (saved) expect(saved.suggestedFilename()).toMatch(/-story\.png$/);
  else await expect(page.getByTestId("share-hint")).toBeVisible();

  await page.goto(`${verifyBase()}#/unlock`);
  await page.getByLabel("License key").fill(KEY);
  await page.getByRole("button", { name: /unlock|restore|verify/i }).first().click();
  await expect(page.getByText(/unlocked on this device/i)).toBeVisible({ timeout: 10_000 });

  expect(requests.length).toBeGreaterThan(0);
  const verifyCalls: Request[] = [];
  for (const r of requests) {
    const url = r.url();
    const blob = [url, JSON.stringify(r.headers()), r.postData() ?? ""].join("\n");
    expect(blob, `canary in ${url}`).not.toContain(CANARY);
    if (url.startsWith(VERIFY_URL)) {
      verifyCalls.push(r);
      continue;
    }
    if (url.startsWith("data:") || url.startsWith("blob:")) continue;
    expect(new URL(url).origin, `foreign request ${url}`).toBe(origin);
  }
  expect(verifyCalls).toHaveLength(1);
  expect(verifyCalls[0].method()).toBe("POST");
  expect(verifyCalls[0].postData()).toBe(`license_key=${KEY}`);
});
