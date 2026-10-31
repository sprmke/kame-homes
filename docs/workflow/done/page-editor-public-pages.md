---
title: 'Page Editor — Host-Configurable Public Pages'
status: done
tags: [workflow, done, public-pages, page-editor, stay-guide, plans]
updated: 2026-08-20
stage: done
kind: plan
---

# Page Editor — Host-Configurable Public Pages

## Context

Hosts today can only "Open" or "Copy link" for each of their 8 guest-facing public pages, from a plain icon-grid gallery (`CustomPagesPage.tsx` at `/org/:orgSlug/property/:propertySlug/public-pages`). Content and appearance for those pages is split across two places that don't fully cover what hosts actually want to change: **Property Settings** (structural fields like description, amenities, house rules, cancellation policy, brand color, photos — buried across many settings tabs) and the **Templates** page (rich-text body copy for the Stay Guide's four fixed sections). Neither lets a host control _what shows, in what order, or how it's styled_ on the actual public page — that's all hardcoded in the React components.

The user wants a proper **Page Editor**: click "Edit" on a public page → a builder with a left-side controls panel and a right-side realtime preview, where a host can toggle sections on/off, reorder them, adjust styling, and edit content — as configurable as reasonably possible without turning this into a generic drag-and-drop CMS. Two firm requirements: (1) **single source of truth** — once a setting becomes editable in the Page Editor, its old control in Property Settings must be removed, not duplicated; (2) the **Public Pages gallery** itself needs a UI upgrade, since a flat icon grid doesn't scale once cards need an "Edit" action and real state (last edited, etc.).

Research found the groundwork is already unusually well-prepared for this: a token-content system (`property_template_contents`) already powers Stay Guide's four sections, a stub `custom_pages` table already exists for future template selection, Marketing Studio's Calendar Builder already proves out the exact "left controls / right realtime preview" UI pattern this app needs (reusable wholesale, not reinvented), `@dnd-kit` is already a dependency with a working reorder pattern (`PropertyMediaUpload.tsx`), and a `customPages` plan-feature flag _already exists_ in the pricing catalog with a ready-made `<FeatureGate>` component and server-side `requirePropertyFeature()` helper — it's defined but never actually wired to anything, which is exactly the gate this feature needs.

**Locked decisions:**

1. **Phase 1 scope**: Stay Guide + Property Landing page get the editor first. Calendar/Form/SD-form/Pay-parking/Guest-review get their own editor phases later (mapped below, not built now).
2. **Rendering model**: keep the existing coded React components; the editor writes structured JSON config to the DB that drives their props (visibility, order, color/style, text) — not a generic block/CMS system with arbitrary new block types.
3. **`property-public-pages-shell-redesign.md`** (an unrelated, unstarted layout/shell-merge plan that also touched `PropertyDetailPage.tsx`) has been **moved to [`../wont-do/property-public-pages-shell-redesign.md`](../wont-do/property-public-pages-shell-redesign.md)** — this plan proceeds alone, no coordination needed. (Done — see Phase 0.)
4. **Plan gating**: the entire Public Pages section (gallery + editor) requires the **Starter** plan tier (`pricing_plans.code = 'starter'`) or higher. **`customPages` is already `true` for Starter** (and Growth+) as of `20261029120000_plan_tier_feature_catalog.sql`; Free stays `false`. This plan **enforces** the flag for the first time (it was defined but unused). No separate starter-flip migration needed.

---

## Progress

| Phase                      | Status   | Notes                                                                                                                  |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| 0 Housekeeping             | ✅       | Shell redesign moved to wont-do                                                                                        |
| 1 Data & edge foundation   | ✅       | Table + shared helper + `public-page-configs` + guest DTO `sectionConfig` + plan copy; starter DB flip already present |
| 2 Guest pages honor config | ✅       | Stay Guide + Property Landing filter/reorder/accent from `sectionConfig`                                               |
| 3 Page Editor + Stay Guide | ✅       | Shell, preview override, Stay Guide controls, autosave, gallery Edit CTA, `customPages` route gate                     |
| 4 Landing editor + media   | ✅       | Listing editor, media + brand color migrated out of Settings, `#media` banner, listing Edit CTA                        |
| 5 Landing content migrate  | ✅       | Amenities, house rules, cancellation, socials, description in listing editor; Settings slimmed                         |
| 6 Gallery redesign         | ✅       | Two sections; `editable` registry; last-edited meta; larger Edit cards                                                 |
| 7 Docs & wrap-up           | ✅       | PROJECT.md Page Editor; stay-guide + properties + settings guides; plan → done                                         |
| 8 Backlog                  | deferred | Multi-template stay guide; editors for other guest pages — outline only                                                |

