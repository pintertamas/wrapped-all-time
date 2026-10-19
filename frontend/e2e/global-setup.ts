import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Builds the synthetic export ZIPs (gitignored, frontend/.fixtures/) when they are missing.
export default function globalSetup(): void {
  const root = join(import.meta.dirname, "..");
  if (existsSync(join(root, ".fixtures", "perf.zip"))) return;
  execFileSync(process.execPath, ["scripts/make-fixtures.mjs"], { cwd: root, stdio: "inherit" });
}
