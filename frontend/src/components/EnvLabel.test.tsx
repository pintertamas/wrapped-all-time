import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EnvLabel from "./EnvLabel";

describe("EnvLabel", () => {
  it("shows the label text", () => {
    render(<EnvLabel label="TEST SITE" />);
    expect(screen.getByRole("note")).toHaveTextContent("TEST SITE");
  });

  it("renders nothing without a label", () => {
    const { container } = render(<EnvLabel label="" />);
    expect(container).toBeEmptyDOMElement();
  });
});
