import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sampleProfile } from "../data/sampleProfile";
import { recap } from "../lib/recap";
import { CARD_HEIGHT, CARD_WIDTH } from "../lib/shareCard";
import ShareCardButton from "./ShareCardButton";

const texts: string[] = [];
const fakeCtx = new Proxy(
  {},
  {
    get: (_t, k) => {
      if (k === "measureText") return (s: string) => ({ width: s.length });
      if (k === "fillText") return (s: string) => void texts.push(s);
      if (k === "createLinearGradient") return () => ({ addColorStop() {} });
      return () => {};
    },
    set: () => true,
  },
);

afterEach(() => {
  vi.restoreAllMocks();
  texts.length = 0;
});

describe("ShareCardButton", () => {
  it("renders a 1080x1920 card with watermark and shows it in a modal", () => {
    let size = [0, 0];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      size = [this.width, this.height];
      return fakeCtx as unknown as CanvasRenderingContext2D;
    });
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,AAAA");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const r = recap(sampleProfile, "long_term");
    render(<ShareCardButton recap={r} title="Your last year" />);
    fireEvent.click(screen.getByRole("button", { name: "Share card" }));

    expect(size).toEqual([CARD_WIDTH, CARD_HEIGHT]);
    expect(texts).toContain("DEMO");
    expect(texts.some((t) => t.includes(r.topArtists[0].name))).toBe(true);
    expect(texts.some((t) => t.includes(r.topTracks[2].name))).toBe(true);
    expect(texts.join(" ")).not.toMatch(/^Spotify$/m);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute("download");
    expect(fetchSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
