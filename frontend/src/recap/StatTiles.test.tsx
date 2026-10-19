import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import StatTiles from "./StatTiles";
import type { PeriodStats } from "../model/types";

const stats = {
  from: "2025-01-01", to: "2025-12-31", minutes: 1234, plays: 56, podcastMinutes: 0,
  activeDays: 40, longestStreakDays: 3, topDay: null, skipRate: null, firstTrack: null,
  hourMinutes: Array.from({ length: 24 }, () => 0),
} as unknown as PeriodStats;

function stubMotion(noPreference: boolean | undefined) {
  if (noPreference === undefined) {
    vi.stubGlobal("matchMedia", undefined);
    return;
  }
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.includes("no-preference") ? noPreference : false,
    media: q, onchange: null, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  }));
}

describe("StatTiles count-up", () => {
  let frames: FrameRequestCallback[] = [];
  beforeEach(() => {
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows final values immediately when reduced motion is requested", () => {
    stubMotion(false);
    render(<StatTiles stats={stats} />);
    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("56")).toBeInTheDocument();
    expect(frames).toHaveLength(0);
  });

  it("shows final values immediately when matchMedia is unavailable", () => {
    stubMotion(undefined);
    render(<StatTiles stats={stats} />);
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("counts up from zero to the final value when motion is allowed", () => {
    stubMotion(true);
    vi.spyOn(performance, "now").mockReturnValue(0);
    render(<StatTiles stats={stats} />);
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    expect(frames.length).toBeGreaterThan(0);
    act(() => { frames[0](500); });
    expect(screen.queryByText("1,234")).toBeNull();
    act(() => { frames[frames.length - 1](2000); });
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });
});
