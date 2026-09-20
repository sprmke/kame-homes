---
title: 'Public Pages'
status: active
tags: [guides, routes, org, property]
updated: 2026-09-20
---

# Public Pages

Route: `/org/:orgSlug/property/:propertySlug/public-pages`

> **Status:** Documented — gallery of guest-facing public pages

**Manual testing:** [`custom-pages-module-manual.md`](../../testing/custom-pages-module-manual.md) · Showcase: [`property-showcase-manual.md`](../../testing/property-showcase-manual.md)

Legacy URL `/custom-pages` redirects here.

## Progress overview

| Section            | E2E save | Validation | Docs       | Notes                                                                                                                   |
| ------------------ | -------- | ---------- | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| Module access      | —        | Free+      | Documented | Gallery + editor open on every plan; save gated by `publicPagesAutosave` (Pro+)                                         |
| Design your pages  | —        | —          | Documented | Showcase + Stay Guide + Property; Edit + last-edited from page configs                                                  |
| Other guest pages  | —        | —          | Documented | Six operational URLs; Copy / Open only                                                                                  |
| Stay Guide editor  | —        | explore    | Documented | 6-template engine (shared w/ Showcase): Template / Sections / Style + Content (WYSIWYG/images); live preview; save Pro+ |
| Showcase editor    | explore  | Pro save   | Documented | Same explore-open + save gate as Stay Guide; live URL → `propertyShowcase`                                              |
| Page Editor chrome | —        | —          | Documented | Fixed 480px sidebar; viewport + undo/redo in editor dock (phone) / unlabeled bar (`lg+`); no Preview strip              |
| Permissions        | —        | —          | Documented | `publicPages:view` for gallery; Edit needs matching edit leaf                                                           |

## Purpose

Directory of this property's **guest-facing public pages**, grouped into **Design your pages** (editable) and **Other guest pages** (open/copy only). **Stay Guide** and **Property** cards include **Edit** → Page Editor. **Stay Guide now shares the Showcase 6-template engine** — `custom_pages.template_key` holds one of the 6 `showcase-*` keys, and the editor has the same Template / Sections / Style controls as Showcase (see [[stay-guide|Stay Guide guide]]). Chapter **content** (rich text + section images) still stays on **[[templates|Property templates]]**.

Template choice and page config are bulk-copyable via org **Properties → Copy settings** (showcase stays unpublished on the target).

**Explore-open (every plan):** Free / Starter / Commission hosts can open `/public-pages` and the Page Editor for **Showcase**, **Stay Guide**, and **Property**. **Saving** requires **`publicPagesAutosave`** (Pro+). **Live / Open / iframe preview URLs** for Showcase (`propertyShowcase`) and Stay Guide host preview (`publicPagesAutosave`) show a non-dismissible blurred plan-lock overlay when the property is below Pro — including `?preview=1` / `?embed=1`. Page Editor canvas still works via `PreviewOverrideProvider` (no public API). Booking-token Stay Guide emails (`get-guest-stay-guide`) stay open for operational guests.

**Stay Guide** and **Property** (listing) cards use **Edit** → Page Editor (`/public-pages/:pageId/edit`). The listing editor covers gallery, brand color, description, amenities, house rules, cancellation, socials, and optional section visibility (amenities / location / rules / reviews — fixed order; gallery + overview always on) — the same content fields as **Property Settings** (single storage; Settings has no live preview). Stay Guide body copy and section images edit in the Stay Guide Page Editor (**Content**); Templates still has standard body copy without section images. Property Settings surfaces the reverse direction: its Photos & Videos, Amenities, House Rules, Cancellation, and Socials cards each show an **"Also in Public Pages"** link (`PublicPagesCrossLink`) back to this page.

## Host-facing knowledge

Public Pages lists every guest URL for this property. At the top, **Design your pages** shows Showcase, Stay Guide, and Property — use **Edit** to open the Page Editor (you can explore on every plan; saving needs Pro). Below that, **Other guest pages** covers calendar, booking form, messages, SD refund, guest review, and **Find parking** (stay-scoped marketplace entry) — use **Copy link** or **Open page**. Stay guide, SD refund, guest review, and find-parking links are **per booking** — guests get them by email or from the booking workflow; copy on those cards is the URL pattern or host preview.

**Common host questions**

- Q: What's the difference between View Property on the dashboard and Public Pages?
  A: **View Property** on the dashboard jumps straight to your listing. **Public Pages** lists every guest page.
