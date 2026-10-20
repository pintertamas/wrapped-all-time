import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PeriodStats, StatsBundle } from "../model/types";
import { clearEverything, registerWorkerTerminator } from "../storage/clear";
import { PREFS_KEY, RECAP_KEY } from "../storage/keys";
import { loadRecap, saveRecap } from "../storage/recap";
import RecapPage from "./RecapPage";

function period(minutes: number, extra: Partial<PeriodStats> = {}): PeriodStats {
  return {
    from: "2025-01-01", to: "2025-12-31", minutes, plays: 10, podcastMinutes: 0,
    topArtists: [{ name: "Artist A", minutes: 50, plays: 5 }],
    topTracks: [{ name: "Song A", artist: "Artist A", minutes: 20, plays: 3 }],
    topAlbums: null, topDay: { date: "2025-03-01", minutes: 90 }, longestStreakDays: 4, activeDays: 12,
    firstTrack: null, skipRate: null, hourMinutes: Array.from({ length: 24 }, (_, h) => (h === 21 ? 40 : 1)),
    ...extra,
  };
}

function bundle(over: Partial<StatsBundle> = {}): StatsBundle {
  return {
    version: 1, tz: "UTC", sources: ["extended"], sample: false, latestPlay: "2025-12-31",
    periods: { "4w": period(111), "6m": period(222), "12m": period(333) },
    years: { "2024": period(444), "2025": period(555) },
    allTime: period(999),
    ...over,
  };
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  window.location.hash = "";
});
afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe("RecapPage", () => {
  it("renders the stats of the routed period and top lists with text equivalents", () => {
    saveRecap(bundle());
    render(<RecapPage period="6m" />);
    expect(screen.getByRole("heading", { level: 1, name: "Last 6 months" })).toBeInTheDocument();
    expect(screen.getByText("222")).toBeInTheDocument();
    expect(screen.getAllByText("Artist A").length).toBeGreaterThan(0);
    expect(screen.getByText(/50 min, 5 plays/)).toBeInTheDocument();
    expect(screen.getByTestId("hours-text")).toHaveTextContent("around 21:00");
  });

  it("tabs and chips link to the matching hash", () => {
    saveRecap(bundle({ sample: true }));
    render(<RecapPage period="12m" />);
    expect(screen.getByRole("link", { name: "4 weeks" })).toHaveAttribute("href", "#/recap/4w");
    expect(screen.getByRole("link", { name: "All time" })).toHaveAttribute("href", "#/recap/all");
    expect(screen.getByRole("link", { name: "2024" })).toHaveAttribute("href", "#/recap/2024");
    expect(screen.getByRole("link", { name: "12 months" })).toHaveAttribute("aria-current", "page");
  });

  it("shows a year's stats and everything unlocked with a SAMPLE label in sample mode", () => {
    saveRecap(bundle({ sample: true }));
    render(<RecapPage period="2024" />);
    expect(screen.getByTestId("sample-label")).toHaveTextContent("SAMPLE");
    expect(screen.getByText("444")).toBeInTheDocument();
    expect(screen.queryByTestId("locked")).toBeNull();
  });

  it("locks years and all time without an unlock, with placeholder text only", () => {
    saveRecap(bundle());
    render(<RecapPage period="all" />);
    expect(screen.getByTestId("locked")).toBeInTheDocument();
    expect(screen.queryByText("999")).toBeNull();
    expect(screen.getByTestId("teaser-unlock")).toHaveAttribute("href", "#/unlock");
    expect(screen.getByTestId("teaser-hd")).toHaveAttribute("href", "#/unlock");
  });

  it("renders no real artist name or number from the bundle when locked, and chips tease the unlock", () => {
    const b = bundle();
    saveRecap(b);
    const { container } = render(<RecapPage period="2024" />);
    const text = container.textContent ?? "";
    const real = [b.allTime, ...Object.values(b.years)].flatMap((p) => [
      ...p.topArtists.map((a) => a.name),
      String(p.minutes),
      String(p.plays),
    ]);
    for (const r of real) expect(text).not.toContain(r);
    for (const c of screen.getAllByTestId("chip-teaser")) expect(c).toHaveAttribute("href", "#/unlock");
  });

  it("explains that years need the Extended history for Account-only imports", () => {
    saveRecap(bundle({ sources: ["account"], years: {} }));
    render(<RecapPage period="12m" />);
    expect(screen.getByTestId("years-need-extended")).toHaveTextContent(/Extended streaming history/);
  });

  it("shows an empty state without a stored recap", () => {
    render(<RecapPage period="2019" />);
    expect(screen.getByRole("heading", { level: 1, name: "2019" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Load my data" })).toBeInTheDocument();
  });
});

describe("recap storage", () => {
  it("keeps the recap in sessionStorage by default, aggregates only", () => {
    saveRecap(bundle());
    const raw = sessionStorage.getItem(RECAP_KEY);
    expect(raw).not.toBeNull();
    expect(localStorage.getItem(RECAP_KEY)).toBeNull();
    const stored = JSON.parse(raw as string);
    expect(Object.keys(stored).sort()).toEqual(["stats", "v"]);
    expect(raw).not.toMatch(/endMs|msPlayed/);
    expect(loadRecap()?.allTime.minutes).toBe(999);
  });

  it("moves the recap to localStorage when Keep my recap is ticked", () => {
    saveRecap(bundle());
    render(<RecapPage period="12m" />);
    fireEvent.click(screen.getByLabelText("Keep my recap on this device"));
    expect(localStorage.getItem(RECAP_KEY)).not.toBeNull();
    expect(sessionStorage.getItem(RECAP_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(PREFS_KEY) as string)).toEqual({ v: 1, keepRecap: true });
    fireEvent.click(screen.getByLabelText("Keep my recap on this device"));
    expect(sessionStorage.getItem(RECAP_KEY)).not.toBeNull();
    expect(localStorage.getItem(RECAP_KEY)).toBeNull();
  });
});

describe("Clear everything", () => {
  it("removes every lv.* key, terminates workers and returns to #/", () => {
    localStorage.setItem("lv.prefs.v1", "{}");
    localStorage.setItem("lv.unlock.v1", "{}");
    localStorage.setItem("other", "keep");
    sessionStorage.setItem("lv.recap.v1", "{}");
    sessionStorage.setItem("lv.pkce.v1", "{}");
    const terminate = vi.fn();
    registerWorkerTerminator(terminate);
    window.location.hash = "#/recap/12m";
    act(() => clearEverything());
    expect(Object.keys(localStorage)).toEqual(["other"]);
    expect(sessionStorage.length).toBe(0);
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("#/");
  });

  it("is wired to the button", () => {
    saveRecap(bundle());
    render(<RecapPage period="12m" />);
    fireEvent.click(screen.getByRole("button", { name: "Clear everything" }));
    expect(sessionStorage.getItem(RECAP_KEY)).toBeNull();
    expect(window.location.hash).toBe("#/");
  });
});
