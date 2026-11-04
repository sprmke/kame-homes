# Branch cleanup audit

**Last run:** 2026-11-04 · **Base:** `develop` (`3b41e15a`), `main` (`babe1985`)

Every local and remote branch was compared against `develop` before anything was deleted.
The audit answers one question per branch: **does this branch still hold a change that
`develop` does not already have?**

## Method

| Check                   | Command                                                                               | What it proves                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Already merged          | `git merge-base --is-ancestor <branch> develop`                                       | Branch tip is in `develop`'s history                                            |
| Content already applied | `git cherry develop <branch>`                                                         | Every patch has an equivalent commit in `develop` (covers squash/rebase merges) |
| Unique files            | `git diff --name-status <merge-base>..<branch>` then `git cat-file -e develop:<path>` | A file the branch added is absent from `develop`                                |
| Superseded files        | compare the branch's blobs with `develop`'s                                           | The branch's version is an older state that `develop` has since replaced        |

A branch was deleted only when **all** of these held:

1. No unapplied patch (`git cherry` shows no `+`), **or** every unapplied patch was traced to a
   successor commit in `develop`, and
2. Every file it added exists in `develop` (or was renamed/moved there), and
3. Every file it modified is either identical to `develop` or an older revision of it.

## Result

| Verdict                                    | Count              |
| ------------------------------------------ | ------------------ |
| Merged or content-merged, deleted (local)  | 95                 |
| Merged or content-merged, deleted (remote) | 79                 |
| Kept: still unmerged                       | 4 local + 3 remote |

PR #204 (`docs/readiness-dashboard-2026-11-01`) closed automatically when its branch was deleted;
its patch was already in `develop` (`git cherry` showed it as applied). PR #153
(`ci/pin-actions-sha`) is untouched and still open.

## Kept branches

| Branch                                                                                    | Why it stays                                                                                                                                                                                                                                                                | Next step                                                                                                          |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `ci/pin-actions-sha` (local + remote)                                                     | Real unmerged work: pins every GitHub Action to a full commit SHA. `develop` still uses floating tags (`@v4`). Open PR #153. Cannot merge as-is because it edits `cd-dev.yml` / `cd-preprod.yml`, which no longer exist.                                                    | Rebase onto `develop`, re-apply to the current 6 workflow files, run CI, merge.                                    |
| `wip/snapshot-20261102` (local)                                                           | Safety snapshot of a cloud session (643 files). Content verified superseded by `develop`, but it is the only copy of that session's working tree.                                                                                                                           | Keep as an archive, or delete once you are satisfied the 2026-11-02 session is fully landed.                       |
| `wip/local-uncommitted-20261103` (local)                                                  | Safety snapshot of the local working tree before a resync (414 files). Same reasoning.                                                                                                                                                                                      | Same as above.                                                                                                     |
| `ui/mobile-native-sizing` (local) + its worktree `.claude/worktrees/mobile-native-sizing` | The branch tip is merged, but that worktree holds **144 uncommitted files** plus an untracked plan (`docs/workflow/in-progress/public-native-density.md`). It sits on an October base, so the diff against `develop` is mostly noise, but nothing there has been committed. | Review it, commit what is still wanted onto a fresh branch off `develop`, then remove the worktree and the branch. |
| `dependabot/bun/minor-and-patch-c833299ba8` (remote)                                      | Closed PR #194, but the branch still holds newer dependency versions than `develop` (45 UI deps, 9 root deps).                                                                                                                                                              | Reopen or regenerate the bump, or delete if you do not want it.                                                    |
| `dependabot/bun/pdfjs-dist-6.4.299` (remote)                                              | Closed PR #203. Major bump `pdfjs-dist` 4.10.38 → 6.4.299, not in `develop`.                                                                                                                                                                                                | Decide whether to take the major bump, then delete.                                                                |

## Deleted branches

Tip SHA recorded so any branch can be restored with
`git branch <name> <sha>` (local) or `git push origin <sha>:refs/heads/<name>` (remote),
as long as the object is still in the local repository.