- Q: What is Showcase?
  A: A shareable one-page landing link with animated templates. Separate from the marketing listing. Growth plan and above.
- Q: Why does the Showcase guest link ask me to upgrade?
  A: The live Showcase page needs Pro or above. You can still open **Edit** on Free to explore the editor — saving and the public link unlock on Pro.
- Q: Why doesn't the SD refund or find-parking copy link work for guests?
  A: Those URLs need a **booking ID**. Guests receive the full link by email; hosts copy the link from a booking in the workflow panel.
- Q: Can I change how the stay guide or listing looks?
  A: Open **Public Pages → Design your pages → Stay Guide or Property → Edit**. For Stay Guide: pick a template, reorder/hide sections, set palette/type/motion, and edit each chapter's text + photo — the same controls as Showcase. For Property: manage photos, brand color, and listing content (also editable in **Property Settings** — same saved data).
- Q: How do I get a shareable link for the stay guide?
  A: There isn't one link you can reuse. Each guest gets their own personal link automatically once their booking reaches ready-for-check-in. The Stay Guide card here is a preview for you.
- Q: Where do I edit the actual text (house rules, check-in steps)?
  A: **Public Pages → Stay Guide → Edit → Content**, or **Templates** for the same body copy. Section photos upload only in the Stay Guide Page Editor.
- Q: Is there a Save button in the page editor?
  A: On **Pro and above**, no — changes save automatically. You'll see **Unsaved**, then **Saved**, in the top-right of the editor. On **Free / Starter**, autosave isn't included, so a **Save** button appears once you have unsaved changes — clicking it (or **Save & leave** in the leave dialog) opens the upgrade prompt for Pro instead of saving. You can still **Discard changes** and leave, or stay and keep editing locally until you upgrade.
- Q: Can I preview how the page looks on a phone?
  A: Yes. Use the desktop and phone icons. On a phone they’re in the bar above the bottom tabs, next to **Edit content**.
- Q: Where do I change Stay Guide text and section photos?
  A: **Public Pages → Stay Guide → Edit → Content**. Expand a section to edit text or upload its image. Changes show in the live preview and save automatically.

## UI

Two sections:

1. **Design your pages** — Showcase + Stay Guide + Property (registry order). Larger cards; primary **Edit**; Copy / Open as icon buttons. Grid: 1 column on phone, 2 from `sm`, **3 from `lg`** (Showcase, Stay Guide, Property in one row on desktop).
2. **Other guest pages** — Calendar, Form, Messages, SD Refund, Guest Review, Pay Parking. Compact cards with **Copy link** / **Open page**. Same grid as above: 1 / 2 (`sm`) / **3 (`lg`)**.

Each card lazy-loads a **scaled live iframe** at **1280px desktop width** (`?embed=1`). Booking-scoped pages render host embed previews when `embed=1` without a booking id. Page subtitle: "Every guest URL for this listing." Registry field `editable` on `propertyGuestPublicPages` drives grouping (no hardcoded IDs in the page).

### Page Editor (`/public-pages/:pageId/edit`)

Opened from **Design your pages → Edit**. Keeps the **Public Pages** page title and subtitle (`AdminMobilePage`), then a bordered editor shell (same height pattern as Marketing Studio). On phone/tablet (`max-lg`) the shell fills the admin main column (`useAdminLayoutFillMain`), the **controls sidebar becomes a bottom sheet** (`MarketingEditorSidebar mobileVariant="sheet"`, opened from an **Edit content** dock button via `MarketingEditorMobileToolbar`), and the preview goes full-width with **no Preview strip** — desktop/mobile viewport and undo/redo sit in that same editor dock (same pattern as Marketing Studio zoom/history). Desktop (`lg+`) keeps the fixed 480px sidebar and an unlabeled chrome bar (history + viewport; padded to clear the sidebar collapse control). The editor dock floats **above** the app bottom tab bar (which stays visible for navigation); the preview reserves clearance for both via `marketingEditorScrollClearanceClassName`.

