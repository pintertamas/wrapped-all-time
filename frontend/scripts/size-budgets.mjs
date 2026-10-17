// Per-role gzip budgets (eng/frontend.md § Size budgets). 1 kB = 1000 bytes.
// A build file's role comes from its name prefix in dist/assets.

/** @type {Record<string, { label: string, budgetKb: number, required: boolean, single: boolean }>} */
export const ROLES = {
  entry: { label: "entry index-*.js", budgetKb: 100, required: true, single: true },
  worker: { label: "worker parse.worker-*.js", budgetKb: 25, required: false, single: true },
  staticJs: { label: "static-page script", budgetKb: 6, required: false, single: false },
  mainCss: { label: "main CSS index-*.css", budgetKb: 15, required: true, single: true },
  staticCss: { label: "static CSS", budgetKb: 6, required: false, single: false },
  lazy: { label: "share/unlock lazy chunk", budgetKb: 20, required: false, single: false },
  font: { label: "font woff2", budgetKb: 30, required: false, single: false },
};

// Static pages and their scripts/styles: guide, privacy, terms, the shared static bundle, and
// per-year SEO pages added later.
const STATIC_PREFIX = /^(guide|privacy|terms|static|whichFile|countdown|ics|year)[-.]/i;
const LAZY_PREFIX = /^(share|ShareSheet|render|unlock|UnlockSheet|verifier|lemonsqueezy|gumroad)[-.]/i;

/** Role key for a file in dist/assets, or null when the file has no budget (reported only). */
export function roleOf(name) {
  if (name.endsWith(".woff2")) return "font";
  if (name.endsWith(".js")) {
    if (/^index-[^.]+\.js$/.test(name)) return "entry";
    if (/^parse\.worker-[^.]+\.js$/.test(name)) return "worker";
    if (STATIC_PREFIX.test(name)) return "staticJs";
    if (LAZY_PREFIX.test(name)) return "lazy";
    return null;
  }
  if (name.endsWith(".css")) {
    if (/^index-[^.]+\.css$/.test(name)) return "mainCss";
    if (STATIC_PREFIX.test(name)) return "staticCss";
    return null;
  }
  return null;
}

/**
 * Checks measured files against the budgets.
 * @param {{ name: string, gzip: number }[]} files
 * @returns {string[]} failure messages (empty when all budgets hold)
 */
export function checkBudgets(files) {
  const failures = [];
  for (const [key, role] of Object.entries(ROLES)) {
    const found = files.filter((file) => roleOf(file.name) === key);
    if (role.required && found.length === 0) failures.push(`no ${role.label} file found`);
    if (role.single && found.length > 1) failures.push(`expected one ${role.label} file, found ${found.length}`);
    for (const file of found) {
      const kb = file.gzip / 1000;
      if (kb > role.budgetKb) {
        failures.push(`${file.name} is ${kb.toFixed(2)} kB gzip, over the ${role.budgetKb} kB ${role.label} budget`);
      }
    }
  }
  return failures;
}
