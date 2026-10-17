import type { Play } from "../../model/types";

export interface AdapterResult {
  plays: Play[];
  /** Rows that could not become a Play (missing fields, bad timestamp, null track and no show). */
  skippedRows: number;
}

export function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

export function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}