| Chrome             | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Editor header      | Back → gallery (blocked by a leave-confirmation dialog if there are unsaved changes — see Save row); title **Edit - Property** / **Edit - Stay Guide** / **Edit - Showcase**; **Unsaved / Saving… / Saved** (upper right) on Pro+, a primary **Save** button below Pro when dirty; **Copy link** + **Open page** (text buttons, new tab) beside save status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Sidebar            | Fixed **480px** on `lg+` (not resizable; collapse rail still available). Listing: **Sections** first (open by default) — visibility for amenities / location / house rules / reviews only (no reorder; gallery + overview always on). Desktop preview chrome is left-padded so it clears the collapse control.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Preview            | Live guest page tree. Opens on **mobile** (≤420px) with the left sidebar expanded. **Desktop / mobile** viewport toggle and **undo/redo**: on phone/tablet they live in the **Edit content** floating dock (no Preview strip, so the canvas fills the column); on `lg+` they sit in an unlabeled bar above the frame. Choosing **desktop** collapses the sidebar so the preview can use full width; choosing **mobile** expands it again. Both viewports **scroll inside the bordered frame** (mobile: fixed frame height; desktop: flex-fill). Frame splits into a scrollport + non-scrolling `[data-page-editor-preview-chrome]` host — Showcase / Stay Guide header and section menu portal **into that host** with `position: absolute` so they clip to the frame and stay under admin sheets (More). Showcase / Stay Guide / Property editors opt into **fill-main**. Focusing or editing a section/field **scrolls the preview** to that block (skipped for global settings like brand color). Listing layout uses **container queries**, so both frames adapt to frame width. |
| Save               | **Pro+**: debounced autosave (no Save button needed) — Stay Guide and Property use the same entitlement gate as Showcase (`publicPagesAutosave` from property entitlements). **Below Pro**: autosave stays off; a primary **Save** button (and leave-dialog **Save & leave**) opens the upgrade modal instead of calling the API. The **Edit - {page}** header title shows a solid `TierBadge` when not entitled. Layout → `public-page-configs`; Stay Guide body + section images → `property-templates-settings`; listing content/brand/socials → property/`app_settings`. **Brand color** includes a **From photos** swatch (property only; enabled after gallery images exist). Status merges all pending surfaces. Leaving the editor (Back, tab close/refresh) with unsaved changes on either plan prompts **Save & leave** / **Discard changes** rather than losing the edit silently.                                                                                                                                                                                        |
| Stay Guide Content | Merged **Sections** block: drag + visibility per chapter, nested WYSIWYG/image cards. Live preview updates as you type.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

| Item         | Path                                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| Property     | `/properties/:propertySlug`                                                                                      |
| Showcase     | `/properties/:propertySlug/showcase`                                                                             |
| Calendar     | `…/calendar`                                                                                                     |
| Form         | `…/form`                                                                                                         |
| Messages     | `…/messages?checkInDate=<today>&checkOutDate=<tomorrow>` (preview adds `embed=1` in iframe only)                 |
| Stay Guide   | `…/stay-guide?preview=1&property_id=` (admin preview)                                                            |
| SD Refund    | `…/sd-form` (guest link adds `?bookingId=`; open from dashboard uses `embed=1`)                                  |
| Guest Review | `…/guest-review` (guest link adds `?bookingId=`; open uses `embed=1`)                                            |
| Pay Parking  | `…/parking/preview` + `embed=1` for preview; copy uses `…/parking/` prefix; guest link is `…/parking/:bookingId` |

## Data model

Stay Guide / listing / showcase template selection uses `custom_pages`:

```sql
custom_pages (
  id, property_id,
  page_type ('stay_guide' | 'property_landing' | 'property_showcase'),
  template_key, created_at, updated_at,
  unique (property_id, page_type)
)
```

Rows are **lazily created on first read**. Showcase `template_key` ∈ `showcase-aurora` | `showcase-monolith` | `showcase-editorial` | `showcase-verso` | `showcase-atlas` | `showcase-haven`.

`public_page_configs.page_type` uses the same three values; showcase config includes `published` plus section/style overrides.

## API

| Function                | Method     | Auth                                                                                                                                                  | Query / body                                                 |
| ----------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `custom-pages-settings` | GET, PATCH | JWT + public-pages permissions; stay_guide + showcase template PATCH → `publicPagesAutosave`                                                          | `?property_id=`; PATCH template                              |
| `public-page-configs`   | GET, PATCH | JWT + `publicPages:view` / matching `publicPages.*.edit` + `publicPagesAutosave` on PATCH; showcase publish → `propertyShowcase`                      | GET `?property_id=&page_type=`; PATCH `{ pageType, config }` |
| `get-public-showcase`   | GET        | anon; live URL needs `propertyShowcase` (else `planAccessDenied`); unpublished → empty payload; `?embed=1`/`preview=1` bypasses plan for host preview | `?property=` / `?property_id=`                               |
| `get-public-showcase`   | GET        | anon                                                                                                                                                  | `?property=` (+ embed/preview)                               |

