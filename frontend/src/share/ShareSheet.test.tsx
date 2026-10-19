import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PeriodStats } from "../model/types";
import ShareSheet from "./ShareSheet";
import type { RenderOptions } from "./types";

const stats = { from: "a", to: "b", minutes: 1, plays: 1, topArtists: [], topTracks: [] } as unknown as PeriodStats;
const renderCard = vi.fn(async (o: RenderOptions) => ({
  blob: new Blob(["x"], { type: "image/png" }), fileName: `x-${o.format}.png`,
  altText: `alt ${o.format}`, width: 1, height: 1,
}));

function setup(paid = false) {
  return render(
    <ShareSheet stats={stats} period="4w" periodLabel="Last 4 weeks" sample={false} paid={paid} onClose={() => {}} renderCard={renderCard} />,
  );
}

beforeEach(() => {
  renderCard.mockClear();
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
});

describe("ShareSheet", () => {
  it("shows both previews with alt text", async () => {
    setup();
    expect(await screen.findByAltText("alt story")).toBeTruthy();
    expect(screen.getByAltText("alt square")).toBeTruthy();
  });

  it("uses navigator.share when files can be shared", async () => {
    const share = vi.fn(async () => {});
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    setup();
    await screen.findByAltText("alt story");
    fireEvent.click(screen.getByText("Share story"));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("share-hint")).toBeNull();
  });

  it("downloads and shows the long-press hint otherwise", async () => {
    const share = vi.fn();
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: () => false, configurable: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    setup();
    await screen.findByAltText("alt square");
    fireEvent.click(screen.getByText("Share square"));
    expect(await screen.findByTestId("share-hint")).toBeTruthy();
    expect(share).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it("offers HD only when unlocked and makes no network request", async () => {
    const { unmount } = setup(false);
    await screen.findByAltText("alt story");
    expect(screen.queryByText(/HD/)).toBeNull();
    unmount();
    setup(true);
    await screen.findByAltText("alt story");
    fireEvent.click(screen.getByLabelText(/HD/));
    await waitFor(() => expect(renderCard.mock.calls.some(([o]) => o.hd)).toBe(true));
    expect(fetch).not.toHaveBeenCalled();
  });
});
