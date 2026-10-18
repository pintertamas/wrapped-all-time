// The import pipeline: read the chosen files, stream-unzip ZIPs one entry at a time, parse each
// JSON file, run the adapters (field allow-list), de-dupe, and keep plays in a columnar store.
// Pure of any I/O except reading the given files; runs inside the Web Worker (parse.worker.ts)
// and in unit tests. Nothing here touches the network.
import { Unzip, UnzipInflate, UnzipPassThrough, type UnzipFile } from "fflate";
import type {
  ExportKind, FileClass, FileReport, ImportErrorCode, ImportSummary, PeriodStats, StatsBundle,
} from "../model/types";
import type { FromWorker, ToWorker } from "./protocol";
import { adaptAccountMusic, adaptAccountPodcast } from "./adapters/account";
import { adaptExtendedAudio } from "./adapters/extended";
import type { AdapterResult } from "./adapters/types";
import { buildStructureInfo, classify } from "./classify";
import { dropAccountOverlap, FileDeduper, PlayDeduper } from "./dedupe";
import { PlayStore } from "./store";

const MB = 1024 * 1024;
/** Read chunk size for files and ZIPs. */
export const CHUNK_BYTES = 1 * MB;
/**
 * Largest single JSON file we try to hold (inflated). V8 cannot build strings much beyond
 * ~512 MB, and a phone runs out of memory long before; past this we report out-of-memory.
 */
export const MAX_ENTRY_BYTES = 400 * MB;
/** At most 8 progress messages per second (protocol allows 10). */
export const PROGRESS_INTERVAL_MS = 125;

/** The slice of the File API the pipeline needs (a File satisfies it). */
export interface InputFile {
  name: string;
  size: number;
  slice(start: number, end: number): { arrayBuffer(): Promise<ArrayBuffer> };
}

export interface ProgressInfo {
  filesDone: number;
  filesTotal: number;
  currentFile: string;
  bytesDone: number;
  bytesTotal: number;
}

export interface PipelineOptions {
  tz: string;
  signal?: AbortSignal;
  onProgress?: (p: ProgressInfo) => void;
  chunkBytes?: number;
  maxEntryBytes?: number;
}

export interface PipelineResult {
  summary: ImportSummary;
  /** Stays inside the worker. */
  store: PlayStore;
}

export class ImportError extends Error {
  constructor(readonly code: ImportErrorCode, readonly summary: ImportSummary | null = null, message?: string) {
    super(message ?? code);
    this.name = "ImportError";
  }
}

const HISTORY: FileClass[] = ["account-music", "account-podcast", "extended-audio"];
const IGNORED: FileClass[] = ["extended-video", "spotify-other"];

function baseName(name: string): string {
  const parts = name.split(/[\\/]/);
  return parts[parts.length - 1] ?? name;
}

function isZipMagic(b: Uint8Array): boolean {
  return b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5) && (b[3] === 4 || b[3] === 6);
}

/** Collects the chunks of one inflated JSON file; released as soon as it is parsed. */
class Collector {
  private chunks: Uint8Array[] = [];
  private bytes = 0;
  constructor(private readonly max: number) {}

  push(chunk: Uint8Array): void {
    this.bytes += chunk.length;
    if (this.bytes > this.max) throw new ImportError("out-of-memory", null, "file too large to hold in memory");
    this.chunks.push(chunk);
  }

  get size(): number {
    return this.bytes;
  }

  take(): Uint8Array {
    const out = this.chunks.length === 1 ? this.chunks[0]! : new Uint8Array(this.bytes);
    if (this.chunks.length > 1) {
      let at = 0;
      for (const c of this.chunks) { out.set(c, at); at += c.length; }
    }
    this.chunks = [];
    this.bytes = 0;
    return out;
  }
}

class Run {
  readonly store = new PlayStore();
  readonly plays = new PlayDeduper(this.store);
  readonly files = new FileDeduper();
  readonly reports: FileReport[] = [];
  duplicatePlays = 0;
  overlapDropped = 0;
  sawInvalidUnrecognised = false;
  private filesDone = 0;
  private bytesDone = 0;
  private currentFile = "";
  private readonly bytesTotal: number;

  constructor(private readonly inputs: InputFile[], readonly opts: Required<Pick<PipelineOptions, "chunkBytes" | "maxEntryBytes">> & PipelineOptions) {
    this.bytesTotal = inputs.reduce((sum, f) => sum + f.size, 0);
  }

  checkCancelled(): void {
    if (this.opts.signal?.aborted) throw new ImportError("cancelled");
  }

  emit(): void {
    this.opts.onProgress?.({
      filesDone: this.filesDone, filesTotal: this.inputs.length, currentFile: this.currentFile,
      bytesDone: Math.min(this.bytesDone, this.bytesTotal), bytesTotal: this.bytesTotal,
    });
  }

