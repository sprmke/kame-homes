# kh-submit-for-review

Open a **pull request into `develop`** for review. For new teammates (QA / tester / junior dev).

**Base branch:** `develop`  
**Do not** open day-to-day feature PRs into `main` (legacy production track).

## When to use

| User says                     | Action                                      |
| ----------------------------- | ------------------------------------------- |
| Submit for review / open a PR | Push branch + `gh pr create --base develop` |
| Ready for review / create PR  | Same                                        |

## Steps (agent)

1. **Inspect git state** (run in parallel):

```bash
git status -sb
git branch --show-current
git remote -v
git log --oneline develop..HEAD 2>/dev/null || git log --oneline origin/develop..HEAD
git diff --stat origin/develop...HEAD
```

2. **Guards — stop and explain if:**
   - Current branch is `develop` or `main` → create/switch to a feature branch first (`/kh-start-work`).
   - No commits ahead of `develop` → nothing to review.
   - Uncommitted changes → ask to commit or stash first (only commit if the user asked).
   - Branch name is vague (`fix`, `temp`) → suggest renaming to `fix/…` or `feat/…` before push.

3. **Update from develop** (reduce review conflicts):

```bash
git fetch origin
git merge origin/develop
```

Resolve conflicts with care (or `/fix-merge-conflicts`). Do not force-push.

4. **Quality gate** (same checks as CI — run before opening the PR):

```bash
bun run ci:quality
```

If it fails, fix or report errors; do not open a broken PR unless the user insists.

5. **Push** (needs network):

```bash
git push -u origin HEAD
```

6. **Create PR** into `develop`:

```bash
gh pr create --base develop --title "…" --body "$(cat <<'EOF'
## Summary
- What changed and why (1–3 bullets)

## Related
- Fixes #N   <!-- or Relates to #N -->

## Test plan
- [ ] Steps a reviewer or QA can follow
- [ ] Route(s) checked: `/…`
- [ ] Desktop + mobile smoke (if UI)

EOF
)"
```

Title style: short conventional subject when possible (`fix: …`, `feat: …`, `docs: …`).  
If an issue number is known, include `Fixes #N` or `Relates to #N`.

7. **Reply** with the PR URL. Mention that merging to `develop` deploys the multi-tenant **dev** app (`dev.kamehomes.space`) via CD Dev — not legacy production.

## Don'ts

- Do not target `main` unless the user explicitly asks for a release/cutover PR.
- Do not `--force` push to shared branches.
- Do not add co-author trailers or AI attribution in commits/PRs (`git-commits.mdc`, `git-commits` skill).
- Do not run production Supabase deploys.

## If a PR already exists

```bash
gh pr view --web
# or
gh pr view --json url,title,state,baseRefName
```

Update description if needed; do not open a duplicate.

This command is available in chat as **/kh-submit-for-review**
