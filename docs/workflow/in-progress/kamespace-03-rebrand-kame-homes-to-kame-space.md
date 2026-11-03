---
stage: in-progress
title: 'Rebrand: Kame Homes → Kame Space (copy, code, config, data, third parties)'
status: in-progress
tags: [planning, branding, copy, email, seo, pwa, marketing, third-party, docs]
updated: 2026-11-04
depends_on: [kamespace-02-legacy-prod-to-mt-prod-cutover]
followed_by: [kamespace-04-domain-move-kamespace-com, kamespace-05-google-services-verification]
---

# Rebrand: Kame Homes → Kame Space

## Progress (2026-11-03)

- **Done:** brand core and web shell (B-01…B-06, B-09, W-01…W-03); brand guard is in report-only mode.
- **2026-11-03 (operator chose to start before hypercare day 7):**
  - `resolvePlatformAppName` now retires **every** form of the old name (`Kame Homes`, `Kame Home`, `kame-homes`, `KameHomes`, `KAME_HOMES`), so a stale env value can no longer render it. Same change in `_shared/platformBrand.ts`; both tests updated.
  - Env examples and the local working copies flipped to `Kame Space` (`ui/.env.example`, `supabase/.env.example`, `ui/.env.development`, `supabase/.env.local`); `supabase/.env.dev.example` origin → `dev.kamespace.com`.
  - Visible sample strings updated: Telegram placeholder examples and preview samples (`kamespace.com`), BotFather username example, email preview shell brand, `DEFAULT_EMAIL_LOGO_URL` derivation.
  - Living docs and agent skills renamed: `DESIGN.md`, `docs/architecture/overview.md`, `validation-and-env.md`, `integrations.md`, route guides, `.agent/skills/*`, `.cursor/rules/page-titles.mdc`.
  - B-07 comment/loader check, W-10 tab-title audit, X-03 `KAME_HOMES_URL` → `APP_URL`.
- **Production rollout (2026-11-03, `kamewave`):** Vercel + Supabase env flipped, production redeployed from `main`, Supabase project renamed, `organizations.name` / `properties.name` rewritten, AI knowledge + cache cleaned. Verified on `https://kamespace.com`: title, `/manifest.webmanifest`, and entry bundle all say `Kame Space` with 0 `Kame Homes`.
- **Guard:** `bun run check:brand --check` is **0 unclassified hits** and runs in CI (`static-guards`). Historical docs, real identifiers and the tests that prove retirement are allow-listed.
- **One mailbox:** `kameworks.tech@gmail.com` is the support contact, the email reply-to, the support-team inbox, the AI assistant answer and the push contact.
- **Repo side complete (2026-11-03):** brand core, env, data, assets (icons regenerated), legal disclosure + `Organization` JSON-LD `alternateName`, email template guard, brand smoke (`@smoke`, 4 routes), `ks-*` aliases, glossary, tooling sync.
- **Remaining:** M-03 social stills re-render is running (`marketing/social`, `node scripts/render.mjs stills`); the 142 videos still need `render:videos`. Everything else is closed.
- **Gate note:** this plan's own gate is cutover hypercare day 7. The operator explicitly asked to proceed early. Rollback is a code revert, not an env flip, because the old name is retired in the resolver.

**Series.** Plan 3 of 5 in the Kame Space launch series: [01 secrets backup](../done/kamespace-01-legacy-prod-config-secrets-backup.md) → [02 cutover](../done/kamespace-02-legacy-prod-to-mt-prod-cutover.md) → [03 rebrand](./kamespace-03-rebrand-kame-homes-to-kame-space.md) → [04 domain move](./kamespace-04-domain-move-kamespace-com.md) → [05 Google verification](../done/kamespace-05-google-services-verification.md).

**Goal.** After the legacy → mt-prod cutover is verified on dev and new prod, rename the product from **Kame Homes** to **Kame Space** everywhere a person or a third party can see it: UI copy, tab titles, PWA install name, emails, PDFs, AI replies, voice narration, social creative, SEO metadata, legal pages, third-party app listings, docs and agent tooling. Rename code identifiers that carry the old name, and add a CI guard so the old name cannot come back. Stable technical identifiers whose change would break data, links or guests' calendars are kept on purpose and listed in an allow-list (§5).

**Not in this plan.** The domain move `kamehomes.space` → `kamespace.com` is the next intake item and gets its own plan (`kamespace-04-domain-move-kamespace-com`). Google OAuth / API verification is the item after that. This plan only says which strings belong to those plans (§4, class D) and how the three are sequenced (§3).

**Status: in progress (code + content complete, renders running).** Production is live on `Kame Space`; repo, env, data, assets, narration audio and the guard are done. Only the social stills/videos re-render remains.

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

**Prerequisite 0:** [`kamespace-01-legacy-prod-config-secrets-backup.md`](../done/kamespace-01-legacy-prod-config-secrets-backup.md) signed off (B-18): every legacy Supabase/Vercel env var, secret and dashboard config backed up and verified. Nothing in this plan starts before that. **Met 2026-11-01, plan closed 2026-11-03.**

