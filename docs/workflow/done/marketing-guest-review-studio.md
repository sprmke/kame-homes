---
title: 'Marketing — guest reviews in Canvas & Video'
status: done
tags: [workflow, done, marketing, guest-reviews, canvas, video]
updated: 2026-09-01
stage: done
kind: plan
---

# Marketing — guest reviews in Canvas Design & Video Editor

## Goal

Hosts can **manage, view, and turn completed-stay guest reviews into social content** inside Marketing Content Studio: pick a review, design a Quiet Coast canvas graphic, and/or build a Guest-love reel — then download or publish to Meta — end-to-end without leaving Marketing.

## Competitive UX brief (adopt / adapt / skip)

| Source                | Pattern                                                                          | Kame Homes                                                                                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Airbnb**            | Reviews stay on-platform; ToS restrict republishing Airbnb review text elsewhere | **Adopt:** only auto-seed social copy from **Kame-owned** `guest_reviews` (+ host-authored Facebook external reviews). Airbnb external rows stay browsable; no one-click text-to-post for Airbnb quote text. |
| **Hostaway / Guesty** | Review center for ops + auto-request; no native “review → Instagram reel”        | **Adapt:** Marketing-first **Reviews** picker (not a separate PMS Reviews module) with **Create design** / **Create reel** as primary actions. Skip host↔guest review reply workflows (out of scope).        |
| **Canva / CapCut**    | Template → replace text/photo                                                    | **Adopt:** bind review fields into existing Design/Video presets; host can still edit layout after seed.                                                                                                     |

## Scope

### In

1. **Host review library** in Marketing Studio (property-scoped): list Kame + approved external reviews with rating, excerpt, media, source, date.
2. **Select review → Design**: seed Quiet Coast **Reviews** canvas presets (stars, quote, guest name, optional stay photo / property photo).
3. **Select review → Video**: seed **Guest love** / **Stay again** (Reviews category) with real quote, attribution, and review media when present.
4. **Composition edits** on canvas/video (truncate quote, swap photo, tweak CTA) — stored only on the marketing draft/template, **not** on the source review row.
5. Admin API to list property reviews for hosts (today only public + insert paths exist).
6. Docs: Marketing route guide, `docs/PROJECT.md` API row, plans/permissions decision.

### Out

- Mutating/deleting guest-submitted `guest_reviews` rows (immutable — see locked decision below).
- Guest-facing review **page** theming (`/guest-review` / SD step) — separate intake item _Marketing — edit guest review page design_.
- Super-admin moderation for Kame reviews (already locked **No** in [`../done/guest-review-module-refinement.md`](../done/guest-review-module-refinement.md)).
- Calendar Builder (no review binding).
- Auto-post on review submit; AI review summarization (roadmap elsewhere).
- AI Generate “Use guest review” Content-step selector (optional follow-on — host can seed after generate via the Reviews sidebar).

## Locked product decisions

| Decision                 | Choice                                                                                                                                | Why                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Source of truth          | `guest_reviews` stays **immutable**                                                                                                   | Guest authenticity + existing table contract                     |
| “Edit” meaning           | Edit **marketing composition** (quote length, display name for post, which media, stars layout)                                       | Hosts need control for IG/FB without rewriting the public review |
| Social seed eligibility  | **Kame** reviews always; **Facebook** external when approved; **Airbnb** external = library only (no text seed)                       | Platform ToS / content ownership                                 |
| Where UI lives           | Marketing Studio — **Reviews** category in Design + Video sidebars; **Reviews** list under Templates (not a modal; not a 4th top tab) | Keeps Calendar/Design/Video IA; reviews are content inputs       |
| Min rating for templates | Default filter **≥ 4★** (no UI toggle); paginate 5 per page when >5 reviews                                                           | Social proof quality + sidebar length                            |
| Plans                    | **N/A new key** — reuse `marketingStudio` (Pro+) for download/publish; browse/preview-open below Pro with existing watermarks         | Same surface as Design/Video                                     |
| Team RBAC                | **N/A new leaves** — `marketing:view` to open list; `marketing.content:edit` to seed/autosave; `marketing.publish:add` for Publish    | Covered by Marketing catalog                                     |
| External review CRUD     | Stay on **Settings → Reviews & vouchers / external reviews**                                                                          | Already shipped; Marketing does not replace Settings             |

## Approach

```
guest_reviews (+ approved external)
        │
        ▼
 list-property-guest-reviews (admin JWT + property scope)
        │
        ▼
 Marketing Reviews sidebar ──► applyReviewToDesign(polotno)
                    └──► applyReviewToVideo(project)
        │
        ▼
 Existing autosave / Download / Publish (Meta)
```

### Data model

No new table. Design autosave stores `designJson.sourceReviewId` (+ binding fields). Video stores `project.sourceReviewId`.

### API