`custom-pages-settings` returns `{ pages: [{ pageType, templateKey, updatedAt }] }`. `public-page-configs` owns section visibility/order/style (`stay_guide` / `property_landing` / `property_showcase`).

## Implementation map

| Layer         | Path                                                                                                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route         | `ui/src/features/dashboard/custom-pages/routes/index.tsx` (`public-pages`, `public-pages/:pageId/edit`, redirect from `custom-pages`)                                                     |
| Page          | `ui/src/features/dashboard/custom-pages/pages/CustomPagesPage.tsx`                                                                                                                        |
| Editor        | `ui/src/features/dashboard/page-editor/` (Stay Guide + Property Landing + Showcase editors + shell + preview chrome + `components/shared/`)                                               |
| Card          | `ui/src/features/dashboard/custom-pages/components/PublicPageCard.tsx` (`variant` editable \| static; optional `locked`)                                                                  |
| Live preview  | `ui/src/features/dashboard/custom-pages/components/PublicPageLivePreview.tsx`                                                                                                             |
| Static mock   | `ui/src/features/dashboard/custom-pages/components/PublicPagePreview.tsx` (Messages + iframe fallback)                                                                                    |
| Guest URLs    | `ui/src/features/dashboard/property/lib/propertyGuestPublicPages.ts` (`editable` metadata)                                                                                                |
| Hook          | `ui/src/features/dashboard/custom-pages/hooks/useCustomPages.ts`                                                                                                                          |
| Settings API  | `supabase/functions/custom-pages-settings/index.ts`                                                                                                                                       |
| Config API    | `supabase/functions/public-page-configs/index.ts`                                                                                                                                         |
| Shared helper | `supabase/functions/_shared/customPages.ts`, `_shared/publicPageConfigs.ts`                                                                                                               |
| Migration     | `…/20261018130000_custom_pages.sql`, `…/20261102120000_public_page_configs.sql`, `…/20261209120000_property_showcase_page_type.sql`, `…/20261209120100_property_showcase_entitlement.sql` |
| Permissions   | Gallery/route: `publicPages:view`; **Edit** requires `publicPages.property:edit` / `publicPages.stayGuide:edit` / `publicPages.showcase:edit`                                             |
| Plan gate     | Gallery + all three editors explore-open; save → `publicPagesAutosave` (Pro+); live Showcase URL → `propertyShowcase` (Pro+, non-dismissible blur overlay)                                |

## v1 template: stay guide redesign

See **[[stay-guide|Guest stay guide (token-gated brochure)]]** for the `stay-guide-warm-arrival` template. The `template_key` flows from `custom_pages` through `get-guest-stay-guide` / `preview-guest-stay-guide`.

## Edge cases

- `/custom-pages` redirects to `/public-pages`.
- A property with no `custom_pages` row gets one lazily on first `custom-pages-settings` or stay-guide read, defaulting to `stay-guide-warm-arrival`.
- Gallery does not wait on `custom-pages-settings`; it always lists the guest URLs from the registry (including Showcase).
- Showcase / Stay Guide / Property editors are explore-open on Free; Save opens the Pro upgrade modal when `publicPagesAutosave` is off.
- Live Showcase URL without Pro shows a non-dismissible blurred plan-lock overlay (guest copy + **Home** → Explore `/`; no close control).

---

## Testing

| Layer  | Path / spec                                                                                                                  | Manual                                        |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Unit   | `buildPropertyGuestPublicPages` registry helpers when pure                                                                   | —                                             |
| E2E    | `ui/e2e/features/dashboard/dashboardModulesSmoke.spec.ts` gallery shell load (`@ci`)                                         | Editor save, showcase live URL, autosave gate |
| E2E    | `ui/e2e/features/dashboard/dashboardModulesSmoke.spec.ts` "free host sees upgrade badge before editing listing page" (`@ci`) | `TierBadge` visible before any edit on Free   |
| Manual | [`custom-pages-module-manual.md`](../../testing/custom-pages-module-manual.md)                                               | Full editor + publish                         |

---
