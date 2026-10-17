import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import { buildCsp, parseConfig, type AppConfig } from "./src/configSchema.ts";

const root = dirname(fileURLToPath(import.meta.url));

// HTML pages of the multi-page build. Each one gets the generated CSP meta tag.
export const PAGES = {
  index: resolve(root, "index.html"),
  guide: resolve(root, "guide/index.html"),
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "VITE_");
  const cfg = parseConfig(env);
  return {
    base: cfg.basePath,
    plugins: [react(), cspMeta(cfg)],
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
