---
stage: planned
title: 'Rebrand: Kame Homes → Kame Space (copy, code, config, data, third parties)'
status: planned
tags: [planning, branding, copy, email, seo, pwa, marketing, third-party, docs]
updated: 2026-10-25
depends_on: [legacy-prod-to-mt-prod-cutover]
followed_by: [kamespace-com-domain-move, google-services-verification]
---

# Rebrand: Kame Homes → Kame Space

**Goal.** After the legacy → mt-prod cutover is verified on dev and new prod, rename the product from **Kame Homes** to **Kame Space** everywhere a person or a third party can see it: UI copy, tab titles, PWA install name, emails, PDFs, AI replies, voice narration, social creative, SEO metadata, legal pages, third-party app listings, docs and agent tooling. Rename code identifiers that carry the old name, and add a CI guard so the old name cannot come back. Stable technical identifiers whose change would break data, links or guests' calendars are kept on purpose and listed in an allow-list (§5).

**Not in this plan.** The domain move `kamehomes.space` → `kamespace.com` is the next intake item and gets its own plan (`kamespace-com-domain-move`). Google OAuth / API verification is the item after that. This plan only says which strings belong to those plans (§4, class D) and how the three are sequenced (§3).

**Status: planned, not started.** Nothing here is implemented. Work starts only with `/workflow-start` once the gate in §2 is met.

---

## 1. Inventory (verified 2026-10-25, read-only grep)

Counts exclude `node_modules`, `dist`, `backups/`, `worktrees/` and `.claude/worktrees/` (agent worktree copies; they are re-created from the branch and need no edits).

| Variant                                               | Lines | Files | Where it lives                                                                                     |
| ----------------------------------------------------- | ----: | ----: | -------------------------------------------------------------------------------------------------- |
| `Kame Homes`                                          |   410 |   234 | Display name: UI defaults, PWA manifest, SEO, marketing copy, narration, e2e fixtures, docs        |
| `Kame Home` (singular)                                |    86 |    53 | Legacy tenant org name (`multi_tenancy_foundation` backfill), test fixtures, legacy-brand matcher  |
| `kame-homes`                                          |   585 |   207 | Repo `sprmke/kame-homes`, Vercel project, `*.vercel.app` origins, seed org slug, e2e slugs, pepper |
| `kame-home`                                           |   215 |   104 | Real tenant org slug, QR asset filename, dev seeds and QA scripts                                  |
| `kamehomes`                                           |   450 |   179 | Domain `kamehomes.space` (mostly class D), ICS UID, social handles, hashtags                       |
| `kamehome`                                            |    30 |    23 | Owner Gmail `kamehome.azurenorth@gmail.com`, `@kamehome.ph` mock handle                            |
| `KameHomes` / `KameHome`                              |    12 |    12 | `KameHomesBrandIcon`, `isLegacyKameHomeBrand`, `#KameHomes` hashtag                                |
| `KAME_HOMES_URL`                                      |    20 |     2 | Placeholder name in CI/CD setup docs only (not a real env var)                                     |
| Bare `Kame`                                           |   996 |   439 | Mascot / AI receptionist "Kame", "vs Kame median", "Kame Superhost", `Kame*` editor components     |
| `kame homes`, `KAME HOMES`, `kame_homes`, `kameHomes` |     0 |     0 | None today. The guard (§9) still covers them.                                                      |

**Good news.** Visible branding is already env-driven:

- UI: `ui/src/lib/platformAppName.ts` (`DEFAULT_PLATFORM_APP_NAME = 'Kame Homes'`) → `ui/src/lib/platformBranding.ts` (`PLATFORM_APP_NAME`, `appPageTitle`, `platformCopyrightLine`, `platformWordmarkParts`, `platformWatermarkLabel`, `platformLegalIntro`, `platformProductLabel`), driven by `VITE_PLATFORM_APP_NAME`.
- Edge: `supabase/functions/_shared/platformBrand.ts` (`DEFAULT_PLATFORM_APP_NAME`, `PLATFORM_BRAND_NAME`, `resolvePublicBrandName`), driven by `PLATFORM_APP_NAME`. Used by `brandedEmailShell.ts`, `emailService.ts`, `orgVerificationEmail.ts`, `superAdminStepUpEmail.ts`, `subscriptionBillingEmail.ts`.
- Vercel edge: `ui/middleware.ts` uses `VITE_PLATFORM_APP_NAME` with a `'Kame Homes'` fallback for crawler HTML.
- No env var **name** contains the brand. Only **values** do.

So most visible text flips by changing two env values and two constants. Everything outside those resolvers is a hardcoded string (static HTML, manifests, marketing data, narration, tests, docs) and is the bulk of the work.

**Traps found during inventory** (each one has a task below):

| Trap                                                                                                                                                       | Why a blind find-and-replace breaks it                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `guestIdentityKey.ts` pepper fallback `'kame-homes-review-identity-dev-pepper'`                                                                            | Changing it changes every review identity hash wherever the pepper env is unset (local, possibly dev). Duplicate-review detection breaks.                                                  |
| Guest trip `.ics` `UID:trip-<id>@kamehomes` (`guestTripCalendar.ts`)                                                                                       | Calendar apps match events on UID. A new UID creates a **duplicate event** for every guest who already saved their trip. `PRODID` text can change; the UID must not.                       |
| `kame-home-gcash-qr-payment` used as a **sentinel** in `paymentMethods.ts`, `emailService.ts`, `propertyTemplateEmailSections.ts`, `storedMediaDisplay.ts` | Stored DB URLs and already-sent emails reference that filename. Renaming the file without keeping the old matcher shows the default QR as if it were custom, or drops it.                  |
| `isLegacyKameHomeBrand` / `isLegacyPlatformOrgBrand` regex `^kame\s*home…$`                                                                                | It hides the migrated org label "Kame Home" from guests. It must keep matching that, and should also match "Kame Homes" (and decide on "Kame Space") or the org name leaks as a host name. |
| Generic word "Homes" ("Homes in Cebu", "Available Homes", "View Homes", "Camella Homes", "Urban Deca Homes")                                               | Not the brand. Never replace `Homes` alone.                                                                                                                                                |
| Shipped migrations (`20260629180000_multi_tenancy_foundation.sql`, `20260703150000_org_settings.sql`, …) contain `'Kame Home'` / `'kame-home'`             | Editing a shipped migration is forbidden (hook-enforced) and would change history. Data renames go in a **new** migration or the shaping script.                                           |
| For-hosts narration `.mp3` files say "Kame Homes" out loud                                                                                                 | Text edits to `.vtt` / `manifest.json` / `hostTourNarration.ts` leave the audio wrong. Audio must be regenerated.                                                                          |
| PWA `name` / `short_name` are baked into the build and installed icons                                                                                     | Android picks the new name up on manifest update. iOS home-screen labels never change until the user re-adds the app.                                                                      |
| `kamewave` (prod unlock word) and `kame-works` (Vercel team)                                                                                               | Not "Homes". Out of scope. Renaming `kamewave` would silently disable the prod-deploy guard.                                                                                               |
| Claude Code memory is keyed by the local folder path (`~/.claude/projects/-Users-…-kame-homes/`)                                                           | Renaming the local checkout folder orphans agent memory and Cursor/OpenCode workspace state.                                                                                               |

