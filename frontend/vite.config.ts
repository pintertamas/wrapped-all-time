import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import { renderYearPage, yearRange } from "./src/static/yearPages.ts";
import { buildCsp, parseConfig, type AppConfig } from "./src/configSchema.ts";

const root = dirname(fileURLToPath(import.meta.url));

// HTML pages of the multi-page build. Each one gets the generated CSP meta tag.
export const PAGES = {
  index: resolve(root, "index.html"),
  guide: resolve(root, "guide/index.html"),
  faq: resolve(root, "faq/index.html"),
  privacy: resolve(root, "privacy/index.html"),
  terms: resolve(root, "terms/index.html"),
};

// CI passes every VITE_* variable; an unset GitHub variable arrives as "". Treat that as
// "not set" so the committed default in frontend/.env applies (Vite lets process.env win).
for (const key of Object.keys(process.env)) {
  if (key.startsWith("VITE_") && process.env[key] === "") delete process.env[key];
}

/** Adds <meta http-equiv="Content-Security-Policy"> right after <meta charset> on every built HTML
 *  page, before any script or stylesheet. Build only: the dev server needs inline scripts. */
function cspMeta(cfg: AppConfig): Plugin {
  const tag = `<meta http-equiv="Content-Security-Policy" content="${buildCsp(cfg)}" />`;
  return {
    name: "lv-csp-meta",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler: (html, ctx) => {
        const charset = /<meta charset="[^"]*"\s*\/?>/i;
        if (!charset.test(html)) throw new Error(`lv-csp-meta: ${ctx.filename} has no <meta charset>`);
        return html.replace(charset, (match) => `${match}\n    ${tag}`);
      },
    },
  };
}

/** Emits robots.txt and sitemap.xml from VITE_SITE_URL / VITE_ROBOTS (build only). */
function seoFiles(cfg: AppConfig): Plugin {
  const site = cfg.siteUrl.endsWith("/") ? cfg.siteUrl : `${cfg.siteUrl}/`;
  const urls = ["", "guide/", "faq/", "privacy/", "terms/", ...yearRange().map((y) => `year/${y}/`)].map((path) => `  <url><loc>${site}${path}</loc></url>`);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  const robots = `User-agent: *\n${cfg.robots === "noindex" ? "Disallow: /" : "Disallow:"}\n\nSitemap: ${site}sitemap.xml\n`;
  return {
    name: "lv-seo-files",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap });
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robots });
    },
  };
}

/** Emits /year/<yyyy>/index.html for every year as static HTML (no JS) with the CSP meta tag. */
function yearPages(cfg: AppConfig): Plugin {
  const site = cfg.siteUrl.endsWith("/") ? cfg.siteUrl : `${cfg.siteUrl}/`;
  const csp = buildCsp(cfg);
  return {
    name: "lv-year-pages",
    apply: "build",
    generateBundle: {
      order: "post",
      handler(_opts, bundle) {
      // Reuse the hashed stylesheet link Vite wrote into the built FAQ page.
      const faq = bundle["faq/index.html"];
      const html = faq && faq.type === "asset" ? String(faq.source) : "";
      const tag = /<link rel="stylesheet"[^>]*>/.exec(html)?.[0] ?? "";
      const stylesheetTag = tag.replace(/href="([^"]*)"/, (_m, href: string) => `href="${relativize(href, cfg.basePath)}"`);
      const years = yearRange();
      for (const year of years) {
        const source = renderYearPage({ year, productName: cfg.productName, siteUrl: site, robots: cfg.robots, csp, stylesheetTag });
        this.emitFile({ type: "asset", fileName: `year/${year}/index.html`, source });
      }
      },
    },
  };
}

// Stylesheet hrefs in built pages are absolute under the base path; year pages sit two levels deeper.
function relativize(href: string, base: string): string {
  const b = base.endsWith("/") ? base : `${base}/`;
  return href.startsWith(b) ? `../../${href.slice(b.length)}` : href;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "VITE_");
  const cfg = parseConfig(env);
  return {
    base: cfg.basePath,
    plugins: [react(), cspMeta(cfg), seoFiles(cfg), yearPages(cfg)],
    build: {
      rollupOptions: { input: PAGES },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test-setup.ts"],
      globals: false,
      exclude: [...configDefaults.exclude, "e2e/**"],
    },
  };
});
