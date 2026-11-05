---
name: branch-lifecycle
description: >-
  Land finished work and keep the branch list clean. Use when a task, feature, or module is
  done, when opening or merging a PR into develop, when deciding whether a branch can be
  deleted, or when asked to audit or clean up branches.
disable-model-invocation: false
---

# Branch lifecycle

Canonical always-on rule: **`.cursor/rules/branch-lifecycle.mdc`**.
Audit record: **`docs/archive/operations/branch-cleanup-audit.md`**.

**Core principle:** a branch exists to carry one change into `develop`. When the change is in
`develop`, the branch is deleted. Finished work never parks on a branch.

## 1. When the task is done

Run this before you tell the user the work is complete.

| Step                   | Command                              | Pass condition                                  |
| ---------------------- | ------------------------------------ | ----------------------------------------------- |
| 1. Nothing uncommitted | `git status --porcelain`             | Empty, or the leftovers are named and justified |
| 2. Quality gates       | `bun run ci:quality`                 | Lint, type-check, filenames, build all pass     |
| 3. Push                | `git push -u origin HEAD`            | Branch is on `origin`                           |
| 4. Open the PR         | `gh pr create --base develop --fill` | URL returned                                    |
| 5. Report              | —                                    | The PR URL is in your reply                     |
| 6. Merge               | after the user approves              | `gh pr merge <n> --squash --delete-branch`      |
| 7. Delete local branch | `git branch -d <name>`               | Only after the merge                            |

**Never merge on your own initiative.** Opening the PR is the agent's job. Merging is the
user's decision: ask, then act on the answer.

If the change is docs-only or a one-liner, the same flow applies. It is cheaper than a branch
that rots for a month.

## 2. Deciding whether a branch can be deleted

Run all four checks. Record the tip SHA in the audit doc before deleting.

```bash
git fetch origin --prune

# 1. Merged outright?
git merge-base --is-ancestor <branch> develop

# 2. Content merged (covers squash / rebase merges)?
git cherry develop <branch>          # no "+" lines = every patch already in develop

# 3. Files it added that develop does not have
mb=$(git merge-base develop <branch>)
git diff --name-status "$mb"..<branch> | awk '$1=="A"{print $2}' |
  while read -r f; do git cat-file -e "develop:$f" 2>/dev/null || echo "MISSING $f"; done

# 4. Uncommitted work in any worktree on it
git worktree list
```

| Result                                       | Action                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1 true, or 2 empty, and 3 empty, and 4 clean | Safe to delete                                                                                         |
| Any `MISSING` file                           | Look for a renamed successor in `develop` (`git log develop --oneline -- '*name*'`). If none, **keep** |
| Unapplied patches that look real             | **Keep** and report what needs merging                                                                 |
| Worktree with `git status` output            | **Keep**. Commit or move the work first                                                                |
| Open PR                                      | Close or merge the PR first, then delete                                                               |

Deleting a branch is cheap to undo only while the objects survive: the SHA map in
`docs/archive/operations/branch-cleanup-audit.md` is the durable record. Restore with
`git branch <name> <sha>`.

## 3. Periodic audit

```bash
bun run branch:audit          # read-only, prints one row per branch
```

The script reports, per branch: ancestor of `develop`, unapplied patch count, added files absent
from `develop`, and whether a worktree has uncommitted changes. Nothing is deleted.

Report first, delete second. The user decides about:

- branches with unapplied patches,
- WIP / backup snapshots,
- worktrees with uncommitted files,
- dependency bumps.

## 4. Safety rules

- Never `git branch -D` / `git worktree remove --force` to get past a refusal. The refusal means
  work exists only there.
- Never delete a branch because the name looks old. Check the four conditions.
- Never delete `develop` or `main`.
- Do not touch branches owned by other people without asking (`git log --format='%an'`).
- Cleanup of in-progress work is opt-in. If the user did not ask, report and stop.

## 5. Common rationalizations

| Excuse                                                 | Reality                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| "The work is done, I'll leave the branch for the user" | An unmerged branch is unfinished work. Open the PR.          |
| "The PR is up, so the branch is harmless"              | Harmless until it rots. Delete after merge.                  |
| "It is only docs, no need for a PR"                    | Docs-only branches rot the same way. Same flow.              |
| "I'll merge it since CI is green"                      | Merging is the user's call. Ask.                             |
| "This branch is old, it must be merged"                | Age proves nothing. Run the four checks.                     |
| "`git cherry` says merged, so the files are fine"      | Check added files too. A squash merge can drop a new file.   |
| "The worktree is clean, so the branch is safe"         | Check `git status` in the worktree, not just the main tree.  |
| "Force-delete, I verified it earlier"                  | Verify against current `develop`, then delete without force. |