  start(name: string): void {
    this.currentFile = name;
    this.emit();
  }

  addBytes(n: number): void {
    this.bytesDone += n;
    this.emit();
  }

  setCurrent(name: string): void {
    this.currentFile = name;
  }

  fileDone(): void {
    this.filesDone++;
    this.emit();
  }

  /** Summary of everything read so far (also attached to errors). */
  summary(): ImportSummary {
    const store = this.store;
    const counts = store.countBySource();
    const sources = (["account", "extended"] as ExportKind[]).filter((s) => counts[s] > 0);
    const range = store.range();
    const tz = this.opts.tz;
    return {
      sources,
      years: range === null ? [] : yearsWithData(store, tz),
      firstPlay: range === null ? "" : localIsoDate(range.min, tz),
      lastPlay: range === null ? "" : localIsoDate(range.max, tz),
      totalPlays: store.length,
      files: this.reports,
      // Duplicate plays dropped by rule 2. Skipped duplicate files (rule 1) are in files[].duplicateOf.
      duplicatesSkipped: this.duplicatePlays,
      overlapDropped: this.overlapDropped,
    };
  }

  /** Parses one inflated/loaded JSON file and ingests its plays. */
  ingestJson(name: string, bytes: Uint8Array): void {
    const size = bytes.length;
    let parsed: unknown;
    let invalid = false;
    try {
      parsed = JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
      invalid = true;
    }
    const byName = classify(name);
    const named = HISTORY.includes(byName);
    const rows = Array.isArray(parsed) ? (parsed as unknown[]) : null;
    if (invalid || rows === null) {
      this.reports.push({
        name, cls: named ? byName : "unrecognised", plays: 0, skippedRows: 0, duplicateOf: null,
        structure: buildStructureInfo(name, parsed, size, invalid),
      });
      if (named) throw new ImportError("invalid-json", this.summary(), `${name} is not a JSON array`);
      if (invalid) this.sawInvalidUnrecognised = true;
      return;
    }
    const cls = byName === "unrecognised" ? classify(name, rows[0]) : byName;
    let result: AdapterResult | null = null;
    if (cls === "account-music") result = adaptAccountMusic(rows);
    else if (cls === "account-podcast") result = adaptAccountPodcast(rows);
    else if (cls === "extended-audio") result = adaptExtendedAudio(rows);
    if (result === null) {
      this.reports.push({
        name, cls, plays: 0, skippedRows: 0, duplicateOf: null,
        structure: cls === "unrecognised" ? buildStructureInfo(name, parsed, size) : null,
      });
      return;
    }
    let added = 0;
    for (const play of result.plays) {
      if (this.plays.add(play)) added++;
      else this.duplicatePlays++;
    }
    this.reports.push({
      name, cls, plays: added, skippedRows: result.skippedRows, duplicateOf: null, structure: null,
    });
  }

  reportIgnored(name: string, cls: FileClass): void {
    this.reports.push({ name, cls, plays: 0, skippedRows: 0, duplicateOf: null, structure: null });
  }

  reportDuplicate(name: string, cls: FileClass, earlier: string): void {
    this.reports.push({ name, cls, plays: 0, skippedRows: 0, duplicateOf: earlier, structure: null });
  }
}

async function readChunk(file: InputFile, start: number, end: number): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(start, end).arrayBuffer());
}

/** A loose (non-ZIP) file chosen by the user. */
async function ingestLooseFile(run: Run, file: InputFile, first: Uint8Array): Promise<void> {
  const { chunkBytes, maxEntryBytes } = run.opts;
  const byName = classify(file.name);
  if (IGNORED.includes(byName)) {
    run.reportIgnored(file.name, byName);
    run.addBytes(file.size);
    return;
  }
  if (!file.name.toLowerCase().endsWith(".json")) {
    run.reports.push({
      name: file.name, cls: "unrecognised", plays: 0, skippedRows: 0, duplicateOf: null,
      structure: buildStructureInfo(file.name, undefined, file.size),
    });
    run.addBytes(file.size);
    return;
  }
  const collector = new Collector(maxEntryBytes);
  collector.push(first);
  run.addBytes(first.length);
  for (let at = first.length; at < file.size; at += chunkBytes) {
    run.checkCancelled();
    const chunk = await readChunk(file, at, Math.min(at + chunkBytes, file.size));
    collector.push(chunk);
    run.addBytes(chunk.length);
  }
  run.checkCancelled();
  run.ingestJson(file.name, collector.take());
}

