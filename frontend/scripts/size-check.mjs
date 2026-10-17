// Size budget for the production build. Run after `npm run build`.
// Every file in dist/assets gets a role from its name (see size-budgets.mjs) and must stay under
// that role's gzip budget. Files without a role are listed for information only.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { ROLES, checkBudgets, roleOf } from "./size-budgets.mjs";

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = join(frontendRoot, "dist", "assets");

if (!existsSync(assetsDir)) {
  console.error(`size-check: ${assetsDir} not found. Run "npm run build" first.`);
  process.exit(1);
}

const files = readdirSync(assetsDir)
  .filter((name) => /\.(js|css|woff2)$/.test(name))
  .sort()
  .map((name) => {
    const raw = readFileSync(join(assetsDir, name));
    return { name, raw: raw.length, gzip: gzipSync(raw).length };
  });

const pad = (text, width) => String(text).padEnd(width);
const kb = (bytes) => (bytes / 1000).toFixed(2);
console.log(`${pad("file", 44)}${pad("role", 28)}${pad("raw kB", 10)}${pad("gzip kB", 10)}budget kB`);
for (const file of files) {
  const key = roleOf(file.name);
  const role = key ? ROLES[key] : null;
  console.log(
    `${pad(file.name, 44)}${pad(role ? role.label : "(no budget)", 28)}${pad(kb(file.raw), 10)}${pad(kb(file.gzip), 10)}${role ? role.budgetKb : "-"}`,
  );
}

const failures = checkBudgets(files);
if (failures.length > 0) {
  console.error(`\nsize-check failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nsize-check passed.");
