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
  guide/ privacy/ terms/index.html   static pages (no React); guide is the full export guide, privacy lists the lv.* storage keys and the CSP enforcement, terms holds the unaffiliated statement, the $4.99 unlock and the honour-system note
  vite.config.ts        base path, multi-page inputs, CSP meta plugin, vitest config
  scripts/size-check.mjs, size-budgets.mjs   per-role gzip budgets, run after the build
  e2e/playwright.config.ts, *.spec.ts        e2e against `vite preview` of the build
  public/.nojekyll, public/og.png, goatcounter-count.js   (goatcounter-count.js: self-hosted minimal GoatCounter client, loaded only when analytics is on; robots.txt and sitemap.xml are emitted at build by the lv-seo-files plugin in vite.config.ts from VITE_SITE_URL / VITE_ROBOTS)
  src/
    main.tsx            React root
    App.tsx             shell: header, current view, footer (unaffiliated line, guide/privacy/terms, Restore purchase)
    router.ts           hash router: #/, #/import, #/recap/<4w|6m|12m|YYYY|all>, #/unlock[?code=]
    config.ts           the ONLY reader of import.meta.env; exports `config`
    configSchema.ts     pure parseConfig + DEFAULTS + buildCsp (shared with vite.config.ts)
    model/types.ts      normalised model (Play, PeriodStats, StatsBundle, ImportSummary, ...)
    import/protocol.ts  worker protocol (ToWorker / FromWorker)
    import/classify.ts  classify(name, firstItem?) -> FileClass, buildStructureInfo (keys only)
    import/adapters/    account.ts, extended.ts: rows -> Play via field allow-list; __fixtures__/ synthetic data (files.ts: in-memory File + ZIP builders for tests)
    import/pipeline.ts  runPipeline (read files, fflate streaming unzip, adapters, de-dupe), ImportError codes, createWorkerHandler (the Worker protocol), progress throttle, placeholder StatsBundle
    import/parse.worker.ts  thin worker entry: wires createWorkerHandler to postMessage
    import/client.ts    createImportClient: owns the worker, relays progress/result, cancel = terminate + fresh worker
    import/useImport.ts React hook (useSyncExternalStore) over the import client; ImportPage accepts an injected client for tests
    import/dedupe.ts    FileDeduper (rule 1), PlayDeduper (rule 2, hash table), dropAccountOverlap (rule 3)
    import/store.ts     PlayStore: columnar typed arrays + interned strings (worker only)
    stats/compute.ts    computeStats(store, {tz, sources, sample}) -> StatsBundle (periods 4w/6m/12m from latestPlay, years, allTime, tops, minutes, plays); periods.ts (LocalClock tz maths, ranges), tops.ts (TopAccumulator, 30 s threshold). days.ts (DayAccumulator): topDay, longestStreakDays, activeDays (30 s plays), hourMinutes (local hour), and Extended-only firstTrack / skipRate (null otherwise)
    pages/Landing.tsx, pages/ImportPage.tsx  landing and import views (drop zone, progress, summary, errors)
    recap/RecapPage.tsx recap view (shell)
    unlock/UnlockSheet.tsx  unlock view (shell; "Coming soon" while provider is none)
    analytics/track.ts  track(name, props): no-op unless VITE_ANALYTICS_PROVIDER=goatcounter; goatcounter.ts adapter lazy-loaded
    components/TopList.tsx  ranked list building block
    static/static.css   stylesheet of the static pages
    static/guide.ts     guide page script (progressive enhancement, <6 kB gzip): ics.ts (reminder .ics, CRLF, 75-octet folding), whichFile.ts (name -> package), countdown.ts (to 2026-12-02, hides itself after)
    share/              card renderer (lazy chunk): render.ts (renderShareCard, shareFileName, Space Grotesk 700 via @fontsource, no CDN), layouts/story.ts + square.ts (common.ts: fitText, footer), altText.ts, lazy.ts (loadShareRenderer = the dynamic import). Story 1080x1920, square 1080x1080, paid HD 2x; free cards carry "made with <name> · <host>", all cards "Not affiliated with Spotify", sample cards "SAMPLE DATA"; file <slug>-<period>-<story|square>.png
    index.css           app styles, mobile-first
    test-setup.ts       jest-dom matchers and cleanup
