---
stage: planned
title: 'Marketing — Meta publishing feature gaps (scheduling, confirmation, Reels)'
status: planned
tags: [workflow, planned, marketing, publishing, meta]
updated: 2026-09-09
kind: plan
---

# Marketing — Meta publishing feature gaps

**Split from** [`../done/marketing-module-refinement.md`](../done/marketing-module-refinement.md) (Marketing 5). That plan's scope was the reported performance / rendering / AI-generation bugs plus the Instagram video publish race — all shipped. The gaps below surfaced from a broader "is publishing production-ready" code audit, were never in that plan's scope, and are carried here so they are not silently dropped.

## Gaps (from code audit — not yet fixed)

| Gap                                            | Where                                         | Notes                                                                                                                                                                                 |
| ---------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Facebook Stories unsupported                   | `publish-to-meta/index.ts`                    | Explicit 400 — `resolvePublishType` returns `null` for `platform=facebook, postType=story`. Documented in `docs/guides/routes/org/property/marketing.md` as a v1 gap.                 |
| Facebook video unsupported                     | `publish-to-meta/index.ts:161-163`            | Explicit 400 `'Facebook video publishing is not supported in v1'`. Documented.                                                                                                        |
| Instagram scheduling doesn't actually schedule | `publish-to-meta/index.ts:212-221`            | A future-dated IG request is stored as `pending` with no cron/scheduler to publish it later — a host who schedules sees nothing happen. Flagged in the route guide as a known v1 gap. |
| `scheduledAt` never sent from the UI           | `marketingPublishApi.ts`, `PublishDialog.tsx` | Even where the backend supports scheduling (Facebook), `PublishDialog` never collects or sends a `scheduledAt` — no date/time picker in the dialog.                                   |
| No publish confirmation / permalink shown      | `PublishDialog.tsx`, `PublishHistory.tsx`     | Success only shows a toast; the resulting `metaPostId` is captured by the API type but never rendered, so a host can't click through to verify the live post.                         |
| No retry from Publish History                  | `PublishHistory.tsx`                          | Failed publishes show `errorMessage` but there's no retry action.                                                                                                                     |
| Instagram Reels unreachable from the UI        | `PublishDialog.tsx`                           | Backend supports `instagram_reel`, but the dialog only offers Post / Story — Reels is dead code from the client's perspective.                                                        |

## Scope (when started)

1. **Scheduling, end to end.** `scheduledAt` picker in `PublishDialog`; wire it through `marketingPublishApi.ts`; a scheduled-publish cron (hosted `pg_cron` + `pg_net`, per `scheduled-jobs-and-testing.md`) that drains `pending` future-dated rows for every platform that supports scheduling, with status + error surfaced in Publish History.
2. **Publish confirmation.** Render `metaPostId` as a permalink in the success state and in `PublishHistory` so a host can open the live post.
3. **Retry.** Retry action on failed `PublishHistory` rows (re-submit the stored payload; new history row).
4. **Instagram Reels.** Expose `instagram_reel` as a post-type option in `PublishDialog` (video source only) and confirm the existing backend path.
5. **Decide Facebook Stories / Facebook video.** Either implement via the Meta Graph video + stories endpoints, or keep the explicit 400 and make the "not supported" messaging in the dialog unmistakable (not a generic failure toast).

## Out of scope

- Marketing Studio mobile-editing parity — [`./marketing-studio-mobile-and-dashboard-responsive.md`](./marketing-studio-mobile-and-dashboard-responsive.md).
- Generate-modal suggestion-thumbnail polish (tracked in `intake/_to-prompt.md`).
- Any change to the AI generation pipeline — that work is done.

## Verification (no automated suite in this repo)

- `bun run type-check` / `lint` / `build` clean.
- `bun run dev:api` + a connected Facebook Page + Instagram test account: schedule a post for +5 min → cron publishes it → history shows `published` + working permalink; force a failure → retry succeeds; publish an `instagram_reel`; confirm FB Story / FB video failure mode is clean.
- Update `docs/guides/routes/org/property/marketing.md` (Publish to Meta section) and remove the "known v1 gap" notes as each ships.
- `audit-logging`: `publish-to-meta` already emits `marketing.published_to_meta`; extend to the scheduled-publish cron run + retry.

## Related

- Done: [`../done/marketing-module-refinement.md`](../done/marketing-module-refinement.md) (Marketing 5 — perf / AI-gen / IG video race)
- Done: [`../done/guest-inbox-meta-hardening.md`](../done/guest-inbox-meta-hardening.md) (Meta OAuth / webhook hardening)
- `docs/guides/routes/org/property/marketing.md` · `docs/archive/operations/scheduled-jobs-and-testing.md`
