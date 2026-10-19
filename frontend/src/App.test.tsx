import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";
import { config } from "./config";

function go(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

afterEach(() => {
  window.location.hash = "";
});

describe("App shell", () => {
  it("shows the landing view with the product name and import link", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: config.productName })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Load my data" })).toHaveAttribute("href", "#/import");
  });

  it("has the footer with the unaffiliated line and page links", () => {
    render(<App />);
    expect(screen.getByText(/Not affiliated with Spotify/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Export guide" })).toHaveAttribute("href", `${config.basePath}guide/`);
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", `${config.basePath}privacy/`);
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", `${config.basePath}terms/`);
    expect(screen.getByRole("link", { name: "Restore purchase" })).toHaveAttribute("href", "#/unlock");
  });

  it("serves every route from the hash", async () => {
    render(<App />);
    go("#/import");
    expect(screen.getByTestId("import")).toBeInTheDocument();
    go("#/recap/6m");
    expect(screen.getByRole("heading", { level: 1, name: "Last 6 months" })).toBeInTheDocument();
    go("#/recap/2019");
    expect(screen.getByRole("heading", { level: 1, name: "2019" })).toBeInTheDocument();
    go("#/recap/all");
    expect(screen.getByRole("heading", { level: 1, name: "All time" })).toBeInTheDocument();
    go("#/unlock");
    expect(await screen.findByTestId("unlock")).toHaveTextContent("Coming soon.");
    go("#/does-not-exist");
    expect(screen.getByRole("heading", { level: 1, name: config.productName })).toBeInTheDocument();
  });

  it("keeps no POC demo or fake Spotify-connect UI", () => {
    render(<App />);
    for (const hash of ["#/", "#/import", "#/recap/12m", "#/unlock"]) {
      go(hash);
      const text = document.body.textContent ?? "";
      expect(text).not.toMatch(/DEMO|Wrapped|Connect Spotify/i);
    }
  });
});