| Function                      | Method | Auth                                                         | Behavior                                                                                                                                                                                                                                                   |
| ----------------------------- | ------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list-property-guest-reviews` | GET    | Admin + property scope (`marketing:view` or property access) | Merged newest-first: Kame `guest_reviews` + approved `external_reviews`. Query: `?minRating=&limit=&source=&socialSeedOnly=1`. Returns DTOs safe for marketing (id, author, rating, comment, feedbackTags, media[], source, createdAt, socialSeedAllowed). |

### Design (Canvas)

1. Campaign category **`reviews`** (label **Reviews**).
2. Three Quiet Coast presets: Quote card / Photo + quote / Stars stack (`review-quote`, `review-photo-quote`, `review-stars`).
3. **Reviews** list under Templates when category is Reviews; pick → `bindingWithReview` + re-apply preset.
4. AI generate category `reviews` supported.

### Video

1. **Guest love** / **Stay again** under **Reviews** (legacy id `social-proof` → `reviews`).
2. Pick review → quote / attribution / media via `applyGuestReviewToVideoProject`.
3. Shared `MarketingReviewSidebarSection`.

### Host flows (E2E)

1. Guest completes stay → submits review.
2. Host opens Marketing → Design or Video → **Reviews** → Reviews list under Templates.
3. List shows ≥4★ by default (paginated); host selects one → canvas/reel seeds.
4. Host edits → autosave → Download / Publish (existing gates).

## Implementation tasks

### Phase 0 — Shared types + API (foundation)

- [x] `_shared` DTO + `listPropertyGuestReviewsForMarketing(propertyId, opts)`
- [x] Edge `list-property-guest-reviews` + `config.toml` + `docs/architecture/edge-functions.md` / `docs/PROJECT.md`
- [x] UI `usePropertyGuestReviews` + `lib/marketingGuestReview.ts`
- [x] Deno unit tests (`marketingGuestReviews_test.ts` — 5/5 pass with `--no-check`)

### Phase 1 — Reviews picker UI

- [x] `MarketingReviewSidebarSection` under Templates (Design/Video **Reviews** only)
- [x] Pagination (5/page); empty state **No reviews yet** only
- [x] Empty / loading / error states; mobile 44px rows

### Phase 2 — Design presets + seed

- [x] Category + 3 presets + Polotno builders
- [x] Seed via `bindingWithReview` + re-apply; `sourceReviewId` on autosave
- [x] AI tokens + generate options for `reviews`

### Phase 3 — Video seed

- [x] Video category **Reviews** (legacy `social-proof` alias)
- [x] `applyGuestReviewToVideoProject` for guest-love / stay-again
- [x] Prefer review images; persist `sourceReviewId`

### Phase 4 — Polish + verify

- [x] Type-check clean (`bun run type-check` in `ui/`)
- [x] Lint: 0 errors
- [x] Filenames OK
- [x] Deno filter/ToS unit tests 5/5
- [x] Local edge smoke: unauthenticated `list-property-guest-reviews` → **401**
- [x] Confirm Free-tier watermark + Pro download gate unchanged
- [x] Confirm Airbnb external cannot seed (`socialSeedAllowed` + `socialSeedOnly`)
- [ ] Full signed-in browser E2E (host verifies when logged in) — stack serves function; UI path documented

## Verification notes (2026-09-01)

| Check                | Result                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| UI type-check        | Pass                                                                                                                                                                     |
| UI lint errors       | 0                                                                                                                                                                        |
| Filename conventions | OK                                                                                                                                                                       |
| Deno unit tests      | 5/5 (`--no-check --allow-env`)                                                                                                                                           |
| Edge auth gate       | 401 without valid JWT                                                                                                                                                    |
| Perf                 | Reviews query only when Reviews category mounted; `staleTime` 30s; memoized query params; no double filter on list endpoint; Design re-seed keyed on `selectedReview.id` |
| Plans / RBAC         | N/A new — `marketingStudio` + existing `marketing:*` leaves                                                                                                              |

## Docs updated

| Doc                                            | Change                                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `docs/guides/routes/org/property/marketing.md` | Reviews category (Design + Video), sidebar list, pagination, Settings empty link |
| `docs/PROJECT.md`                              | Feature blurb                                                                    |
| `docs/architecture/edge-functions.md`          | `list-property-guest-reviews`                                                    |
| `docs/architecture/plans-feature-matrix.md`    | N/A new plan key                                                                 |
| Intake `_to-plan.md`                           | ✅ + Done link                                                                   |

## Related

- Guest reviews shipped: [`guest-review-module-refinement.md`](./guest-review-module-refinement.md)
- Marketing refinement (perf): [`../done/marketing-module-refinement.md`](../done/marketing-module-refinement.md)
- Intake sibling (page theming): _Marketing — edit guest review page design_ in `_to-plan.md`