### Local

| Branch                                            | Tip      | Last commit | Not in develop | Unapplied patches | Ancestor of develop |
| ------------------------------------------------- | -------- | ----------- | -------------- | ----------------- | ------------------- |
| `backup/develop-pre-date-split`                   | e7a0a840 | 2026-10-20  | 63             | 0                 | no                  |
| `backup/develop-pre-sync-20260912-1656`           | 09351cda | 2026-09-11  | 0              | 0                 | yes                 |
| `backup/develop-pre-sync-20261103`                | 4bb562cb | 2026-11-03  | 5              | 3                 | no                  |
| `chore/deps-security-patches`                     | 40d32ee0 | 2026-10-19  | 1              | 0                 | no                  |
| `chore/docs-obsidian-tooling-sync`                | d8a4ada4 | 2026-08-02  | 0              | 0                 | yes                 |
| `chore/merge-main-into-develop`                   | 99be5e14 | 2026-11-03  | 0              | 0                 | yes                 |
| `chore/react-router-v7`                           | ecd8bda5 | 2026-10-19  | 37             | 0                 | no                  |
| `chore/vite5-vitest3`                             | 9b1180b9 | 2026-10-19  | 44             | 0                 | no                  |
| `codebase-restructure`                            | 1cabe01e | 2025-02-09  | 0              | 0                 | yes                 |
| `cursor/intake-guest-review-superadmin-plan-088f` | 201d6530 | 2026-08-31  | 0              | 0                 | yes                 |
| `cursor/remove-kame-branding-d1cd`                | 749acb74 | 2026-08-31  | 0              | 0                 | yes                 |
| `docs/close-legacy-dates`                         | b0bf7583 | 2026-11-04  | 1              | 0                 | no                  |
| `docs/close-legacy-dates-push`                    | b0bf7583 | 2026-11-04  | 1              | 0                 | no                  |
| `docs/close-phase`                                | 3df2b9a6 | 2026-11-04  | 1              | 0                 | no                  |
| `docs/close-phase-push`                           | 3df2b9a6 | 2026-11-04  | 1              | 0                 | no                  |
| `docs/legacy-stay-dates`                          | 34004cc0 | 2026-11-03  | 2              | 2                 | no                  |
| `docs/legacy-stay-reconstruction`                 | d6955e4c | 2026-11-03  | 1              | 1                 | no                  |
| `docs/module-card-evidence`                       | 4df2c072 | 2026-11-03  | 1              | 0                 | no                  |
| `docs/prod-deploy-verify`                         | c1004b89 | 2026-11-02  | 2              | 2                 | no                  |
| `docs/prod-post-deploy`                           | 4449c7dc | 2026-11-02  | 1              | 1                 | no                  |
| `docs/prod-seo-findings`                          | 70aa3c07 | 2026-11-02  | 1              | 0                 | no                  |
| `docs/production-audit`                           | 70aa3c07 | 2026-11-02  | 1              | 0                 | no                  |
| `docs/production-readiness-consolidation`         | 458c367d | 2026-10-19  | 5              | 0                 | no                  |
| `docs/readiness-dashboard-2026-11-01`             | 238b61cf | 2026-11-01  | 1              | 0                 | no                  |
| `docs/readiness-merge-status`                     | f6e6ba7c | 2026-10-19  | 46             | 0                 | no                  |
| `docs/readiness-round-3`                          | bf7ef247 | 2026-10-20  | 60             | 0                 | no                  |
| `docs/readiness-round-4`                          | 15a8660f | 2026-10-20  | 62             | 0                 | no                  |
| `docs/readiness-status-and-tooling`               | c643c4bc | 2026-11-02  | 1              | 0                 | no                  |
| `docs/repair-verified`                            | 7aa72e66 | 2026-11-03  | 1              | 0                 | no                  |
| `docs/repair-verified-push`                       | 7aa72e66 | 2026-11-03  | 1              | 0                 | no                  |
| `docs/same-day-prod-verified`                     | 2ecfef17 | 2026-11-03  | 1              | 0                 | no                  |
| `docs/same-day-verified`                          | 2ecfef17 | 2026-11-03  | 1              | 0                 | no                  |
| `feat/same-day-stays`                             | 4ade9024 | 2026-11-03  | 2              | 2                 | no                  |
| `feature/ai-voice-receptionist`                   | 7fe6b5ae | 2026-07-30  | 0              | 0                 | yes                 |
| `feature/architecture-phase-1`                    | 2849c0d8 | 2026-09-23  | 20             | 19                | no                  |
| `feature/marketing-ai-image-quality-hardening`    | 2849c0d8 | 2026-09-23  | 20             | 19                | no                  |
| `feature/pet-details-settings`                    | d753f849 | 2026-06-17  | 0              | 0                 | yes                 |
| `feature/production-readiness-00-05`              | 252f2346 | 2026-09-17  | 0              | 0                 | yes                 |
| `feature/production-readiness-06-10`              | 252f2346 | 2026-09-17  | 0              | 0                 | yes                 |
| `feature/reskin-app`                              | cd82d192 | 2026-05-30  | 0              | 0                 | yes                 |
| `feature/support-multi-users-and-properties`      | 55c246c8 | 2026-08-07  | 0              | 0                 | yes                 |
| `feature/todos-management-and-restructure`        | 552675ff | 2025-05-27  | 0              | 0                 | yes                 |
| `fix/auth-card-cls`                               | 3c8a5dbf | 2026-10-19  | 2              | 0                 | no                  |
| `fix/axe-sweep-ci-timeout`                        | b18731b4 | 2026-11-02  | 1              | 0                 | no                  |
| `fix/backup-pg17-docker`                          | e3a5e20c | 2026-11-01  | 0              | 0                 | yes                 |
| `fix/brand-text-contrast`                         | 389a1e25 | 2026-10-19  | 0              | 0                 | yes                 |
| `fix/cd-backup-and-restore-drill`                 | 3fea7d5a | 2026-11-03  | 1              | 0                 | no                  |
| `fix/cd-prod-linked-project-kind`                 | b12c3f3c | 2026-11-01  | 0              | 0                 | yes                 |
| `fix/ci-green-guards`                             | 3e269a98 | 2026-10-19  | 0              | 0                 | yes                 |
| `fix/ci-pwa-and-reviews`                          | 3e5f322a | 2026-11-02  | 1              | 0                 | no                  |
| `fix/ci-pwa-project-and-reviews`                  | 3e5f322a | 2026-11-02  | 1              | 0                 | no                  |
| `fix/ci-tslib-lock`                               | ec400338 | 2026-11-01  | 0              | 0                 | yes                 |
| `fix/csp-enforce-ready`                           | b7e58f56 | 2026-10-19  | 48             | 0                 | no                  |
| `fix/db-push-confirm-remote`                      | c40712b9 | 2026-11-03  | 1              | 0                 | no                  |
| `fix/db-push-linked`                              | dccef4c5 | 2026-11-03  | 1              | 0                 | no                  |
| `fix/db-push-yes`                                 | c40712b9 | 2026-11-03  | 1              | 0                 | no                  |
| `fix/deno-lock-tslib`                             | e81c1bd3 | 2026-11-01  | 0              | 0                 | yes                 |
| `fix/deploy-ci-yes`                               | a79d3268 | 2026-11-03  | 1              | 0                 | no                  |
| `fix/deploy-db-push-linked`                       | dccef4c5 | 2026-11-03  | 1              | 0                 | no                  |
| `fix/deploy-noninteractive-yes`                   | a79d3268 | 2026-11-03  | 1              | 0                 | no                  |
| `fix/dev-noindex`                                 | 99e07ca5 | 2026-10-19  | 58             | 0                 | no                  |
| `fix/functions-lock-tslib`                        | 66a675c4 | 2026-11-01  | 0              | 0                 | yes                 |
| `fix/guest-down-payment`                          | 6a4f5f8e | 2026-10-19  | 0              | 0                 | yes                 |
| `fix/hero-search-names-and-zap-rescan`            | c643c4bc | 2026-11-02  | 1              | 0                 | no                  |
| `fix/migration-replay-lint`                       | 0c0cf85d | 2026-11-03  | 0              | 0                 | yes                 |
| `fix/prod-readiness-qa-nits`                      | 5c760b44 | 2026-10-19  | 0              | 0                 | yes                 |
| `fix/prod-robots-and-frame-headers`               | 4894c657 | 2026-11-02  | 1              | 0                 | no                  |
| `fix/property-page-view-tracking`                 | 113b95b2 | 2026-10-19  | 0              | 0                 | yes                 |
| `fix/restore-applied-migrations`                  | 4d633c49 | 2026-11-03  | 0              | 0                 | yes                 |
| `fix/robots-union-defaults`                       | 0595d153 | 2026-11-02  | 1              | 0                 | no                  |
| `fix/safe-redirect-backslash`                     | 8daa6ef5 | 2026-10-19  | 0              | 0                 | yes                 |
| `fix/seed-org-for-fresh-replay`                   | 497c7772 | 2026-11-01  | 0              | 0                 | yes                 |
| `fix/ssrf-guard-user-urls`                        | 36ffa658 | 2026-11-02  | 0              | 0                 | yes                 |
| `fix/stale-chunk-recovery`                        | 220f13bc | 2026-10-19  | 23             | 0                 | no                  |
| `fix/upload-mime-sniff`                           | af70d302 | 2026-10-19  | 0              | 0                 | yes                 |
| `fix/upload-sniff-remaining`                      | e343edb4 | 2026-10-19  | 0              | 0                 | yes                 |
| `fix/wcag-aa-sweep`                               | eb29110a | 2026-11-02  | 2              | 0                 | no                  |
| `fix/workflow-email-failures-visible`             | 9e6228e5 | 2026-10-19  | 0              | 0                 | yes                 |
| `new-changes`                                     | c4fee112 | 2026-05-12  | 0              | 0                 | yes                 |
| `payment-receipt-ai-validation`                   | 3d08774c | 2026-06-17  | 0              | 0                 | yes                 |
| `perf/entry-dashboard-rest`                       | 975d14de | 2026-10-19  | 1              | 0                 | no                  |
| `perf/landing-hero-srcset`                        | d0bc1633 | 2026-10-19  | 0              | 0                 | yes                 |
| `perf/lazy-dashboard-shells`                      | 88cfdfdb | 2026-10-19  | 0              | 0                 | yes                 |
| `perf/public-property-latency`                    | 0ce15dac | 2026-10-19  | 56             | 0                 | no                  |
| `production`                                      | 5bd8443d | 2026-08-08  | 0              | 0                 | yes                 |
| `qa/dev-integration`                              | 843f3f9b | 2026-10-19  | 3              | 0                 | no                  |
| `release/same-day-picker`                         | 6ad14c31 | 2026-11-04  | 3              | 3                 | no                  |
| `test/axe-sweep-bounded`                          | cf5d9865 | 2026-11-03  | 1              | 0                 | no                  |
| `test/axe-sweep-ci-timeout`                       | b18731b4 | 2026-11-02  | 1              | 0                 | no                  |
| `test/e2e-dev-warmup`                             | c281f14d | 2026-10-19  | 46             | 0                 | no                  |
| `test/gate-visible-timeout`                       | 7388390a | 2026-10-19  | 52             | 0                 | no                  |
| `test/marketing-collage-specs`                    | 765eb8e2 | 2026-11-02  | 1              | 0                 | no                  |
| `test/marketing-remaining-fixmes`                 | 3e2452a5 | 2026-11-03  | 1              | 1                 | no                  |
| `test/marketing-studio-specs`                     | 765eb8e2 | 2026-11-02  | 1              | 0                 | no                  |
| `wip/cloud-session-resync-20261102`               | e2409b50 | 2026-11-02  | 0              | 0                 | yes                 |

