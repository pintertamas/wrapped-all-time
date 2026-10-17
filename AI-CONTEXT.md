# AI-CONTEXT.md — Listening Vault (`wrapped-all-time`)

> **SINGLE SOURCE OF TRUTH** for AI models working with this codebase. `CLAUDE.md` and `AGENTS.md`
> only point here. Update this file in the same PR when patterns, commands, architecture or
> conventions change, and add a change-log row.
>
> Built and maintained by the software factory (`pintertamas/factory-hq`). Product plan: `docs/PRD.md`.
> Architecture: `docs/architecture.md`. The normative contracts (types, worker protocol, storage keys,
> verifier rules, events, output formats) are in the frontend engineering plan, § Interfaces.

## 1. Repository Overview

Listening Vault (working name, set by `VITE_PRODUCT_NAME`) shows a user's whole Spotify listening
history — every calendar year and all time, not only the last 12 months — from the Spotify data
export (Account Data or Extended streaming history). The user loads the ZIP/JSON files in the
browser; a Web Worker parses them and computes aggregate stats; the app shows a recap and share
cards. Free: rolling 4 weeks / 6 months / 12 months. Paid (one-time $4.99 license key): every year,
all time, HD cards without watermark, poster. Not affiliated with Spotify.

### Owner Priorities (do not change without asking)

- **Cost first.** Idle cost must stay ≤ $5/month (it is $0). No always-on compute, no paid add-ons
  without an approved budget gate.
- **Level 0: static site, all logic in the browser.** No backend, no AWS, no server routes of our
  own, no runtime AI, no paid API. Re-adding cloud needs a `gate:cloud`; agents never set
  `CLOUD_ENABLED`.
- **Privacy rule: file contents never leave the device.** Parsing, stats, share cards and the
  unlock check run on the device. Only aggregates (`StatsBundle`) leave the worker; raw plays never
  do. No request may carry file contents, file names, artists, tracks or keys except the license
  key in the verify call. The CSP `connect-src` allow-list enforces this in the browser, and CI
  checks it (privacy canary e2e, added with the import pipeline).
- **Honour-system unlock.** The browser calls the payment provider's license-verify endpoint
  directly (CORS confirmed) and stores only `{ provider, keyLast4, verifiedAt }`. Shared keys and a
  client-side bypass are accepted at this price. Locked previews render placeholder text, never the
  real values. The full key and the provider response (buyer email) are never stored.
- **Environments:** staging = GitHub Pages (`pintertamas.github.io/wrapped-all-time/`, provider test
  mode, `noindex`, "TEST SITE" label); production = Cloudflare Pages (`<CF_PAGES_PROJECT>.pages.dev`,
  live provider values set by the owner at go-live; deploy job added later). Live checkout is never
  configured on GitHub Pages.

### Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 6, Vite 8 (multi-page), no UI or router library |
| Tests | Vitest + jsdom + React Testing Library (unit/component); Playwright chromium (e2e) |
| Lint | ESLint (typescript-eslint, react-hooks) |
| Hosting | GitHub Pages (staging), Cloudflare Pages (production) |
| Backend / infra | none (Level 0) |

### Directory Structure
```
frontend/
  .env                  public VITE_* defaults (committed on purpose; never secrets)
  index.html            app entry (landing copy is static HTML before React mounts)
  guide/ privacy/ terms/index.html   static pages (no React); guide is the full export guide, privacy/terms are stubs
  vite.config.ts        base path, multi-page inputs, CSP meta plugin, vitest config
  scripts/size-check.mjs, size-budgets.mjs   per-role gzip budgets, run after the build
  e2e/playwright.config.ts, *.spec.ts        e2e against `vite preview` of the build
  public/.nojekyll, public/og.png   (robots.txt and sitemap.xml are emitted at build by the lv-seo-files plugin in vite.config.ts from VITE_SITE_URL / VITE_ROBOTS)
  src/
    main.tsx            React root
    App.tsx             shell: header, current view, footer (unaffiliated line, guide/privacy/terms, Restore purchase)
    router.ts           hash router: #/, #/import, #/recap/<4w|6m|12m|YYYY|all>, #/unlock[?code=]
    config.ts           the ONLY reader of import.meta.env; exports `config`
    configSchema.ts     pure parseConfig + DEFAULTS + buildCsp (shared with vite.config.ts)
    model/types.ts      normalised model (Play, PeriodStats, StatsBundle, ImportSummary, ...)
    import/protocol.ts  worker protocol (ToWorker / FromWorker)
    pages/Landing.tsx, pages/ImportPage.tsx  landing and import views (import is a shell)
    recap/RecapPage.tsx recap view (shell)
    unlock/UnlockSheet.tsx  unlock view (shell; "Coming soon" while provider is none)
    components/TopList.tsx  ranked list building block
    static/static.css   stylesheet of the static pages
    index.css           app styles, mobile-first
    test-setup.ts       jest-dom matchers and cleanup
.github/workflows/ci-cd.yaml   CI/CD (Detect Changes, Code Quality & Tests, Deploy Frontend)
```
Planned modules (see the engineering plan § Repo layout): `import/` worker pipeline and adapters,
`stats/`, `sample/`, `share/`, `unlock/` verifiers, `analytics/`, `storage/`, `static/` scripts.

