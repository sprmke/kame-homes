---
stage: done
title: 'Refine Footer & Create Public Pages — Implementation Plan'
status: complete
tags: [planning, planned-modules]
updated: 2026-08-06
---

# Refine Footer & Create Public Pages — Implementation Plan

> **Status (2026-08-06):** Implemented. Footer trimmed; About/Contact/Support/Cookies routes live; Terms/Privacy rewritten with product-grounded copy.

## Context

The public marketing footer (`MarketingFooter.tsx`) has 15 links across four sections, but 8 point to routes that don't exist (`/about`, `/contact`, `/careers`, `/blog`, `/pricing`, `/resources`, `/support`, `/cookies`). Separately, `/terms` and `/privacy` already exist but are known placeholder copy — `docs/guides/routes/legal.md` explicitly documents them as "static legal copy ported from PMA," not content grounded in this app's actual features or data practices. There's no Cookie Policy at all, despite the guest booking flow collecting significant PII (names, ages, phone, address, government ID images, pet vaccination records, payment receipts, bank/GCash payout details) and the platform integrating numerous third-party processors (Supabase, Resend, Google OAuth/Calendar/Sheets/Gmail, Gemini/Groq AI, Meta, Telegram, Jamendo).

This plan trims the footer to what's realistic for a lean property-management operation, builds real (non-fabricated) content for the pages worth keeping, and rewrites Terms/Privacy plus adds a new Cookie Policy with content grounded in the app's actual data collection and integrations. This is a planning-only deliverable — no code changes were made in this session; implementation is a future task.

## Decisions made during brainstorming (do not re-litigate during implementation)