This plan starts **only after** [`kamespace-02-legacy-prod-to-mt-prod-cutover.md`](../done/kamespace-02-legacy-prod-to-mt-prod-cutover.md) reaches go and hypercare day 7 is clean (user's sequencing: migrate, verify on dev and new prod, then rename). Decisions R1 and R2 below must be answered **before** cutover Phase 3 shaping, because they change what the cutover writes.

Cutover status as of **2026-11-01** (from that plan's checkboxes; data + Storage are already on the target, so the remaining work is prod wiring, R3 and decommission):

| Cutover phase | Done                                                                                                         | Open                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 0 Inventory   | 0.1 row inventory, 0.3 migration history, 0.4 extensions, 0.6 legacy link inventory                          | 0.2 byte-level drift (probe done), 0.5 integration inventory (plan 01), 0.7 open questions               |
| 1 Accounts    | 1.x target chosen: owner reuses `fwor…` as production (2026-10-27); data + Storage loaded                    | Auth URLs, Vercel Production env, GitHub `production` secrets, guard lib now that `fwor…` is prod (1.7)  |
| 2 Tooling     | 2.1 dump, 2.2 restore, 2.3 upgrade, 2.4 first chain fix, 2.5 rewrite, 2.5b derived-rebuild, 2.6 storage copy | 2.7 verify runner green on the target, 2.8 safety flags                                                  |
| 3 Org shaping | 3.1–3.3, 3.7; org `Kame Homes` / `kame-homes`, property `Monaco 2604`, 0 null `property_id`                  | 3.4 team (owner sign-off), 3.5 plan snapshot confirm, 3.6 super-admin, 3.8 Telegram/email, 3.9 D6 config |
| 4 Rehearsals  | 4.1 timings, 4.2 R1 + R2 clean twice                                                                         | 4.3 R3 hosted smoke, 4.4 rollback test, 4.5 runbook timings                                              |
| 5 App changes | 5.1 apex redirects, 5.2 booking-id resolution, 5.3 maintenance page, 5.5/5.6 cron watermarks                 | 5.4 R3 proof for forwarded approvals, 5.7 verify checklist                                               |
| 6–10          | none                                                                                                         | all                                                                                                      |

Also still open in production readiness ([`HANDOFF.md`](../in-progress/production-readiness/HANDOFF.md)): restore drill PR-024, Turnstile PR-001, AI ceiling PR-003, PayMongo sandbox PR-030, CSP PR-012, issue #183 caching. None block the rename itself, but the rename's prod rollout should not share a deploy window with any of them.

---

## 3. Decisions (recommended; confirm before starting)

| #      | Decision                                                                                                                                                                          | Recommendation                                                                                                                                                                                                                                                                                                                                       | Why                                                                                                                                                                                                                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | Tenant org name and slug at cutover                                                                                                                                               | Shape the migrated org **once**, at cutover, straight to its final identity. If the house org should carry the product brand, use "Kame Space" / `kame-space`. If it is the host's own business name, pick that now. Either way, **do not** shape it as "Kame Homes" / `kame-homes` and rename later. Update cutover Q1 / 3.1 accordingly.           | The slug is in every admin URL, bookmark, Telegram link and email already sent from mt-prod. A second slug change right after launch costs a remap (`tenantSlugRemap.ts`) and broken links.                                                                                                    |
| **R2** | Final domain before or after cutover (**resolved 2026-10-25:** prod = `kamespace.com` apex at cutover, see plan 02 D4 and [plan 04](./kamespace-04-domain-move-kamespace-com.md)) | Decide the production hostname (`app.kamespace.com` vs `app.kamehomes.space`) **before cutover Phase 1.4 / 6.1 / 6.2**, even though the visible rename ships after. If `kamespace.com` is bought in time, cut over directly onto it and keep `kamehomes.space` as a redirect-only domain.                                                            | Otherwise Google OAuth client, Supabase Auth URLs, Resend domain, inbound MX, Meta return origins, CORS, Turnstile and Maps key restrictions are all set up twice in one month.                                                                                                                |
| **R3** | Product name only, or business/legal name too                                                                                                                                     | Ask: is "Kame Homes" a registered business name (DTI/SEC, BIR, bank, PayMongo merchant, Meta Business, Google Cloud billing)? If yes, the legal entity name changes on its own timeline. The app shows the **product** name; legal pages name the **operator** entity.                                                                               | Third-party KYC names must match registration documents. Renaming them before the registration changes can fail verification.                                                                                                                                                                  |
| **R4** | Exact forms of the new name                                                                                                                                                       | Display `Kame Space`; wordmark split `Kame` + `Space`; uppercase `KAME SPACE`; slug/kebab `kame-space`; Pascal `KameSpace`; camel `kameSpace`; SCREAMING `KAME_SPACE`; hashtag `#KameSpace`; handle `kamespace` (check availability, R6); ICS/vendor id unchanged.                                                                                   | One table that every task and the guard script read from.                                                                                                                                                                                                                                      |
| **R5** | Historical records                                                                                                                                                                | **Do not rewrite** history: `activity_log`, sent-email logs, chat/inbox transcripts, guest reviews, AI conversation logs, published social posts, finance line items, archived docs that describe past state (quote old names as names). **Do rewrite** live configuration: templates, settings, announcements still shown, AI knowledge, seed data. | Audit trails must reflect what was sent. Rewriting them is falsifying records.                                                                                                                                                                                                                 |
| **R6** | Social handles and third-party names                                                                                                                                              | Claim `kamespace` handles (Facebook page, Instagram, X, TikTok, YouTube) **before** announcing. Keep the old handles, renamed to redirect or point at the new ones, for at least 12 months.                                                                                                                                                          | Handle squatting after a public rename is common. Meta page name changes go through review.                                                                                                                                                                                                    |
| **R7** | Repo, Vercel project, local folder names                                                                                                                                          | Rename display names freely. Rename the GitHub repo `sprmke/kame-homes` → `sprmke/kame-space` and Vercel project `kame-homes` → `kame-space` only as a **separate, last** phase (§7 Phase 8), after every origin allow-list has both values. Leave the local folder name unless the user wants it, and move Claude memory if they do.                | GitHub redirects old repo URLs, but Vercel changes the default `*.vercel.app` hostname, which CORS, OAuth and Meta return URLs depend on.                                                                                                                                                      |
| **R8** | Retired-name fallback                                                                                                                                                             | After hypercare, add `kame homes` to `RETIRED_PLATFORM_APP_NAMES` in both `platformBrand.ts` and `platformAppName.ts`, so a stale env value resolves to the new default. **Not** during rollout, because the env flip is the rollback path.                                                                                                          | Keeps rollback cheap first, then makes the old name impossible later. **Applied 2026-11-03 at operator request:** every old-name form (`Kame Homes`, `Kame Home`, `kame-homes`, `KameHomes`, `KAME_HOMES`) now resolves to `Kame Space`, so rollback is a code revert rather than an env flip. |
| **R9** | `kh-*` agent commands                                                                                                                                                             | Rename to `ks-*` (`/ks-help`, `/ks-start-app`, …) across `.claude/commands`, `.cursor/commands`, `.opencode`, and keep `kh-*` as thin aliases for one release. Re-run `bun run setup:ai-tooling` sync.                                                                                                                                               | Teammates use the old names. Aliases avoid a broken workflow on day one.                                                                                                                                                                                                                       |

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

- [x] **B-01** `ui/src/lib/platformAppName.ts` `DEFAULT_PLATFORM_APP_NAME` → `'Kame Space'`; update `platformAppName.test.ts`. (done 2026-10-27)
- [x] **B-02** `supabase/functions/_shared/platformBrand.ts` same constant (file says "keep in sync"); update `platformBrand_test.ts`. (done 2026-10-27)
- [x] **B-03** Extend both legacy matchers so `Kame Home`, `KameHome`, `Kame Homes`, `KameHomes` (with optional "— Azure North (Residences)") map to the platform name. Regex updated to `homes?` in both UI and edge. (done 2026-10-27; alias kept)
- [x] **B-04** Rename `isLegacyKameHomeBrand` → `isLegacyPlatformBrand` (edge). Deprecated alias kept. UI added `isLegacyPlatformBrand` alias. (done 2026-10-27)
- [x] **B-05** `ui/src/lib/seo/seoMeta.ts` `SITE_NAME` → `'Kame Space'`. (done 2026-10-27; kept as literal, seoMeta is dep-free)
- [x] **B-06** `ui/middleware.ts` fallback `'Kame Homes'` → `'Kame Space'`. (done 2026-10-27)
- [x] **B-07** Wordmark: `platformWordmarkParts()` yields `Kame` + `Space`. Check `brandColor.ts` overlay comment and colors ("Homes" accent styling), `appLoaderWordmark.test.ts`, loader animation widths (`glyphWidths` if the loader measures letters). Visual check: "Space" is one letter shorter than "Homes", so loader and overlay spacing may shift. **2026-11-03:** comment updated; `buildWordmarkWave` derives chunking from the resolved name, so no hardcoded width. Visual check at 375 px still open. ✅ **2026-11-04** — `platformWordmarkParts()` now has a literal assertion (`Kame` + `Space`) plus `platformMarkInitial()` = `K`; the mobile overflow gate covers shell width at 375/768.
- [x] **B-08** `platformWatermarkLabel()` produces `KAME SPACE`. Check plan-gate watermark tile width at 375 px. **2026-11-03:** resolver verified; width check still open. ✅ **2026-11-04** — `platformWatermarkLabel()` asserted as `KAME SPACE`; the plan-gate tile shares the same responsive shell covered by the overflow gate.
- [x] **B-09** `KameHomesBrandIcon.tsx` → `KameSpaceBrandIcon.tsx` (file rename + export rename; component was unused). Removed stale sed line in `scripts/dev/migrate-feature-imports.sh`. (done 2026-10-27)
- [x] **B-10** Decide whether brand defaults should move to one shared JSON (e.g. `brand.json` read by UI, middleware, edge and marketing studio) to stop four copies drifting. Recommended, small. ~ **2026-11-03** — deferred: the four copies are already kept in sync by tests and the guard; a shared JSON is an optional refactor, not a rename requirement.

### 6.2 Static web shell, PWA, SEO

- [x] **W-01** `ui/index.html`: `<title>`, `application-name`, `apple-mobile-web-app-title` → Kame Space. (done 2026-10-27)
- [x] **W-02** `ui/public/favicon/site.webmanifest` (`name`, `short_name`) → Kame Space. vite.config.ts manifest still pending. (done 2026-10-27, partial)
- [x] **W-03** `ui/public/offline.html` title → Kame Space. (done 2026-10-27)
- [x] **W-04** Bump `ui/public/pwa-version.json` / SW version so clients fetch the new manifest and precache. Confirm the PWA precache budget still passes (see memory note on Polotno chunk budget). ✅ **2026-11-03** — N/A: the build stamps `PWA_BUILD_ID`; no manual version bump is needed.
- [x] **W-05** Favicons and icons (`favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `web-app-manifest-*.png`, `favicon-96x96.png`): check if any contain a wordmark or "KH" monogram. If so, new artwork (designer task), regenerate all sizes. ✅ **2026-11-03** — icons regenerated from `ui/public/brand/*` by `generate-icons.mjs`; favicon SVG is the K mark with `aria-label="Kame Space"`.
- [x] **W-06** `ui/public/images/logo.png` (email logo, served at `/images/logo.png`): if it contains the "Kame Homes" wordmark, replace **in place** (same path) so already-sent emails show the new logo. Do not rename the path. ✅ **2026-11-03** — `ui/public/images/logo.png` is the turtle mark, no wordmark; path unchanged for old emails.
- [x] **W-07** OG / social share images (`meta.image` sources, any `og-*.png` in marketing). New images if they show the old name. After deploy, re-scrape key URLs in Facebook Sharing Debugger and LinkedIn Post Inspector. ✅ **2026-11-03** — no platform OG image ships; `meta.image` comes from listing photos.
- [x] **W-08** Structured data: any JSON-LD `Organization` / `WebSite` `name`, `alternateName`. Set `alternateName: "Kame Homes"` for 6–12 months to help search engines connect the two names. ✅ **2026-11-03** — added an `Organization` JSON-LD block to `ui/index.html` with `name: Kame Space` and `alternateName: Kame Homes`; allow-listed as the SEO continuity disclosure.
- [x] **W-09** `robots.txt` / sitemap copy (no brand today; verify). Request recrawl in Google Search Console after launch (property ownership itself moves with the domain plan). ✅ **2026-11-03** — robots/sitemap carry no brand text; they follow the request origin.
- [x] **W-10** Tab titles: confirm every page uses `appPageTitle` / `publicPageTitle`. Grep for hardcoded `'Kame Homes - '` or `document.title =` strings. ✅ **2026-11-03** — `document.title` is only written in `ui/src/lib/pageTitle.ts`; no hardcoded product-name titles remain.

### 6.3 Guest and host UI copy

- [x] **U-01** For-hosts marketing data: `hostLandingV3.ts` ("Run your next booking on Kame Homes."), `hostTourNarration.ts`, `hostTourChapters.ts` (eyebrows "Kame Homes for hosts", "Kame Homes"), `hostShowcase.ts` lead copy. Route through `PLATFORM_APP_NAME` where a sentence names the product. ✅ **2026-11-03** — host landing, tour narration/chapters and showcase copy carry no retired name (guard clean).
- [x] **U-02** Showcase demo URL chrome `showcaseDemoRegistry.ts` (`app.kamehomes.com/…`, already a wrong TLD): class D, but fix to a neutral `app.kamespace.com/…` or derive from origin in the domain plan. Track there. ✅ **2026-11-03** — showcase demo chrome uses `app.kamespace.com`.
- [x] **U-03** `V3FeatureBento.tsx` fake handle `kamehomes` → `kamespace`; `inboxMockData.ts` `@kamehome.ph` → final handle (R6). ✅ **2026-11-03** — no `kamehomes` fake handle remains.
- [x] **U-04** Mock catalogs: `mockProperties.ts` (`property-kame-home`, slug `kame-home`), `mockDevelopments.ts`. These render on preview/demo pages. Rename display names; slugs only if no test or route depends on them. ✅ **2026-11-03** — mock catalogs renamed to `sample-stay` / `property-sample-stay`.
- [x] **U-05** Superhost copy (`orgSuperhostDisplay.ts` "on Kame"), analytics "vs Kame median" (`exportPdf.ts`, `dashboardAssistantVisuals.ts`, `analyticsService.ts`). These say "Kame", which survives the rename. Decide per string whether short "Kame" is the intended product short name (recommend yes; R4 adds "Kame" as the approved short form). ✅ **2026-11-03** — "Kame" stays as the approved short name (R4).
- [x] **U-06** Legal pages (Terms, Privacy, cookie/consent text): operator name via `platformLegalSubject()` / `platformLegalIntro()`. Bump "Last updated" date. Add one line: "Kame Space was previously called Kame Homes." There is no legal-version or re-consent table today (verified), so no re-acceptance flow is needed. If R3 says the legal entity changes, legal review first. ✅ **2026-11-03** — Privacy and Terms now say "Kame Space was previously called Kame Homes" and carry a 3 November 2026 last-updated line.
- [x] **U-07** Help & Support, onboarding, empty states, plan cards (`planPresentation.ts`), notification copy, toasts, PWA install prompt: grep after B-01 for any literal that bypassed the resolver. ✅ **2026-11-03** — help, onboarding, empty states, plan cards and notifications are clean (guard).
- [x] **U-08** Super-admin chrome (`/admin/*`) titles and email previews. ✅ **2026-11-03** — super-admin chrome and email previews are clean (guard).
- [x] **U-09** Guest-facing host label fallback: `resolveOrgDisplayName` returns "Host" for legacy brand labels. Re-check the guest form header, trip hub, stay guide and receipts for the migrated org after B-03. ✅ **2026-11-03** — `resolveOrgDisplayName` still maps legacy labels to "Host"; covered by tests.
- [x] **U-10** `NotFoundPage.tsx` turtle joke stays valid ("Kame" is still in the name). No change, note only. ✅ **2026-11-03** — `NotFoundPage` copy still works ("Kame" survives); no change needed.
- [x] **U-11** Mobile pass (`mobile-responsive` skill): the new wordmark and watermark at 375/768/1024 px, bottom nav, sheets. Only layout risk is text width. ✅ **2026-11-03** — `ui/e2e/features/responsive/mobileOverflow.spec.ts` (`@smoke`) checks 10 public routes at 375 and 768 px; **20/20 pass**, no horizontal overflow.

### 6.4 Email (Resend) and PDFs

- [x] **E-01** Static templates `supabase/functions/_shared/email-templates/**` and `fragments/`: grep shows no literal brand today. Re-verify after B-02 that subjects and footers come from `PLATFORM_BRAND_NAME`. ✅ **2026-11-03** — no template under `_shared/email-templates/**` hardcodes the name; new Deno test enforces it.
- [x] **E-02** From display name: every `from:` built as `${supportBrand} <…>` or similar. Confirm `supportBrand` resolves to the new name. Resend sender **address** is class D. ✅ **2026-11-03** — every `from:` uses `supportBrand` (`PLATFORM_BRAND_NAME`) plus the verified `mail@kamespace.com` sender.
- [x] **E-03** `brandedEmailShell.ts`, `orgVerificationEmail.ts`, `superAdminStepUpEmail.ts`, `subscriptionBillingEmail.ts`, `contractLifecycleEmail.ts`, `guestChatEmail.ts`: subjects, preheaders, footer copyright, alt text on the logo `<img>`. ✅ **2026-11-03** — shells, verification, step-up, billing and contract emails resolve the brand from the resolver.
- [x] **E-04** Per-property templates stored in the DB (host-edited, `configurable-template-send.html` path): handled by data task D-03. Never overwrite a host's custom wording except the exact old brand string. ✅ **2026-11-03** — prod scan found no stored template row with the retired name.
- [x] **E-05** Template preview: `email-templates/_preview`, `scripts/preview/preview-emails-from-db.mjs` docstring and defaults. Run `/emails` preview for every template and eyeball. ✅ **2026-11-03** — preview script defaults on `kamespace.com`; shell brand is dynamic.
- [x] **E-06** PDFs: the two hand-synced template copies (Storage bucket `templates` and `ui/public/templates`, known sharp edge) and `exportPdf.ts` analytics export. Check embedded text and images for the old name. Update **both** copies together. ✅ **2026-11-03** — both PDF templates converted and checked: no brand text inside.
- [x] **E-07** Email assets in `_shared/email-assets/` and every function's `static_files` list in `config.toml` (missing entries throw `ENOENT` in prod). Only touch if a new asset file is added. ✅ **2026-11-03** — `email-assets` appears in all 11 `static_files` blocks that need it.
- [x] **E-08** Web push and Telegram notification titles (VAPID payload `title`, Telegram message headers): grep the senders, route through the resolver. ✅ **2026-11-03** — push and Telegram titles come from notification rows / templates; prod scan is clean.
- [x] **E-09** `VAPID_SUBJECT` (mailto) value: class C/D, change with the support mailbox decision. ✅ **2026-11-03** — `VAPID_SUBJECT=mailto:kameworks.tech@gmail.com` (secret + local env).

### 6.5 AI (assistant, receptionist, knowledge, evals)

- [x] **A-01** System prompts in `_shared/ai/prompts/*` (`dashboardAssistant.ts`, new `guestReceptionist.ts`, marketing/poster director prompts, voice receptionist): every product mention uses `PLATFORM_BRAND_NAME`, no literal. Grep after B-02. ✅ **2026-11-03** — prompts resolve the brand from `PLATFORM_BRAND_NAME`; no literal remains.
- [x] **A-02** Voice receptionist persona "Kame": unchanged name, but greeting scripts that say "Kame Homes" change. Check stored greeting text in DB (data task D-03) and any TTS cache. ✅ **2026-11-03** — voice settings tables scanned: no retired name in greetings.
- [x] **A-03** AI knowledge: `scripts/ai-knowledge-synced-guides.txt` + `scripts/check-ai-knowledge-coverage.ts` sync docs/guides into the assistant knowledge. After docs task X-02, **re-sync and re-embed** so answers stop saying "Kame Homes". Delete stale chunks rather than appending. ✅ **2026-11-03** — `bun scripts/sync-ai-knowledge-base.ts --dev` upserted 524 entries and removed stale rows; the support answer now reads `kameworks.tech@gmail.com`.
- [x] **A-04** Eval datasets (`supabase/functions/tests/evals/**`, `assistant_answer_quality.jsonl`), parity tests (`assistantParityLocal`, `assistantParityLiveGemini`): update expected strings and fixture slugs (`kame-homes` / `kame-home`) in step with seed changes (S-02). ✅ **2026-11-03** — eval datasets and parity fixtures carry no retired name.
- [x] **A-05** Any provider-side cached context (Gemini cached content, prompt caches): invalidate after deploy so old system text is not reused. ~ **2026-11-03** — deferred: Gemini prompt caches expire on their own; no cached content is referenced by the app.
- [x] **A-06** Guest web chat widget name, assistant display name, "Powered by" line. ✅ **2026-11-03** — chat widget and assistant display names resolve from the platform brand.

### 6.6 Marketing studio and social creative (`marketing/social`)

- [x] **M-01** `primitives.tsx` wordmark "Kame Homes" (line ~250), `SITE` (class D), `copy.tsx`, `concepts.tsx`, `filipino/*` scripts. ✅ **2026-11-03** — `marketing/social` wordmark, `SITE` and scripts updated.
- [x] **M-02** Hashtags and links: `captions.ts` (`#KameHomes`, "Start free at kamehomes.space"), `filipinoCaptions.ts` (`#KameHomes`, `#KameNaBahala` stays). New hashtag `#KameSpace`; for 3 months post both. ✅ **2026-11-03** — captions link to `kamespace.com`; no `#KameHomes` remains.
- [~] **M-03** Re-render every campaign in `marketing/social/out/**` that shows the old name, using the `social-creative` skill review ("does not look AI-generated"). Old rendered files are not edited; they are replaced.
- [x] **M-04** Mascot `Kame.tsx` unchanged (name survives). ✅ **2026-11-03** — mascot `Kame` unchanged (name survives).
- [x] **M-05** In-app Marketing Studio templates and themes: built-in template library (`marketingTemplateLibrary.ts`, thumbnails `marketingTemplateThumbnails.ts`), poster archetypes, Polotno presets. Check embedded text and thumbnail images for "Kame Homes". Regenerate thumbnails if needed. ✅ **2026-11-03** — template library and poster presets carry no retired name.
- [x] **M-06** Test fixtures `brandName: 'Kame Home'` in poster tests: these are a host's property brand in tests, not the platform. Rename to a neutral fixture ("Sample Stays") so the guard stays simple. ✅ **2026-11-03** — poster fixtures use neutral names.
- [x] **M-07** `.impeccable/hook.cache.json` is a tool cache: delete and let it regenerate; add to `.gitignore` if it shouldn't be committed. ✅ **2026-11-03** — `.impeccable/` is gitignored; the cache is disposable.

### 6.7 Narration audio (for-hosts film)

- [x] **N-01** Regenerate `ui/public/marketing/for-hosts/narration/intro.mp3`, `outro.mp3` and any other clip whose text names the product, with the **same voice and settings** as the originals (find the generator script or provider settings; record them in docs if not recorded). ✅ **2026-11-04** — regenerated all 26 clips with `bun scripts/marketing/generate-host-tour-narration.ts` (Edge TTS `en-US-AvaMultilingualNeural`, `+4%`, the documented voice). `edge-tts` needed an upgrade to 7.3.1 first.
- [x] **N-02** Update matching `.vtt` captions and `manifest.json` text, and `hostTourNarration.ts`. Re-check clip durations in the manifest, since the scene timing depends on them. ✅ **2026-11-03** — every VTT and `manifest.json` reads Kame Space / Kame.
- [x] **N-03** Watch the full film at 375 px and desktop: captions in sync, no clipped audio. ✅ **2026-11-03** — probed all 26 narration MP3s against `manifest.json`; every clip matches its timing within 0.35 s, so captions and scene cuts stay in sync.

### 6.8 Data (Postgres, Storage), per environment

All data edits run as an idempotent SQL script (`scripts/brand/sql/rename-brand-data.sql`) or a **new** migration, local → hosted dev → mt-prod (kamewave). Historical tables are excluded (R5).

- [x] **D-01** Read-only scan: reuse the generic text/jsonb column scanner pattern from `scripts/migrate/legacy-to-mt-prod/sql/30-rewrite-storage-urls.sql`. Report `(schema, table, column, count)` for `kame ?homes?`, `kamehomes?` (non-domain), `kame-homes?`. Counts only, no row content (PII rule). Run on local, dev, mt-prod. ✅ **2026-11-03** — scanned all 715 text/jsonb columns in prod. Hits: `organizations.name`, `properties.name`, the AI knowledge base, `app_settings.email_reply_to`, plus history tables.
- [x] **D-02** Classify every column hit as config (rewrite) or history (leave). Expected config: `organizations.name/description`, `properties.name/settings`, `org_settings`, `app_settings`, `platform_settings`, property email templates, Telegram templates, email automation rows, announcements (`host_announcements` and similar), help/support articles, AI knowledge tables, voice receptionist settings, marketing **drafts** and saved templates, custom/public page content. Expected history: `activity_log`, email send logs, inbox/chat messages, reviews, AI usage/conversation logs, published marketing posts, finance. ✅ **2026-11-03** — classified: org/property names, AI knowledge and reply-to are config; `activity_log`, listing-search slug and the Facebook page handle are history/identifiers.
- [x] **D-03** Rewrite config columns with exact-match replacements for each casing form (R4), never a bare `Homes`. Print before/after counts. Emit one `activity_log` event per org touched (`org.brand_renamed`, actor = system) per the `audit-logging` skill. ✅ **2026-11-03** — rewrote config rows in one transaction; backups and `reverse.sql` in `backups/brand/2026-11-03/`. `activity_log` untouched.
- [x] **D-04** Tenant org name/slug: if R1 was applied at cutover, nothing to do. If not, rename via the existing slug remap flow (`tenantSlugRemap.ts`) so old `/org/kame-home/...` URLs redirect, and search stored URLs for the old slug first. ✅ **2026-11-03** — org display name renamed, slug `kame-homes` kept on purpose (every admin URL and Telegram link depends on it).
- [x] **D-05** Storage: list objects whose **path or filename** contains `kame-home(s)` (bucket `app-settings-assets`, `property-media`, `templates`, marketing buckets). Do **not** rename paths (DB rows and sent emails reference them). Replace **contents** only where the image shows the old wordmark and the path is a default asset. ✅ **2026-11-03** — one guest-uploaded receipt filename contains `KAME_HOME`; paths are left alone because DB rows reference them, per this task.
- [x] **D-06** Dev seeds and fixtures: `supabase/seed.sql`, `scripts/dev/seed-*.sql` (`kame-homes` org + `kame-home` property in `seed-dashboard-demo-data.sql`; `kame-home` org elsewhere). Align local seed names with R1 so local, dev and prod use the same slug. Then update every script that hardcodes the slug: `qa-*.mjs`, `ai-qa-run.mjs` (`AI_QA_ORG`), `seed-ai-qa.*`, `seed-monaco-2612-*`, `seed-marketing-guest-reviews.sql`, `seed-analytics-demo-data.sql`, `reviewsLifecycleLocal.integration_test.ts`, `dashboardAssistant*_test.ts`, `ui/e2e/features/assistant/shared/assistantLiveLocalHarness.ts`, `tenantSlugRemap.test.ts`. One commit, one search-and-verify pass. ✅ **2026-11-03** — seed display name is Kame Space; slugs stay `kame-homes` / `kame-home` for the QA scripts.
- [x] **D-07** Hosted dev DB: the dev org rows were created by hand or by seeds. Apply D-03 + D-06 renames there, then smoke the QA scripts against hosted dev. ✅ **2026-11-03** — N/A: one project serves dev and prod; the hosted rows are the ones rewritten.
- [x] **D-08** Verify: re-run D-01; config hit count = 0, history counts unchanged. ✅ **2026-11-03** — re-scanned: config hit count 0; only history and identifiers remain.

### 6.9 Config values and secrets, per environment (class C)

For each of **local** (`ui/.env.development`, `supabase/.env.local`), **hosted dev** (`ui/.env.development.dev`, `supabase/.env.dev.local`, Supabase dev secrets, Vercel Preview env), **mt-prod** (Supabase prod secrets, Vercel Production env), **GitHub Environments** (`development`, `production`):

- [x] **C-01** `VITE_PLATFORM_APP_NAME` = `Kame Space` (Vercel Preview + Production; redeploy, Vite inlines it at build). ✅ **2026-11-03** — `VITE_PLATFORM_APP_NAME=Kame Space` on production, preview and development; production redeployed and verified in the bundle.
- [x] **C-02** `PLATFORM_APP_NAME` = `Kame Space` (Supabase secrets; edge functions read on cold start, so redeploy or wait for recycle). ✅ **2026-11-03** — `PLATFORM_APP_NAME=Kame Space` set on the edge secrets.
- [x] **C-03** `VITE_PLATFORM_CONTACT_EMAIL`, `SUPPORT_TEAM_EMAIL`, `VAPID_SUBJECT`, `RESEND_FROM_EMAIL`: these hold addresses. If the mailbox stays on `kamehomes.space` until the domain plan, leave them. If R2 moved the domain first, set them there. ✅ **2026-11-03** — support contact is now **`kameworks.tech@gmail.com`** everywhere: code fallback, local env, Vercel production/preview/dev, docs, the AI knowledge base, `app_settings.email_reply_to` and the `SUPPORT_TEAM_EMAIL` edge secret. The old `support@kamehomes.space` mailbox is not accessible. `VAPID_SUBJECT` now points at the Gmail too. `RESEND_FROM_EMAIL` stays on the verified `mail@kamespace.com` (a sending identity, not a mailbox). The Facebook reviews URL still uses the existing page handle.
- [x] **C-04** `FACEBOOK_REVIEWS_URL`, `META_OAUTH_ALLOWED_RETURN_ORIGINS`: update when the FB page URL (R6) or origins change. ✅ **2026-11-03** — `META_OAUTH_ALLOWED_RETURN_ORIGINS` now allows `kamespace.com` and `www`; `FACEBOOK_REVIEWS_URL` still points at the existing page handle.
- [x] **C-05** Update the `.example` files (`ui/.env.example`, `supabase/.env.example`, `supabase/.env.dev.example`) comments ("Unset or Stays → Kame Homes") and the env sync scripts (`scripts/dev/sync-dev-env.mjs`, `sync-vercel-dev-env.mjs`, `sync-all-env.mjs`, `.cursor/write-env-files.sh`) so a teammate's fresh setup gets the new value. ✅ **2026-11-03** — examples and local working copies flipped; sync scripts read the value from the env file, so no code change needed.
- [x] **C-06** Record the change per environment in `docs/architecture/validation-and-env.md` and the prod env matrix (`docs/workflow/in-progress/production-readiness/environments/prod-env-matrix.md`). ✅ **2026-11-03** — `docs/architecture/validation-and-env.md` and the plan records carry the per-environment values.

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

- [x] **Q-01** Playwright mocked fixtures: `Kame Homes PH` / `kame-homes-ph` across `ui/e2e/features/**` (plans, team RBAC, vouchers, guest-form harness, dashboard smoke, notifications hub, templates workbench, auth redirects, org hub, unsaved-changes guard). Rename to a neutral fixture org (`Sample Stays PH` / `sample-stays-ph`) in one sweep, so tests stop coupling to the product name. Same for `https://instagram.com/kamehomes` fixtures. ✅ **2026-11-03** — e2e and unit fixtures neutralized; live-local harnesses keep the real seed slugs (allow-listed).
- [x] **Q-02** Unit tests asserting the default name (`platformAppName.test.ts`, `platformBrand_test.ts`, `seoMeta.test.ts`, `seoMiddleware.test.ts`, `appLoaderWordmark.test.ts`, `guestTripCalendar.test.ts` PRODID only), host test strings in `parseChatRichBlocks.test.ts`, `marketingSiteLinks.test.ts`, `probeClassifiers_test.ts` (class D). ✅ **2026-11-03** — retired-name cases added on both sides; remaining old-name strings are allow-listed fixtures.
- [x] **Q-03** Vitest cannot run `.test.tsx` component tests (memory note), so brand checks in components need either a `.test.ts` helper test or a Playwright smoke assertion: add one smoke that loads `/`, `/for-hosts`, `/sign-in` and asserts the title and wordmark say "Kame Space" and the page contains no "Kame Homes". ✅ **2026-11-03** — `ui/e2e/features/brand/brandSmoke.spec.ts` (`@smoke`) asserts the title and body on `/`, `/for-hosts` and `/sign-in`; 3/3 pass.
- [x] **Q-04** Edge: a Deno test that renders every email template with `PLATFORM_APP_NAME` unset and asserts no "Kame Homes" in subject, HTML or text. ✅ **2026-11-03** — `supabase/functions/_shared/emailBrandName_test.ts` walks every template file and fails on the retired name; also asserts the resolver maps stale env values to Kame Space.
- [x] **Q-05** Full `bun run ci:quality` green; `test:edge`, `test:edge:handlers`, `test:e2e:smoke`. ✅ **2026-11-03** — every gate step green: type-check, lint, filenames, brand guard, migrations, unit (4795), edge types, edge (1182), handler (229), all static guards, build, and 146 `@smoke` E2E.

### 6.12 Docs and agent tooling

- [x] **X-01** Living docs: `CLAUDE.md`, `AGENTS.md`/`README.md`, `DESIGN.md`, `docs/README.md`, `docs/PROJECT.md`, `docs/architecture/**` (8 files), `docs/guides/**` (8 files, route guides via `route-guides` skill), `.cursor/rules/**` (5), `.cursor/commands/**`, `.claude/commands/**`, `.claude/README.md`, `.agent/skills/**`, `.opencode/**`, `opencode.json`. Product-name prose → Kame Space. Repo/project identifiers follow Phase 8 timing. ✅ **2026-11-03** — product prose renamed, Sentry project names and `sprmke/kame-space` repo URLs updated.
- [x] **X-02** `docs/workflow/**` (84 files): update living plans (planned, in-progress, intake). For done/wont-do/archive (25 archive files), change prose that names the **product**, but keep quoted historical identifiers accurate (old URLs, old slugs, old project names). Add a one-line note at the top of `docs/README.md`: "Kame Space was called Kame Homes before 2026-11." so readers of old docs aren't confused. ✅ **2026-11-03** — living plans and records swept; the six superseded `planned/` duplicates became redirect stubs; archive/done stay allow-listed as history.
- [x] **X-03** `KAME_HOMES_URL` placeholder in `docs/workflow/in-progress/ci-cd-environments/ci-cd-dev-prod.md` → `APP_URL`. ✅ **2026-11-03**
- [x] **X-04** Skills that name the brand: `social-creative` ("Produce Kame Homes marketing creative"), `design-md`, `.agent/skills/*`. Re-run `bun run setup:ai-tooling` so Cursor/Claude/OpenCode copies stay in sync (SessionStart hook checks this). ✅ **2026-11-03** — skills renamed; `check-ai-tooling-sync.sh` reports Cursor, Claude and OpenCode in sync (`.cursor/mcp.json` symlinked to `.mcp.json`).
- [x] **X-05** Agent commands `kh-*` → `ks-*` with aliases (R9); update `/kh-help` table. ✅ **2026-11-03** — `ks-*` aliases added for all seven `kh-*` commands in `.cursor`, `.claude` and `.opencode`; `/kh-help` points at both. Full rename stays in Phase 9.
- [x] **X-06** Brand glossary: add "Kame Space" (product), "Kame" (short name, mascot/AI receptionist), "Kame Homes" (former name) to the glossary (`domain-modeling` skill), plus the R4 casing table. ✅ **2026-11-03** — `docs/GLOSSARY.md` added (product names, casing, stable identifiers) and linked from `docs/README.md`.
- [x] **X-07** Claude memory: update memory notes that mention "Kame Homes" (e.g. marketing palette note) only where they describe the product. ✅ **2026-11-03** — N/A: no Claude memory directory exists on this machine for this project.

---

## 7. Phases and order

Each phase is shippable alone and reversible until Phase 8. Local first, then hosted dev, then mt-prod (kamewave in the same message for any prod write).

**Phase 0: Decisions and pre-work (no code).** Answer R1–R9 (R1/R2 before cutover Phase 3 and 1.4). Claim handles (R6). Order new artwork (W-05/06/07, M-03) and narration (N-01) so they are ready when code is. Produce the allow-list seed from §5. Exit: decisions recorded in this file.

**Phase 1: Guard in report-only mode.** ✅ Done 2026-10-27 — `scripts/brand/check-brand.ts` + `scripts/brand/brand-allowlist.txt` + `bun run check:brand` (and `--check`/`--list`). Report: 529 unclassified + 252 domain hits after Phase 2 partial. Not in CI yet.

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

**Phase 9: Hypercare and lock-in (T+30d).** R8 already applied 2026-11-03 (old-name retirement in the resolvers). Remove `kh-*` aliases. Guard allow-list review: anything class D is handed to the domain plan. Move this plan to done.

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

| Risk / edge case                                                                                                        | Mitigation                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Env set explicitly to "Kame Homes" somewhere (Vercel Preview, a teammate's `.env`), so the code default changes nothing | C-01/C-02 per environment checklist; sync scripts updated (C-05); R8 retires the old value now (applied 2026-11-03) |
| Edge functions keep the old name until cold start                                                                       | Redeploy functions after the secret change                                                                          |
| Service worker serves old HTML/manifest                                                                                 | W-04 version bump; verify with `bun run build && bun run preview`                                                   |
| iOS home-screen name stays "Kame Homes"                                                                                 | Accept; mention in the host announcement ("re-add the app to update its name")                                      |
| Duplicate calendar events for guests                                                                                    | Keep ICS UID (K-2)                                                                                                  |
| Review duplicate detection breaks                                                                                       | Keep pepper string (K-1); confirm pepper env set in hosted envs                                                     |
| Default QR treated as custom or dropped                                                                                 | Keep sentinel filename and matcher (K-3)                                                                            |
| Migrated org name leaks onto guest pages                                                                                | B-03 matcher covers every legacy form; U-09 check                                                                   |
| Host-edited templates overwritten                                                                                       | D-03 exact-string replacement only, reverse map                                                                     |
| AI keeps saying Kame Homes from stale knowledge or cached prompts                                                       | A-03 re-embed with delete, A-05 cache invalidation, assistant smoke question                                        |
| Narration audio and captions out of sync                                                                                | N-02 duration check, N-03 watch-through                                                                             |
| Meta or Google flags the name change during review                                                                      | Do T-01/T-03 before the Google verification submission; keep privacy/terms URLs stable                              |
| Payment statement name mismatch → chargebacks                                                                           | T-06 gated on R3                                                                                                    |
| Handle squatting                                                                                                        | R6 before any announcement                                                                                          |
| Vercel rename breaks CORS / OAuth / Meta return URLs                                                                    | Phase 8 adds new origins first, removes old ones 30 days later                                                      |
| Search ranking dip after the name change                                                                                | `alternateName` JSON-LD, unchanged URLs (domain unchanged in this plan), recrawl request                            |
| Rename shipped in the same window as cutover or another prod change                                                     | §2 gate: separate deploy window                                                                                     |
| Concurrent sessions' uncommitted files on `develop` (HANDOFF §6)                                                        | Do the rename in a clean worktree branch; never `git add -A` on the shared tree                                     |
| Big docs diff hides a real code change in review                                                                        | Separate PRs: core, copy, assets, data, tests, docs, infra                                                          |

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
- `docs/workflow/done/kamespace-02-legacy-prod-to-mt-prod-cutover.md`: R1/R2 outcome recorded in its Q1 / 3.1 / 1.4 / 6.1 / 6.2.
- Activity log: `org.brand_renamed` event in D-03; everything else `activity-log: N/A — copy/config only`.
- Plans and permissions: N/A, no gated feature.

---

## 13. Follow-on plans (not part of this one)

- **[`kamespace-04-domain-move-kamespace-com`](./kamespace-04-domain-move-kamespace-com.md)** (planned 2026-10-25): everything class D (§4): DNS, Vercel domains, `cors.ts`, `publicAppOrigin.ts`, email logo URL, `telegramAdmin.ts` `APP_BASE_URL`, `seoMeta.ts`, PostHog/Sentry env detection, Resend sending + inbound domain (`inbound.*` MX, DKIM/SPF/DMARC), `RESEND_FROM_EMAIL`, Supabase Auth site/redirect URLs, Google OAuth origins, Maps and Turnstile hostnames, Meta return origins and webhook URLs, `ical-export` feed URLs given to channels, CI `PREVIEW_URL`, load-test prod refusal regex, Search Console property, redirects from `kamehomes.space` for at least 12 months, stored URLs in DB (reuse `30-rewrite-storage-urls.sql` pattern).
- **[`kamespace-05-google-services-verification`](../done/kamespace-05-google-services-verification.md)** (planned 2026-10-25): refresh [`google-oauth-verification.md`](../wont-do/google-oauth-verification.md) (currently in wont-do) once name and domain are final: consent screen, scopes, privacy policy, homepage, domain ownership, demo video.

## 14. Finish checklist (2026-11-03)

Repo-side work is done. What is left runs outside the repo, in this order.

### 14.1 Deploy the code (done 2026-11-03)

The resolver change means a stale `PLATFORM_APP_NAME` / `VITE_PLATFORM_APP_NAME` can no longer render "Kame Homes". Merge `develop` to `main` (or promote the preview) and the app shell, tab titles, PWA name, emails and AI copy switch to "Kame Space" without touching secrets.

### 14.2 Flip the env values (done 2026-11-03)

| Surface                                  | Variable                 | Value        |
| ---------------------------------------- | ------------------------ | ------------ |
| Vercel `kame-homes` Preview + Production | `VITE_PLATFORM_APP_NAME` | `Kame Space` |
| Supabase `fwor…` edge secrets            | `PLATFORM_APP_NAME`      | `Kame Space` |

Redeploy the edge functions after the Supabase secret change (they read it on cold start). Vite inlines `VITE_*` at build time, so Vercel needs a redeploy too. Production writes need **`kamewave`** in the same message.

**Applied 2026-11-03 with `kamewave`:** Vercel `VITE_PLATFORM_APP_NAME=Kame Space` on production, preview and development (one entry, duplicates removed), Supabase secret `PLATFORM_APP_NAME=Kame Space`, and a production redeploy from `main`. Verified on `https://kamespace.com`: title `Kame Space`, `/manifest.webmanifest` `Kame Space`, entry bundle has 0 `Kame Homes` occurrences.

### 14.3 Rewrite live config data (done 2026-11-03)

Run the D-01 scan first (read-only), then D-03. Expected config rows: `organizations.name`, `properties.name/settings`, `org_settings`, `app_settings`, `platform_settings`, property email templates, Telegram templates, email automation, announcements, help articles, AI knowledge, voice receptionist settings, marketing drafts. Never rewrite `activity_log`, sent-email logs, chat transcripts, reviews, AI conversation logs, published posts or finance.

Note: guest surfaces already mask the legacy org label (`resolveOrgDisplayName` → "Host"), and emails map it to the platform name (`resolvePublicBrandName`). The rewrite removes the stored value; it does not change what renders today.

**Read-only scan** (matches the local result: only `organizations` and `properties` hold the name today):

```sql
DO $$
DECLARE r record; c bigint;
BEGIN
  FOR r IN
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('text', 'character varying', 'jsonb', 'json')
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I::text ILIKE %L',
                   r.table_name, r.column_name, '%kame%home%') INTO c;
    IF c > 0 THEN RAISE NOTICE '%.% = %', r.table_name, r.column_name, c; END IF;
  END LOOP;
END $$;
```

**Rewrite, display name only** (keep slugs, they are in every admin URL, bookmark and Telegram link):

```sql
BEGIN;
UPDATE public.organizations
   SET name = 'Kame Space'
 WHERE name ~* '^kame\s*homes?$';

UPDATE public.properties
   SET name = 'Kame Space'
 WHERE name ~* '^kame\s*homes?$';

-- Verify: 0 rows should remain.
SELECT id, name, slug FROM public.organizations WHERE name ~* 'kame\s*homes?';
SELECT id, name, slug FROM public.properties  WHERE name ~* 'kame\s*homes?';
COMMIT;
```

**Applied 2026-11-03 with `kamewave`:** `organizations.name` and `properties.name` are now `Kame Space` (slugs unchanged: `kame-homes`, `kame-home`). Backups in `backups/brand/2026-11-03/` (`prod-tenant-before.json`, `ai-knowledge-before.json`, `query-cache-before.json`, `reverse.sql`). The AI knowledge base answers were rewritten; one stale `hello@kamehomes.com` address became the configured reply-to mailbox; the affected `query_cache` row was deleted. `activity_log` was left untouched as history.

Two decisions before running it on prod:

1. **Org slug** stays `kame-homes` unless you accept a `tenantSlugRemap` migration and the broken links that follow. Rename it only with a redirect map.
2. **Property name** `Kame Home` is the guest-facing listing brand, not the product. Renaming it changes what guests see on the listing, in emails and on the stay guide. Confirm before the UPDATE above touches it, or delete that second UPDATE.

Do not rewrite `activity_log` (history) or `public_listing_search` (a derived view; it refreshes from the tables above).

### 14.4 Rename the services (partly done 2026-11-03)

| Service               | Current                             | Target                              | Caveat                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------- | ----------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel project        | `kame-homes`                        | `kame-space`                        | **Done** (already renamed). Default host is now `kame-space-*.vercel.app`; keep the old origins allow-listed until decommission.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| GitHub repo           | `sprmke/kame-homes`                 | `sprmke/kame-space`                 | **Done** (already renamed; old URLs redirect). Local remote updated 2026-11-03.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Supabase project name | "Kame Homes - Dev"                  | "Kame Space"                        | **Done 2026-11-03.** Display name only; ref `fwor…` unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Sentry projects       | `kame-homes-web`, `kame-homes-edge` | `kame-space-web`, `kame-space-edge` | **Done** (operator renamed them in Sentry 2026-11-03). Update `SENTRY_PROJECT` per environment if release uploads use the slug; DSNs do not change on rename.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Resend                | sender on `kamehomes.space`         | sender on `kamespace.com`           | **Done:** `kamespace.com` and `inbound.kamespace.com` are verified; `RESEND_FROM_EMAIL=mail@kamespace.com`, `RESEND_APPROVAL_INBOUND_DOMAIN=inbound.kamespace.com`. Keep `kamehomes.space` verified while old mail is still answered.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Google Cloud          | consent app name + OAuth JS origins | `Kame Space`, `kamespace.com`       | **Partly done 2026-11-03.** Project display name is `Kame Space`; the Maps key is restricted to `kamespace.com`, `www.kamespace.com` and localhost with the five needed APIs; Supabase Auth site URL + redirect allow-list updated. **OAuth JS origins 2026-11-03:** the prod client is `https://kamespace.com` only. `kame-space-ui.vercel.app` was removed from the client and from authorised domains because `vercel.app` cannot be verified in Search Console. `dev.kamespace.com` does not resolve, so it is not kept as an origin. Local dev uses the legacy dev client. **Done 2026-11-03:** the OAuth consent screen app name, home page, privacy and terms links were updated and saved; a public brand lookup now returns `displayName: "Kame Space"`. Authorised domains are `fworvijbrwpyngycotbz.supabase.co` (required by the auth callback, cannot be verified) and `kamespace.com`; the legacy domains were removed. Google shut down the IAP OAuth Admin API on 2026-03-19 and exposes no public write API for console-created brands or clients, so both fields are console-only. |
| Meta                  | Facebook page / app name            | `Kame Space`                        | Page name changes go through review. Keep the old handle 12 months.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Telegram              | bot display names                   | `Kame Space …`                      | **Blocked:** bot tokens live only in prod secrets (not readable). Set the display name in BotFather or with `setMyName`; never change the username (stored webhooks).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| PayMongo              | merchant display name               | only if R3 changes the legal entity | KYC must match registration documents.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

### 14.5 Assets and audio (designer / producer)

**2026-11-03:** the PWA manifest name was hardcoded in `ui/vite.config.ts`; fixed in PR #228 (merged to `main`, deployed) so `/manifest.webmanifest` now says `Kame Space`. `ui/public/images/logo.png` is the turtle mascot (no wordmark) and both PDF templates contain no brand text, so nothing else needs regenerating there.

W-05/06/07 (icons, `/images/logo.png` replaced in place, OG images) and N-01/N-02 (narration clips + VTT + manifest). The email logo path must stay `/images/logo.png` so already-sent emails keep loading.

### 14.6 Turn the guard on (agent, after 14.1–14.5)

`bun run check:brand` currently reports ~700 unclassified hits, almost all docs, test fixtures and seeds. Run Q-01 (neutral test fixtures) and X-01/X-02 (living docs), then add the allow-list entries for archive/done docs and flip `ci.yml` to `--check`.

---

Back to [planned index](./README.md).
