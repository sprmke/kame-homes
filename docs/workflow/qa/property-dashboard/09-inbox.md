---
title: 'QA — Property Inbox'
status: active
updated: 2026-09-21
---

# 09 — Inbox

Route: `/org/:orgSlug/property/:propertySlug/inbox`

## Looks good

- Web chat free; Meta connect Business+ (`metaChatChannel`); AI auto-send Business+.
- Quick replies Starter+; Manage leaf-split permissions.
- Share booking links from composer — strong ops feature.
- **Phase 3:** Channels → **Connect Meta** on Pro opens **Upgrade to Business** (correct gate); “Using org Meta” badge visible.
- **Phase 4 (Business):** Connect Meta starts real Facebook OAuth (`META_APP_ID`); no upgrade modal. Page grant left for human login.

## Issues

| Sev | Issue                                                                                                                                                                                                                                                                                                                       | Evidence                                                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2  | Meta is where PH hosts live — gating connect to Business+ pushes them off-platform                                                                                                                                                                                                                                          | Matrix + host critique — **triaged 2026-09-20**: confirmed intentional, already-reviewed pricing tradeoff, not an oversight (see `plans-feature-matrix.md` § Open questions — resolved). No tier change without a product decision. |
| P2  | ~~Org Meta inheritance badge is correct but confusing for multi-property hosts~~ — **Fixed (2026-09-21)**: badge moved into the open conversation header (not just Channels tab) with an explanatory tooltip, plus a best-effort **cross-property switcher** link when the thread matches a booking on a different property | Guide Q&A                                                                                                                                                                                                                           |
| P3  | Full Meta OAuth + 24h window needs human Facebook login + test Page — **blocked on human interaction**, cannot be automated                                                                                                                                                                                                 | Phase 4                                                                                                                                                                                                                             |

## Improvements

- Consider Starter Meta read-only / reply with limited pages (product decision).
- ~~Property switcher from within a thread when org Meta shows cross-property noise.~~ **Shipped (2026-09-21)**: `useInboxCrossPropertyMatch` — org-wide booking match (reuses `inboxMatchBooking.ts`'s existing name/date matcher), "Looks like `<property>`" link deep-links to the matched property's Inbox with the same conversation open (Meta conversations are keyed by connection, not property, so this works). E2E: `inboxThreadListSmoke.spec.ts`.

## Doc gaps

- Guide current (2026-08-28).

## Evidence

Live Inbox load; Phase 3 Connect Meta → upgrade modal; Phase 4 Business OAuth start → facebook.com; guide + social-inbox rule; matrix.
