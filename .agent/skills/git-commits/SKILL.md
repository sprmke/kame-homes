---
name: git-commits
description: >-
  Human-only git commits — no Co-authored-by trailers, no AI/Cursor/Claude attribution,
  no --author overrides. Use when creating commits, batch commits, amending messages,
  or drafting PR bodies that might inherit commit text.
disable-model-invocation: false
---

# Git commits — human authorship only

Canonical always-on rule: **`.cursor/rules/git-commits.mdc`**.

## Policy

| Do                                                         | Don't                                                           |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| One author: the developer's git `user.name` / `user.email` | `Co-authored-by:` lines (any co-author, human or tool)          |
| Plain conventional-commit subjects                         | `Generated with Claude Code` / Cursor footers in commits or PRs |
| Commit only when the user explicitly asks                  | `--author`, `GIT_AUTHOR_*`, or impersonating an AI identity     |

## Before `git commit`

1. Message body must **not** include `Co-authored-by`, `Co-Authored-By`, or tool attribution.
2. Do not append Claude/Cursor/Composer/Copilot trailers "because the tool suggests it."
3. PR descriptions: no AI co-author blocks (Claude Code `attribution.pr` is disabled in `.claude/settings.json`).

## Repo enforcement (automatic)

- **`scripts/dev/strip-commit-co-author-trailers.sh`** removes co-author and AI attribution lines.
- **`.husky/commit-msg`** runs that script before commitlint.

Agents should still omit trailers; the hook is the backstop when Claude Code or Cursor injects them.

## Claude Code

Project **`.claude/settings.json`** sets:

```json
"attribution": { "commit": "", "pr": "", "sessionUrl": false }
```

Older Claude builds may still inject trailers; the commit-msg hook strips them.

## Cleaning existing history

If commits on GitHub already show a second author from trailers:

```bash
# clean working tree first
bash scripts/dev/strip-co-authors-from-history.sh HEAD~5..HEAD   # or HEAD for whole branch
git push --force-with-lease origin <branch>
```

## Related

- **`batch-commit`** skill for daily small commits
- **`git-commits.mdc`** for Cursor always-on agent behavior
