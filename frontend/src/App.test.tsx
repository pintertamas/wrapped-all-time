import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { isConnected } from "./lib/session";
import { DEMO_BANNER_TEXT } from "./DemoBanner";

describe("App", () => {
  it("shows the persistent demo banner", () => {
    render(<App />);
    const banner = screen.getByTestId("demo-banner");
    expect(banner).toHaveTextContent(DEMO_BANNER_TEXT);
    expect(DEMO_BANNER_TEXT).toBe("DEMO - not connected to Spotify");
  });

  it("shows the product name", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Wrapped Vault" })).toBeInTheDocument();
  });
});

describe("fake login flow", () => {
  beforeEach(() => localStorage.clear());

  it("approves through the mock consent and sets the flag without network", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<App />);
    expect(screen.getByText(/Unaffiliated with Spotify/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect Spotify (demo)" }));
    expect(screen.getByText("DEMO MOCK, no data leaves your device")).toBeInTheDocument();
    expect(screen.getByText("user-top-read")).toBeInTheDocument();
    expect(screen.getByText("user-read-recently-played")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(isConnected()).toBe(true);
    expect(screen.getByTestId("recap-placeholder")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("cancel returns to the landing page without setting the flag", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Connect Spotify (demo)" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(isConnected()).toBe(false);
    expect(screen.getByRole("button", { name: "Connect Spotify (demo)" })).toBeInTheDocument();
  });
});
