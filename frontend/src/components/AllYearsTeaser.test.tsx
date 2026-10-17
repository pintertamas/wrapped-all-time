import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AllYearsTeaser from "./AllYearsTeaser";

describe("AllYearsTeaser", () => {
  beforeEach(() => localStorage.clear());
  it("explains limits and stores interest", () => {
    render(<AllYearsTeaser />);
    expect(screen.getByText(/Extended streaming history/)).toBeTruthy();
    fireEvent.click(screen.getByText(/All years/));
    expect(screen.getByText("This is where the $4.99 unlock would sit")).toBeTruthy();
    fireEvent.click(screen.getByText("Count me in"));
    expect(screen.getByText(/Thanks/)).toBeTruthy();
    expect(localStorage.getItem("wrapped-interest")).toBe("1");
  });
});