## 0. Preliminary housekeeping — done

- ✅ Moved `docs/workflow/planned/property-public-pages-shell-redesign.md` → [`docs/workflow/wont-do/property-public-pages-shell-redesign.md`](../wont-do/property-public-pages-shell-redesign.md) via `bash scripts/dev/workflow-move.sh wont-do`, and updated both `planned/README.md` and `wont-do/README.md` indexes.

---

## 1. Data model

### New table: `public_page_configs`

```sql
CREATE TABLE public.public_page_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  page_type TEXT NOT NULL CHECK (page_type IN ('stay_guide', 'property_landing')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT public_page_configs_property_page_type_unique UNIQUE (property_id, page_type)
);
CREATE INDEX public_page_configs_property_id_idx ON public.public_page_configs (property_id);
```

- Separate from `custom_pages` (which stays as-is — a single `template_key` string for _future_ full alternate visual template selection) and separate from `property_template_contents` (rich-text body copy, untouched). This table owns exactly one concern: **visibility + order + light style overrides** per page section — the thing that currently has no home at all.
- `page_type` CHECK list grows via new migrations as later phases add page types (`calendar`, `guest_form`, etc.), same convention `custom_pages.page_type` already established.
- Lazy-create-on-read, mirroring `_shared/customPages.ts#getOrCreateCustomPage` exactly, in a new `supabase/functions/_shared/publicPageConfigs.ts` (`getOrCreatePublicPageConfig`, `upsertPublicPageConfig`, `defaultStayGuideConfig()`, `defaultPropertyLandingConfig()`, `normalizeStayGuideConfig()`/`normalizePropertyLandingConfig()` to backfill missing keys as the shape evolves).

### Config shapes

```ts
type StayGuideConfig = {
  version: 1;
  hero: { visible: boolean };
  stayPassCard: { visible: boolean };
  galleryCarousel: { visible: boolean };
  quickNavTabs: { visible: boolean };
  chapters: {
    id: 'getting-in' | 'make-yourself-at-home' | 'before-you-go';
    visible: boolean;
    order: number;
    accentColor: string | null; // null = inherit brand color
  }[];
  helpSection: { visible: boolean };
};

type PropertyLandingConfig = {
  version: 1;
  sections: {
    id: 'gallery' | 'overview' | 'amenities' | 'location' | 'rules' | 'reviews';
    visible: boolean;
    order: number;
  }[];
  // BookingCard is not togglable (core conversion element).
  // SimilarProperties stays out of scope (always-mock, not property-specific).
};
```

### Where content data physically lives — do not move it

**Decision: content stays exactly where it is today** (`properties.settings.*`, `app_settings.*`). The Page Editor becomes a second UI surface that reads/writes the _same_ columns via the _same_ (or lightly extended) edge functions. `public_page_configs` holds only the new visibility/order/style concern, layered on top.

Concretely, unchanged storage locations:

- `properties.settings.description`, `.media` (photos/videos array), `.enabledAmenities`/`.customAmenities`, `.enabledHouseRules`/`.customHouseRules`, `.cancellationPolicy`
- `app_settings.brand_color`, `.facebook_reviews_url`/`.airbnb_url`/`.instagram_url`/`.tiktok_url`, `.external_reviews` (JSONB)

This avoids a backfill/migration script, avoids any window where two storage locations could disagree, and keeps every existing read path (`get-public-property`, emails, etc.) untouched. "Single source of truth" here means **one editable UI surface**, not a storage relocation — moving data would be unjustified complexity for zero functional gain.

**First-load guarantee**: on first GET, the config row is created with all-visible/natural-order defaults, and content fields are read straight from their existing columns — so a host's very first open of the editor renders identically to today's live page. No surprise regressions.

---

## 2. Edge functions

Follow the confirmed real conventions (`serveAuthenticated` + `resolveScopedPropertyAccess(req, permission)` — same as `custom-pages-settings`/`property-templates-settings`, not the `serveAdmin`/`verifyPropertyAccess` names used elsewhere in the repo for a different auth style).

### New: `supabase/functions/public-page-configs/index.ts`

