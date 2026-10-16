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

### Tech Stack
| Layer | Technology |
|---|---|

### Directory Structure
```
```

## 2. Essential Commands
```bash
# exactly what CI runs
```

## 3. Architecture

## 4. Code Patterns

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

## 7. Gotchas

## 8. Change Log
| Date | Change | Model |
|---|---|---|
| 2026-10-17 | Repository created by the software factory | software factory |
