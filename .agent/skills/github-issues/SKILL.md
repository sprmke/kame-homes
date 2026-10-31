---
name: github-issue
description: >-
  Work the GitHub backlog on sprmke/kame-homes: view issues, create new ones,
  ship completed work to docs/archive/todos/shipped. Use when filing tickets, picking up
  work, or closing/shipping an issue.
disable-model-invocation: false
---

# GitHub Issues (source of truth)

**Repo:** `sprmke/kame-homes`  
**Pending backlog:** GitHub Issues + Project board  
**Epic grouping:** GitHub parent issue (`--parent` on create) — not body text  
**Shipped archive:** `docs/archive/todos/shipped/{issueNumber}-{slug}.md`

## Before starting work

1. Epic index: **`docs/README.md`** (Product backlog — parent issues #101–#119).
2. Fetch issue: `bun scripts/dev/gh-issue.mjs view --github N`
3. Read `docs/guides/routes/` when the issue touches a page.
4. Never add co-author trailers or AI attribution in commits/PRs (`git-commits.mdc`, `git-commits` skill).

## Commands

```bash
bun scripts/dev/gh-issue.mjs view --github 32

bun scripts/dev/gh-issue.mjs create --section 4 --title "Add check-in block" \
  --body "Acceptance criteria…" --parent 104 --priority p1

bun scripts/dev/gh-issue.mjs update --github 32 --body "…"

bun scripts/dev/gh-issue.mjs ship --github 32 --notes "What changed; key files"
```

**New teammates / QA:** prefer slash command **`/kh-create-new-ticket`** (short body template + sub-issue `--parent`). Related: `/kh-start-work`, `/kh-help`.

Raw `gh` works too; prefer **`gh-issue.mjs ship`** over bare `gh issue close` to archive in repo.

## Agent checklist

| Action      | Steps                                                |
| ----------- | ---------------------------------------------------- |
| **Pick up** | `view --github N` → read guides → implement          |
| **Create**  | `create --section N --title … --parent {epic#}`      |
| **Update**  | Edit body on GitHub via `update --github N --body …` |
| **Ship**    | Code + docs → `ship --github N --notes "…"`          |

## After shipping

- Update **`docs/PROJECT.md`** / route guides if behavior changed.
- Do **not** add Spec/Epic footers or local spec files.

See: `.cursor/rules/github-issues.mdc`, `docs/README.md` (Product backlog).