1. Drop **Careers** and **Blog** links entirely from the footer — no hiring pipeline or content team to back them. Do not add "coming soon" placeholder pages for these; just remove the links.
2. Drop **Resources** link — redundant with the new Support page.
3. Fix **Pricing** link to point to the existing `/for-hosts#pricing` in-page anchor instead of building a separate Pricing page (that section already exists in `ForHostsPage.tsx`).
4. Keep social icons (Facebook/Instagram/Twitter) as-is even though they currently point to generic platform homepages, not real brand accounts — sourcing real social URLs is out of scope.
5. Build real (not placeholder/"coming soon") content for About, Contact, Support — sourced from `docs/PROJECT.md`'s feature list. No fabricated founding dates, team bios, or company history.
6. Rewrite Terms of Service and Privacy Policy **in place** with real content (not just adding a Cookie Policy alongside untouched placeholders) — grounded in the actual guest/host PII collected and every third-party processor in use.
7. Operating business name across About/Contact/Legal pages: **"Kame Homes"** (existing public brand) — no invented legal entity suffix (Inc./LLC). Contact point: `hello@kamehomes.com` (already used in the footer today).
8. New pages reuse existing patterns exactly — `LegalSimplePage` for prose legal pages, flat `marketing/pages/*.tsx` files for About/Contact/Support (matching `ServicesPage.tsx`/`ForHostsPage.tsx` precedent). No new component subfolders, no new typography system (stays Plus Jakarta Sans body font, `text-primary` teal accent — Fraunces is not currently used anywhere in guest-facing pages and this plan doesn't introduce it).
9. No new backend/edge function work — the Contact page is static info, not a working contact form with submission handling.
10. Out of scope: sourcing real social media URLs, adding a catch-all 404/not-found route (a real gap discovered during research, but unrelated to this task), building an actual blog/CMS or careers/job-listing system.

## Current state (verified this session)

- Footer: `ui/src/features/guest/marketing/shared/components/MarketingFooter.tsx` (186 lines). Sections: **Explore** (`/properties` + type filters — all real), **Company** (About/Contact/Careers/Blog — all 4 dead), **For Hosts** (`/for-hosts` real; Pricing/Resources/Support dead), **Legal** (Privacy/Terms real; Cookies dead). Social icons hardcoded to `facebook.com`/`instagram.com`/`twitter.com`. Brand block already has `mailto:hello@kamehomes.com`, `tel:+639123456789`, "Manila, Philippines".
- Footer renders via `MarketingLayoutShell.tsx`, wrapping all `marketingRoutes`; hidden only on public form pages.
- Reusable pattern: `ui/src/features/guest/marketing/legal/components/LegalSimplePage.tsx` — prose layout (`{title, description, sections: {title, paragraphs}[]}`) already used by Terms/Privacy.
- Page templates to mirror: `TermsPage.tsx` / `PrivacyPage.tsx` (thin wrappers around `LegalSimplePage`), `ServicesPage.tsx` (richer standalone page pattern — hero band, `container mx-auto px-4 sm:px-6 lg:px-8`, `text-primary` accents), `ForHostsPage.tsx` (longer landing page with in-page anchor sections, including an existing `id="pricing"` section).
- Routes registered in `ui/src/features/guest/marketing/routes/index.tsx` inside the `MarketingLayoutShell` `<Route>` block — `terms`/`privacy` (lines ~64-65) are the exact pattern new routes will follow.
- No `/about`, `/contact`, `/support`, `/cookies` routes or page files exist anywhere in `ui/src`. No catch-all/404 route exists anywhere in the app (unrelated gap, noted but out of scope).
- Guest PII collected (`guestFormSchema.ts` / `submit-form`): guest names + ages (up to 5 guests), email, PH phone, address, check-in/out dates, nationality, "how you found us," special requests. Uploads: payment receipt image, government ID per adult guest, optional pet vaccination record + photo, optional parking plate/brand/model/color + endorsement/receipt. At SD refund: bank/GCash payout account details. Storage buckets: `payment-receipts`, `pet-vaccinations`, `parking-endorsements`, `approved-gafs` (private), `approved-pet-forms` (private), `sd-refund-receipts` (private), `property-media`.
- Host verification data (separate category, `upload-org-verification-asset`): valid ID, selfie-with-ID, ownership/social proof.
- Third-party processors requiring privacy disclosure: **Supabase** (DB/Storage/Auth/Edge Functions), **Resend** (transactional email, `kamehomes.space` sending domain), **Google** (OAuth sign-in, Gmail API listener for GAF/pet approvals, Calendar + Sheets sync, Places/Maps API), **Gemini + Groq** (AI receipt/document validation, AI marketing captions, AI inbox reply suggestions, AI voice receptionist), **Meta** (Guest Inbox OAuth/webhooks, Marketing Studio publishing), **Telegram** (internal ops notifications only — booking details relayed to internal staff groups, not guest-facing consent), **Jamendo** (royalty-free music in video editor, non-personal data).
- Access-control posture (CLAUDE.md): RLS is **not** the access-control layer — edge-function checks (`verifyAdminJwt`/`verifyOrgAccess`/`verifyPropertyAccess`/`resolveScopedParkingAccess`) are; Gmail OAuth refresh tokens encrypted at rest (AES-256-GCM); tiered access model (guest anon / guest authenticated / legacy admin / org / property / parking / super-admin).
- No formal legal entity name exists anywhere in the repo; public brand is "Kame Home"/"Kame Homes" (GitHub org/repo `sprmke/kame-homes`). Existing contact info already in the footer: `hello@kamehomes.com`, `+63 912 345 6789`, "Manila, Philippines".
- `docs/guides/routes/legal.md` documents Terms/Privacy as Phase 1 static placeholder copy "ported from PMA" — needs correcting once real content ships.

## Architecture

### 1. Footer link changes (`MarketingFooter.tsx`)

- **Company**: remove Careers and Blog list items; keep About → `/about`, Contact → `/contact`.
- **For Hosts**: remove Resources list item; change Pricing href from the dead `/pricing` route to `/for-hosts#pricing` (anchor scroll to the existing `id="pricing"` section in `ForHostsPage.tsx`); keep Support → `/support`.
- **Legal**: keep Privacy/Terms unchanged; add Cookie Policy → `/cookies`.
- **Social row**: unchanged (kept as placeholder per decision #4).
- Net result: 15 links (8 dead) → 11 links, all resolving to real routes or anchors.

### 2. New pages (`ui/src/features/guest/marketing/pages/`)

- **`AboutPage.tsx`** — mission/what-Kame-Homes-does copy sourced from `docs/PROJECT.md`'s feature list (booking workflow, org/property/parking multi-tenancy, guest portal, marketing studio, AI receipt validation, etc.). Styled like `ServicesPage.tsx` (hero band + content sections). No fabricated history, founding date, or team bios.
- **`ContactPage.tsx`** — static contact info cards (general inquiries, host support, guest support) reusing the `hello@kamehomes.com` / `+63 912 345 6789` / Manila address already in the footer. No new contact-form submission backend.
- **`SupportPage.tsx`** — FAQ-style entries covering the booking status workflow guests/hosts actually experience (booking → document review → check-in → check-out → SD refund), linking out to Contact and For Hosts.
- **`CookiesPage.tsx`** — thin wrapper around `LegalSimplePage`, matching the `TermsPage.tsx`/`PrivacyPage.tsx` pattern. Content describes the app's actual minimal cookie/local-storage footprint (Supabase Auth session storage only — no analytics/ad-tracking scripts found in the codebase during research).

### 3. Legal content rewrite (in place)

- **`TermsPage.tsx`** — booking terms (subject to per-property rules), security deposit + refund conditions, guest portal account terms, acceptable use, liability disclaimer, Philippines governing law, changes-to-terms clause, contact via `hello@kamehomes.com`.
- **`PrivacyPage.tsx`** — what's collected (guest PII + document uploads + host verification data, per Current State above), why (booking fulfillment, identity verification, SD refund payout), the third-party processors list, security posture (edge-function access control, encrypted secrets at rest), data retention, user rights (access/deletion via contact email), children's privacy note, changes-to-policy clause.
- Both continue rendering through `LegalSimplePage` — only new `sections` content is passed in, no layout component changes.

### 4. Routing (`ui/src/features/guest/marketing/routes/index.tsx`)

- Add four new `<Route path="..." element={<...Page />} />` entries inside the existing `MarketingLayoutShell` block, following the exact pattern already used for `terms`/`privacy`: `about`, `contact`, `support`, `cookies`.

## Rollout

- Single-pass change: footer edits, new pages, route registrations, and legal rewrites ship together — copy/routing only, no behavioral risk, no feature flag needed.
- No migrations, no edge function changes, no env vars.

## Docs to update

- `docs/guides/routes/legal.md` — correct the "Phase 1 static placeholder ported from PMA" description once real Terms/Privacy content ships; add entries for the new About/Contact/Support/Cookies routes if this guide's scope covers all marketing routes.
- `docs/PROJECT.md` — update the guest route list if it enumerates marketing routes individually.

## Verification

- `bun run type-check`, `bun run lint`, `bun run build` after implementation.
- Manually click all 11 footer links and confirm each resolves to a real page or anchor, at 375/768/1024px+ widths per the `mobile-responsive` skill.
- Confirm the Pricing link scrolls to the `id="pricing"` section on `/for-hosts`.
- Spot-check that Terms/Privacy/Cookies content is internally consistent and doesn't contradict facts in `docs/PROJECT.md`/CLAUDE.md (no invented data practices).
