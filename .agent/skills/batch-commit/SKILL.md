---
name: batch-commit
description: >-
  Create N daily commits from unstaged changes, 5–10 files per commit, grouped by
  feature. Use when the user asks for batch commit, /batch-commit, split commits,
  or "X commits today" — NOT to dump the entire working tree into few large commits.
disable-model-invocation: true
---

# Batch commit — daily small commits (5–10 files each)

Commit **a slice** of unstaged work each session — not the entire working tree at once.

## Core model

| User says          | Meaning                                                                     |
| ------------------ | --------------------------------------------------------------------------- |
| `/batch-commit 10` | Create **10 commits today**, each with **5–10 files** (~50–100 files total) |
| `/batch-commit 5`  | Create **5 commits today**, each with **5–10 files**                        |
| `/batch-commit`    | Ask how many commits for this session (default **5**)                       |

**Never** interpret "10 commits" as "fit all 1,500 changed files into 10 mega-commits."

Large backlogs are committed over **many days**: repeat `/batch-commit N` until `git status` is clean.

## When to use

- Daily commit habit: small, reviewable commits
- User mentions batch commit, split commits, commit grouping, "X commits today"

**Do not use** for one-file fixes or when the user already staged exactly what they want.

## Hard rules

Follow **`.cursor/rules/git-commits.mdc`** and invoke **`git-commits`** skill if unsure:

- Never `Co-authored-by` / `Co-Authored-By` trailers (any co-author, including Claude/Cursor)
- Never mention Cursor/Claude/AI in commit or PR text
- Never change git config or pass `--author`
- **Only commit when the user explicitly asks**
- **Never commit** secrets (`.env`, `.env.local`, credentials JSON, keys)

## CI quality gate (required)

**Before** creating any batch commits and **after** the last commit (before recommending push), run the same checks as GitHub Actions **`ci.yml`** and **`cd-dev.yml`** quality job:

```bash
bun run ci:quality
```

Script: `scripts/dev/ci-quality-gate.sh` — runs in order:

| Step       | Command                         | Blocks CD?                                    |
| ---------- | ------------------------------- | --------------------------------------------- |
| Install    | `bun install --frozen-lockfile` | —                                             |
| Type check | `bun run type-check`            | Yes                                           |
| Lint       | `bun run lint`                  | **Yes** (ESLint **errors** only; warnings OK) |
| Filenames  | `bun run check:filenames`       | Yes                                           |
| Build      | `bun run build`                 | Yes                                           |

**If the gate fails:** fix the reported issue, re-run `bun run ci:quality`, then continue batch commits. Do **not** push to **`develop`** until the gate passes.

**Re-run after last commit** (use `--skip-install` if deps unchanged):

```bash
./scripts/dev/ci-quality-gate.sh --skip-install
```

Per-commit hooks still run **lint-staged** (ESLint `--fix` on staged UI files) and **commitlint** — those do **not** replace the full gate (no type-check or build).

## Commit message format

See `commitlint.config.js`. Use `chore(deps)` for lockfiles — **`deps` is not a valid type**.

Subject: lower-case, max 72 chars, imperative mood.

## Workflow

```
Batch commit progress:
- [ ] 0. CI quality gate (before any commit)
- [ ] 1. Inventory (respect commit quota)
- [ ] 2. Show daily plan only (N batches × 5–10 files)
- [ ] 3. User confirms or adjusts
- [ ] 4. Execute exactly N commits — stop
- [ ] 5. CI quality gate again (before push)
- [ ] 6. Report remaining uncommitted files
```

### Step 0 — CI quality gate (before commits)

```bash
bun run ci:quality
```

Stop if this fails. Common CD blockers: ESLint **errors** (`react-hooks/rules-of-hooks`, etc.), TypeScript errors, failed Vite build.

### Step 1 — Inventory

```bash
git status -sb
git status --porcelain=v1 -uall | wc -l
node .agent/skills/batch-commit/scripts/plan-commits.mjs --commits <N> --min 5 --max 10
```

Use **`dailyPlan`** from JSON — only those batches. Ignore the rest until the next session.

### Step 2 — Present plan

Show **exactly N rows** (or fewer if not enough changed files):

| #   | Type(scope) | Subject                           | Files |
| --- | ----------- | --------------------------------- | ----- |
| 1   | feat(org)   | add org team invite edge function | 4     |

Include footer:

> Remaining after today: **X files** (~Y future batches). Run `/batch-commit` again tomorrow.

If total changed files < 3, commit 1 batch only and tell the user.

### Step 3 — Execute (strict limits)

For each row in **dailyPlan** only:

```bash
git add -- <path1> <path2> ...
git commit -m "$(cat <<'EOF'
type(scope): subject

Optional body.
EOF
)"
```

- **5–10 files per commit** (1–4 only for a lone migration or atomic rename pair)
- Stage **only** listed paths — never `git add -A` for the whole tree
- **Stop after N commits** even if more files remain
- On hook failure, fix message and retry; do not amend pushed commits

### Step 4 — CI quality gate (after last commit)

```bash
./scripts/dev/ci-quality-gate.sh --skip-install
```

Only recommend **`git push`** when this passes.

### Step 5 — Verify

```bash
git status -sb
git log --oneline -n <N>
```

Report: commits created, files committed, **files still uncommitted**, gate status, suggested next session.

## Grouping rules

1. Same logical unit (one edge fn folder, one migration, one UI feature slice)
2. **5–10 files** per commit (user's daily batch size)
3. Never mix unrelated domains
4. Keep delete+add pairs together when same refactor (still ≤5 when possible)
5. One migration per commit when possible
6. `package.json` + `bun.lock` together in one `chore(deps)` commit

## Examples

**User: `/batch-commit 10`**

→ Run `ci:quality` → 10 commits × ~7 files ≈ 70 files committed → run gate again → push if green.

**Bad (previous mistake):**

→ 10 commits × 150 files = entire refactor in one session.

## Edge cases

| Case                          | Action                                              |
| ----------------------------- | --------------------------------------------------- |
| User gives N                  | Commit at most **N** batches today                  |
| Not enough files for N        | Commit what's available; say so                     |
| User says "commit everything" | Confirm — that's a different mode; warn about count |
| Already staged                | Include in plan; don't double-stage                 |
| Gate fails mid-batch          | Fix, re-run gate, resume remaining commits          |
| User skips gate               | Warn: push to `develop` will likely fail **CD Dev** |

## property-management-app

Same skill; copy script if missing. Read that repo's `commitlint.config.js`.
