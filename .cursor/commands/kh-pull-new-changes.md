# kh-pull-new-changes

Safely **pull the latest `develop`** so the local repo matches the team’s multi-tenant line. For new teammates (QA / tester / junior dev).

**Default integration branch:** `develop` (not `main` — `main` is legacy production until multi-tenant cutover).

## When to use

| User says                                      | Action                                      |
| ---------------------------------------------- | ------------------------------------------- |
| Pull / sync / get latest / update from develop | Fetch + update `develop` (and current work) |
| “I’m behind” / “CI has new commits”            | Same                                        |

## Steps (agent)

1. **Check status** (do not discard work):

```bash
git status -sb
git branch --show-current
```

2. **If there are uncommitted changes:**
   - Tell the user what is dirty.
   - Ask: stash, commit first, or abort.
   - Only `git stash push -u -m "kh-pull-new-changes"` if they agree.

3. **Fetch and update `develop`:**

```bash
git fetch origin
git checkout develop
git pull --ff-only origin develop
```

If `--ff-only` fails, **stop** — do not rebase or force. Explain they need help resolving diverge.

4. **If they were on a feature branch** (and want that branch updated too):

```bash
git checkout <their-branch>
git merge origin/develop
```

Prefer **merge** over rebase for juniors (safer, easier to undo). Only rebase if they explicitly ask.

5. **If you stashed**, offer `git stash pop` after the update.

6. **Summarize** in plain language:
   - Current branch
   - Whether `develop` moved (brief: new commits count if easy)
   - Reminder: after pull, restart the local app if it was running (`./dev.sh` or `./dev.sh --ui-only --env dev`)

## Don'ts

- Never `git reset --hard` or force-push unless the user explicitly asks.
- Never pull/merge into `main` for day-to-day multi-tenant work.
- Never run production Supabase deploy commands.
- Do not push unless they ask (use **/kh-submit-for-review** for PRs).

## Quick check after pull

Optional (if they want to confirm the app still starts):

```bash
bun run ci:quality
```

Or just restart UI against hosted dev:

```bash
./dev.sh --ui-only --env dev
```

This command is available in chat as **/kh-pull-new-changes**