## 2. Essential Commands
```bash
# exactly what CI runs (from frontend/)
npm ci
npm run lint
npm test           # vitest (unit + component; also scripts/*.test.mjs)
npm run build      # tsc --noEmit && vite build -> dist/{index,guide/,privacy/,terms/}
npm run size       # per-role gzip budgets (needs a prior build)
npx playwright install chromium   # once (CI: --with-deps, cached)
npm run e2e        # Playwright against `vite preview` of dist (needs a prior build, same VITE_BASE_PATH)
npm run dev        # local dev server (no CSP meta in dev)
```

## 3. Architecture

Static multi-page site, no server. `index.html` is the React app with hash routing (so the static
host never needs rewrites); `guide/`, `privacy/`, `terms/` are plain HTML pages. A Web Worker
(`import/parse.worker.ts`, coming) parses the export and returns only aggregates.

**Config.** All values are public and build-time. Defaults live in `frontend/.env`; CI passes
every `VITE_*` from GitHub variables (Environment `github-pages` for the staging deploy, repo
variables for PR builds). An empty/unset variable falls back to the `.env` default
(`vite.config.ts` drops empty `VITE_*` before Vite loads env). `VITE_PRODUCT_NAME` drives the TS
(`config.productName`) and the HTML (`%VITE_PRODUCT_NAME%`).

| Name | Default | Purpose |
|---|---|---|
| `VITE_BASE_PATH` | `/` (CI: `/<repo>/`) | base path |
| `VITE_PRODUCT_NAME` | `Listening Vault` | the one name string |
| `VITE_SITE_URL` | staging URL | canonical, sitemap, watermark host |
| `VITE_ROBOTS`, `VITE_ENV_LABEL` | `index`, empty | staging: `noindex`, `TEST SITE` |
| `VITE_CHECKOUT_URL` | empty | hosted checkout link ("coming soon" when empty) |
| `VITE_UNLOCK_PROVIDER` | `none` | `lemonsqueezy` \| `gumroad` \| `none` |
| `VITE_UNLOCK_PRODUCT_ID`, `VITE_UNLOCK_STORE_ID` | empty | IDs the key must belong to |
| `VITE_SUPPORT_URL` | empty | public support contact |
| `VITE_ANALYTICS_PROVIDER`, `VITE_ANALYTICS_SITE` | `none`, empty | GoatCounter (off until `gate:public`) |
| `VITE_FEATURE_LOGIN`, `VITE_SPOTIFY_CLIENT_ID` | `false`, empty | S2 Spotify login (flagged) |

**CSP.** The build adds `<meta http-equiv="Content-Security-Policy">` right after `<meta charset>`
on every HTML page (`buildCsp` in `configSchema.ts`): `default-src 'self'; script-src 'self'; ...;
connect-src 'self' [verify host] [<site>.goatcounter.com] [Spotify hosts]; object-src 'none';
base-uri 'self'; form-action 'none'`. A bracketed host appears only when its config is set.
Production will also send it as a real header via a generated `_headers` (with
`frame-ancestors 'none'`).

**Deploy.** Merging to `main` with frontend changes builds `frontend/` with the `github-pages`
environment variables and deploys `frontend/dist` to GitHub Pages staging (`index.html` copied to
`404.html`). The Cloudflare production job comes in its own task.

