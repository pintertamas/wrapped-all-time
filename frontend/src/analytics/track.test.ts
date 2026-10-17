import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("../config");
  vi.doUnmock("./goatcounter");
  document.head.innerHTML = "";
});

async function setup(provider: "none" | "goatcounter") {
  const send = vi.fn(async () => undefined);
  vi.doMock("../config", () => ({ config: { analyticsProvider: provider, analyticsSite: "lv", basePath: "/" } }));
  vi.doMock("./goatcounter", () => ({ send }));
  const mod = await import("./track");
  return { ...mod, send };
}

describe("track", () => {
  it("is a no-op when provider is none: no adapter call, no script", async () => {
    const { track, send } = await setup("none");
    track("recap_viewed", { tier: "free" });
    await new Promise((r) => setTimeout(r, 10));
    expect(send).not.toHaveBeenCalled();
    expect(document.querySelector("script")).toBeNull();
  });

  it("sends event/<name>[/<enum>] when enabled", async () => {
    const { track, send } = await setup("goatcounter");
    track("file_type_detected", { kind: "extended" });
    track("guide_viewed");
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send).toHaveBeenCalledWith("event/file_type_detected/extended");
    expect(send).toHaveBeenCalledWith("event/guide_viewed");
  });

  it("never lets free text reach the adapter", async () => {
    const { track, send } = await setup("goatcounter");
    const evil = { kind: "Daft Punk - Around the World.json", tier: "key ABCD-1234" } as never;
    track("file_dropped", evil);
    track("parse_failed", { errorClass: "my_secret_file.zip" } as never);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    for (const [path] of send.mock.calls as unknown as string[][]) {
      expect(path).toMatch(/^event\/[a-z_]+(\/[a-z0-9_-]+)?$/);
      expect(path).not.toMatch(/daft|punk|ABCD|json|zip|key/i);
    }
  });
});
