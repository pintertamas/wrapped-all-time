// Size budget for the production build. Run after `npm run build`.
// Fails when the entry chunk (index-*.js) or the main stylesheet (index-*.css) exceeds its gzip budget.
// Lazy route chunks are printed for information only.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

// Gzip budgets in kB (1 kB = 1000 bytes). Start generous; tighten once the app exists.
const BUDGET_KB = {
  entryJs: 60,
  mainCss: 15,
};

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = join(frontendRoot, "dist", "assets");

if (!existsSync(assetsDir)) {
  console.error(`size-check: ${assetsDir} not found. Run "npm run build" first.`);
  process.exit(1);
}

const kb = (bytes) => bytes / 1000;
const rows = readdirSync(assetsDir)
  .filter((name) => name.endsWith(".js") || name.endsWith(".css"))
  .sort()
  .map((name) => {
    const raw = readFileSync(join(assetsDir, name));
    const gzip = gzipSync(raw).length;
    const role = /^index-.*\.js$/.test(name) ? "entry"
      : /^index-.*\.css$/.test(name) ? "main css"
        : "lazy";
    return { name, role, raw: raw.length, gzip };
  });

const pad = (text, width) => String(text).padEnd(width);
const lines = [
  `${pad("file", 40)}${pad("role", 10)}${pad("raw kB", 12)}gzip kB`,
  ...rows.map((row) => `${pad(row.name, 40)}${pad(row.role, 10)}${pad(kb(row.raw).toFixed(2), 12)}${kb(row.gzip).toFixed(2)}`),
];
console.log(lines.join("\n"));

const initialGzip = rows.filter((row) => row.role === "entry" || /^(vendor|tanstack)-.*\.js$/.test(row.name)).reduce((sum, row) => sum + row.gzip, 0);
console.log(`initial JS (entry + vendor + tanstack, informational): ${kb(initialGzip).toFixed(2)} kB gzip`);

const failures = [];
const check = (label, budgetKb) => {
  const found = rows.filter((row) => row.role === label);
  if (found.length !== 1) {
    failures.push(`expected exactly one ${label} file, found ${found.length}`);
    return;
  }
  const actual = kb(found[0].gzip);
  console.log(`${label}: ${found[0].name} ${actual.toFixed(2)} kB gzip (budget ${budgetKb} kB)`);
  if (actual > budgetKb) failures.push(`${found[0].name} is ${actual.toFixed(2)} kB gzip, over the ${budgetKb} kB ${label} budget`);
};

check("entry", BUDGET_KB.entryJs);
check("main css", BUDGET_KB.mainCss);

if (failures.length > 0) {
  console.error(`\nsize-check failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nsize-check passed.");
