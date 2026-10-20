import { useEffect, useRef, useState, type DragEvent } from "react";
import { config } from "../config";
import type { ImportClient, ImportProgress } from "../import/client";
import { useImport } from "../import/useImport";
import type { FileReport, ImportErrorCode, ImportSummary, StructureInfo } from "../model/types";
import { routeToHash } from "../router";
import { saveRecap } from "../storage/recap";

const ACCEPT = ".zip,.json,application/zip";
const SAMPLE_SEED = 1;

const ERROR_TEXT: Record<ImportErrorCode, { title: string; body: string }> = {
  "no-history-files": {
    title: "No listening history found",
    body: "These files do not contain streaming history. Request \"Account data\" or \"Extended streaming history\" from Spotify and load that ZIP.",
  },
  "invalid-zip": {
    title: "That ZIP could not be opened",
    body: "The file looks damaged or is not a ZIP. Download it again from Spotify, or load the JSON files from inside it.",
  },
  "invalid-json": {
    title: "A file could not be read",
    body: "One of the JSON files is damaged. Download your export again and retry.",
  },
  "out-of-memory": {
    title: "Not enough memory",
    body: "This device ran out of memory. Close other tabs, or load the files one at a time.",
  },
  cancelled: { title: "Import cancelled", body: "Nothing was loaded." },
  unknown: { title: "Something went wrong", body: "The import stopped unexpectedly. Please try again." },
};

function percent(p: ImportProgress | null): number {
  if (!p || p.bytesTotal <= 0) return 0;
  return Math.min(100, Math.round((p.bytesDone / p.bytesTotal) * 100));
}

/** The only text "Copy file info" ever produces: structure, never values. */
export function structureText(reports: FileReport[]): string {
  const infos: StructureInfo[] = [];
  for (const r of reports) {
    if (r.structure) {
      infos.push({
        fileName: r.structure.fileName,
        topLevel: r.structure.topLevel,
        firstItemKeys: [...r.structure.firstItemKeys],
        sizeBucket: r.structure.sizeBucket,
      });
    }
  }
  return JSON.stringify(infos, null, 2);
}

function CopyInfo({ reports }: { reports: FileReport[] }) {
  const [copied, setCopied] = useState<"idle" | "ok" | "failed">("idle");
  if (!reports.some((r) => r.structure)) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(structureText(reports));
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
  };
  return (
    <p>
      <button type="button" className="btn" onClick={copy}>
        Copy file info
      </button>{" "}
      <span className="note" role="status">
        {copied === "ok" && "Copied. It holds field names and size only, no listening data."}
        {copied === "failed" && "Could not copy on this device."}
      </span>
    </p>
  );
}

function FileList({ files }: { files: FileReport[] }) {
  const unrecognised = files.filter((f) => f.cls === "unrecognised");
  if (unrecognised.length === 0) return null;
  return (
    <div className="card" data-testid="unrecognised">
      <h2>Files we did not recognise</h2>
      <ul>
        {unrecognised.map((f) => (
          <li key={f.name}>{f.name}</li>
        ))}
      </ul>
      <p className="note">These were skipped. If they should be listening history, copy the file info and send it to us.</p>
    </div>
  );
}

function Summary({ summary }: { summary: ImportSummary }) {
  return (
    <section aria-labelledby="summary-h">
      <h2 id="summary-h">Import complete</h2>
      <p className="lead">
        {summary.totalPlays.toLocaleString("en-US")} plays
        {summary.firstPlay && summary.lastPlay ? ` from ${summary.firstPlay} to ${summary.lastPlay}` : ""}.
      </p>
      {summary.years.length > 0 && <p className="note">Years: {summary.years.join(", ")}</p>}
      {summary.duplicatesSkipped > 0 && (
        <p className="note" data-testid="duplicates">
          {summary.duplicatesSkipped} duplicate {summary.duplicatesSkipped === 1 ? "file" : "files"} skipped.
        </p>
      )}
      {summary.overlapDropped > 0 && (
        <p className="note">{summary.overlapDropped.toLocaleString("en-US")} overlapping plays merged.</p>
      )}
      <FileList files={summary.files} />
      <CopyInfo reports={summary.files} />
      <div className="actions">
        <a className="btn btn-primary" href={routeToHash({ view: "recap", period: "12m" })}>
          See my recap
        </a>
      </div>
    </section>
  );
}

export default function ImportPage({ client: injected }: { client?: ImportClient }) {
  const { state, client } = useImport(injected);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const take = (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (files.length > 0) client.load(files);
    if (input.current) input.current.value = "";
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer?.files ?? null);
  };

  const doneStats = state.status === "done" ? state.stats : null;
  useEffect(() => {
    if (doneStats) saveRecap(doneStats);
  }, [doneStats]);

  const idle = state.status === "idle" || state.status === "cancelled";
  const progress = state.status === "running" ? state.progress : null;
  const liveText =
    state.status === "running"
      ? progress
        ? `Reading file ${Math.min(progress.filesDone + 1, progress.filesTotal)} of ${progress.filesTotal}, ${percent(progress)} percent`
        : "Starting import"
      : state.status === "cancelled"
        ? "Import cancelled"
        : state.status === "done"
          ? "Import complete"
          : state.status === "error"
            ? ERROR_TEXT[state.code].title
            : "";

  return (
    <main className="page" data-testid="import">
      <h1>Load your Spotify data</h1>
      <p className="lead">Your files are read on this device only. Nothing is uploaded.</p>
      <div className="sr-only" role="status" aria-live="polite" data-testid="live">
        {liveText}
      </div>

      {state.status === "cancelled" && <p className="note">Import cancelled. You can start again.</p>}

      {idle && (
        <>
          <div
            className={`dropzone${over ? " dropzone-over" : ""}`}
            data-testid="dropzone"
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <p>Drop your ZIP or JSON files here</p>
            <label className="btn btn-primary" htmlFor="import-files">
              Choose files
            </label>
            <input
              ref={input}
              id="import-files"
              className="sr-only"
              type="file"
              accept={ACCEPT}
              multiple
              data-testid="file-input"
              onChange={(e) => take(e.target.files)}
            />
          </div>
          <div className="actions">
            <button type="button" className="btn" onClick={() => client.loadSample(SAMPLE_SEED)}>
              Try with sample data
            </button>
          </div>
        </>
      )}

      {state.status === "running" && (
        <section aria-label="Import progress">
          <progress max={100} value={percent(progress)} aria-label="Import progress" />
          <p className="note">{progress ? progress.currentFile : "Starting..."}</p>
          <div className="actions">
            <button type="button" className="btn" onClick={() => client.cancel()}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {state.status === "done" && <Summary summary={state.summary} />}

      {state.status === "error" && (
        <section role="alert" className="card" data-testid="error">
          <h2>{ERROR_TEXT[state.code].title}</h2>
          <p>{ERROR_TEXT[state.code].body}</p>
          {state.summary && <FileList files={state.summary.files} />}
          {state.summary && <CopyInfo reports={state.summary.files} />}
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => client.reset()}>
              Try again
            </button>
          </div>
        </section>
      )}

      <p className="note">
        Don&apos;t have your file yet? <a href={`${config.basePath}guide/`}>See how to request it</a>.
      </p>
    </main>
  );
}
