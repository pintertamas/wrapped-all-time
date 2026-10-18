// Test helpers: in-memory input files and ZIPs built with fflate (synthetic data only).
import { strToU8, zipSync, type Zippable } from "fflate";
import type { InputFile } from "../pipeline";

export function memFile(name: string, content: string | Uint8Array): InputFile {
  const bytes = typeof content === "string" ? strToU8(content) : content;
  return {
    name,
    size: bytes.length,
    slice: (start, end) => ({
      arrayBuffer: async () => {
        const part = bytes.slice(start, end);
        return part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) as ArrayBuffer;
      },
    }),
  };
}

/** entries: path -> JSON-able value or raw string. level 0 stores the entry uncompressed. */
export function zipFile(name: string, entries: Record<string, unknown>, level: 0 | 6 = 6): InputFile {
  const zippable: Zippable = {};
  for (const [path, value] of Object.entries(entries)) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    zippable[path] = [strToU8(text), { level }];
  }
  return memFile(name, zipSync(zippable));
}

export function json(value: unknown): string {
  return JSON.stringify(value);
}