## 4. Code Patterns

- `src/config.ts` is the only module that reads `import.meta.env` (a unit test enforces it). Import
  `config` everywhere else; put parsing logic in `configSchema.ts`.
- Navigation: `router.ts` (`useRoute`, `routeToHash`, `navigate`). Links use `href={routeToHash(...)}`;
  links to static pages use `` `${config.basePath}guide/` ``. Unknown hashes show the landing view.
- `model/types.ts` and `import/protocol.ts` mirror the engineering plan exactly; change them only
  together with the plan.
- Browser storage keys are prefixed `lv.` and JSON values carry `v`. Store aggregates only.
- Mobile-first CSS, no UI framework, no external fonts/CDNs (CSP). No Spotify logo or brand colours.
  Every page shows "Not affiliated with Spotify".

## 5. Repository Conventions

- Branches, commit messages and PRs: the `git-conventions` skill
  (`.claude/skills/git-conventions/SKILL.md`) — `<type>/<short-description>` branches, Conventional
  Commits, merge commits only, auto-merge when **Code Quality & Tests** is green.
- Merging to `main` deploys `frontend/**` to GitHub Pages staging. There is no backend deploy.

### Required GitHub Configuration (names only)
| Kind | Names |
|---|---|
| Secrets | none yet (`CLOUDFLARE_API_TOKEN` when the production deploy lands) |
| Variables | `VITE_*` (above; Environment `github-pages` = staging test mode, `production` = live), `CLOUDFLARE_ACCOUNT_ID` (later) |

## 6. Testing Guidelines

- Vitest + React Testing Library, tests next to the code as `*.test.ts(x)`. Globals are off: import
  `describe/it/expect` from `vitest`. Unit tests run on the `.env` defaults; read values through
  `config` rather than hard-coding the product name or base path.
- E2E specs live in `frontend/e2e/*.spec.ts` (excluded from vitest), chromium only, against the
  production build under the real base path. Today: `smoke.spec.ts` (CSP meta on every page, the
  hash routes). Planned: privacy canary, offline, perf, errors, CSP-vs-config.

## 7. Gotchas

- Vite `base` comes from `VITE_BASE_PATH`; locally `/`. Use `config.basePath` or relative paths.
- The CSP meta is build-only; `npm run dev` has none (React refresh needs inline scripts). Check
  CSP issues with `npm run build && npm run preview` or `npm run e2e`.
- `frontend/.env` is committed (it is un-ignored in `.gitignore`); it must only ever hold public values.
- Size budgets (gzip, by file-name prefix in `dist/assets`): entry `index-*.js` 100 kB, worker
  `parse.worker-*.js` 25 kB, static-page scripts 6 kB each, main CSS 15 kB, static CSS 6 kB,
  share/unlock lazy chunks 20 kB each, font woff2 30 kB. React + react-dom alone are about 68 kB.
- Run `npm run build` before `npm run e2e`, with the same `VITE_BASE_PATH`.

## 8. Change Log
| Date | Change | Model |
|---|---|---|
| 2026-10-17 | Repository created by the software factory | software factory |
| 2026-10-17 | POC skeleton: React + Vite page with demo banner, tests, CI build and Pages deploy (T001) | Claude Sonnet 5.5 |
| 2026-10-17 | Fake login flow: landing, mock consent, session flag (T003) | Claude Sonnet 5.5 |
| 2026-10-17 | Sample profile and recap computation (T002) | Claude Sonnet 5.5 |
| 2026-10-17 | Recap view with range switcher and logout (T004) | Claude Sonnet 5.5 |
| 2026-10-17 | Share card canvas export with DEMO watermark (T005) | Claude Sonnet 5.5 |
| 2026-10-17 | Locked All years teaser and interest panel (T006) | Claude Sonnet 5.5 |
| 2026-10-17 | Listening Vault foundation: POC mocks removed, `.env` config, hash router, model + protocol types, multi-page build with CSP meta, per-role size budgets, Playwright smoke e2e, CI on Node 24 without backend (T007) | Claude Sonnet 5.5 |
| 2026-10-17 | Static export guide page with SEO tags, OG image, generated robots.txt and sitemap.xml (T018) | Claude Sonnet 5.5 |
