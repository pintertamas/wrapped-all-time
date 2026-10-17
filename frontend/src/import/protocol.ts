// Worker protocol. Normative contract: eng/frontend.md § Worker protocol (keep in sync, exactly).
// The worker is created with
//   new Worker(new URL("./parse.worker.ts", import.meta.url), { type: "module" })
// and cancel terminates it and starts a fresh one.
import type { ImportErrorCode, ImportSummary, StatsBundle } from "../model/types";

export type ToWorker =
  | { type: "load"; jobId: string; files: File[]; tz: string }
  | { type: "loadSample"; jobId: string; seed: number; tz: string }
  | { type: "cancel"; jobId: string };
export type FromWorker =
  | { type: "progress"; jobId: string; filesDone: number; filesTotal: number;
      currentFile: string; bytesDone: number; bytesTotal: number }      // throttled to <= 10/s
  | { type: "done"; jobId: string; summary: ImportSummary; stats: StatsBundle }
  | { type: "error"; jobId: string; code: ImportErrorCode; summary: ImportSummary | null }
  | { type: "cancelled"; jobId: string };
