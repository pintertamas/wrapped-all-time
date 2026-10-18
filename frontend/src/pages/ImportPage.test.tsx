import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createImportClient, type WorkerLike } from "../import/client";
import type { FromWorker, ToWorker } from "../import/protocol";
import type { FileReport, ImportSummary } from "../model/types";
import ImportPage from "./ImportPage";
import Landing from "./Landing";

function fakeWorker() {
  const posted: ToWorker[] = [];
  const w: WorkerLike = {
    postMessage: (m) => { posted.push(m); },
    terminate: () => {},
    onmessage: null, onerror: null, onmessageerror: null,
  };
  const send = (m: FromWorker) => act(() => { w.onmessage?.({ data: m } as MessageEvent<FromWorker>); });
  return { w, posted, send };
}

function setup() {
  const workers: ReturnType<typeof fakeWorker>[] = [];
  const client = createImportClient(() => {
    const f = fakeWorker();
    workers.push(f);
    return f.w;
  });
  render(<ImportPage client={client} />);
  const cur = () => workers[workers.length - 1]!;
  return { client, cur };
}

const report = (over: Partial<FileReport> = {}): FileReport => ({
  name: "a.json", cls: "extended-audio", plays: 10, skippedRows: 0, duplicateOf: null, structure: null, ...over,
});
const summary = (over: Partial<ImportSummary> = {}): ImportSummary => ({
  sources: ["extended"], years: [2020, 2021], firstPlay: "2020-01-01", lastPlay: "2021-12-31",
  totalPlays: 1234, files: [report()], duplicatesSkipped: 0, overlapDropped: 0, ...over,
});
const file = (name: string) => new File(["[]"], name, { type: "application/json" });

async function startLoad(s: ReturnType<typeof setup>) {
  fireEvent.change(screen.getByTestId("file-input"), { target: { files: [file("a.json")] } });
  const w = s.cur();
  return { w, jobId: (w.posted[0] as { jobId: string }).jobId };
}

describe("ImportPage", () => {
  it("accepts zip/json, multiple, and runs the sample", async () => {
    const s = setup();
    const input = screen.getByTestId("file-input");
    expect(input).toHaveAttribute("accept", ".zip,.json,application/zip");
    expect(input).toHaveAttribute("multiple");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Try with sample data" })); });
    expect(s.cur().posted[0]).toMatchObject({ type: "loadSample" });
  });

  it("loads dropped files", () => {
    const s = setup();
    fireEvent.drop(screen.getByTestId("dropzone"), { dataTransfer: { files: [file("a.json"), file("b.json")] } });
    expect(s.cur().posted[0]).toMatchObject({ type: "load" });
    expect((s.cur().posted[0] as { files: File[] }).files).toHaveLength(2);
  });

  it("announces progress in a live region and cancels back to idle", async () => {
    const s = setup();
    const { w, jobId } = await startLoad(s);
    const live = screen.getByTestId("live");
    expect(live).toHaveAttribute("aria-live", "polite");
    w.send({ type: "progress", jobId, filesDone: 0, filesTotal: 2, currentFile: "a.json", bytesDone: 50, bytesTotal: 100 });
    expect(live).toHaveTextContent("Reading file 1 of 2, 50 percent");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cancel" })); });
    expect(live).toHaveTextContent("Import cancelled");
    expect(screen.getByTestId("dropzone")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("shows the summary with duplicates skipped and unrecognised files", async () => {
    const s = setup();
    const { w, jobId } = await startLoad(s);
    w.send({
      type: "done", jobId, stats: {} as never,
      summary: summary({
        duplicatesSkipped: 2,
        files: [report(), report({ name: "weird.json", cls: "unrecognised" })],
      }),
    });
    expect(screen.getByText("Import complete", { selector: "h2" })).toBeInTheDocument();
    expect(screen.getByTestId("duplicates")).toHaveTextContent("2 duplicate files skipped");
    expect(screen.getByTestId("unrecognised")).toHaveTextContent("weird.json");
    expect(screen.getByRole("link", { name: "See my recap" })).toHaveAttribute("href", "#/recap/12m");
  });

  it.each([
    ["no-history-files", "No listening history found"],
    ["invalid-zip", "That ZIP could not be opened"],
    ["invalid-json", "A file could not be read"],
    ["out-of-memory", "Not enough memory"],
    ["unknown", "Something went wrong"],
  ] as const)("shows the %s error without crashing and can retry", async (code, title) => {
    const s = setup();
    const { w, jobId } = await startLoad(s);
    w.send({ type: "error", jobId, code, summary: null });
    expect(screen.getByRole("alert")).toHaveTextContent(title);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Try again" })); });
    expect(screen.getByTestId("dropzone")).toBeInTheDocument();
  });

  it("lists unrecognised files in the no-history error", async () => {
    const s = setup();
    const { w, jobId } = await startLoad(s);
    w.send({
      type: "error", jobId, code: "no-history-files",
      summary: summary({ totalPlays: 0, files: [report({ name: "x.json", cls: "unrecognised" })] }),
    });
    expect(screen.getByTestId("unrecognised")).toHaveTextContent("x.json");
  });

  it("copies only StructureInfo (canary values never copied)", async () => {
    const s = setup();
    const { w, jobId } = await startLoad(s);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const leaky = report({
      name: "CANARY-PLAY-NAME.json", cls: "unrecognised", plays: 987654,
      structure: { fileName: "f.json", topLevel: "array", firstItemKeys: ["ts", "ms_played"], sizeBucket: "<1MB" },
    });
    (leaky.structure as unknown as Record<string, unknown>).value = "CANARY-VALUE";
    w.send({ type: "done", jobId, stats: {} as never, summary: summary({ files: [leaky] }) });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy file info" })); });
    const text = writeText.mock.calls[0]![0] as string;
    expect(JSON.parse(text)).toEqual([
      { fileName: "f.json", topLevel: "array", firstItemKeys: ["ts", "ms_played"], sizeBucket: "<1MB" },
    ]);
    expect(text).not.toContain("CANARY");
    expect(text).not.toContain("987654");
  });
});

describe("Landing", () => {
  it("offers only the export door, no login", () => {
    render(<Landing />);
    expect(screen.getByRole("link", { name: "Load my data" })).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(/log ?in|sign ?in|connect spotify|password/i);
  });
});
