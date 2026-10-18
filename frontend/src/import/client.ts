// Main-thread import client: owns the parse worker, relays progress and results, and on cancel
// terminates the worker and starts a fresh one. Framework-free; the import page wraps it in a hook.
// Only aggregates (ImportSummary, StatsBundle) ever arrive here, never raw plays.
import type { ImportErrorCode, ImportSummary, StatsBundle } from "../model/types";
import type { FromWorker, ToWorker } from "./protocol";

export interface ImportProgress {
  filesDone: number;
  filesTotal: number;
  currentFile: string;
  bytesDone: number;
  bytesTotal: number;
}

export type ImportState =
  | { status: "idle" }
  | { status: "running"; jobId: string; progress: ImportProgress | null }
  | { status: "done"; jobId: string; summary: ImportSummary; stats: StatsBundle }
  | { status: "error"; jobId: string; code: ImportErrorCode; summary: ImportSummary | null }
  | { status: "cancelled" };

/** The part of the Worker API the client uses. */
export interface WorkerLike {
  postMessage(message: ToWorker): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<FromWorker>) => void) | null;
  onerror: ((event: Event) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
}

export function createParseWorker(): WorkerLike {
  return new Worker(new URL("./parse.worker.ts", import.meta.url), { type: "module" }) as WorkerLike;
}

export interface ImportClient {
  getState(): ImportState;
  subscribe(listener: () => void): () => void;
  load(files: File[], tz?: string): void;
  loadSample(seed: number, tz?: string): void;
  /** Terminates the running worker and starts a fresh one; state becomes "cancelled". */
  cancel(): void;
  /** Back to idle (after done, error or cancelled). */
  reset(): void;
  dispose(): void;
}

function defaultTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function createImportClient(makeWorker: () => WorkerLike = createParseWorker): ImportClient {
  let state: ImportState = { status: "idle" };
  let worker: WorkerLike | null = null;
  let jobCounter = 0;
  let currentJob: string | null = null;
  let disposed = false;
  const listeners = new Set<() => void>();

  const set = (next: ImportState) => {
    state = next;
    for (const l of [...listeners]) l();
  };

  const onMessage = (event: MessageEvent<FromWorker>) => {
    const m = event.data;
    if (m.jobId !== currentJob) return;     // stale message from a cancelled job
    switch (m.type) {
      case "progress":
        set({
          status: "running", jobId: m.jobId,
          progress: {
            filesDone: m.filesDone, filesTotal: m.filesTotal, currentFile: m.currentFile,
            bytesDone: m.bytesDone, bytesTotal: m.bytesTotal,
          },
        });
        break;
      case "done":
        currentJob = null;
        set({ status: "done", jobId: m.jobId, summary: m.summary, stats: m.stats });
        break;
      case "error":
        currentJob = null;
        set({ status: "error", jobId: m.jobId, code: m.code, summary: m.summary });
        break;
      case "cancelled":
        currentJob = null;
        set({ status: "cancelled" });
        break;
    }
  };

  const fail = () => {
    if (currentJob === null) return;
    const jobId = currentJob;
    currentJob = null;
    // A crashed worker (for example killed for memory) is replaced so the next import works.
    spawn();
    set({ status: "error", jobId, code: "unknown", summary: null });
  };

  function spawn(): WorkerLike {
    worker?.terminate();
    const w = makeWorker();
    w.onmessage = onMessage;
    w.onerror = fail;
    w.onmessageerror = fail;
    worker = w;
    return w;
  }

  function start(build: (jobId: string) => ToWorker): void {
    if (disposed) return;
    if (currentJob !== null) return;        // one import at a time
    const w = worker ?? spawn();
    const jobId = `job-${++jobCounter}`;
    currentJob = jobId;
    set({ status: "running", jobId, progress: null });
    w.postMessage(build(jobId));
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    load: (files, tz = defaultTz()) => start((jobId) => ({ type: "load", jobId, files, tz })),
    loadSample: (seed, tz = defaultTz()) => start((jobId) => ({ type: "loadSample", jobId, seed, tz })),
    cancel() {
      if (disposed || currentJob === null) return;
      currentJob = null;
      spawn();                              // terminates the busy worker, starts a fresh one
      set({ status: "cancelled" });
    },
    reset() {
      if (state.status !== "running") set({ status: "idle" });
    },
    dispose() {
      disposed = true;
      currentJob = null;
      worker?.terminate();
      worker = null;
      listeners.clear();
    },
  };
}
