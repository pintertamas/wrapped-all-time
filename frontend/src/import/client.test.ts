import { describe, expect, it, vi } from "vitest";
import { createImportClient, type WorkerLike } from "./client";
import type { FromWorker, ToWorker } from "./protocol";
import type { ImportSummary, StatsBundle } from "../model/types";

class FakeWorker implements WorkerLike {
  sent: ToWorker[] = [];
  terminated = false;
  onmessage: WorkerLike["onmessage"] = null;
  onerror: WorkerLike["onerror"] = null;
  onmessageerror: WorkerLike["onmessageerror"] = null;
  postMessage(m: ToWorker) { this.sent.push(m); }
  terminate() { this.terminated = true; }
  emit(m: FromWorker) { this.onmessage?.({ data: m } as MessageEvent<FromWorker>); }
}

const summary = { sources: ["account"], years: [2023], firstPlay: "2023-03-01", lastPlay: "2023-03-03", totalPlays: 2, files: [], duplicatesSkipped: 0, overlapDropped: 0 } as ImportSummary;
const stats = { version: 1 } as StatsBundle;

function setup() {
  const workers: FakeWorker[] = [];
  const client = createImportClient(() => { const w = new FakeWorker(); workers.push(w); return w; });
  return { client, workers };
}

describe("import client", () => {
  it("starts a job, relays progress and the result", () => {
    const { client, workers } = setup();
    const states: string[] = [];
    client.subscribe(() => states.push(client.getState().status));
    client.load([new File(["[]"], "a.json")], "UTC");
    const w = workers[0]!;
    const msg = w.sent[0]!;
    expect(msg).toMatchObject({ type: "load", tz: "UTC" });
    const jobId = msg.jobId;
    w.emit({ type: "progress", jobId, filesDone: 0, filesTotal: 1, currentFile: "a.json", bytesDone: 1, bytesTotal: 2 });
    expect(client.getState()).toMatchObject({ status: "running", progress: { bytesDone: 1 } });
    w.emit({ type: "done", jobId, summary, stats });
    expect(client.getState()).toMatchObject({ status: "done", summary });
    expect(states).toEqual(["running", "running", "done"]);
    client.reset();
    expect(client.getState().status).toBe("idle");
  });

  it("surfaces worker errors with the code and summary", () => {
    const { client, workers } = setup();
    client.load([], "UTC");
    const jobId = workers[0]!.sent[0]!.jobId;
    workers[0]!.emit({ type: "error", jobId, code: "invalid-zip", summary: null });
    expect(client.getState()).toMatchObject({ status: "error", code: "invalid-zip", summary: null });
  });

  it("cancel terminates the worker, starts a fresh one and ignores stale messages", () => {
    const { client, workers } = setup();
    client.load([], "UTC");
    const first = workers[0]!;
    const staleJob = first.sent[0]!.jobId;
    client.cancel();
    expect(first.terminated).toBe(true);
    expect(workers).toHaveLength(2);
    expect(workers[1]!.terminated).toBe(false);
    expect(client.getState().status).toBe("cancelled");
    first.emit({ type: "done", jobId: staleJob, summary, stats });
    expect(client.getState().status).toBe("cancelled");
    // the next import runs on the fresh worker
    client.load([], "UTC");
    expect(workers).toHaveLength(2);
    expect(workers[1]!.sent[0]).toMatchObject({ type: "load" });
    expect(workers[1]!.sent[0]!.jobId).not.toBe(staleJob);
  });

  it("replaces a crashed worker and reports unknown", () => {
    const { client, workers } = setup();
    client.load([], "UTC");
    workers[0]!.onerror?.(new Event("error"));
    expect(client.getState()).toMatchObject({ status: "error", code: "unknown" });
    expect(workers[0]!.terminated).toBe(true);
    expect(workers).toHaveLength(2);
  });

  it("runs one import at a time and sends loadSample", () => {
    const { client, workers } = setup();
    client.loadSample(7, "UTC");
    client.load([], "UTC");
    expect(workers[0]!.sent).toHaveLength(1);
    expect(workers[0]!.sent[0]).toMatchObject({ type: "loadSample", seed: 7 });
  });

  it("dispose terminates the worker", () => {
    const { client, workers } = setup();
    client.load([], "UTC");
    const spy = vi.fn();
    client.subscribe(spy);
    client.dispose();
    expect(workers[0]!.terminated).toBe(true);
  });
});
