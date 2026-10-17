# AI-CONTEXT.md — All-years music recap (POC)

> **SINGLE SOURCE OF TRUTH** for AI models working with this codebase. `CLAUDE.md` and `AGENTS.md`
> only point here. Update this file in the same PR when patterns, commands, architecture or
> conventions change, and add a change-log row.
>
> Built and maintained by the software factory (`pintertamas/factory-hq`). Product plan: `docs/PRD.md`.
> Architecture: `docs/architecture.md`.

## 1. Repository Overview

Proof of concept: a mobile-first static demo that fakes a Spotify login with sample data and shows a shareable recap of the last year, so the owner can judge whether a login-based funnel beats the data-export approach. Unaffiliated with Spotify; all data is sample data.

### Owner Priorities (do not change without asking)

- **Cost first.** Idle cost must stay ≤ $5/month. No always-on compute, no paid add-ons
  without an approved budget gate.
- **Frontend is hosted on GitHub Pages.**
- **AWS deploys only run when the owner has set `CLOUD_ENABLED=true`.** Agents never set it.

**This is a static demo POC named Wrapped Vault.** There is **no backend**, **no cloud resources**, **no secrets or API keys** and **no real Spotify calls** (no OAuth, no client id, no network requests to Spotify). The only state is a flag in the browser's `localStorage`. Every screen shows a persistent banner: "DEMO - not connected to Spotify".

### Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, hosted on GitHub Pages |
| Tests | Vitest, jsdom, React Testing Library |
| Lint | ESLint (typescript-eslint, react-hooks) |
| Backend / infra | none (POC) |

### Directory Structure
```
frontend/
  index.html            Vite entry
  vite.config.ts        base path from VITE_BASE_PATH (set by CI for Pages), vitest config
  scripts/size-check.mjs  gzip size budget, run after the build
  public/.nojekyll
  src/
    main.tsx            React root
    App.tsx             page shell
    DemoBanner.tsx      persistent demo banner (always rendered by App)
    lib/session.ts      localStorage demo-login flag (isConnected/setConnected/clearConnected)
    pages/Landing.tsx   landing + "Connect Spotify (demo)" button
    pages/Recap.tsx     recap view: range tabs, top lists, hour histogram, Log out (App guards it with the session flag)
    components/RangeTabs.tsx, components/TopList.tsx  recap building blocks
    pages/MockConsent.tsx  in-app mock consent (Approve sets flag, Cancel returns)
    data/sampleProfile.ts  fictional Spotify-API-shaped sample profile (tops per range, 50 recent plays)
    lib/shareCard.ts    canvas share card (1080x1920, top 5 artists, top 3 tracks, DEMO watermark, no network)
    components/ShareCardButton.tsx  "Share card" button + modal (long-press save, Download link)
    lib/recap.ts        recap(profile, range): top 5 artists/tracks, genres, hour histogram (no totals)
    index.css           global styles, mobile-first
    test-setup.ts       jest-dom matchers and cleanup
.github/workflows/ci-cd.yaml   CI/CD (Code Quality & Tests, Pages deploy)
```

## 2. Essential Commands
```bash
# exactly what CI runs (from frontend/)
npm ci
npm run lint
npm test
npm run build      # tsc --noEmit && vite build; CI sets VITE_BASE_PATH=/<repo-name>/
npm run size       # gzip size budget (needs a prior build)
npm run dev        # local dev server
```

## 3. Architecture

Single-page static app, no server. Merging to `main` builds `frontend/` and deploys `frontend/dist` to GitHub Pages (`index.html` is copied to `404.html`). No state leaves the device.

## 4. Code Patterns

- The demo banner is rendered by `App` above all content and is `position: fixed`; keep it on every screen and keep its text exactly "DEMO - not connected to Spotify".
- Mobile-first CSS, no UI framework. Sample data only, never real user data.

- Navigation is a `view` state in `App` (landing, consent, recap); no router. No Spotify logo or brand colours anywhere.

## 5. Repository Conventions

- Branches, commit messages and PRs: the `git-conventions` skill
  (`.claude/skills/git-conventions/SKILL.md`) — `<type>/<short-description>` branches, Conventional
  Commits, merge commits only, auto-merge when **Code Quality & Tests** is green.
- Merging to `main` deploys: `frontend/**` → GitHub Pages; `backend/**`, `infra/**` → Terraform
  apply in CI (only with `CLOUD_ENABLED=true`).
- Terraform is applied only by CI.

### Required GitHub Configuration (names only)
| Kind | Names |
|---|---|
| Secrets | |
| Variables | `CLOUD_ENABLED` (owner only), `AWS_REGION`, `OWNER_EMAIL`, `MONTHLY_BUDGET_USD`, `VITE_*` |

## 6. Testing Guidelines

- Vitest + React Testing Library, tests next to the code as `*.test.ts(x)`. Globals are off: import `describe/it/expect` from `vitest`.

## 7. Gotchas

- Vite `base` comes from `VITE_BASE_PATH`; locally it defaults to `/`. Use relative or `import.meta.env.BASE_URL` paths for assets.
- The entry bundle budget in `size-check.mjs` is 90 kB gzip because React + react-dom alone are about 68 kB.

## 8. Change Log
| Date | Change | Model |
|---|---|---|
| 2026-10-17 | Repository created by the software factory | software factory |
| 2026-10-17 | POC skeleton: React + Vite page with demo banner, tests, CI build and Pages deploy (T001) | Claude Sonnet 5.5 |
| 2026-10-17 | Fake login flow: landing, mock consent, session flag (T003) | Claude Sonnet 5.5 |
| 2026-10-17 | Sample profile and recap computation (T002) | Claude Sonnet 5.5 |
| 2026-10-17 | Recap view with range switcher and logout (T004) | Claude Sonnet 5.5 |
| 2026-10-17 | Share card canvas export with DEMO watermark (T005) | Claude Sonnet 5.5 |
