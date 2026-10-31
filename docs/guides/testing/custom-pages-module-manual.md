---
title: 'Custom Pages module — manual test flows'
status: active
tags: [guides, testing, custom-pages, stay-guide]
updated: 2026-08-18
---

# Custom Pages module — step-by-step manual testing

Manual E2E for the **Public Pages** dashboard module and the **v1 `stay-guide-warm-arrival`** template redesign.

**Implementation plan:** [`docs/workflow/done/custom-pages-module.md`](../../workflow/done/custom-pages-module.md)
**Route guides:** [`public-pages.md`](../routes/org/property/public-pages.md), [`stay-guide.md`](../routes/stay-guide.md)

---

## 0. What you are proving

| #   | Capability                    | Pass criteria                                                                                                                         |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `custom_pages` lazy-create    | First read for a property creates one `stay_guide` row (`template_key = 'stay-guide-warm-arrival'`); repeat reads do not duplicate it |
| 2   | Public Pages dashboard module | Nav entry between Templates and Settings; five public-page cards render; each card opens the matching guest URL in a new tab          |
| 3   | Permission gating             | A property member without `templates:view` cannot load `/public-pages` (redirects, no crash)                                          |
| 4   | Hero + stay pass              | Full-bleed hero photo, `Fraunces` title, boarding-pass card with correct guest/dates, no text/card overlap at any width               |
| 5   | Chapters + grouping           | "Getting In" / "Make Yourself at Home" (house rules + parking when applicable) / "Before You Go" render with real template content    |
| 6   | Quick-nav                     | Sticky pill bar jump-scrolls to each chapter; active pill updates on scroll (scrollspy)                                               |
| 7   | Gallery film strip            | Horizontal scroll-snap strip of property photos, separate from the hero                                                               |
| 8   | Need Anything / contact       | Host name, avatar, phone/email/Facebook/Airbnb links render and are clickable                                                         |
| 9   | Preview ↔ guest parity        | `?preview=1` admin route renders the identical template to the real token-gated guest route                                           |
| 10  | Theming                       | Palette + type correct in **both** light and dark mode (page-scoped warm palette, not the dashboard's default theme)                  |
| 11  | Motion + reduced motion       | Hero/chapter animations play normally; with `prefers-reduced-motion: reduce`, content appears immediately with no animation           |
| 12  | Mobile / tablet / desktop     | Usable at 375 / 768 / 1024px+ — no clipped text, no truncated dates, centered ~720px content column at every width                    |
| 13  | Regression — token gating     | Existing `stay_guide_token` validity window (Manila check-in day → end of day after checkout) unchanged                               |

---

## 1. Prerequisites

### 1.1 Local stack

```bash
./dev.sh
# If functions return 502/503: stop leftover serve, then from repo root:
bun run stop:supabase   # only if you need a clean restart of Docker
./dev.sh                # or: bun run start:supabase && bun run dev:api
```

> **Known gotcha** (see `CLAUDE.md` → Local dev gotchas): a 502 on `/functions/v1/*` after `db:migrate`/a partial restart usually means the edge runtime process died — restart it with `bun run dev:api` (no need to restart the whole Docker stack).

Apply the migration if you haven't yet:

```bash
bun run db:migrate
```

Confirm the table exists:

```bash
./scripts/dev/bunx --bun supabase@latest db query --local \
  "select column_name, data_type from information_schema.columns where table_name = 'custom_pages' order by ordinal_position;"
```

### 1.2 Accounts

| Role                                         | Need                                                                                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin (owner or org/property member)**     | Signed-in host session with `templates:view` on the test property — needed for the Public Pages dashboard page and the guest-page preview route |
| **Property member without `templates:view`** | For the permission-gating check (#3) — a custom role/invite with that permission unchecked                                                      |

### 1.3 UI surfaces

| Surface                       | URL pattern                                                         |
| ----------------------------- | ------------------------------------------------------------------- |
| Public Pages (dashboard)      | `/org/:orgSlug/property/:propertySlug/public-pages`                 |
| Property Templates (content)  | `/org/:orgSlug/property/:propertySlug/templates`                    |
| Guest stay guide (preview)    | `/properties/:propertySlug/stay-guide?preview=1&property_id=<uuid>` |
| Guest stay guide (real token) | `/properties/:propertySlug/stay-guide?token=<opaque>`               |

Chrome DevTools → device toolbar → **375×812** (mobile), **768×1024** (tablet), **1440×900** (desktop) for responsive checks. Toggle **Rendering → Emulate CSS media feature `prefers-reduced-motion`** for the motion check.

---

## 2. Data layer — lazy-create + idempotency

Get an admin access token (only needed for direct curl testing — skip this section if you're testing entirely through the browser).

```bash
ANON=$(./scripts/dev/bunx --bun supabase@latest status -o env | grep '^ANON_KEY=' | cut -d= -f2- | tr -d '"')
```

1. Pick a seeded property id (Studio → Table Editor → `properties`, or query `select id, slug from properties limit 5;`).
2. Sign in as an admin with `templates:view` on that property; grab the session `access_token` from DevTools → Application → Local Storage (`sb-...-auth-token`), or use Studio's SQL editor to confirm the row instead of curling.
3. Call the settings endpoint twice:

```bash
curl -s "http://127.0.0.1:54321/functions/v1/custom-pages-settings?property_id=<PROPERTY_ID>" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" -H "apikey: $ANON"
```

**Pass:** first call returns `{ "pages": [{ "pageType": "stay_guide", "templateKey": "stay-guide-warm-arrival", ... }] }`; second call returns the **same** `updatedAt` (not a new row). Confirm with:

```bash
./scripts/dev/bunx --bun supabase@latest db query --local \
  "select count(*) from custom_pages where property_id = '<PROPERTY_ID>';"
```

Expect `count = 1` regardless of how many times you called the endpoint.

---

## 3. Dashboard module

1. Sign in as an admin, navigate to `/org/:orgSlug/property/:propertySlug/public-pages`.
2. **Pass:** page title is `"<Property> - Public Pages"`; sidebar shows a **Public Pages** entry (globe icon) between **Templates** and **Settings**, highlighted as active.
3. **Pass:** five cards — **Property**, **Calendar**, **Form**, **Messages**, **Stay Guide** — each with a visual preview. Tapping a card opens that guest URL in a new tab.
4. Click **Stay Guide** → opens `/properties/:slug/stay-guide?preview=1&property_id=...` in a new tab.
5. **Permission check:** as a property member whose custom role has `templates:view` unchecked, navigate directly to `/public-pages`. **Pass:** redirected to the first section that member _can_ view (or an access-denied screen) — no crash, no blank page.
6. Resize to 375px. **Pass:** teal hero band + title, cards stack full-width, bottom tab bar shows **More** (Public Pages is reachable from there since it isn't one of the pinned mobile tabs).
7. Open `/custom-pages` on the same property. **Pass:** redirects to `/public-pages`.

---

## 4. Guest page — hero, stay pass, gallery

Open the **Preview** link from step 3.

1. **Pass banner:** a "Preview" status bar at the very top.
2. **Hero:** full-bleed property photo, bottom gradient scrim, `Stay guide` eyebrow + property/unit name in serif (`Fraunces`) type. No carousel controls on the hero itself.
3. **Stay pass card:** overlaps the bottom of the hero. Shows guest name, property name, **Check-in** / **Check-out** each with a short date (`Aug 15`, not truncated as `Aug 15, 20…`) and a 12-hour time.
4. Scroll down slightly. **Pass:** a **Gallery** film strip of horizontally-scrollable photos appears below the stay pass, separate from the hero.
5. Below the gallery: a sticky **quick-nav** pill bar — **Getting in / At home / Before you go / Need help**.

---

## 5. Chapters + quick-nav scrollspy

1. Click **At home** in the quick-nav. **Pass:** page jump-scrolls to the "Make Yourself at Home" chapter; that pill becomes the active/filled one.
2. Scroll manually back up through **Getting In**. **Pass:** each chapter shows a `Chapter 0N` eyebrow, a serif heading, and a Sand-colored content card with the real content from **Property Templates** (check `/templates` in another tab to cross-check the text matches).
3. If the test booking / mock preview has `need_parking` true, confirm **"Make Yourself at Home"** contains **both** House Rules and Parking Reminders as two sub-sections in the same chapter (not two separate chapters).
4. Confirm the **Getting In** chapter includes a map card (address + **Directions** button) below the check-in instructions.
5. Scroll to the very bottom. **Pass:** **Need Anything?** section — host avatar, name, org, and any of Email / Facebook / Airbnb links present on the property — each link is clickable (`mailto:`, `tel:`, or external).

---

## 6. Preview ↔ real guest token parity

1. In the dashboard, drive a real booking to **`READY_FOR_CHECKIN`** (or reuse one already there) so `stay_guide_token` + validity window are set.
2. Open `/properties/:slug/stay-guide?token=<that token>` (no `preview=1`).
3. **Pass:** identical visual template to the preview route (hero, stay pass, chapters, quick-nav, gallery, footer) — the **Preview** banner is absent and stay-pass data reflects the **real** guest/dates instead of the mock "Jordan Santos" sample.
4. **Regression:** confirm the token's validity window is unchanged — a token outside its Manila check-in-day → end-of-day-after-checkout window still shows the generic "not available" message, and an unrelated/garbage token 404s the same way it did before this redesign.

---

## 7. Theming — light / dark

1. On the guest preview page, click the theme toggle (top-right of the hero) to switch to **light**.
2. **Pass:** background becomes warm paper (`#F7F2E8`), text/headings are ink-dark, chapter cards are a slightly darker sand tone — not the dashboard's default light theme colors.
3. Toggle back to **dark**. **Pass:** background becomes a deep warm brown/black, text is warm cream, chapter cards are a darker sand — good contrast in both modes, and the teal brand accent (buttons, active nav pill, links) is unchanged across both.

---

## 8. Motion + reduced motion

1. With normal settings, reload the preview page. **Pass:** hero image does a subtle scale-settle, the stay-pass card fades/slides up shortly after, and each chapter fades up the first time it scrolls into view.
2. Enable **`prefers-reduced-motion: reduce`** (Chrome DevTools → **⋮ → More tools → Rendering → Emulate CSS media feature prefers-reduced-motion**) and reload.
3. **Pass:** hero, stay pass, and chapters are all immediately visible with no animation — nothing stays invisible waiting for a scroll/intersection event that reduced-motion mode skips.

---

## 9. Responsive sweep

At each of **375×812**, **768×1024**, and **1440×900**:

1. Load the hero + stay pass. **Pass:** the unit/property title (even when it wraps to two lines) is never covered by the stay-pass card's overlap; check-in/check-out dates never truncate.
2. Confirm chapters, quick-nav, and the "Need Anything?" footer all stay inside a centered column (~720px max) — no edge-to-edge stretched text on desktop, no horizontal scroll on mobile except the intentional gallery film strip.
3. Confirm all tap targets (quick-nav pills, Directions button, contact links) are at least 44×44px on mobile.

---

## 10. Cleanup

- No teardown required — `custom_pages` rows are safe to leave in the local DB (idempotent lazy-create, no side effects on booking data).
- If you created a throwaway low-permission property member for step 3.5, remove or restore their permissions afterward.