### Remote (`origin/`)

| Branch                                               | Tip      | Last commit | Not in develop | Unapplied patches | Ancestor of develop |
| ---------------------------------------------------- | -------- | ----------- | -------------- | ----------------- | ------------------- |
| `bugfix/fix-verification-requirements-flow`          | 99bb280f | 2026-09-05  | 0              | 0                 | yes                 |
| `chore/deps-security-patches`                        | 4fab9d4d | 2026-10-19  | 3              | 0                 | no                  |
| `chore/react-router-v7`                              | ecd8bda5 | 2026-10-19  | 37             | 0                 | no                  |
| `chore/vite5-vitest3`                                | 9b1180b9 | 2026-10-19  | 44             | 0                 | no                  |
| `codebase-restructure`                               | 1cabe01e | 2025-02-09  | 0              | 0                 | yes                 |
| `cursor/intake-guest-review-superadmin-plan-088f`    | 201d6530 | 2026-08-31  | 0              | 0                 | yes                 |
| `cursor/remove-kame-branding-d1cd`                   | 749acb74 | 2026-08-31  | 0              | 0                 | yes                 |
| `docs/close-legacy-dates-push`                       | b0bf7583 | 2026-11-04  | 1              | 0                 | no                  |
| `docs/close-phase-push`                              | 3df2b9a6 | 2026-11-04  | 1              | 0                 | no                  |
| `docs/legacy-stay-dates`                             | 34004cc0 | 2026-11-03  | 2              | 2                 | no                  |
| `docs/module-card-evidence`                          | 4df2c072 | 2026-11-03  | 1              | 0                 | no                  |
| `docs/prod-deploy-verify`                            | c1004b89 | 2026-11-02  | 2              | 2                 | no                  |
| `docs/production-audit`                              | 70aa3c07 | 2026-11-02  | 1              | 0                 | no                  |
| `docs/production-readiness-consolidation`            | 458c367d | 2026-10-19  | 5              | 0                 | no                  |
| `docs/readiness-dashboard-2026-11-01`                | 238b61cf | 2026-11-01  | 1              | 0                 | no                  |
| `docs/readiness-merge-status`                        | f6e6ba7c | 2026-10-19  | 46             | 0                 | no                  |
| `docs/readiness-round-3`                             | bf7ef247 | 2026-10-20  | 60             | 0                 | no                  |
| `docs/readiness-round-4`                             | 15a8660f | 2026-10-20  | 62             | 0                 | no                  |
| `docs/readiness-status-and-tooling`                  | eb29110a | 2026-11-02  | 2              | 0                 | no                  |
| `docs/repair-verified-push`                          | 7aa72e66 | 2026-11-03  | 1              | 0                 | no                  |
| `docs/same-day-verified`                             | 2ecfef17 | 2026-11-03  | 1              | 0                 | no                  |
| `feat/same-day-stays`                                | 4ade9024 | 2026-11-03  | 2              | 2                 | no                  |
| `feature/architecture-phase-1`                       | 2849c0d8 | 2026-09-23  | 20             | 19                | no                  |
| `feature/finance`                                    | 60be0e48 | 2026-06-09  | 0              | 0                 | yes                 |
| `feature/help-&-support`                             | d8b02f12 | 2026-08-17  | 0              | 0                 | yes                 |
| `feature/observability-sentry-posthog-split`         | 74bb7822 | 2026-11-02  | 0              | 0                 | yes                 |
| `feature/production-readiness-00-05`                 | 252f2346 | 2026-09-17  | 0              | 0                 | yes                 |
| `feature/reskin-app`                                 | cd82d192 | 2026-05-30  | 0              | 0                 | yes                 |
| `feature/support-multi-users-and-properties`         | 2dfd07dd | 2026-08-08  | 1              | 0                 | no                  |
| `fix-google-calendar-related-issues`                 | f7b75ca0 | 2026-06-16  | 0              | 0                 | yes                 |
| `fix/auth-card-cls`                                  | 3c8a5dbf | 2026-10-19  | 2              | 0                 | no                  |
| `fix/backup-pg17-docker`                             | e3a5e20c | 2026-11-01  | 0              | 0                 | yes                 |
| `fix/brand-text-contrast`                            | f0b61903 | 2026-10-19  | 2              | 0                 | no                  |
| `fix/cd-backup-and-restore-drill`                    | 3fea7d5a | 2026-11-03  | 1              | 0                 | no                  |
| `fix/cd-prod-linked-project-kind`                    | b12c3f3c | 2026-11-01  | 0              | 0                 | yes                 |
| `fix/ci-green-guards`                                | 3e269a98 | 2026-10-19  | 0              | 0                 | yes                 |
| `fix/ci-pwa-and-reviews`                             | 3e5f322a | 2026-11-02  | 1              | 0                 | no                  |
| `fix/ci-tslib-lock`                                  | ec400338 | 2026-11-01  | 0              | 0                 | yes                 |
| `fix/cors-probe-blocked-origin`                      | 03c95083 | 2026-11-01  | 1              | 0                 | no                  |
| `fix/csp-enforce-ready`                              | b7e58f56 | 2026-10-19  | 48             | 0                 | no                  |
| `fix/db-push-confirm-remote`                         | c40712b9 | 2026-11-03  | 1              | 0                 | no                  |
| `fix/deno-lock-tslib`                                | e81c1bd3 | 2026-11-01  | 0              | 0                 | yes                 |
| `fix/deploy-ci-yes`                                  | a79d3268 | 2026-11-03  | 1              | 0                 | no                  |
| `fix/deploy-db-push-linked`                          | dccef4c5 | 2026-11-03  | 1              | 0                 | no                  |
| `fix/dev-noindex`                                    | 99e07ca5 | 2026-10-19  | 58             | 0                 | no                  |
| `fix/functions-lock-tslib`                           | 66a675c4 | 2026-11-01  | 0              | 0                 | yes                 |
| `fix/guest-down-payment`                             | e2bfe985 | 2026-10-19  | 2              | 0                 | no                  |
| `fix/hero-search-names-and-zap-rescan`               | c643c4bc | 2026-11-02  | 1              | 0                 | no                  |
| `fix/marketing-low-spec-signals`                     | 79766629 | 2026-11-01  | 1              | 0                 | no                  |
| `fix/marketing-media-library-plan-tiers`             | b8beeb82 | 2026-11-01  | 4              | 4                 | no                  |
| `fix/notifications-feed-and-ci-e2e`                  | c2ad3c0f | 2026-11-01  | 1              | 0                 | no                  |
| `fix/prod-readiness-qa-nits`                         | 8a6813aa | 2026-10-19  | 2              | 0                 | no                  |
| `fix/prod-robots-and-frame-headers`                  | 4894c657 | 2026-11-02  | 1              | 0                 | no                  |
| `fix/property-page-view-tracking`                    | 14ec0513 | 2026-10-19  | 2              | 0                 | no                  |
| `fix/restore-applied-migrations`                     | 4d633c49 | 2026-11-03  | 0              | 0                 | yes                 |
| `fix/rls-probe-denied-tables`                        | 73627f2a | 2026-11-01  | 1              | 0                 | no                  |
| `fix/robots-union-defaults`                          | 0595d153 | 2026-11-02  | 1              | 0                 | no                  |
| `fix/safe-redirect-backslash`                        | fed90dd0 | 2026-10-19  | 2              | 0                 | no                  |
| `fix/ssrf-guard-user-urls`                           | 53674648 | 2026-11-02  | 1              | 0                 | no                  |
| `fix/stale-chunk-recovery`                           | 220f13bc | 2026-10-19  | 23             | 0                 | no                  |
| `fix/upload-mime-sniff`                              | 098a91f3 | 2026-10-19  | 2              | 0                 | no                  |
| `fix/upload-sniff-remaining`                         | 82c0d21c | 2026-10-19  | 2              | 0                 | no                  |
| `fix/wcag-aa-sweep`                                  | 5d2f141d | 2026-11-02  | 1              | 0                 | no                  |
| `fix/workflow-email-failures-visible`                | a14daaaa | 2026-10-19  | 2              | 0                 | no                  |
| `improvement/refine-onboarding-&-verification-flow`  | d6836b57 | 2026-08-17  | 0              | 0                 | yes                 |
| `improvements/update-onboarding-&-verification-flow` | b19fb87e | 2026-08-31  | 0              | 0                 | yes                 |
| `new-changes`                                        | c4fee112 | 2026-05-12  | 0              | 0                 | yes                 |
| `payment-receipt-ai-validation`                      | 3d08774c | 2026-06-17  | 0              | 0                 | yes                 |
| `perf/entry-dashboard-rest`                          | b5551367 | 2026-10-19  | 3              | 0                 | no                  |
| `perf/landing-hero-srcset`                           | d49bbd59 | 2026-10-19  | 2              | 0                 | no                  |
| `perf/lazy-dashboard-shells`                         | b4244d7c | 2026-10-19  | 2              | 0                 | no                  |
| `perf/public-property-latency`                       | 0ce15dac | 2026-10-19  | 56             | 0                 | no                  |
| `production`                                         | 5bd8443d | 2026-08-08  | 0              | 0                 | yes                 |
| `release/same-day-picker`                            | 6ad14c31 | 2026-11-04  | 3              | 3                 | no                  |
| `test/axe-sweep-bounded`                             | cf5d9865 | 2026-11-03  | 1              | 0                 | no                  |
| `test/axe-sweep-ci-timeout`                          | b18731b4 | 2026-11-02  | 1              | 0                 | no                  |
| `test/e2e-dev-warmup`                                | c281f14d | 2026-10-19  | 46             | 0                 | no                  |
| `test/gate-visible-timeout`                          | 7388390a | 2026-10-19  | 52             | 0                 | no                  |
| `test/marketing-collage-specs`                       | 765eb8e2 | 2026-11-02  | 1              | 0                 | no                  |