/** A ZIP: pushed through fflate's streaming Unzip chunk by chunk; one entry inflates at a time. */
async function ingestZip(run: Run, file: InputFile, first: Uint8Array): Promise<void> {
  const { chunkBytes, maxEntryBytes } = run.opts;
  let entries = 0;
  let unfinished = 0;
  // fflate re-wraps errors thrown from its callbacks, so failures are recorded here and
  // rethrown (with their type) as soon as push() returns; later callbacks are ignored.
  let failure: unknown = null;
  const guard = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A): void => {
    if (failure !== null) return;
    try {
      fn(...args);
    } catch (e) {
      failure = e;
    }
  };
  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.register(UnzipPassThrough);
  unzip.onfile = guard((entry: UnzipFile) => {
    entries++;
    const name = entry.name;
    const lower = name.toLowerCase();
    const base = baseName(name);
    const isJson = lower.endsWith(".json") && !lower.startsWith("__macosx/") && !base.startsWith("._");
    const cls = isJson ? classify(name) : "unrecognised";
    // Entries we do not read are still started and discarded: Unzip buffers the data of
    // unstarted entries, which would keep them in memory.
    if (!isJson || IGNORED.includes(cls)) {
      if (isJson) run.reportIgnored(name, cls);
      entry.ondata = guard((err) => { if (err) throw new ImportError("invalid-zip", null, String(err)); });
      entry.start();
      return;
    }
    if (entry.originalSize !== undefined) {
      const earlier = run.files.check(name, entry.originalSize);
      if (earlier !== null) {
        run.reportDuplicate(name, cls, earlier);
        entry.ondata = () => {};
        entry.start();
        return;
      }
    }
    const collector = new Collector(maxEntryBytes);
    unfinished++;
    run.setCurrent(name);
    entry.ondata = guard((err, data, final) => {
      if (err) throw new ImportError("invalid-zip", null, String(err));
      collector.push(data);
      if (!final) return;
      unfinished--;
      // The inflated file is parsed and released before the next entry starts inflating.
      run.ingestJson(name, collector.take());
    });
    entry.start();
  });

  const total = file.size;
  let pushed = 0;
  let chunk = first;
  for (;;) {
    const last = pushed + chunk.length >= total;
    try {
      unzip.push(chunk, last);
    } catch (e) {
      failure ??= new ImportError("invalid-zip", null, e instanceof Error ? e.message : String(e));
    }
    if (failure !== null) throw failure;
    pushed += chunk.length;
    run.addBytes(chunk.length);
    run.checkCancelled();
    if (last) break;
    chunk = await readChunk(file, pushed, Math.min(pushed + chunkBytes, total));
  }
  if (entries === 0 || unfinished > 0) {
    throw new ImportError("invalid-zip", null, entries === 0 ? "no entries in ZIP" : "ZIP ended inside a file");
  }
}

/** Runs the import. Resolves with the summary and the play store, or rejects with ImportError. */
export async function runPipeline(inputs: InputFile[], options: PipelineOptions): Promise<PipelineResult> {
  const run = new Run(inputs, {
    ...options, chunkBytes: options.chunkBytes ?? CHUNK_BYTES, maxEntryBytes: options.maxEntryBytes ?? MAX_ENTRY_BYTES,
  });
  try {
    for (const file of inputs) {
      run.checkCancelled();
      run.start(file.name);
      const dup = run.files.check(file.name, file.size);
      if (dup !== null) {
        run.reportDuplicate(file.name, classify(file.name), dup);
        run.addBytes(file.size);
        run.fileDone();
        continue;
      }
      const first = file.size === 0 ? new Uint8Array(0) : await readChunk(file, 0, Math.min(run.opts.chunkBytes, file.size));
      const looksZip = isZipMagic(first);
      if (looksZip) await ingestZip(run, file, first);
      else if (file.name.toLowerCase().endsWith(".zip")) throw new ImportError("invalid-zip", null, "not a ZIP file");
      else await ingestLooseFile(run, file, first);
      run.fileDone();
    }
    run.checkCancelled();
    if (run.store.length === 0) {
      throw new ImportError(run.sawInvalidUnrecognised ? "invalid-json" : "no-history-files");
    }
    run.overlapDropped = dropAccountOverlap(run.store);
    return { summary: run.summary(), store: run.store };
  } catch (e) {
    throw toImportError(e, run);
  }
}

function toImportError(e: unknown, run: Run): ImportError {
  if (e instanceof ImportError) {
    return e.summary !== null || e.code === "cancelled" ? e : new ImportError(e.code, run.summary(), e.message);
  }
  // Allocation failures (typed arrays, strings, JSON.parse) surface as RangeError.
  if (e instanceof RangeError || (e instanceof Error && e.name === "QuotaExceededError")) {
    return new ImportError("out-of-memory", run.summary(), e.message);
  }
  return new ImportError("unknown", null, e instanceof Error ? e.message : String(e));
}

// ---------- dates in the user's time zone ----------