.github/workflows/ci-cd.yaml   CI/CD (Detect Changes, Code Quality & Tests, Deploy Frontend)
```
Planned modules (see the engineering plan § Repo layout): `unlock/` verifiers, `analytics/`, `storage/`, `static/` scripts.

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
(`import/parse.worker.ts`) parses the export and returns only aggregates.

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

**Import pipeline.** `client.ts` (main thread) creates the worker with
`new Worker(new URL("./parse.worker.ts", import.meta.url), { type: "module" })`. The worker handles
`ToWorker` (`load`, `loadSample`, `cancel`) and answers with `FromWorker`; `pipeline.ts` holds the
logic so tests drive it without a Worker. Per input file: ZIPs (detected by magic bytes) go through
fflate's streaming `Unzip` in 1 MB chunks, each `.json` entry is inflated alone, parsed, adapted and
released before the next one; loose JSON is read in chunks. Plays go through `PlayDeduper` into the
columnar `PlayStore`; after all files `dropAccountOverlap` removes Account plays inside the Extended
range. Only `ImportSummary` and a `StatsBundle` cross `postMessage`; the worker builds the bundle with
`stats/computeStats`. Progress is throttled to one message per 125 ms. Cancel in the client terminates the
worker and spawns a fresh one; stale messages are ignored by job id. `loadSample` runs
`sample/generate.ts` through the same adapters and store (`stats.sample = true`). `ImportSummary.duplicatesSkipped` counts
duplicate plays (rule 2); skipped duplicate files (rule 1) show as `files[].duplicateOf`. Error codes:
`no-history-files`, `invalid-zip` (garbage, truncated, empty ZIP), `invalid-json` (a history file that
is not a JSON array), `out-of-memory` (RangeError or an inflated file over 400 MB), `cancelled`,
`unknown`. fflate re-wraps errors thrown inside its callbacks, so `ingestZip` records failures and
rethrows them after `push()` returns.

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

- Import tests build inputs with `__fixtures__/files.ts` (`memFile`, `zipFile`): jsdom's `File`/`Blob`
  has no `arrayBuffer()`, and the pipeline only needs `{ name, size, slice().arrayBuffer() }`.
  `noNetwork.test.ts` stubs fetch, XMLHttpRequest, sendBeacon, WebSocket, EventSource and Image.src
  and asserts the pipeline makes zero calls; extend it when new pipeline code is added.

## 7. Gotchas

- Vite `base` comes from `VITE_BASE_PATH`; locally `/`. Use `config.basePath` or relative paths.
- The CSP meta is build-only; `npm run dev` has none (React refresh needs inline scripts). Check
  CSP issues with `npm run build && npm run preview` or `npm run e2e`.
- `frontend/.env` is committed (it is un-ignored in `.gitignore`); it must only ever hold public values.
- Size budgets (gzip, by file-name prefix in `dist/assets`): entry `index-*.js` 100 kB, worker
  `parse.worker-*.js` 25 kB, static-page scripts 6 kB each, main CSS 15 kB, static CSS 6 kB,
  share/unlock lazy chunks 20 kB each, font woff2 30 kB. React + react-dom alone are about 68 kB.
- The worker chunk only exists in the build once something imports `import/client.ts` (the import page);
  until then `npm run size` has no worker file to check (about 9 kB gzip when wired, budget 25 kB).
- fflate's `Unzip` buffers the data of entries that are never `start()`ed, so ignored entries are started
  and discarded instead of skipped.
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
| 2026-10-17 | Analytics wrapper `track()` (enum props only, off by default) with lazy GoatCounter adapter (T022) | Claude Sonnet 5.5 |
| 2026-10-17 | Static export guide page with SEO tags, OG image, generated robots.txt and sitemap.xml (T018) | Claude Sonnet 5.5 |
| 2026-10-17 | File classifier, Account/Extended schema adapters with field allow-list, StructureInfo builder, synthetic fixtures (T008) | Claude Sonnet 5.5 |
| 2026-10-18 | Parse worker pipeline: fflate streaming unzip, Worker protocol handler, throttled progress, cancel = terminate + fresh worker, de-dupe rules 1-3, columnar play store, no-network guard test (T010) | Claude Sonnet 5.5 |
| 2026-10-18 | Seeded sample-history generator (`src/sample/generate.ts`) and `npm run fixtures` (`scripts/make-fixtures.mjs`) writing gitignored ZIPs to `frontend/.fixtures/` (T009) | Claude Sonnet 5.5 |
| 2026-10-18 | Stats engine part 1: `src/stats/` periods, calendar years in the user's tz, all time, tops, minutes/plays; worker now returns real StatsBundle (T011) | Claude Sonnet 5.5 |
| 2026-10-18 | Guide extras: which-file checker, reminder .ics, recap-week countdown in a <6 kB static script (T019) | Claude Sonnet 5.5 |
| 2026-10-18 | Import page: drop zone/picker, aria-live progress, cancel, summary, error states, "Copy file info" (StructureInfo only); `import/useImport.ts` hook over the import client (T013) | Claude Sonnet 5.5 |
| 2026-10-19 | Share card renderer v2: story/square canvas layouts, paid HD 2x, tier watermark, SAMPLE DATA mark, alt text, self-hosted Space Grotesk (T016) | Claude Sonnet 5.5 |
| 2026-10-19 | Privacy page (stored `lv.*` keys, CSP enforcement) and terms page (unaffiliated statement, $4.99 unlock, honour system) replace the stubs (T023) | Claude Haiku 5.5 |
| 2026-10-19 | Stats engine part 2: `stats/days.ts` top day, streaks, active days, hour minutes, first track, skip rate (T012) | Claude Sonnet 5.5 |
