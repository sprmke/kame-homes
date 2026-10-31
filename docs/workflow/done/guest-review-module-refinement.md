---
title: 'Guest review module refinement'
stage: done
status: done
updated: 2026-08-29
tags: [workflow, done, guest-review, external-reviews, property-detail]
---

# Guest review module refinement

**Goal:** Make guest reviews, SD-form review step, external (seed) reviews, property-detail display, and super-admin moderation production-ready and UX-aligned.

**Locked decisions** (user-confirmed 2026-08-29):

| Decision                               | Choice                                             |
| -------------------------------------- | -------------------------------------------------- |
| Feedback pills on external reviews     | **Yes** — same tag catalog as guest reviews        |
| Category score bars on property detail | **Remove** (no category data collected)            |
| Search + Helpful                       | **Remove Helpful**; **remove search** (minimal UI) |
| Guest review moderation                | **No** — booking-verified, live immediately        |
| Sort                                   | **Newest first**, mixed Kame + approved external   |
| Scope                                  | Phases A + B + C                                   |

---

## Phase A — Property detail display

- [x] Remove `mockReviews` fallback from `PropertyReviews`
- [x] Remove Airbnb-style category average bars
- [x] Remove non-functional Helpful control
- [x] Remove unused search input
- [x] Sort merged reviews by date descending (server `sortPublicGuestReviewsNewestFirst` + client belt)
- [x] Keep source badges, feedback tags, photos, detail modal, lightbox

## Phase B — Shared write UX + external tags

- [x] Extract shared `GuestReviewStarRating` (guest + compact sizes)
- [x] Reuse `GuestReviewFeedbackPills` on external review editor
- [x] Wire shared star + pills into `SdFormReviewSection` and `PropertyExternalReviewsBlock`
- [x] Persist `feedbackTags` on `app_settings.external_reviews` JSONB (normalize + validate; mirror UI/server)
- [x] Public merge maps external `feedbackTags` into `PublicGuestReviewDto`

## Phase C — Super-admin E2E

- [x] Confirm `/admin/approvals` Type=Reviews → dialog → approve/reject (`moderate-external-review` intact)
- [x] Dialog shows feedback tags + stay photos
- [x] Approved reviews appear on property detail; rejected stay off (`listApprovedPublicExternalReviews`)
- [x] Host content edit / asset upload resets to `pending` (existing behavior)

## Docs

- [x] `docs/guides/routes/sd-form.md`, `properties.md`, `org/property/settings.md`, `admin/approvals.md`
- [x] Plan checklist updated

## Out of scope

- Full Airbnb 6-category ratings
- Helpful votes backend
- Guest-review moderation queue
- Showcase carousel redesign (separate surface)