---

## 2. Gate and current status of the cutover plan

**Prerequisite 0:** [`legacy-prod-config-secrets-backup.md`](./legacy-prod-config-secrets-backup.md) signed off (B-18): every legacy Supabase/Vercel env var, secret and dashboard config backed up and verified. Nothing in this plan starts before that.

This plan starts **only after** [`legacy-prod-to-mt-prod-cutover.md`](./legacy-prod-to-mt-prod-cutover.md) reaches go and hypercare day 7 is clean (user's sequencing: migrate, verify on dev and new prod, then rename). Decisions R1 and R2 below must be answered **before** cutover Phase 3 shaping, because they change what the cutover writes.

Cutover status as of 2026-10-25 (from that plan's checkboxes):

| Cutover phase | Done                                                                                                                                | Open                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 0 Inventory   | 0.1 row inventory, 0.3 migration history, 0.4 extensions, 0.6 legacy link inventory                                                 | 0.2 byte-level drift (probe done), 0.5 integration inventory, 0.7 open questions                    |
| 1 Accounts    | none                                                                                                                                | 1.1–1.7 (mt-prod project, rehearsal project, Auth, Vercel prod env, GitHub env, guards)             |
| 2 Tooling     | 2.1 dump, 2.2 restore, 2.3 upgrade, 2.4 first chain fix (`20260629215000_gmail_listener_state_singleton_drop_guard.sql`), all on R1 | 2.5 rewrite, 2.6 storage, 2.7 verify (SQL drafted, not run green), 2.8 safety flags                 |
| 3 Org shaping | none                                                                                                                                | 3.1–3.9. **3.1 org name/slug is now coupled to this plan (R1).**                                    |
| 4 Rehearsals  | R1 partially (restore + upgrade)                                                                                                    | R2, R3 dress rehearsal, timings, rollback test                                                      |
| 5 App changes | 5.2 booking-id property resolution (`resolve-booking-property`)                                                                     | 5.1 apex redirects, 5.3 legacy maintenance page, 5.4 PMO path, 5.5/5.6 cron guards, 5.7 verify list |
| 6–10          | none                                                                                                                                | all                                                                                                 |

Also still open in production readiness ([`HANDOFF.md`](../in-progress/production-readiness/HANDOFF.md)): restore drill PR-024, Turnstile PR-001, AI ceiling PR-003, PayMongo sandbox PR-030, CSP PR-012, issue #183 caching. None block the rename itself, but the rename's prod rollout should not share a deploy window with any of them.

---

## 3. Decisions (recommended; confirm before starting)

| #      | Decision                                      | Recommendation                                                                                                                                                                                                                                                                                                                                       | Why                                                                                                                                                                                         |
| ------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | Tenant org name and slug at cutover           | Shape the migrated org **once**, at cutover, straight to its final identity. If the house org should carry the product brand, use "Kame Space" / `kame-space`. If it is the host's own business name, pick that now. Either way, **do not** shape it as "Kame Homes" / `kame-homes` and rename later. Update cutover Q1 / 3.1 accordingly.           | The slug is in every admin URL, bookmark, Telegram link and email already sent from mt-prod. A second slug change right after launch costs a remap (`tenantSlugRemap.ts`) and broken links. |
| **R2** | Final domain before or after cutover          | Decide the production hostname (`app.kamespace.com` vs `app.kamehomes.space`) **before cutover Phase 1.4 / 6.1 / 6.2**, even though the visible rename ships after. If `kamespace.com` is bought in time, cut over directly onto it and keep `kamehomes.space` as a redirect-only domain.                                                            | Otherwise Google OAuth client, Supabase Auth URLs, Resend domain, inbound MX, Meta return origins, CORS, Turnstile and Maps key restrictions are all set up twice in one month.             |
| **R3** | Product name only, or business/legal name too | Ask: is "Kame Homes" a registered business name (DTI/SEC, BIR, bank, PayMongo merchant, Meta Business, Google Cloud billing)? If yes, the legal entity name changes on its own timeline. The app shows the **product** name; legal pages name the **operator** entity.                                                                               | Third-party KYC names must match registration documents. Renaming them before the registration changes can fail verification.                                                               |
| **R4** | Exact forms of the new name                   | Display `Kame Space`; wordmark split `Kame` + `Space`; uppercase `KAME SPACE`; slug/kebab `kame-space`; Pascal `KameSpace`; camel `kameSpace`; SCREAMING `KAME_SPACE`; hashtag `#KameSpace`; handle `kamespace` (check availability, R6); ICS/vendor id unchanged.                                                                                   | One table that every task and the guard script read from.                                                                                                                                   |
| **R5** | Historical records                            | **Do not rewrite** history: `activity_log`, sent-email logs, chat/inbox transcripts, guest reviews, AI conversation logs, published social posts, finance line items, archived docs that describe past state (quote old names as names). **Do rewrite** live configuration: templates, settings, announcements still shown, AI knowledge, seed data. | Audit trails must reflect what was sent. Rewriting them is falsifying records.                                                                                                              |
| **R6** | Social handles and third-party names          | Claim `kamespace` handles (Facebook page, Instagram, X, TikTok, YouTube) **before** announcing. Keep the old handles, renamed to redirect or point at the new ones, for at least 12 months.                                                                                                                                                          | Handle squatting after a public rename is common. Meta page name changes go through review.                                                                                                 |
| **R7** | Repo, Vercel project, local folder names      | Rename display names freely. Rename the GitHub repo `sprmke/kame-homes` → `sprmke/kame-space` and Vercel project `kame-homes` → `kame-space` only as a **separate, last** phase (§7 Phase 8), after every origin allow-list has both values. Leave the local folder name unless the user wants it, and move Claude memory if they do.                | GitHub redirects old repo URLs, but Vercel changes the default `*.vercel.app` hostname, which CORS, OAuth and Meta return URLs depend on.                                                   |
| **R8** | Retired-name fallback                         | After hypercare, add `kame homes` to `RETIRED_PLATFORM_APP_NAMES` in both `platformBrand.ts` and `platformAppName.ts`, so a stale env value resolves to the new default. **Not** during rollout, because the env flip is the rollback path.                                                                                                          | Keeps rollback cheap first, then makes the old name impossible later.                                                                                                                       |
| **R9** | `kh-*` agent commands                         | Rename to `ks-*` (`/ks-help`, `/ks-start-app`, …) across `.claude/commands`, `.cursor/commands`, `.opencode`, and keep `kh-*` as thin aliases for one release. Re-run `bun run setup:ai-tooling` sync.                                                                                                                                               | Teammates use the old names. Aliases avoid a broken workflow on day one.                                                                                                                    |

---

## 4. Classification rule (applies to every hit)

Every occurrence lands in exactly one class. The guard script (§9) and the review checklist use these classes.

| Class                      | Meaning                                                                                  | Examples                                                                                                                                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Visible copy**        | Text a guest, host, admin, crawler or third-party reviewer can see or hear               | `index.html` title/meta, `vite.config.ts` manifest, `site.webmanifest`, `offline.html`, marketing data, narration, email subjects and from-names, PDF text, AI prompts, legal pages, social captions                                               |
| **B. Code identifier**     | Symbol, file or test name, no user impact                                                | `KameHomesBrandIcon`, `isLegacyKameHomeBrand`, `DEFAULT_PLATFORM_APP_NAME` values, test fixture names `Kame Homes PH` / `kame-homes-ph`                                                                                                            |
| **C. Config value**        | Env values, secrets, platform settings, third-party dashboard fields                     | `PLATFORM_APP_NAME`, `VITE_PLATFORM_APP_NAME`, `VITE_PLATFORM_CONTACT_EMAIL`, `SUPPORT_TEAM_EMAIL`, `VAPID_SUBJECT`, `FACEBOOK_REVIEWS_URL`, Resend from-name, OAuth consent app name, Telegram bot display names                                  |
| **D. Domain / hostname**   | Contains `kamehomes.space` or a `*.vercel.app` origin. **Moves with the domain plan.**   | `cors.ts`, `publicAppOrigin.ts`, `renderEmailHtml.ts` logo URL, `telegramAdmin.ts` `APP_BASE_URL`, `seoMeta.ts` host list, `posthog/env.ts`, `sentry/client.ts`, `RESEND_FROM_EMAIL`, `approvalInboundAddress.ts`, social `SITE`, CI `PREVIEW_URL` |
| **E. Data**                | Strings stored in Postgres or Storage                                                    | `organizations.name/slug`, property names, per-property email/Telegram templates, announcements, AI knowledge chunks, marketing drafts, `platform_settings`                                                                                        |
| **K. Keep (allow-listed)** | Stable identifiers whose change breaks data, links or calendars. Documented, not changed | Review pepper fallback, ICS UID domain, QR sentinel filename, shipped migrations, legacy-brand matcher patterns, owner Gmail address, `kamewave`, `kame-works`, `legacy-final` tag, historical records (R5)                                        |

Rule of thumb: if changing it would alter a hash, a UID, a stored path, a URL someone already has, or a shipped migration, it is **K**, even if it looks like branding.

---

## 5. Keep list (class K, the allow-list seed)

Each line becomes an entry in `scripts/brand/brand-allowlist.txt` with a reason.

1. `supabase/functions/_shared/guestIdentityKey.ts` `REVIEW_IDENTITY_PEPPER_FALLBACK = 'kame-homes-review-identity-dev-pepper'`. Instead: confirm `REVIEW_IDENTITY_PEPPER` (or the real env name) is set on dev and mt-prod so the fallback is never used in hosted envs. Optionally rename the **constant** only, keeping the string.
2. `ui/src/features/guest/trip/lib/guestTripCalendar.ts` `UID:trip-${bookingId}@kamehomes` and its test. `PRODID:-//Kame Homes//Guest Trip//EN` → `-//Kame Space//Guest Trip//EN` is allowed (PRODID is not used for matching).
3. Filename sentinel `kame-home-gcash-qr-payment` in `appSettings.ts`, `paymentMethods.ts`, `emailService.ts`, `propertyTemplateEmailSections.ts`, `storedMediaDisplay.ts`, `config.toml` static files, `scripts/preview/preview-emails-from-db.mjs`. If a new default QR file is added, matchers accept **both** names and the old file stays served at `/images/kame-home-gcash-qr-payment.jpg` forever (old emails embed it).
4. Every file under `supabase/migrations/` that exists today.
5. Legacy-brand matchers: patterns in `platformBrand.ts#isLegacyKameHomeBrand` and `platformBranding.ts#isLegacyPlatformOrgBrand` (extend, never remove).
6. Real email addresses (`kamehome.azurenorth@gmail.com` and similar in env values). These are mailboxes, not brand text. Changing them is an account decision, not a rename.
7. `kamewave`, `kame-works`, `legacy-final`.
8. Historical records and archive docs quoting past names (R5).
9. `'stays'` in `RETIRED_PLATFORM_APP_NAMES`.
10. `scripts/migrate/legacy-to-mt-prod/**` references to legacy origins (they describe the legacy system).
11. Class D strings until the domain plan runs (tracked there, guard treats them as "pending-domain").

---

## 6. Task list by surface

Tasks are grouped by surface. Phase order is in §7. Every task: one commit scope, docs updated in the same change, `human-copy` on every string edit (no em dashes, no AI tells).

### 6.1 Brand core (resolvers and constants)

- [ ] **B-01** `ui/src/lib/platformAppName.ts` `DEFAULT_PLATFORM_APP_NAME` → `'Kame Space'`; update `platformAppName.test.ts`.
- [ ] **B-02** `supabase/functions/_shared/platformBrand.ts` same constant (file says "keep in sync"); update `platformBrand_test.ts`.
- [ ] **B-03** Extend both legacy matchers so `Kame Home`, `KameHome`, `Kame Homes`, `KameHomes` (with optional "— Azure North (Residences)") map to the platform name. Decide whether `Kame Space` as an **org** name should also be hidden on guest surfaces (only if R1 names the house org "Kame Space"). Add tests for each form and for "Kame Homes PH" (must **not** match, it's a fixture host name).
- [ ] **B-04** Rename `isLegacyKameHomeBrand` → `isLegacyPlatformBrand` (UI already has `isLegacyPlatformOrgBrand`). Keep deprecated aliases for one release, update `guestFormBranding.ts`, `ShowcaseFooter.tsx`, `platformBranding.test.ts`, edge callers.
- [ ] **B-05** `ui/src/lib/seo/seoMeta.ts` `SITE_NAME` → read from `PLATFORM_APP_NAME` instead of a second literal. Update `seoMeta.test.ts`, `seoMiddleware.test.ts`.
- [ ] **B-06** `ui/middleware.ts` fallback `'Kame Homes'` → `'Kame Space'` (or import the shared default if the middleware bundle allows it).
- [ ] **B-07** Wordmark: `platformWordmarkParts()` yields `Kame` + `Space`. Check `brandColor.ts` overlay comment and colors ("Homes" accent styling), `appLoaderWordmark.test.ts`, loader animation widths (`glyphWidths` if the loader measures letters). Visual check: "Space" is one letter shorter than "Homes", so loader and overlay spacing may shift.
- [ ] **B-08** `platformWatermarkLabel()` produces `KAME SPACE`. Check plan-gate watermark tile width at 375 px.
- [ ] **B-09** `KameHomesBrandIcon.tsx` → `KameSpaceBrandIcon.tsx` (file rename + all imports; `bun run check:filenames`). Remove the stale sed line in `scripts/dev/migrate-feature-imports.sh`.
- [ ] **B-10** Decide whether brand defaults should move to one shared JSON (e.g. `brand.json` read by UI, middleware, edge and marketing studio) to stop four copies drifting. Recommended, small.

### 6.2 Static web shell, PWA, SEO

- [ ] **W-01** `ui/index.html`: `<title>`, `application-name`, `apple-mobile-web-app-title`, any `og:site_name` / description text.
- [ ] **W-02** `ui/vite.config.ts` PWA manifest `name`, `short_name`, `description`. `ui/public/favicon/site.webmanifest` (`name`, `short_name`). Keep manifest `id` and `start_url` **unchanged** so installed PWAs update in place rather than appearing as a new app.
- [ ] **W-03** `ui/public/offline.html` title and any visible copy.
- [ ] **W-04** Bump `ui/public/pwa-version.json` / SW version so clients fetch the new manifest and precache. Confirm the PWA precache budget still passes (see memory note on Polotno chunk budget).
- [ ] **W-05** Favicons and icons (`favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `web-app-manifest-*.png`, `favicon-96x96.png`): check if any contain a wordmark or "KH" monogram. If so, new artwork (designer task), regenerate all sizes.
- [ ] **W-06** `ui/public/images/logo.png` (email logo, served at `/images/logo.png`): if it contains the "Kame Homes" wordmark, replace **in place** (same path) so already-sent emails show the new logo. Do not rename the path.
- [ ] **W-07** OG / social share images (`meta.image` sources, any `og-*.png` in marketing). New images if they show the old name. After deploy, re-scrape key URLs in Facebook Sharing Debugger and LinkedIn Post Inspector.
- [ ] **W-08** Structured data: any JSON-LD `Organization` / `WebSite` `name`, `alternateName`. Set `alternateName: "Kame Homes"` for 6–12 months to help search engines connect the two names.
- [ ] **W-09** `robots.txt` / sitemap copy (no brand today; verify). Request recrawl in Google Search Console after launch (property ownership itself moves with the domain plan).
- [ ] **W-10** Tab titles: confirm every page uses `appPageTitle` / `publicPageTitle`. Grep for hardcoded `'Kame Homes - '` or `document.title =` strings.

### 6.3 Guest and host UI copy

- [ ] **U-01** For-hosts marketing data: `hostLandingV3.ts` ("Run your next booking on Kame Homes."), `hostTourNarration.ts`, `hostTourChapters.ts` (eyebrows "Kame Homes for hosts", "Kame Homes"), `hostShowcase.ts` lead copy. Route through `PLATFORM_APP_NAME` where a sentence names the product.
- [ ] **U-02** Showcase demo URL chrome `showcaseDemoRegistry.ts` (`app.kamehomes.com/…`, already a wrong TLD): class D, but fix to a neutral `app.kamespace.com/…` or derive from origin in the domain plan. Track there.
- [ ] **U-03** `V3FeatureBento.tsx` fake handle `kamehomes` → `kamespace`; `inboxMockData.ts` `@kamehome.ph` → final handle (R6).
- [ ] **U-04** Mock catalogs: `mockProperties.ts` (`property-kame-home`, slug `kame-home`), `mockDevelopments.ts`. These render on preview/demo pages. Rename display names; slugs only if no test or route depends on them.
- [ ] **U-05** Superhost copy (`orgSuperhostDisplay.ts` "on Kame"), analytics "vs Kame median" (`exportPdf.ts`, `dashboardAssistantVisuals.ts`, `analyticsService.ts`). These say "Kame", which survives the rename. Decide per string whether short "Kame" is the intended product short name (recommend yes; R4 adds "Kame" as the approved short form).
- [ ] **U-06** Legal pages (Terms, Privacy, cookie/consent text): operator name via `platformLegalSubject()` / `platformLegalIntro()`. Bump "Last updated" date. Add one line: "Kame Space was previously called Kame Homes." There is no legal-version or re-consent table today (verified), so no re-acceptance flow is needed. If R3 says the legal entity changes, legal review first.
- [ ] **U-07** Help & Support, onboarding, empty states, plan cards (`planPresentation.ts`), notification copy, toasts, PWA install prompt: grep after B-01 for any literal that bypassed the resolver.
- [ ] **U-08** Super-admin chrome (`/admin/*`) titles and email previews.
- [ ] **U-09** Guest-facing host label fallback: `resolveOrgDisplayName` returns "Host" for legacy brand labels. Re-check the guest form header, trip hub, stay guide and receipts for the migrated org after B-03.
- [ ] **U-10** `NotFoundPage.tsx` turtle joke stays valid ("Kame" is still in the name). No change, note only.
- [ ] **U-11** Mobile pass (`mobile-responsive` skill): the new wordmark and watermark at 375/768/1024 px, bottom nav, sheets. Only layout risk is text width.

### 6.4 Email (Resend) and PDFs

- [ ] **E-01** Static templates `supabase/functions/_shared/email-templates/**` and `fragments/`: grep shows no literal brand today. Re-verify after B-02 that subjects and footers come from `PLATFORM_BRAND_NAME`.
- [ ] **E-02** From display name: every `from:` built as `${supportBrand} <…>` or similar. Confirm `supportBrand` resolves to the new name. Resend sender **address** is class D.
- [ ] **E-03** `brandedEmailShell.ts`, `orgVerificationEmail.ts`, `superAdminStepUpEmail.ts`, `subscriptionBillingEmail.ts`, `contractLifecycleEmail.ts`, `guestChatEmail.ts`: subjects, preheaders, footer copyright, alt text on the logo `<img>`.
- [ ] **E-04** Per-property templates stored in the DB (host-edited, `configurable-template-send.html` path): handled by data task D-03. Never overwrite a host's custom wording except the exact old brand string.
- [ ] **E-05** Template preview: `email-templates/_preview`, `scripts/preview/preview-emails-from-db.mjs` docstring and defaults. Run `/emails` preview for every template and eyeball.
- [ ] **E-06** PDFs: the two hand-synced template copies (Storage bucket `templates` and `ui/public/templates`, known sharp edge) and `exportPdf.ts` analytics export. Check embedded text and images for the old name. Update **both** copies together.
- [ ] **E-07** Email assets in `_shared/email-assets/` and every function's `static_files` list in `config.toml` (missing entries throw `ENOENT` in prod). Only touch if a new asset file is added.
- [ ] **E-08** Web push and Telegram notification titles (VAPID payload `title`, Telegram message headers): grep the senders, route through the resolver.
- [ ] **E-09** `VAPID_SUBJECT` (mailto) value: class C/D, change with the support mailbox decision.

### 6.5 AI (assistant, receptionist, knowledge, evals)

- [ ] **A-01** System prompts in `_shared/ai/prompts/*` (`dashboardAssistant.ts`, new `guestReceptionist.ts`, marketing/poster director prompts, voice receptionist): every product mention uses `PLATFORM_BRAND_NAME`, no literal. Grep after B-02.
- [ ] **A-02** Voice receptionist persona "Kame": unchanged name, but greeting scripts that say "Kame Homes" change. Check stored greeting text in DB (data task D-03) and any TTS cache.
- [ ] **A-03** AI knowledge: `scripts/ai-knowledge-synced-guides.txt` + `scripts/check-ai-knowledge-coverage.ts` sync docs/guides into the assistant knowledge. After docs task X-02, **re-sync and re-embed** so answers stop saying "Kame Homes". Delete stale chunks rather than appending.
- [ ] **A-04** Eval datasets (`supabase/functions/tests/evals/**`, `assistant_answer_quality.jsonl`), parity tests (`assistantParityLocal`, `assistantParityLiveGemini`): update expected strings and fixture slugs (`kame-homes` / `kame-home`) in step with seed changes (S-02).
- [ ] **A-05** Any provider-side cached context (Gemini cached content, prompt caches): invalidate after deploy so old system text is not reused.
- [ ] **A-06** Guest web chat widget name, assistant display name, "Powered by" line.

### 6.6 Marketing studio and social creative (`marketing/social`)

- [ ] **M-01** `primitives.tsx` wordmark "Kame Homes" (line ~250), `SITE` (class D), `copy.tsx`, `concepts.tsx`, `filipino/*` scripts.
- [ ] **M-02** Hashtags and links: `captions.ts` (`#KameHomes`, "Start free at kamehomes.space"), `filipinoCaptions.ts` (`#KameHomes`, `#KameNaBahala` stays). New hashtag `#KameSpace`; for 3 months post both.
- [ ] **M-03** Re-render every campaign in `marketing/social/out/**` that shows the old name, using the `social-creative` skill review ("does not look AI-generated"). Old rendered files are not edited; they are replaced.
- [ ] **M-04** Mascot `Kame.tsx` unchanged (name survives).
- [ ] **M-05** In-app Marketing Studio templates and themes: built-in template library (`marketingTemplateLibrary.ts`, thumbnails `marketingTemplateThumbnails.ts`), poster archetypes, Polotno presets. Check embedded text and thumbnail images for "Kame Homes". Regenerate thumbnails if needed.
- [ ] **M-06** Test fixtures `brandName: 'Kame Home'` in poster tests: these are a host's property brand in tests, not the platform. Rename to a neutral fixture ("Sample Stays") so the guard stays simple.
- [ ] **M-07** `.impeccable/hook.cache.json` is a tool cache: delete and let it regenerate; add to `.gitignore` if it shouldn't be committed.

### 6.7 Narration audio (for-hosts film)

- [ ] **N-01** Regenerate `ui/public/marketing/for-hosts/narration/intro.mp3`, `outro.mp3` and any other clip whose text names the product, with the **same voice and settings** as the originals (find the generator script or provider settings; record them in docs if not recorded).
- [ ] **N-02** Update matching `.vtt` captions and `manifest.json` text, and `hostTourNarration.ts`. Re-check clip durations in the manifest, since the scene timing depends on them.
- [ ] **N-03** Watch the full film at 375 px and desktop: captions in sync, no clipped audio.

### 6.8 Data (Postgres, Storage), per environment

All data edits run as an idempotent SQL script (`scripts/brand/sql/rename-brand-data.sql`) or a **new** migration, local → hosted dev → mt-prod (kamewave). Historical tables are excluded (R5).

- [ ] **D-01** Read-only scan: reuse the generic text/jsonb column scanner pattern from `scripts/migrate/legacy-to-mt-prod/sql/30-rewrite-storage-urls.sql`. Report `(schema, table, column, count)` for `kame ?homes?`, `kamehomes?` (non-domain), `kame-homes?`. Counts only, no row content (PII rule). Run on local, dev, mt-prod.
- [ ] **D-02** Classify every column hit as config (rewrite) or history (leave). Expected config: `organizations.name/description`, `properties.name/settings`, `org_settings`, `app_settings`, `platform_settings`, property email templates, Telegram templates, email automation rows, announcements (`host_announcements` and similar), help/support articles, AI knowledge tables, voice receptionist settings, marketing **drafts** and saved templates, custom/public page content. Expected history: `activity_log`, email send logs, inbox/chat messages, reviews, AI usage/conversation logs, published marketing posts, finance.
- [ ] **D-03** Rewrite config columns with exact-match replacements for each casing form (R4), never a bare `Homes`. Print before/after counts. Emit one `activity_log` event per org touched (`org.brand_renamed`, actor = system) per the `audit-logging` skill.
- [ ] **D-04** Tenant org name/slug: if R1 was applied at cutover, nothing to do. If not, rename via the existing slug remap flow (`tenantSlugRemap.ts`) so old `/org/kame-home/...` URLs redirect, and search stored URLs for the old slug first.
- [ ] **D-05** Storage: list objects whose **path or filename** contains `kame-home(s)` (bucket `app-settings-assets`, `property-media`, `templates`, marketing buckets). Do **not** rename paths (DB rows and sent emails reference them). Replace **contents** only where the image shows the old wordmark and the path is a default asset.
- [ ] **D-06** Dev seeds and fixtures: `supabase/seed.sql`, `scripts/dev/seed-*.sql` (`kame-homes` org + `kame-home` property in `seed-dashboard-demo-data.sql`; `kame-home` org elsewhere). Align local seed names with R1 so local, dev and prod use the same slug. Then update every script that hardcodes the slug: `qa-*.mjs`, `ai-qa-run.mjs` (`AI_QA_ORG`), `seed-ai-qa.*`, `seed-monaco-2612-*`, `seed-marketing-guest-reviews.sql`, `seed-analytics-demo-data.sql`, `reviewsLifecycleLocal.integration_test.ts`, `dashboardAssistant*_test.ts`, `ui/e2e/features/assistant/shared/assistantLiveLocalHarness.ts`, `tenantSlugRemap.test.ts`. One commit, one search-and-verify pass.
- [ ] **D-07** Hosted dev DB: the dev org rows were created by hand or by seeds. Apply D-03 + D-06 renames there, then smoke the QA scripts against hosted dev.
- [ ] **D-08** Verify: re-run D-01; config hit count = 0, history counts unchanged.

### 6.9 Config values and secrets, per environment (class C)

For each of **local** (`ui/.env.development`, `supabase/.env.local`), **hosted dev** (`ui/.env.development.dev`, `supabase/.env.dev.local`, Supabase dev secrets, Vercel Preview env), **mt-prod** (Supabase prod secrets, Vercel Production env), **GitHub Environments** (`development`, `production`):

- [ ] **C-01** `VITE_PLATFORM_APP_NAME` = `Kame Space` (Vercel Preview + Production; redeploy, Vite inlines it at build).
- [ ] **C-02** `PLATFORM_APP_NAME` = `Kame Space` (Supabase secrets; edge functions read on cold start, so redeploy or wait for recycle).
- [ ] **C-03** `VITE_PLATFORM_CONTACT_EMAIL`, `SUPPORT_TEAM_EMAIL`, `VAPID_SUBJECT`, `RESEND_FROM_EMAIL`: these hold addresses. If the mailbox stays on `kamehomes.space` until the domain plan, leave them. If R2 moved the domain first, set them there.
- [ ] **C-04** `FACEBOOK_REVIEWS_URL`, `META_OAUTH_ALLOWED_RETURN_ORIGINS`: update when the FB page URL (R6) or origins change.
- [ ] **C-05** Update the `.example` files (`ui/.env.example`, `supabase/.env.example`, `supabase/.env.dev.example`) comments ("Unset or Stays → Kame Homes") and the env sync scripts (`scripts/dev/sync-dev-env.mjs`, `sync-vercel-dev-env.mjs`, `sync-all-env.mjs`, `.cursor/write-env-files.sh`) so a teammate's fresh setup gets the new value.
- [ ] **C-06** Record the change per environment in `docs/architecture/validation-and-env.md` and the prod env matrix (`docs/workflow/in-progress/production-readiness/environments/prod-env-matrix.md`).

### 6.10 Third-party services (dashboards; operator tasks)

Each needs the owner's login. Agent prepares exact field values; user applies. Order matters where noted.

| #    | Service                                                        | Fields to change                                                                                                                         | Notes / edge cases                                                                                                                                                                                                       |
| ---- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-01 | Google Cloud / OAuth                                           | Consent screen **app name**, logo, support email, homepage, privacy and terms URLs; project display name                                 | Do this **before** submitting Google verification (next plan). Changing name/logo on an already verified app triggers re-review. Homepage must show the same app name the consent screen shows.                          |
| T-02 | Google Maps key                                                | Key display name only                                                                                                                    | Referrer restrictions are class D.                                                                                                                                                                                       |
| T-03 | Meta (Facebook / IG)                                           | Developer **app display name**, app icon, privacy/terms URLs; Business Manager name (if R3); Facebook Page name; Instagram username/name | App name changes may need App Review. Page name changes go through Meta review and can be rate-limited. IG username must be available (R6). Messenger/IG inbox webhooks keep working (IDs don't change).                 |
| T-04 | Resend                                                         | Sender display name (code, E-02); account/team name                                                                                      | Sender domain is class D.                                                                                                                                                                                                |
| T-05 | Telegram                                                       | Bot display name and description via BotFather `/setname`, `/setdescription`, `/setuserpic`                                              | Bot **usernames** can't be renamed. If a username contains `kamehomes`, either keep it (allow-list) or create new bots and re-link chats in `telegram_*_settings`, which is a data migration. Recommend keep.            |
| T-06 | PayMongo                                                       | Business display name, statement descriptor, checkout branding, support email                                                            | Bound to R3. Statement descriptor appears on guest card statements; mismatch drives chargebacks. Change only once the registered name allows it.                                                                         |
| T-07 | PostHog                                                        | Project/org name                                                                                                                         | Display only. Keep project key.                                                                                                                                                                                          |
| T-08 | Sentry (if adopted)                                            | Project/org name, release names                                                                                                          | Intake lists Sentry as upcoming. If adopted before rename, name it Kame Space from the start.                                                                                                                            |
| T-09 | Supabase                                                       | Project **display** names for dev and mt-prod, org name                                                                                  | Refs never change. Auth email templates in the Supabase dashboard (magic link, confirm signup, invite) contain brand text: update all of them on both projects. SMTP sender name too.                                    |
| T-10 | Vercel                                                         | Team display name; project rename in Phase 8 (R7)                                                                                        | Project rename changes `kame-homes.vercel.app` and preview URL patterns `kame-homes-git-*-kame-works.vercel.app`. See §7 Phase 8.                                                                                        |
| T-11 | GitHub                                                         | Repo rename in Phase 8 (R7), repo description, social preview image, topics                                                              | GitHub redirects old URLs and remotes, but `scripts/dev/gh-issue.mjs` `DEFAULT_REPO`, `.cursor/rules/github-issues.mdc`, `.claude/commands/*`, CODEOWNERS and badges should use the new name. Project boards keep links. |
| T-12 | Cloudflare Turnstile                                           | Widget name                                                                                                                              | Hostnames are class D.                                                                                                                                                                                                   |
| T-13 | Namecheap / registrar                                          | WHOIS org name (if R3)                                                                                                                   | Domain itself is the next plan.                                                                                                                                                                                          |
| T-14 | Gemini / Groq / TTS vendor                                     | Project or key labels                                                                                                                    | Cosmetic. TTS vendor needed for N-01.                                                                                                                                                                                    |
| T-15 | Google Business Profile, Airbnb host profile, channel listings | Business name, if those name the platform                                                                                                | Only if they currently say Kame Homes. Ask the host.                                                                                                                                                                     |
| T-16 | App stores / TWA                                               | None today                                                                                                                               | Note: if a Play Store TWA is planned, publish under the new name only.                                                                                                                                                   |

### 6.11 Tests

- [ ] **Q-01** Playwright mocked fixtures: `Kame Homes PH` / `kame-homes-ph` across `ui/e2e/features/**` (plans, team RBAC, vouchers, guest-form harness, dashboard smoke, notifications hub, templates workbench, auth redirects, org hub, unsaved-changes guard). Rename to a neutral fixture org (`Sample Stays PH` / `sample-stays-ph`) in one sweep, so tests stop coupling to the product name. Same for `https://instagram.com/kamehomes` fixtures.
- [ ] **Q-02** Unit tests asserting the default name (`platformAppName.test.ts`, `platformBrand_test.ts`, `seoMeta.test.ts`, `seoMiddleware.test.ts`, `appLoaderWordmark.test.ts`, `guestTripCalendar.test.ts` PRODID only), host test strings in `parseChatRichBlocks.test.ts`, `marketingSiteLinks.test.ts`, `probeClassifiers_test.ts` (class D).
- [ ] **Q-03** Vitest cannot run `.test.tsx` component tests (memory note), so brand checks in components need either a `.test.ts` helper test or a Playwright smoke assertion: add one smoke that loads `/`, `/for-hosts`, `/sign-in` and asserts the title and wordmark say "Kame Space" and the page contains no "Kame Homes".
- [ ] **Q-04** Edge: a Deno test that renders every email template with `PLATFORM_APP_NAME` unset and asserts no "Kame Homes" in subject, HTML or text.
- [ ] **Q-05** Full `bun run ci:quality` green; `test:edge`, `test:edge:handlers`, `test:e2e:smoke`.

### 6.12 Docs and agent tooling

- [ ] **X-01** Living docs: `CLAUDE.md`, `AGENTS.md`/`README.md`, `DESIGN.md`, `docs/README.md`, `docs/PROJECT.md`, `docs/architecture/**` (8 files), `docs/guides/**` (8 files, route guides via `route-guides` skill), `.cursor/rules/**` (5), `.cursor/commands/**`, `.claude/commands/**`, `.claude/README.md`, `.agent/skills/**`, `.opencode/**`, `opencode.json`. Product-name prose → Kame Space. Repo/project identifiers follow Phase 8 timing.
- [ ] **X-02** `docs/workflow/**` (84 files): update living plans (planned, in-progress, intake). For done/wont-do/archive (25 archive files), change prose that names the **product**, but keep quoted historical identifiers accurate (old URLs, old slugs, old project names). Add a one-line note at the top of `docs/README.md`: "Kame Space was called Kame Homes before 2026-11." so readers of old docs aren't confused.
- [ ] **X-03** `KAME_HOMES_URL` placeholder in `docs/workflow/in-progress/ci-cd-environments/ci-cd-dev-prod.md` → `APP_URL`.
- [ ] **X-04** Skills that name the brand: `social-creative` ("Produce Kame Homes marketing creative"), `design-md`, `.agent/skills/*`. Re-run `bun run setup:ai-tooling` so Cursor/Claude/OpenCode copies stay in sync (SessionStart hook checks this).
- [ ] **X-05** Agent commands `kh-*` → `ks-*` with aliases (R9); update `/kh-help` table.
- [ ] **X-06** Brand glossary: add "Kame Space" (product), "Kame" (short name, mascot/AI receptionist), "Kame Homes" (former name) to the glossary (`domain-modeling` skill), plus the R4 casing table.
- [ ] **X-07** Claude memory: update memory notes that mention "Kame Homes" (e.g. marketing palette note) only where they describe the product.

---

## 7. Phases and order

Each phase is shippable alone and reversible until Phase 8. Local first, then hosted dev, then mt-prod (kamewave in the same message for any prod write).

**Phase 0: Decisions and pre-work (no code).** Answer R1–R9 (R1/R2 before cutover Phase 3 and 1.4). Claim handles (R6). Order new artwork (W-05/06/07, M-03) and narration (N-01) so they are ready when code is. Produce the allow-list seed from §5. Exit: decisions recorded in this file.

**Phase 1: Guard in report-only mode.** Add `scripts/brand/check-brand.ts` + `scripts/brand/brand-allowlist.txt` + `bun run check:brand` (§9) that **reports** every unclassified hit. Not in CI yet. Exit: the report matches §1 counts.

**Phase 2: Brand core + env (B-01…B-10, C-01/C-02 on local and dev).** Most visible text flips here. Exit: local and hosted dev show "Kame Space" in title, wordmark, emails, legal; tests updated.

**Phase 3: Hardcoded copy, web shell, PWA, SEO (W-_, U-_, E-\*, A-01/A-06, Q-02/Q-03/Q-04).** Exit: guard report shows only class D, K and assets/data.

**Phase 4: Assets and narration (W-05/06/07, N-_, M-_).** Exit: new icons, logo, OG images, narration, social renders in place; film checked on mobile.

**Phase 5: Data (D-01…D-08) and AI knowledge (A-02…A-05).** Local → dev. Exit: D-08 verify clean on dev; assistant answers say Kame Space.

**Phase 6: Tests and docs sweep (Q-01, Q-05, X-\*).** Exit: `ci:quality` green; guard report = allow-listed + class D only. Turn the guard on in CI (`ci.yml`, after `check:filenames`) in **fail** mode for classes A/B/C/E.

**Phase 7: Production rollout (kamewave).** Order:

1. Third-party display names that don't depend on code (T-07, T-09 dashboards, T-12, T-14).
2. mt-prod data script D-03 (after a `backup:supabase:prod`), then D-08 verify.
3. `PLATFORM_APP_NAME` on mt-prod secrets + edge redeploy; `VITE_PLATFORM_APP_NAME` on Vercel Production + redeploy (`develop → main` per normal CD).
4. Supabase Auth email templates (T-09) on mt-prod.
5. Google consent screen (T-01), Meta app/page (T-03), Telegram bots (T-05), PayMongo (T-06, only if R3 allows).
6. Re-scrape OG cards, Search Console recrawl, announcement to hosts (in-app announcement + email), social posts with both hashtags.
7. Smoke: guest booking end to end with real email to an internal inbox, check from-name, subject, logo, PDF; PWA install on Android and iOS; assistant question "what is this app called?".

**Phase 8: Infra identifiers (optional, R7, after 2 clean weeks).** Rename Vercel project → add the new `kame-space.vercel.app` and preview patterns to `cors.ts`, `CORS_ALLOWED_ORIGINS`, Supabase Auth redirect URLs, Google OAuth origins, Meta return origins, `seoMeta.ts` noindex rules and tests **before** renaming. Rename GitHub repo → update `gh-issue.mjs`, rules, commands, remotes, Vercel Git link check, branch protection check, CODEOWNERS. Local folder rename (if wanted) → move `~/.claude/projects/<old-path>/memory` to the new path key. Then remove the old origins after 30 days.

**Phase 9: Hypercare and lock-in (T+30d).** Apply R8 (retire "Kame Homes" in the resolvers). Remove `kh-*` aliases. Guard allow-list review: anything class D is handed to the domain plan. Move this plan to done.

---

## 8. Rollback

- Visible text (Phases 2–3): flip `PLATFORM_APP_NAME` / `VITE_PLATFORM_APP_NAME` back and redeploy. Code defaults only matter when the env is unset, so set the env explicitly in every environment during rollout.
- Data (Phase 5/7): the D-03 script writes a reverse map (`old_value, new_value, table, column, pk`) to a gitignored `backups/brand/<run-id>/` file, restricted to config tables (no PII). Reverse script replays it.
- Assets: old files stay in git history; same paths, so revert the commit.
- Third parties: note the old value of every field before changing it (runbook table).
- Infra renames (Phase 8): Vercel and GitHub both allow renaming back; keep old origins allow-listed until Phase 9.

---

## 9. Guard: `bun run check:brand`

- Scans tracked files (`git ls-files`, so `worktrees/`, `dist/`, `backups/` are skipped) plus `ui/public/**` text files.
- Patterns (case-insensitive): `kame[\s_-]?homes?\b`, `kamehomes?\b` (excluding `kamehomes.space` while the domain plan is pending, reported as class D), `KameHomes?`, `KAME_HOMES?`.
- Never flags bare `Homes` or bare `Kame`.
- Allow-list file entries: `path[:line-pattern]  # class K reason`. Unknown hits fail in CI from Phase 6.
- Binary assets aren't scanned. A manual checklist in this plan (W-05/06/07, N-01, M-03, E-06) covers them.
- Add the DB scan (D-01) as `bun run check:brand:db -- --env local|dev|prod` (read-only, counts only).

---

## 10. Edge cases and risks

| Risk / edge case                                                                                                        | Mitigation                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Env set explicitly to "Kame Homes" somewhere (Vercel Preview, a teammate's `.env`), so the code default changes nothing | C-01/C-02 per environment checklist; sync scripts updated (C-05); R8 retires the old value later |
| Edge functions keep the old name until cold start                                                                       | Redeploy functions after the secret change                                                       |
| Service worker serves old HTML/manifest                                                                                 | W-04 version bump; verify with `bun run build && bun run preview`                                |
| iOS home-screen name stays "Kame Homes"                                                                                 | Accept; mention in the host announcement ("re-add the app to update its name")                   |
| Duplicate calendar events for guests                                                                                    | Keep ICS UID (K-2)                                                                               |
| Review duplicate detection breaks                                                                                       | Keep pepper string (K-1); confirm pepper env set in hosted envs                                  |
| Default QR treated as custom or dropped                                                                                 | Keep sentinel filename and matcher (K-3)                                                         |
| Migrated org name leaks onto guest pages                                                                                | B-03 matcher covers every legacy form; U-09 check                                                |
| Host-edited templates overwritten                                                                                       | D-03 exact-string replacement only, reverse map                                                  |
| AI keeps saying Kame Homes from stale knowledge or cached prompts                                                       | A-03 re-embed with delete, A-05 cache invalidation, assistant smoke question                     |
| Narration audio and captions out of sync                                                                                | N-02 duration check, N-03 watch-through                                                          |
| Meta or Google flags the name change during review                                                                      | Do T-01/T-03 before the Google verification submission; keep privacy/terms URLs stable           |
| Payment statement name mismatch → chargebacks                                                                           | T-06 gated on R3                                                                                 |
| Handle squatting                                                                                                        | R6 before any announcement                                                                       |
| Vercel rename breaks CORS / OAuth / Meta return URLs                                                                    | Phase 8 adds new origins first, removes old ones 30 days later                                   |
| Search ranking dip after the name change                                                                                | `alternateName` JSON-LD, unchanged URLs (domain unchanged in this plan), recrawl request         |
| Rename shipped in the same window as cutover or another prod change                                                     | §2 gate: separate deploy window                                                                  |
| Concurrent sessions' uncommitted files on `develop` (HANDOFF §6)                                                        | Do the rename in a clean worktree branch; never `git add -A` on the shared tree                  |
| Big docs diff hides a real code change in review                                                                        | Separate PRs: core, copy, assets, data, tests, docs, infra                                       |

---

## 11. Acceptance criteria

1. `bun run check:brand` passes in CI with only class K and (until the domain plan) class D hits allow-listed.
2. `check:brand:db` on local, dev and mt-prod: 0 hits in config tables; history tables unchanged.
3. Title, wordmark, PWA install name (Android), emails (subject, from-name, footer, logo), PDFs, legal pages, assistant replies, receptionist greeting, narration and social renders all say Kame Space.
4. Already-sent emails still render (logo path unchanged), saved guest calendar events do not duplicate, review identity hashes unchanged, default QR still detected.
5. `bun run ci:quality` green; Playwright smoke asserts no "Kame Homes" on `/`, `/for-hosts`, `/sign-in`.
6. Every third-party row in §6.10 recorded with old value, new value, date, who changed it.
7. Docs updated in the same PRs; route guides updated via `route-guides`; this plan moved to done.

---

## 12. Docs to update with each phase

- `docs/architecture/overview.md` + `docs/PROJECT.md`: brand resolver, env values, guard script.
- `docs/architecture/validation-and-env.md`, prod env matrix: env values per environment.
- `docs/architecture/pwa.md`: manifest name change and iOS note.
- `docs/guides/routes/*.md` (via `route-guides`): any route copy that names the product.
- `scripts/README.md`: `check:brand`, `check:brand:db`, brand data script.
- `.cursor/rules/*`, `CLAUDE.md`, `.claude/README.md`, `.opencode/README.md`: names, `ks-*` commands, Phase 8 repo name. Keep Cursor and Claude copies in sync.
- `docs/workflow/planned/legacy-prod-to-mt-prod-cutover.md`: R1/R2 outcome recorded in its Q1 / 3.1 / 1.4 / 6.1 / 6.2.
- Activity log: `org.brand_renamed` event in D-03; everything else `activity-log: N/A — copy/config only`.
- Plans and permissions: N/A, no gated feature.

---

## 13. Follow-on plans (not part of this one)

- **`kamespace-com-domain-move`**: everything class D (§4): DNS, Vercel domains, `cors.ts`, `publicAppOrigin.ts`, email logo URL, `telegramAdmin.ts` `APP_BASE_URL`, `seoMeta.ts`, PostHog/Sentry env detection, Resend sending + inbound domain (`inbound.*` MX, DKIM/SPF/DMARC), `RESEND_FROM_EMAIL`, Supabase Auth site/redirect URLs, Google OAuth origins, Maps and Turnstile hostnames, Meta return origins and webhook URLs, `ical-export` feed URLs given to channels, CI `PREVIEW_URL`, load-test prod refusal regex, Search Console property, redirects from `kamehomes.space` for at least 12 months, stored URLs in DB (reuse `30-rewrite-storage-urls.sql` pattern).
- **`google-services-verification`**: refresh [`google-oauth-verification.md`](../wont-do/google-oauth-verification.md) (currently in wont-do) once name and domain are final: consent screen, scopes, privacy policy, homepage, domain ownership, demo video.

Back to [planned index](./README.md).