## Findings that came out of the audit

- **`main` is 56 commits behind `develop`.** No work is lost, but production has not received
  the 2026-11-02 → 11-04 batch. Promotion needs a `develop` → `main` PR, not a branch cleanup.
- **`main` has 2 commits `develop` does not** (`babe1985` brand name resolver, `dcd484a9` PWA
  manifest name). Their files are byte-identical in `develop` (the PWA rewrite replaced them),
  so `develop` already carries the fix. A `develop` → `main` merge will not revert them.
- **`ui/vercel.json` on `develop` has a duplicated `redirects` key** (top-level keys:
  `framework, installCommand, buildCommand, redirects, devCommand, outputDirectory, redirects,
rewrites, headers`). JSON parsers keep the last one, so the first redirect block is dead.
  This is a merge artifact, not branch clutter. Fix it separately.
- `ci/pin-actions-sha` is the only branch with a real, still-relevant change that is not merged.

## 2026-11-04 follow-up

| Branch          | Tip SHA     | Checks                                                                                         | Action             |
| --------------- | ----------- | ---------------------------------------------------------------------------------------------- | ------------------ |
| `debug/pwa-e2e` | `6f2df4014` | ancestor of `develop`; `git cherry` empty; no unique files; no open PR; no worktree; no remote | Deleted local only |

## Re-running this audit

```bash
git fetch origin --prune
# merged?
git merge-base --is-ancestor <branch> develop
# content applied? (no "+" lines = fully applied)
git cherry develop <branch>
# added files missing from develop
git diff --name-status $(git merge-base develop <branch>)..<branch> | awk '$1=="A"{print $2}'
```

The `branch-lifecycle` skill (`.agent/skills/branch-lifecycle/`) wraps this into a repeatable
checklist and defines when a branch must be deleted.