One function, `page_type` as a discriminator (mirrors how `property-templates-settings` already handles multiple template categories in one function):

- `GET ?property_id=&page_type=stay_guide|property_landing` → `{ config, updatedAt }`. Permission: `templates:view` (same permission that already gates Templates + Public Pages nav — no new permission literal needed).
- `PATCH { pageType, config }` → validates shape per `page_type`, `upsertPublicPageConfig`, returns updated row. Permission: `templates:edit`.
- **Plan gate**: both verbs call `requirePropertyFeature(propertyId, 'customPages')` (from `_shared/planEntitlements.ts`) before doing anything else, catching with `catchPlanFeatureError(req, err)` — identical pattern to other gated edge functions in this repo.

### New shared helper: `supabase/functions/_shared/publicPageConfigs.ts`

`getOrCreatePublicPageConfig`, `upsertPublicPageConfig`, default builders, normalizers — see §1.

### Extend existing public render paths (read-only, no write, no auth required — these are `servePublic` anon functions)

- `_shared/guestStayGuide.ts` (`loadGuestStayGuideByToken`, `loadGuestStayGuidePreview`) — add a **read-only** `getPublicPageConfigOrDefault(propertyId, 'stay_guide')` lookup (defaults if missing, no write on every guest page load) and include `sectionConfig` in the DTO returned by `get-guest-stay-guide` / `preview-guest-stay-guide`.
- `_shared/publicPropertyService.ts` (backing `get-public-property`) — same pattern for `property_landing`.

---

## 3. Frontend architecture

### 3.1 Route

```
/org/:orgSlug/property/:propertySlug/public-pages/:pageId/edit
```

