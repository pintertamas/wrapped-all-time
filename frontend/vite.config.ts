import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import { renderYearPage, yearRange } from "./src/static/yearPages.ts";
import { buildCsp, buildHeaders, canonicalFor, parseConfig, withSlash, type AppConfig } from "./src/configSchema.ts";

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

/** Adds the robots meta, the canonical link and (when VITE_ENV_LABEL is set) a visible environment
 *  label to the built HTML. The React shell renders its own label, so index.html only gets the tags. */
function pageMeta(cfg: AppConfig): Plugin {
  const pagePaths = new Map<string, string>([
    [PAGES.index, ""],
    [PAGES.guide, "guide/"],
    [PAGES.faq, "faq/"],
    [PAGES.privacy, "privacy/"],
    [PAGES.terms, "terms/"],
  ]);
  const label = cfg.envLabel.replace(/[<>&"]/g, "");
  return {
    name: "lv-page-meta",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler: (html, ctx) => {
        const pagePath = pagePaths.get(ctx.filename);
        if (pagePath === undefined) throw new Error(`lv-page-meta: unknown page ${ctx.filename}`);
        const tags = `<meta name="robots" content="${cfg.robots}" />\n    <link rel="canonical" href="${canonicalFor(cfg, pagePath)}" />`;
        // faq/ already carries its own robots + canonical tags
        let out = html.includes('rel="canonical"') ? html : html.replace(/<\/title>/i, (match) => `${match}\n    ${tags}`);
        if (label !== "" && pagePath !== "") {
          out = out.replace(/<body[^>]*>/i, (match) => `${match}\n    <div class="env-label" role="note">${label}</div>`);
        }
        return out;
      },
    },
  };
}

/** Emits robots.txt, sitemap.xml and the Cloudflare Pages `_headers` file from the config (build only). */
function seoFiles(cfg: AppConfig): Plugin {
  const site = withSlash(cfg.siteUrl);
  const urls = ["", "guide/", "faq/", "privacy/", "terms/", ...yearRange().map((y) => `year/${y}/`)].map((path) => `  <url><loc>${site}${path}</loc></url>`);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  const robots = `User-agent: *\n${cfg.robots === "noindex" ? "Disallow: /" : "Disallow:"}\n\nSitemap: ${site}sitemap.xml\n`;
  return {
    name: "lv-seo-files",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap });
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robots });
      this.emitFile({ type: "asset", fileName: "_headers", source: buildHeaders(cfg) });
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
    plugins: [react(), cspMeta(cfg), pageMeta(cfg), seoFiles(cfg), yearPages(cfg)],
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
