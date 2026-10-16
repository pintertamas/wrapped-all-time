---
name: git-conventions
description: The factory's git conventions - branch names, Conventional Commit messages, PR titles and descriptions, merge strategy and auto-merge. Use whenever you create a branch, write a commit message, open or merge a pull request, in the factory HQ repo or any product repo.
---

# Git conventions

One consistent way of working in every repository the factory touches, so history reads the same
everywhere. Language and architecture vary per product; these rules do not.

## Branches

Format: `<type>/<short-kebab-description>`

- `type` is one of the commit types below.
- Description: 2–5 lowercase words, kebab-case, no ticket ids, no dates, ≤ 40 characters.
- One branch per task. Never reuse a merged branch name.

Examples: `feat/pricing-page`, `fix/login-redirect-loop`, `ci/pages-deploy`, `refactor/split-order-service`.

## Commit messages (Conventional Commits)

```
<type>(<scope>): <description>

<optional body: why, not how — wrapped at ~72 chars>

<required trailers for this session, e.g. Co-Authored-By>
```

| type | Use for |
|---|---|
| `feat` | New user-visible behaviour |
| `fix` | A bug fix |
| `refactor` | Code change with no behaviour change |
| `test` | Tests only |
| `docs` | Documentation only (incl. `AI-CONTEXT.md`) |
| `style` | Formatting, whitespace |
| `ci` | Workflows, build pipeline |
| `chore` | Dependencies, config, state files, housekeeping |
| `revert` | Reverting an earlier commit |

- `scope`: the area touched — `frontend`, `backend`, `infra`, `ci`, `docs`, or a feature name
  (`checkout`, `auth`). In the HQ repo: `state`, `skills`, `agents`, `standards`, `scripts`, `config`.
- `description`: imperative, lowercase start, no trailing period, ≤ 72 characters for the whole
  header. "add pricing page", not "Added pricing page." or "pricing".
- Breaking change: `feat(api)!: rename /orders to /purchases` plus a `BREAKING CHANGE:` line in the body.
- Small, coherent commits. Don't mix a refactor and a feature in one commit.

## Pull requests

- Base `main`, head = the task branch.
- **Title** = the Conventional Commit header of the change (`feat(frontend): add pricing page`).
- **Description**:
  ```
  ## What and why
  <2–5 lines>

  Task: T012            (factory task id, or "Backlog: BL-007@<slug>")

  ## How it was verified
  <commands run locally and their result; screenshots/links if UI>

  <required PR footer for this session>
  ```
- One task per PR, ideally < 400 changed lines.
- CI check **Code Quality & Tests** must be green. Never merge red, never bypass branch protection.
- Merge with a **merge commit** (no squash, no rebase). The factory enables auto-merge right after
  opening — except for PRs that need review first (`review: true` tasks), which get auto-merge only
  after the reviewer approves.
- Tooling: in Claude cloud sessions GitHub GraphQL is blocked, so `gh pr create/merge/view/checks`
  don't work. Use the factory's REST helper `scripts/gh_pr.py` (`create`, `automerge`, `status`,
  `wait`, `merge`) — in a product repo, from the HQ checkout path you were given.
- Conflicts: merge `origin/main` into the branch. Never rebase a pushed branch, never force-push.

## Never

- Push directly to `main` in a product repo. (HQ state commits are the one exception — the HQ repo
  is the company's database.)
- Commit secrets, tokens, `.env` files or generated build output.
- Rewrite published history, delete branches you didn't create, or close someone else's PR.