Registered in `ui/src/features/dashboard/custom-pages/routes/index.tsx` (extend `customPagesPropertyRoute`), reusing the existing `public-pages` permission section (`propertyPermissions.ts`) — no new nav-permission entry. `pageId` ∈ `{'stay-guide', 'listing'}` in Phase 1 (matches `PropertyGuestPublicPage['id']`); any other id redirects back to `/public-pages` (defense-in-depth; the gallery won't link to non-editable pages anyway).

Wrap the whole editor route element in a `RequirePropertyFeature`-style route guard (reusing `useFeatureGate('customPages')` + `useUpgradeModal()`) that redirects to the Plans/upgrade flow when not entitled — follow whatever pattern `RequirePropertySubscriptionAccess` already uses for the suspended-gate case.

### 3.2 New feature folder: `ui/src/features/dashboard/page-editor/`

```
page-editor/
  pages/PageEditorPage.tsx            — route entry, resolves pageId → editor variant
  components/
    PageEditorShell.tsx               — left/right split, wraps MarketingEditorSidebar
    PageEditorHeader.tsx              — back link, title, autosave status, undo/redo
    PageEditorPreviewPane.tsx         — right pane, scale-to-fit (mirrors CalendarPreviewScaledFrame)
    controls/
      SectionVisibilityToggle.tsx
      SectionOrderList.tsx            — dnd-kit sortable, wraps PropertyMediaUpload's DnD pattern
      AccentColorControl.tsx          — thin wrapper on calendar-builder's ColorPicker.tsx
    stay-guide/StayGuideEditorPanel.tsx
    property-landing/
      PropertyLandingEditorPanel.tsx
      PropertyLandingAmenitiesControl.tsx
      PropertyLandingHouseRulesControl.tsx
      PropertyLandingCancellationControl.tsx
      PropertyLandingSocialsControl.tsx
  stores/
    stayGuideEditorStore.ts           — Zustand+immer, mirrors calendarBuilderStore.ts (path-based updateConfig, undo/redo, isDirty)
    propertyLandingEditorStore.ts
  hooks/
    usePublicPageConfig.ts            — TanStack Query GET/PATCH wrapper
    usePageEditorAutoSave.ts          — wraps useMarketingAutoSave's debounce/fingerprint pattern
  lib/
    previewOverrideContext.tsx        — the preview-injection mechanism, §3.3
```

Reused directly (imported, not forked): `MarketingEditorSidebar.tsx`, `MarketingPreviewHeader.tsx` (adapted), `StyleSection.tsx` (this repo's hand-rolled collapsible-accordion convention — no shadcn Accordion exists, don't add one), `ColorPicker.tsx`, dnd-kit patterns from `PropertyMediaUpload.tsx`.

### 3.3 Realtime preview mechanism (the core design decision)

**Verified against actual code**: `StayGuidePage.tsx` is a thin consumer of `useGuestStayGuide(propertySlug, token)` / `useGuestStayGuidePreview(propertySlug, propertyId)` (`ui/src/features/guest/stay-guide/hooks/useGuestStayGuide.ts`, two plain `useQuery` wrappers), and directly renders `StayGuideHero` → `StayPassCard` → `StayGuideGalleryCarousel` → `StayGuideTabs` → mapped `StayGuideChapter`s → `StayGuideHelpSection`. This is exactly the shape needed for injection.

**Mechanism**: a `PreviewOverrideContext` that the data hooks check _before_ calling `useQuery`:

```ts
// inside useGuestStayGuide / useGuestStayGuidePreview / usePublicPropertyDetail
const override = usePreviewOverride();
if (override) return { data: override.data, isLoading: false, isError: false };
// ...existing useQuery call, unchanged for normal guest traffic
```

`PageEditorPreviewPane.tsx` renders the actual unmodified page component (`<StayGuidePage />` / `<PropertyDetailPage />`) wrapped in `<PreviewOverrideProvider data={mergedPreviewData}>`, where `mergedPreviewData` = one real fetch (via the existing preview edge functions, fetched once on editor mount for genuine content/booking-shape data) with the _live editor store state_ merged in via a memoized selector. Typing/toggling re-renders instantly from local state with **zero additional network round trips**, while the base data is never a fabricated mock shape.

This is deliberately **not an iframe** (rejecting the existing `PublicPageLivePreview.tsx` iframe approach for this use case — that component stays as-is for the gallery's static thumbnails, which is a different job): no postMessage plumbing, no CSS-isolation concerns, instant feedback, and — critically — **preview literally runs the production component tree**, so there is zero drift between what a host sees while editing and what a guest sees live. `StayGuidePage`/`PropertyDetailPage` need no fork, only the small additive hook-level check above plus the config-driven filter/reorder logic described next (which they need in production anyway, editor or not).

Route-param dependencies (`useParams()` for `propertySlug`/`token`) inside the guest pages need to tolerate being mounted outside their real route when previewed — `StayGuidePage.tsx` already has partial precedent for this via its `?preview=1&property_id=` branch; extend that pattern rather than inventing a new one. Confirm exact prop-threading per page during implementation.

### 3.4 Config-driven rendering in the guest pages themselves

Both `StayGuidePage.tsx` and `PropertyDetailPage.tsx` need to actually honor `sectionConfig` regardless of editor/production context:

- `StayGuidePage.tsx`: filter/reorder `chapters` (from `buildStayGuideChapters`) by `sectionConfig.chapters`; conditionally render `StayPassCard`/`StayGuideGalleryCarousel`/`StayGuideTabs`/`StayGuideHelpSection` by their visibility flags; pass `accentColor` into `StayGuideChapter` (new optional prop).
- `PropertyDetailPage.tsx`: filter/reorder its section component list by `sectionConfig.sections`.
- An empty/default config renders identically to today's hardcoded output — this logic ships and is verified _before_ any editor UI exists (see Phase 2 below), de-risking the trickiest part first.

### 3.5 Left-panel controls, enumerated

**Stay Guide** (`StayGuideEditorPanel.tsx`, grouped via `StyleSection.tsx` collapsible sections):

- Hero — visibility toggle
- Stay Pass Card — visibility toggle
- Gallery Carousel — visibility toggle
- Quick-nav Tabs — visibility toggle
- Chapters (Getting In / Make Yourself at Home / Before You Go), each: drag handle + reorder, visibility toggle, accent color picker (defaults to brand color), a "Edit content →" deep link to the Templates page for that section's text (explicitly **not** duplicating the WYSIWYG editor here)
- Help / Need Anything — visibility toggle

**Property Landing** (`PropertyLandingEditorPanel.tsx`):

- Brand Color — global control at top (affects whole page, not one section); relocates `PropertySettingsBrandColorPreview.tsx`
- Gallery — visibility toggle + drag-reorder/add/remove (relocates `PropertyMediaUpload.tsx`'s dnd-kit logic verbatim, writes `properties.settings.media`)
- Overview — description textarea (RHF+Zod, `properties.settings.description`); no visibility toggle (core section)
- Amenities — visibility toggle + reorder + category-grouped picker + custom-amenity add/remove (relocates current Settings UI, writes `enabledAmenities`/`customAmenities`)
- Location — visibility toggle only in Phase 1 (address/map data itself stays in Settings, per §5)
- House Rules — visibility toggle + reorder + rules picker + custom rules (writes `enabledHouseRules`/`customHouseRules` — distinct from the Templates page's `house-rules` stay-guide content slot, do not conflate)
- Cancellation Policy — visibility toggle + policy config, relocating/generalizing the existing `CancellationPolicyDisplay` live-preview component for in-panel use
- Reviews — visibility toggle + socials/external-reviews block (relocates `PropertySocialsBrandingSection.tsx`, `PropertyExternalReviewsBlock.tsx` + its image/photos fields, `PropertySuperhostVerificationBlock.tsx`)

Hybrid form pattern, matching this repo's own split: RHF+Zod for validated text content (description, custom entries), plain Zustand-controlled values for visual/toggle/order controls (matching how Marketing Studio's builder has no RHF at all).

### 3.6 Save model

**Autosave** (debounced ~800ms–1.2s, content-fingerprint-keyed, matching `useMarketingAutoSave.ts`), with `PageEditorHeader.tsx` showing a `MarketingAutoSaveStatus`-style indicator ("Saving… / All changes saved"). Reasoning: Marketing Studio already trained hosts on exactly this interaction model for a structurally identical builder — an explicit Save button here would be an inconsistent surprise. The session-scoped undo/redo stack covers "I want to back out of a change" without needing a hard Cancel.

---

## 4. Plan gating (Starter tier minimum)

- New migration flips `pricing_plans.features->>'customPages'` from `false` to `true` for the `starter` plan row (`code = 'starter'`) — a data-only migration (`UPDATE pricing_plans SET features = jsonb_set(features, '{customPages}', 'true') WHERE code = 'starter';`), following the same non-destructive-update convention as `20261025120000_pricing_plan_display_names.sql`/`20261031120000_pricing_plan_repricing.sql`. Free stays `false`; Growth/Pro/Business already `true`, untouched.
- **This is the first time `customPages` is actually enforced** — it exists in `PlanFeatures`/`featureGateCopy.ts`/the plans comparison table already, but nothing currently gates on it. Wire it in two places:
  - **Frontend**: wrap the Public Pages gallery route (`CustomPagesPage.tsx`) and the new Page Editor route in a route-level feature check using the existing `useFeatureGate('customPages')` hook + `useUpgradeModal()` (`ui/src/features/dashboard/plans/hooks/useFeatureGate.ts`, `.../components/UpgradeModalProvider.tsx`) — below-Starter hosts see an upgrade prompt instead of the gallery/editor, not just a disabled Edit button (the whole section is gated, not just editing).
  - **Backend**: `custom-pages-settings/index.ts` and the new `public-page-configs/index.ts` both call `requirePropertyFeature(propertyId, 'customPages')` / `catchPlanFeatureError(req, err)` from `_shared/planEntitlements.ts` — the same helper already used to gate other paid features server-side. Guest-facing read paths (`get-guest-stay-guide`, `get-public-property`, etc.) are **not** gated — a guest whose host is on a lower tier still needs their booking pages to work; the gate only blocks the _host's_ ability to view/edit the Public Pages module.

### 4.1 Plan cards & compare table copy (verified against actual code — concrete edits, not a "confirm" pass)

The pricing catalog already anticipates this feature but currently mislabels/misrepresents it in three places, all keyed off the same `customPages` `PlanFeatureKey`. All three must be corrected together so the compare table, the plan cards, and the upgrade prompt tell a consistent story:

- **Compare table row** — `ui/src/features/dashboard/plans/lib/planPresentation.ts:224`, `boolRow('customPages', 'Public property listing', 'operations')`. This single row drives `planFeatureMatrixGroups()`, which feeds the full comparison table — no separate table-specific edit needed once this label is corrected. Relabel to **"Public pages access & editor"** (or similar copy reflecting the new scope — no longer just a static listing page).
- **Starter plan card bullet** — `PLAN_TIER_CARD_GAINS.starter` in the same file (`planPresentation.ts:132-139`) **already contains the literal string `'Public property listing'`** (line 134) as a Starter-tier "gain" bullet — confirmed this was anticipated in the pricing catalog before this plan existed, it's just currently false in the DB (§4) and stale in wording. Update this string to match the compare-table row's new label. `PlanTierCard.tsx` renders `PLAN_TIER_CARD_GAINS` entries directly as the card's bulleted list (not auto-diffed from `PLAN_FEATURE_ROWS` for known plan codes — see `resolveTierCardGains()`), so this edit is required independently of the compare-table row edit above, not automatically inherited from it.
- **Upgrade-modal / feature-gate copy** — `ui/src/features/dashboard/plans/lib/featureGateCopy.ts:50-54`, `customPages: { title: 'Public property listing', description: 'Available on Starter and above.', ctaLabel: 'View plans' }`. Update `title` to match; `description` is already accurate as-is once §4's migration lands (Starter is in fact where it becomes available) — no change needed there. This copy is what a below-Starter host actually sees when the `<FeatureGate>`/upgrade-modal blocks them, so it's the most host-visible of the three.
- **Optional consistency fix, not required for correctness**: `PLAN_TIER_CARD_GAINS.growth` (`planPresentation.ts:140-148`) has no bullet mentioning this feature at all, even though `customPages` is already `true` for Growth today — it currently relies entirely on the card's "Everything in Starter, plus" framing (`PlanTierCard.tsx`'s `inheritsFrom` line) to imply inheritance, same as several other Starter-introduced rows. Leave as-is unless doing a broader card-copy consistency pass; not part of this feature's scope.

---

## 5. Property Settings migration mechanics

Reverse of the addition pattern already proven in `docs/workflow/done/guest-form-configurable-sections.md` (adding `PropertyGuestFormSettingsSection.tsx`), applied per migrated field group across the same five files:

1. **`ui/src/features/dashboard/org/lib/propertySettingsForm.ts`** — remove the field(s) from `PropertyProfileDraft`, from the dirty-diff helpers, and from the initial-load block.
2. **`ui/src/features/dashboard/org/lib/propertySettingsSave.ts`** — remove from the payload-building/PATCH logic; confirm no other field's save path implicitly depends on these being present.
3. **`ui/src/features/dashboard/org/lib/propertySettingsCompletion.ts`** — recompute "profile completion" scoring to exclude migrated fields (simplify the checklist rather than trying to reach into the Page Editor's config to keep counting them).
4. **`PropertySettingsCard.tsx`** — remove the corresponding nav entries from `SETTINGS_SECTIONS`.
5. **`PropertyProfileSettingsSections.tsx`** — delete the corresponding JSX blocks and now-unused handler functions; delete orphaned imports only once nothing else references them.

**Important coupling risk** (budget real time for it): `media`, `enabledAmenities/customAmenities`, `enabledHouseRules/customHouseRules`, and `cancellationPolicy` currently live inside the _same combined_ `PropertyProfileDraft` save/dirty-check flow as everything else in Settings. Removing them means the Page Editor's save path for these fields becomes fully independent (its own mutation call, its own dirty-tracking) rather than assuming it's still folded into the profile form's combined save — this is a real architectural split, not just a delete.

**Don't delete, relocate**: components becoming fully orphaned in Settings (`PropertyMediaUpload.tsx`, `PropertyCancellationPolicySection.tsx`, `PropertySocialsBrandingSection.tsx`, `PropertyExternalReviewsBlock.tsx` + its image/photos fields, `PropertySuperhostVerificationBlock.tsx`, `PropertySettingsBrandColorPreview.tsx`) should be **moved into the page-editor feature folder and adapted**, not deleted-and-rewritten — their internals (dnd-kit reorder, live cancellation preview) are exactly what the new panels need.

**Bookmarked old-settings links**: once section IDs disappear from `SETTINGS_SECTIONS`, a host with an old `.../settings#media`-style bookmark lands on Settings with the hash unresolved. Add a one-time inline banner ("Photos, amenities, and house rules moved to the Page Editor — open a public page and tap Edit"), shown only while a migrated-field hash is present in the URL. No persistent redirect route needed beyond that.

---

## 6. Public Pages gallery redesign

**Two-tier grouping, still card-based** (not a dense list — hosts already understand "one card per page"):

- **"Design your pages"** section (Stay Guide, Property landing — the editable tier): larger cards, primary CTA is **Edit** (routes to the new editor), Copy link/Open demoted to a small secondary icon row. Adds a **"Last edited {relative time}"** meta line sourced from `public_page_configs.updated_at` (falls back to "Not customized yet" when the row is still all-defaults) — cheap to add since the column already exists for this purpose.
- **"Other guest pages"** section (Calendar, Form, Messages, SD Refund, Guest Review, Pay Parking — not editable yet): keep today's compact card almost unchanged (icon, label, description, `PublicPageLivePreview` iframe thumbnail, Copy link/Open as equal-weight buttons) — no new capability for these this round, so no need to over-engineer their presentation. An optional subtle "Coming soon" badge, nothing louder.
- `propertyGuestPublicPages.ts` (the canonical page registry) gains an `editable: boolean` field so `CustomPagesPage.tsx` groups without hardcoding IDs in the page component — keeps the registry as the single source of truth for page metadata, consistent with its current role.
- `PublicPageCard.tsx` gets a `variant: 'editable' | 'static'` prop rather than a second component (most markup — icon, label, description, preview — is shared).
- The entire gallery route is behind the Starter-tier feature gate per §4 — non-entitled hosts see an upgrade prompt here, not a broken/empty grid.

---

## 7. Phased task breakdown

### Phase 0 — Housekeeping ✅

Done — see §0.

### Phase 1 — Data & edge function foundation (no UI)

- ✅ `supabase/migrations/20261102120000_public_page_configs.sql` — create table per §1.
- ⏭️ `pricing_plan_starter_custom_pages` migration — **not needed**; Starter already has `customPages: true` in `20261029120000_plan_tier_feature_catalog.sql`.
- ✅ `supabase/functions/_shared/publicPageConfigs.ts`.
- ✅ `supabase/functions/public-page-configs/index.ts` (GET/PATCH, plan-gated).
- ✅ `custom-pages-settings` plan-gated with `requirePropertyFeature(..., 'customPages')`.
- ✅ Extend `_shared/guestStayGuide.ts` and `_shared/publicPropertyService.ts` to include `sectionConfig` (read-only default-if-missing) in their DTOs.
- ✅ Matching TS DTO types on the frontend (`stay-guide/lib/api.ts`, `publicProperty.ts`).
- ✅ **Plan cards & compare table copy** (§4.1): relabeled to **"Public pages access & editor"** in `planPresentation.ts`, `featureGateCopy.ts`, and `planFeatures.ts` `FEATURE_LABELS`.

**Verify**: edge-function type-check; manual local invoke — GET creates a default row, PATCH updates it, GET reflects the change; confirm `get-guest-stay-guide`/`get-public-property` responses include `sectionConfig` with sane defaults for an untouched property. Frontend: open `/org/:orgSlug/property/:propertySlug/plans` and confirm the Starter card's gain bullet, the full compare table's "Public pages access & editor" row (checked from Starter up), and the upgrade-modal title (trigger it from a Free-tier property) all show the corrected label consistently.

### Phase 2 — Guest pages honor config (still no editor UI)

- ✅ `StayGuidePage.tsx` — filter/reorder chapters, conditional section rendering, `accentColor` threading per §3.4.
- ✅ `StayGuideChapter.tsx` — accept optional `accentColor` prop.
- ✅ `PropertyDetailPage.tsx` — filter/reorder its section list per §3.4.

**Verify**: manually set `public_page_configs.config` via SQL for a test property (hide a chapter, reorder landing sections, set an accent color); confirm both guest pages (token / preview URLs) reflect it; confirm default/empty config still renders identically to pre-Phase-2 behavior.

### Phase 3 — Page Editor shell + Stay Guide editor (first editable page)

- ✅ Route registration (`public-pages/:pageId/edit`) + `RequirePropertyFeature` gate.
- ✅ `page-editor/pages/PageEditorPage.tsx`, `PageEditorShell.tsx`, `PageEditorHeader.tsx`, `PageEditorPreviewPane.tsx`.
- ✅ `guest/lib/previewOverrideContext.tsx` + hook edits in `useGuestStayGuide.ts` per §3.3.
- ✅ `page-editor/stores/stayGuideEditorStore.ts`.
- ✅ `page-editor/hooks/usePublicPageConfig.ts`, `usePageEditorAutoSave.ts`.
- ✅ `StayGuideEditorPanel.tsx` + `SectionVisibilityToggle.tsx`, `SectionOrderList.tsx`, `AccentColorControl.tsx`.
- ✅ Interim gallery change: "Edit" primary action for the `stay-guide` card; gallery + editor behind `customPages` gate.

**Verify**: type-check/lint/build; manual walkthrough — toggle a chapter, watch preview update instantly with no network delay, drag-reorder chapters, change accent color, confirm autosave indicator, reload and confirm persistence, open the real guest stay-guide link and confirm parity with the editor's last-saved state; confirm a Free/Starter-ineligible test account sees the upgrade gate, not the editor.

### Phase 4 — Property Landing editor + Settings migration, part 1 (media & brand color)

- ✅ `PropertyLandingEditorPanel.tsx` with Gallery (relocated `PropertyMediaUpload.tsx`) and Brand Color (relocated `PropertySettingsBrandColorPreview.tsx`) controls, plus section visibility/reorder.
- ✅ Extend `previewOverrideContext` usage into `usePublicPropertyDetail.ts`.
- ✅ Settings removal round 1 (§5): media + brand color fields out of Settings UI / dirty / save / completion.
- ✅ One-time "moved" banner gated on `#media` hash.
- ✅ Gallery "Edit" CTA on the `listing` card.

**Verify**: type-check/lint/build; confirm Settings no longer shows Photos or Brand Color; confirm the editor's media reorder persists to the same `properties.settings.media` column and the guest property page reflects it; grep for orphaned `PropertyProfileDraft` field references.

### Phase 5 — Property Landing editor + Settings migration, part 2 (content-heavy sections)

- ✅ `PropertyLandingAmenitiesControl.tsx`, `PropertyLandingHouseRulesControl.tsx`, cancellation + socials (embedded), description field.
- ✅ Settings removal round 2: amenities/house-rules/cancellation/socials (+ description) out of Settings UI / dirty / completion.
- ✅ Completion-score logic updated for the slimmer Settings surface.

**Verify**: same pattern as Phase 4, extended to all remaining migrated fields; a resulting TS compile error on any orphaned `PropertyProfileDraft` field is the correctness check.

### Phase 6 — Public Pages gallery redesign ✅

- ✅ `propertyGuestPublicPages.ts` — `editable` metadata.
- ✅ `PublicPageCard.tsx` — `variant` prop + "Last edited" meta line.
- ✅ `CustomPagesPage.tsx` — two-section layout ("Design your pages" / "Other guest pages").
- ✅ Update `docs/guides/routes/org/property/public-pages.md` (route-guides skill).

**Verify**: manual walkthrough light/dark + mobile breakpoints (`AdminMobilePage` context, 375px minimum); confirm editable-tier cards route correctly; confirm static-tier cards behave exactly as before; confirm the Starter-tier gate applies to the whole page.

### Phase 7 — Docs & wrap-up ✅

- ✅ `docs/PROJECT.md` — "Page Editor" section (tables, edge functions, UI, plan gate).
- ✅ `docs/guides/routes/org/property/public-pages.md`, `stay-guide.md`, `properties.md` (landing `sectionConfig`).
- ✅ `docs/guides/routes/org/property/settings.md` — migrated sections stubbed; Basic Information no longer documents brand color / description.

### Phase 8 (backlog — outline only, not built now)

- **True stay-guide multi-template selection**: a second full component set + `custom_pages.template_key` picker UI, only worth building once a second visual design actually exists.
- **Calendar / Guest Form / SD-form / Pay-parking / Guest-review editors**: `page_type` additions in `public_page_configs`; Guest Form's phase is where `allowPets/allowParking/allowSurpriseDecor` (`PropertyGuestFormSettingsSection.tsx`) finally migrates out of Settings. Audit each page's actual configurable surface before assuming parity with Stay Guide/Property Landing's scope — these are more operational/transactional, likely smaller config surfaces.

---

## Verification approach (end-to-end, per phase and overall)

No automated test suite in this repo — verification is `bun run type-check && bun run lint && bun run build` after each phase, plus a manual walkthrough via local dev (`./dev.sh`) covering: editor interactions (toggle/reorder/color/text) reflecting instantly in the preview pane with no network lag; autosave persisting across a reload; the real guest-facing page (via token/preview URL) matching the editor's last-saved state exactly; Settings no longer showing migrated fields once each phase removes them; the Starter-tier plan gate blocking Free-tier test accounts from both the gallery and the editor route, server-side (curl the edge functions directly) and client-side; mobile viewport checks (375/768/1024px) on both the gallery and the editor shell, since the editor's left/right split needs a defined mobile behavior (stacked or drawer-style, following `MarketingEditorSidebar`'s existing mobile-drawer pattern).