function localParts(ms: number, tz: string): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

function offsetMs(ms: number, tz: string): number {
  const p = localParts(ms, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

/** ISO date (YYYY-MM-DD) of an instant in the given IANA time zone. */
export function localIsoDate(ms: number, tz: string): string {
  const p = localParts(ms, tz);
  return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function startOfYear(year: number, tz: string): number {
  const guess = Date.UTC(year, 0, 1);
  const first = guess - offsetMs(guess, tz);
  return guess - offsetMs(first, tz);
}

/** Calendar years (local time) that contain at least one play, ascending. */
export function yearsWithData(store: PlayStore, tz: string): number[] {
  const range = store.range();
  if (range === null) return [];
  const y0 = localParts(range.min, tz).year;
  const y1 = localParts(range.max, tz).year;
  const starts: number[] = [];
  for (let y = y0; y <= y1; y++) starts.push(startOfYear(y, tz));
  const has = new Array<boolean>(starts.length).fill(false);
  for (let i = 0; i < store.length; i++) {
    const t = store.endMs(i);
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid]! <= t) lo = mid; else hi = mid - 1;
    }
    has[lo] = true;
  }
  const out: number[] = [];
  has.forEach((h, k) => { if (h) out.push(y0 + k); });
  return out;
}

// ---------- worker glue ----------

function emptyPeriod(from: string, to: string): PeriodStats {
  return {
    from, to, minutes: 0, plays: 0, podcastMinutes: 0, topArtists: [], topTracks: [], topAlbums: null,
    topDay: null, longestStreakDays: 0, activeDays: 0, firstTrack: null, skipRate: null,
    hourMinutes: new Array<number>(24).fill(0),
  };
}

/**
 * Aggregate placeholder: a valid StatsBundle v1 with empty periods. The stats engine
 * (src/stats) replaces this; until then only counts and dates are real.
 */
export function placeholderStats(summary: ImportSummary, tz: string): StatsBundle {
  const empty = emptyPeriod(summary.lastPlay, summary.lastPlay);
  return {
    version: 1, tz, sources: summary.sources, sample: false, latestPlay: summary.lastPlay,
    periods: { "4w": empty, "6m": { ...empty, hourMinutes: [...empty.hourMinutes] }, "12m": { ...empty, hourMinutes: [...empty.hourMinutes] } },
    years: {},
    allTime: emptyPeriod(summary.firstPlay, summary.lastPlay),
  };
}

/** Sends at most one progress message per interval; the rest are dropped. */
export function throttleProgress(
  send: (p: ProgressInfo) => void, now: () => number = () => Date.now(), intervalMs = PROGRESS_INTERVAL_MS,
): (p: ProgressInfo) => void {
  let last = -Infinity;
  return (p) => {
    const t = now();
    if (t - last < intervalMs) return;
    last = t;
    send(p);
  };
}

export interface HandlerDeps {
  now?: () => number;
  run?: typeof runPipeline;
}

function validTz(tz: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/**
 * Message handler of the parse worker: implements the Worker protocol. Only progress
 * counters, ImportSummary and the aggregate bundle are ever posted; the play store never leaves.
 */
export function createWorkerHandler(post: (m: FromWorker) => void, deps: HandlerDeps = {}): (msg: ToWorker) => Promise<void> {
  const jobs = new Map<string, AbortController>();
  const run = deps.run ?? runPipeline;

  async function load(jobId: string, files: File[], tzRaw: string): Promise<void> {
    for (const [id, c] of jobs) { c.abort(); jobs.delete(id); }
    const controller = new AbortController();
    jobs.set(jobId, controller);
    const tz = validTz(tzRaw);
    const onProgress = throttleProgress(
      (p) => post({ type: "progress", jobId, ...p }), deps.now,
    );
    try {
      const { summary } = await run(files, { tz, signal: controller.signal, onProgress });
      if (controller.signal.aborted) post({ type: "cancelled", jobId });
      else post({ type: "done", jobId, summary, stats: placeholderStats(summary, tz) });
    } catch (e) {
      if (e instanceof ImportError && e.code === "cancelled") post({ type: "cancelled", jobId });
      else if (e instanceof ImportError) post({ type: "error", jobId, code: e.code, summary: e.summary });
      else post({ type: "error", jobId, code: "unknown", summary: null });
    } finally {
      jobs.delete(jobId);
    }
  }

  return async (msg) => {
    switch (msg.type) {
      case "load":
        return load(msg.jobId, msg.files, msg.tz);
      case "loadSample":
        // The seeded sample generator lands with its own task; until then report it as unavailable.
        post({ type: "error", jobId: msg.jobId, code: "unknown", summary: null });
        return;
      case "cancel":
        jobs.get(msg.jobId)?.abort();
        return;
    }
  };
}
