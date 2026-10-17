import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";
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
