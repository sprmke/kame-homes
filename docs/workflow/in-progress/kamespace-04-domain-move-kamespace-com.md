---
stage: in-progress
title: 'Domain move: kamehomes.space → kamespace.com (DNS, Vercel, email, auth, third parties)'
status: in-progress
tags: [planning, domain, dns, vercel, email, resend, oauth, seo, pwa, third-party, cutover]
updated: 2026-11-01
depends_on: [kamespace-01-legacy-prod-config-secrets-backup]
blocks: [kamespace-02-legacy-prod-to-mt-prod-cutover]
followed_by: [kamespace-05-google-services-verification]
---

# Domain move: kamehomes.space → kamespace.com

## Progress (2026-11-01)

- **Done:** DN-01 Namecheap registration; default origins, SEO index hosts, preview detection and load-test refusal in code (K-01 partial, K-02/03/06/07/11).
- **In progress:** remaining K tasks.
- **Pending:** DNS, Vercel domains, Resend, Auth redirects and third-party allow-lists.

**Series.** Plan 4 of 5 in the Kame Space launch series. The number is the order the plans were written and the order their **final sign-off** happens. Execution overlaps: most of this plan must finish **before** plan 02's cutover day (see §3).

| #   | Plan                                                                                                       | Role                                                         |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 01  | [`kamespace-01-legacy-prod-config-secrets-backup.md`](./kamespace-01-legacy-prod-config-secrets-backup.md) | Back up every legacy env var, secret and dashboard setting   |
| 02  | [`kamespace-02-legacy-prod-to-mt-prod-cutover.md`](./kamespace-02-legacy-prod-to-mt-prod-cutover.md)       | Move legacy data, storage and accounts onto mt-prod          |
| 03  | [`kamespace-03-rebrand-kame-homes-to-kame-space.md`](./kamespace-03-rebrand-kame-homes-to-kame-space.md)   | Rename the product everywhere                                |
| 04  | **this plan**                                                                                              | Move every hostname, mailbox and allow-list to kamespace.com |
| 05  | [`kamespace-05-google-services-verification.md`](../planned/kamespace-05-google-services-verification.md)  | Google verification + every Google service production-ready  |

**Goal.** Serve the app, guest pages, emails and every third-party integration from **`kamespace.com`** instead of `kamehomes.space`, with zero broken links for anything already sent or printed. Every hostname we own moves; every hostname a vendor owns (`*.supabase.co`, `*.vercel.app`) stays. `kamehomes.space` stays registered and redirecting for at least 24 months.

**Owner decisions already made (2026-10-25, recorded in plan 02 D4 and Q2):**

- Production origin is the apex **`https://kamespace.com`**. mt-prod launches there directly at plan 02 T0. `app.kamehomes.space` is never used as the prod host.
- Dev origin is **`https://dev.kamespace.com`** (mt-dev `fwor…`); it can move before or after the cutover.
- Legacy `kamehomes.space` + `www` become redirect-only to `https://kamespace.com/**` for at least 12 months (this plan extends that to 24, DM4).
- If `kamespace.com` isn't registered and verified in time, plan 02 falls back to `app.kamehomes.space` and this plan reverts to a later standalone flip (§7, fallback track).

**Not in this plan.** Product-name copy (plan 03). Google OAuth verification submission (plan 05; this plan gets the domain ready for it). Supabase project refs, Vercel project names and the GitHub repo name (plan 03 Phase 8).

**Status: planned, not started.** Inventory below is read-only.

---

## 1. Inventory (verified 2026-10-25, read-only grep)

### 1.1 Hostnames we own

| Host                                     | Today                                     | Target                                                                             |
| ---------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `kamehomes.space`, `www.`                | Legacy Vercel `guest-form-management-app` | 308 → `https://kamespace.com/*` (path and query kept) from plan 02 T0              |
| `app.kamehomes.space`                    | Reserved in `cors.ts`, not attached       | Never used. Remove from allow-lists; optionally 308 → `kamespace.com`              |
| `dev.kamehomes.space`                    | `kame-homes` Vercel Preview (`develop`)   | 308 → `https://dev.kamespace.com/*`                                                |
| `inbound.kamehomes.space`                | Resend inbound for mt-dev (if configured) | `inbound.kamespace.com`; old MX kept while any sent Reply-To can still be answered |
| Sender on `kamehomes.space`              | Resend domain, `RESEND_FROM_EMAIL`        | Sender on `kamespace.com`                                                          |
| Human mailboxes                          | Unknown (Q2)                              | `@kamespace.com`, old addresses forward                                            |
| `kamespace.com`                          | Not set up                                | Prod SPA (Vercel Production)                                                       |
| `www.kamespace.com`, `app.kamespace.com` | Not set up                                | 308 → `https://kamespace.com/*`                                                    |
| `dev.kamespace.com`                      | Not set up                                | Dev SPA (Vercel Preview, `develop`)                                                |

Vendor hosts that **do not move**: `<ref>.supabase.co` (REST, Auth callback, Storage URLs, edge functions, so the Meta OAuth callback, Meta/PayMongo/Resend/Telegram webhooks, `ical-export` feeds given to Airbnb, pg_cron targets), `kame-homes.vercel.app` and `kame-homes-git-*-kame-works.vercel.app`, `us.i.posthog.com` (proxied at relative `/ingest`).

### 1.2 Code references (78 lines outside `docs/`)

Most runtime links are already derived, which keeps this move small:

- **UI share links and auth redirects use `window.location.origin`** (inbox share rows, quick replies, check-in pack, SD form link, stay guide, document share, parking direct link, `guestOAuthRedirectTo`, `hostGoogleOAuthRedirectTo`, `AcceptInvitePage`). They follow the host automatically, but each host must be on the Supabase Auth redirect allow-list (SA-02).
- **Server-built links use `resolvePublicGuestAppOrigin()`** (`_shared/publicAppOrigin.ts`): env `PUBLIC_GUEST_APP_ORIGIN` → `org_settings.public_guest_app_origin` → hardcoded default. Used by emails, PayMongo checkout `successUrl`/`cancelUrl` (`orgBillingUrls.ts`), invites, verification and billing emails. One env value moves them.
- **Inbound approvals are domain-agnostic.** `approval-email-webhook` reads only the local part `approvals+<slug>` (`approvalInboundAddress.ts#propertySlugFromInboundAddress`). Old and new inbound domains can feed the same webhook in parallel.

Hardcoded hostnames that must change (class D in plan 03 §4):

| File                                                                                                                                                                                                         | What                                                                                                                                                         | Task  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| `supabase/functions/_shared/cors.ts`                                                                                                                                                                         | `ALLOWED_ORIGINS` (5 `kamehomes.space` hosts), `DEFAULT_ORIGIN = https://www.kamehomes.space`                                                                | K-01  |
| `supabase/functions/_shared/publicAppOrigin.ts`                                                                                                                                                              | `DEFAULT_PUBLIC_GUEST_APP_ORIGIN = https://kamehomes.space`                                                                                                  | K-02  |
| `supabase/functions/_shared/renderEmailHtml.ts`                                                                                                                                                              | `DEFAULT_EMAIL_LOGO_URL` on the old apex                                                                                                                     | K-03  |
| `supabase/functions/_shared/telegramAdmin.ts`                                                                                                                                                                | `APP_BASE_URL = https://kamehomes.space` with legacy `/bookings/<id>` paths (pre-existing bug: bypasses the origin resolver and the org/property admin path) | K-04  |
| `ui/src/features/dashboard/lib/storedMediaDisplay.ts`                                                                                                                                                        | Sentinel `'kamehomes.space/images/logo'` for default-logo detection                                                                                          | K-05  |
| `ui/src/lib/seo/seoMeta.ts` (`DEFAULT_INDEXABLE_HOSTS`); `ui/middleware.ts` reads `SEO_INDEXABLE_HOSTS`                                                                                                      | Indexable hosts                                                                                                                                              | K-06  |
| `ui/src/lib/posthog/env.ts`, `ui/src/lib/sentry/client.ts`                                                                                                                                                   | `host.includes('dev.kamehomes.space')` environment detection                                                                                                 | K-07  |
| `supabase/functions/_shared/propertyTemplatePlaceholders.ts` + UI twin `ui/src/features/dashboard/bookings/lib/propertyTemplatePlaceholders.ts`; `telegramPlaceholderGroups.ts`; `telegramPreviewSamples.ts` | Sample links in template editors and previews                                                                                                                | K-08  |
| `ui/src/features/guest/marketing/for-hosts/preview/components/showcase/showcaseDemoRegistry.ts`                                                                                                              | Fake browser chrome `app.kamehomes.com/…` (already the wrong TLD)                                                                                            | K-09  |
| `marketing/social/src/primitives.tsx` `SITE`; `marketing/social/scripts/captions.ts`, `filipinoCaptions.ts`                                                                                                  | Site text in creative and captions                                                                                                                           | MK-01 |
| `scripts/dev/sync-dev-env.mjs` (`DEV_ORIGIN`, CORS default), `qa-walk-hosted-dev.mjs`, `cost-abuse-verify-dev.sh`, `seed-host-announcements.sql`, `scripts/preview/preview-emails-from-db.mjs`               | Dev tooling, seeds, preview defaults                                                                                                                         | K-10  |
| `scripts/performance/load-test/public-api.js` (refuses only `app\.kamehomes\.space`), `load-test/README.md`, `verify-deployed-preview.mjs`                                                                   | **Safety guard**: today it would let a load test hit `kamespace.com` prod                                                                                    | K-11  |
| `scripts/migrate/legacy-to-mt-prod/lib.sh` `NEW_APP_ORIGIN="https://app.kamehomes.space"`, `sql/30-rewrite-storage-urls.sql`                                                                                 | Cutover rewrite target. **Wrong after the owner decision**                                                                                                   | K-12  |
| `.github/workflows/cd-dev.yml` (`PREVIEW_URL`, header comment)                                                                                                                                               | CD dev smoke target                                                                                                                                          | K-13  |
| `supabase/.env.example`, `supabase/.env.dev.example`, `ui/.env.example`                                                                                                                                      | Example values and comments                                                                                                                                  | C-05  |
| `.claude/commands/kh-*.md`, `.cursor/commands/kh-*.md`, `.cursor/rules/project-context.mdc`                                                                                                                  | Agent docs naming `dev.kamehomes.space`                                                                                                                      | X-02  |
| Tests: `cors_test.ts`, `probeClassifiers_test.ts`, `seoMeta.test.ts`, `seoMiddleware.test.ts`, `parseChatRichBlocks.test.ts`, `guestTripCalendar.test.ts`                                                    | Fixture hosts                                                                                                                                                | Q-01  |

**Keep on purpose (allow-list, class K):** ICS `UID:trip-<id>@kamehomes` (`guestTripCalendar.ts`; a new UID duplicates every saved guest event, plan 03 K-2). Legacy origins inside `scripts/migrate/legacy-to-mt-prod/**` that describe the **source** system (`origin_apex`, `origin_www` in the rewrite SQL). Shipped migrations.

### 1.3 Env vars and secrets that hold a hostname or address

| Name                                         | Where                     | Notes                                                                                         |
| -------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| `PUBLIC_GUEST_APP_ORIGIN`                    | Supabase secrets dev/prod | Drives every server-built link. Prod `https://kamespace.com`, dev `https://dev.kamespace.com` |
| `CORS_ALLOWED_ORIGINS`                       | Supabase secrets          | Extra exact origins on top of `cors.ts`                                                       |
| `META_OAUTH_ALLOWED_RETURN_ORIGINS`          | Supabase secrets          | Where Meta connect returns the host                                                           |
| `RESEND_FROM_EMAIL`                          | Supabase secrets          | Sender; system health checks its domain is verified (`classifyResend`)                        |
| `RESEND_APPROVAL_INBOUND_DOMAIN`             | Supabase secrets          | Builds `approvals+slug@<domain>` Reply-To                                                     |
| `SUPPORT_TEAM_EMAIL`, `VAPID_SUBJECT`        | Supabase secrets          | Mailbox and push contact                                                                      |
| `ADMIN_ALLOWED_EMAILS`, `SUPER_ADMIN_EMAILS` | Supabase secrets          | Only if an address is `@kamehomes.space` (identity risk, EM-12)                               |
| `VITE_PLATFORM_CONTACT_EMAIL`                | Vercel                    | Contact shown in UI                                                                           |
| `SEO_INDEXABLE_HOSTS`                        | Vercel (middleware)       | Overrides `DEFAULT_INDEXABLE_HOSTS`                                                           |
| `VITE_TURNSTILE_SITE_KEY`                    | Vercel                    | Key unchanged; widget hostname list changes                                                   |
| `VITE_GOOGLE_MAPS_API_KEY`                   | Vercel                    | Key unchanged; HTTP referrer restrictions change (plan 05 G-33)                               |
| Vault / pg_cron targets                      | Postgres                  | Point at `*.supabase.co`, unaffected (verify, DA-01)                                          |

### 1.4 Data that can hold a hostname

`org_settings.public_guest_app_origin` and `app_settings` origin fields, host announcement `linkUrl` (seed has `https://kamehomes.space/help-support/announcements`), host-edited email and Telegram templates, custom/public page content, AI knowledge chunks, marketing drafts and saved templates, property media metadata. On mt-prod these arrive from legacy and are rewritten by plan 02's `30-rewrite-storage-urls.sql` (target fixed in K-12). On dev they come from seeds and hand edits (DA-02). History (sent emails, inbox messages, published Meta posts, activity log) is **not** rewritten (plan 03 R5); redirects cover it.

### 1.5 Things outside the repo that hold a hostname

Printed QR codes and signage in the unit, house manual PDF, Airbnb/Facebook/Instagram listing text and bios, Google Business Profile website, the PMO office (Azure North) contact records, guests' saved trip calendar events (URL inside the event), bookmarks, every email legacy ever sent. All are covered by permanent redirects plus the operator checklist MK-03.

---

## 2. Facts that shape the plan

| Fact                                                                                                                                       | Consequence                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Prod launches on `kamespace.com` at plan 02 T0, and every prod session resets then anyway (plan 02 D3: new JWT keys).                      | No separate prod "flip" with its own sign-out wave. Everything prod needs from this plan must be ready **before T0**.                         |
| Legacy `main` shipped a web manifest but **no service worker** (checked `main:ui/vite.config.ts`, `main:ui/public`).                       | Redirecting the legacy apex strands nothing. The service-worker kill switch is needed only for installs on `dev.kamehomes.space` (teammates). |
| A new sending domain has no reputation. Gmail and Yahoo require SPF, DKIM and DMARC alignment; we send no `List-Unsubscribe` header today. | Verify and warm `kamespace.com` in Resend at least 14 days before T0, so day-one booking emails don't land in spam.                           |
| `cors.ts` falls back to `DEFAULT_ORIGIN` for unknown origins; the allow-list is code, not env.                                             | `kamespace.com` must be in `cors.ts` and deployed to every edge function on mt-prod at T0.                                                    |
| Supabase callback stays `https://<ref>.supabase.co/auth/v1/callback`.                                                                      | Google OAuth **redirect URIs** don't change for this move. Authorized domains, JS origins, homepage, privacy and terms URLs do (plan 05).     |
| Meta OAuth callback and webhooks are on `*.supabase.co`.                                                                                   | Only Meta app domains, site URL, legal URLs, data deletion URL and Business domain verification change.                                       |
| The legacy apex redirect lives on the **legacy** Vercel project (plan 02 D4), which plan 02 §10.2 deletes after hypercare.                 | Before that deletion, move `kamehomes.space` + `www` onto the `kame-homes` project with the same redirect, or the old links die (DM5).        |
| `ui/middleware.ts` has no host logic today; it only serves crawler HTML.                                                                   | Redirects on the `kame-homes` project are Vercel domain redirects or new middleware rules (DM5).                                              |
| Legacy email links only ever used `/sd-form?bookingId=…`, `/bookings/<id>`, `/images/*` (plan 02 0.6).                                     | The redirect keeps path + query; `LegacyGuestPathRedirect` + `resolve-booking-property` (plan 02 5.2) finish the job on `kamespace.com`.      |

---

## 3. Gate and sequencing

| Track                                     | When                                                                 | What                                                                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **A. Prod readiness (blocks plan 02 T0)** | Now → plan 02 T-14d                                                  | Phases 0–2: domain, DNS, mailboxes, Resend warm-up, code defaults, allow-lists, third-party domains, plan 02 tooling fix |
| **B. Dev move (independent)**             | Any time after Phase 2 code lands; recommended **before** plan 02 R3 | Phase 3: `dev.kamehomes.space` → `dev.kamespace.com`, used as the rehearsal for every §9 check                           |
| **C. Cutover day**                        | Plan 02 T0                                                           | Phase 4: the domain steps plan 02's runbook runs (attach apex, legacy redirect, smoke)                                   |
| **D. Long tail**                          | T0 → T+24 months                                                     | Phases 5–7: overlap end, legacy redirect moved off the legacy project, DMARC tightening, renewals                        |

Prerequisite for anything: plan 01 B-18 sign-off (the old value of every dashboard field changed here is backed up).

**Brand mismatch, accepted by the owner:** from T0 until plan 03 Phase 7 the site at `kamespace.com` still says "Kame Homes". Emails come from `@kamespace.com` with the Kame Homes name. Plan 03 removes the mismatch; plan 05 waits for both.

---

## 4. Decisions (recommended unless marked owner-confirmed)

| #        | Decision                             | Recommendation                                                                                                                                                                                                                                                                                                                                            | Why                                                                                                                            |
| -------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **DM1**  | Timing                               | **Owner-confirmed:** prod lands on `kamespace.com` at plan 02 T0. Dev moves independently (Track B), ideally before plan 02 R3 so the dress rehearsal runs on the final domain shape.                                                                                                                                                                     | One setup for OAuth, Resend, Meta, Turnstile. No second prod migration a month later.                                          |
| **DM2**  | Host layout                          | **Owner-confirmed:** apex `kamespace.com` = prod SPA, `dev.kamespace.com` = dev. Recommended additions: `www.` and `app.kamespace.com` → 308 to apex; `inbound.kamespace.com` = Resend inbound; sender on `kamespace.com` (Resend puts its return-path MX/SPF on `send.kamespace.com`).                                                                   | `app.` catches people and docs that assume the old `app.` layout. Mailbox MX at apex doesn't clash with `send.` or `inbound.`. |
| **DM3**  | Human mailboxes                      | One provider for `hello@`, `support@`, `privacy@`, `security@`, `billing@`, `dmarc@` on `kamespace.com` (Google Workspace if the team pays for it, which also helps plan 05 GV2; otherwise a forwarding service). Old `@kamehomes.space` addresses forward for 24 months.                                                                                 | Legal pages, Google/Meta listings and `VAPID_SUBJECT` need a monitored mailbox.                                                |
| **DM4**  | Old domain retention                 | Keep `kamehomes.space` registered, auto-renew on, renewed **2+ years ahead**, registrar lock on. Redirects stay at least 24 months (plan 02 D4 says 12; this extends it). Never drop while a booking, QR code or guide could still point at it.                                                                                                           | A lapsed domain can be bought and used to phish guests through links in old booking emails.                                    |
| **DM5**  | Redirect mechanism                   | T0 → hypercare: legacy project serves the old-apex 308 (plan 02 D4). **Before plan 02 §10.2 deletes the legacy project:** attach `kamehomes.space` + `www` to `kame-homes` and serve the same 308 there (Vercel domain redirect, which keeps path and query). `dev.kamehomes.space`: middleware 308 except `/sw.js` (self-unregistering worker, PW-02).   | One hop to the final host, no gap when the legacy project goes away, dev installs released.                                    |
| **DM6**  | Overlap for old allow-listed origins | Old **dev** host stays in CORS, Supabase Auth redirect URLs, Turnstile, Maps referrers, Google JS origins and Meta return origins for 30 days after the dev move. **Prod** never needs `kamehomes.space` in those lists, because the old apex only redirects. Old inbound MX: keep while any Reply-To using it may still get answers (dev only; 60 days). | Stale dev tabs and in-flight OAuth keep working; prod lists stay clean from day one.                                           |
| **DM7**  | DMARC policy                         | Publish `p=none` with `rua` reporting in Phase 1, `p=quarantine` after 30 clean days, `p=reject` after 90. Once `kamehomes.space` stops sending: `p=reject` and SPF `v=spf1 -all`.                                                                                                                                                                        | Deliverability first, spoofing protection after.                                                                               |
| **DM8**  | Supabase custom domain               | Not in this plan; plan 05 GV3. If adopted, webhooks and iCal feeds stay on `*.supabase.co`.                                                                                                                                                                                                                                                               | Only changes the Google consent text; moving webhooks is risk with no gain.                                                    |
| **DM9**  | Canonical and SEO                    | Canonical `https://kamespace.com`. Search Console **Change of Address** from the `kamehomes.space` property after T0 (both verified as domain properties).                                                                                                                                                                                                | Moves ranking signals in weeks.                                                                                                |
| **DM10** | Defensive registrations              | Optional: `kamespace.ph`, `kame-space.com`, `kamespace.app` → 308 to `kamespace.com`. Ask the owner.                                                                                                                                                                                                                                                      | Cheap protection on a guest-payment app.                                                                                       |

---

## 5. Host map (final)

| Old / extra host                             | Target                          | Behaviour                                                                                                      |
| -------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `kamehomes.space/*`, `www.kamehomes.space/*` | `https://kamespace.com/*`       | 308, path + query kept; legacy paths then resolve via `LegacyGuestPathRedirect` and `resolve-booking-property` |
| `app.kamehomes.space/*`                      | `https://kamespace.com/*`       | 308 (only if it was ever attached)                                                                             |
| `dev.kamehomes.space/*`                      | `https://dev.kamespace.com/*`   | 308                                                                                                            |
| `dev.kamehomes.space/sw.js`                  | self-unregistering worker (200) | Releases installed dev PWAs, then navigates to the new host                                                    |
| `www.kamespace.com/*`, `app.kamespace.com/*` | `https://kamespace.com/*`       | 308                                                                                                            |
| `inbound.kamehomes.space` (MX)               | `inbound.kamespace.com` (MX)    | Both live during the overlap, same webhook                                                                     |
| `*@kamehomes.space` mailboxes                | `*@kamespace.com`               | Forwarding for 24 months                                                                                       |

---

## 6. Tasks by surface

Every task: local → hosted dev → mt-prod. Prod writes and prod dashboard changes need **`kamewave`** in the same message. Record old value, new value, date and who for every dashboard field in the runbook (X-03).

### 6.1 Registrar and DNS (Namecheap, operator)

- [x] **DN-01** Confirm `kamespace.com` is registered (Q1): registrar account, auto-renew, registrar lock, WHOIS privacy, renewal date. Put it in the same registrar account as `kamehomes.space`. ✅ **2026-11-01** — purchased on Namecheap (owner confirmed; no `app.kamehomes.space` fallback).
- [ ] **DN-02** Renew `kamehomes.space` 2+ years ahead (DM4). Calendar reminders for both domains.
- [ ] **DN-03** Export the full current zone of `kamehomes.space` into the plan 01 backup.
- [ ] **DN-04** Records on `kamespace.com` (values from Vercel and Resend):
  - Apex A/ALIAS and `www`, `app`, `dev` CNAME → Vercel.
  - Resend sending: DKIM (`resend._domainkey`), SPF + MX on `send`.
  - `inbound` MX → Resend inbound.
  - Mailbox provider MX + SPF at apex (DM3). One SPF record per name, merged, under 10 DNS lookups.
  - `_dmarc` TXT `v=DMARC1; p=none; rua=mailto:dmarc@kamespace.com` (DM7).
  - Verification TXT: Google Search Console (domain property), Meta Business domain verification.
  - CAA allowing the CAs Vercel issues from (check Vercel docs at the time).
- [ ] **DN-05** DNSSEC only if Namecheap + Vercel support it cleanly; record the decision.
- [ ] **DN-06** T-2d before cutover (plan 02 runbook) and before the dev move: TTL 300 s on records that change (old apex, `www`, `dev`).
- [ ] **DN-07** After hypercare: `kamehomes.space` `_dmarc p=reject`, SPF `v=spf1 -all` once nothing sends from it.

### 6.2 Vercel (`kame-homes`, kame-works)

- [ ] **V-01** Add `dev.kamespace.com` (Preview, Git branch `develop`) in Track B. Add `kamespace.com`, `www`, `app` to the project in Phase 1 **without** assigning them to Production traffic until plan 02 T0 step 7 (plan 02 1.5 keeps the apex off Production until cutover). Certificates issued ahead.
- [ ] **V-02** `www.kamespace.com` and `app.kamespace.com` as Vercel domain redirects (308) to the apex.
- [ ] **V-03** Production env: `SEO_INDEXABLE_HOSTS=kamespace.com`, `VITE_PLATFORM_CONTACT_EMAIL` → new mailbox. Preview env: `VITE_PLATFORM_CONTACT_EMAIL`. Redeploy (Vite inlines `VITE_*`).
- [ ] **V-04** `ui/vercel.json` CSP is `'self'`-based and vendor hosts don't change, so no CSP edit is expected. Re-check after K-*; the `/ingest` PostHog proxy is relative.
- [ ] **V-05** Deployment protection on Preview: `dev.kamespace.com` behaves like `dev.kamehomes.space`.
- [ ] **V-06** Before plan 02 §10.2: attach `kamehomes.space` + `www` to `kame-homes` as 308 domain redirects to `https://kamespace.com` (DM5). Test with `curl -I` on a legacy SD-form link before detaching from the legacy project.

### 6.3 Code (on `develop`, merged before plan 02 R3)

- [~] **K-01** `cors.ts`: add `https://kamespace.com`, `https://dev.kamespace.com`. `DEFAULT_ORIGIN` → `https://kamespace.com`. Remove `https://app.kamehomes.space` (never used) and `https://guest-form-management-ui.vercel.app` (legacy deploy) once plan 02 decommission removes them. Keep `https://dev.kamehomes.space` for the DM6 overlap, then remove. The legacy apex can go at T0 because it only redirects. Update `cors_test.ts`. ✅ **2026-11-01** — allow-list + `DEFAULT_ORIGIN` + tests; legacy host removals deferred to decommission.
- [x] **K-02** `publicAppOrigin.ts` default → `https://kamespace.com` (env still wins; set env explicitly everywhere, C-01). ✅ **2026-11-01**
- [x] **K-03** `renderEmailHtml.ts` `DEFAULT_EMAIL_LOGO_URL`: derive from `resolvePublicGuestAppOrigin()` + `/images/logo.png` instead of a second literal. Legacy emails keep loading the logo through the redirect (same path). ✅ **2026-11-01**
- [ ] **K-04** `telegramAdmin.ts`: replace `APP_BASE_URL` with `resolvePublicGuestAppOrigin()` and build the **org/property admin booking path**, not legacy `/bookings/<id>`. Check the other Telegram senders for hardcoded bases. Deno test.
- [ ] **K-05** `storedMediaDisplay.ts`: match the default logo by **path** (`/images/logo`) on old or new hosts, so rows written under either host count as the default. Unit test with both.
- [x] **K-06** `seoMeta.ts` `DEFAULT_INDEXABLE_HOSTS` → `['kamespace.com']`. Update `seoMeta.test.ts`, `seoMiddleware.test.ts` (sitemap line, canonical hrefs). ✅ **2026-11-01** — includes `www.kamespace.com`; `seoMeta.test.ts` updated.
- [x] **K-07** `posthog/env.ts`, `sentry/client.ts`: one shared `isPreviewHost()` helper that knows both `dev.` hosts and `vercel.app`. Make sure `kamespace.com` is detected as production and `dev.kamespace.com` as preview (a naive `includes('kamespace.com')` would call dev production). Unit test. ✅ **2026-11-01** — `ui/src/lib/previewHost.ts` + tests.
- [ ] **K-08** Sample links in placeholder/preview files (4 files, 2 twins kept in sync) → `https://kamespace.com/...`.
- [ ] **K-09** `showcaseDemoRegistry.ts` fake URL chrome → `kamespace.com/…`.
- [ ] **K-10** Dev scripts and seeds: `sync-dev-env.mjs` `DEV_ORIGIN` and CORS default (both dev hosts during overlap), `qa-walk-hosted-dev.mjs`, `cost-abuse-verify-dev.sh`, `seed-host-announcements.sql` (`linkUrl` relative), `preview-emails-from-db.mjs` defaults.
- [x] **K-11** Load-test refusal: refuse hostnames exactly `kamespace.com`, `www.kamespace.com`, `app.kamespace.com` and the old prod hosts; still allow `dev.kamespace.com`. Match on the parsed hostname, not a substring. Run it with the prod URL to prove refusal. ✅ **2026-11-01** — `refuseProdHost.mjs` + `public-api.js` + unit test.
- [ ] **K-12** Plan 02 tooling: `lib.sh` `NEW_APP_ORIGIN` → `https://kamespace.com`; `30-rewrite-storage-urls.sql` header comment and target follow it. Legacy source origins (`origin_apex`, `origin_www`) stay. Re-run the R2 rewrite on a local restore to confirm 0 old-origin hits. **Must land before plan 02 R3.**
- [ ] **K-13** `cd-dev.yml` `PREVIEW_URL` → `https://dev.kamespace.com` in the same PR as the dev move.
- [ ] **K-14** Dev-host redirect in `ui/middleware.ts`: one exported host map (`retiredHostRedirects.ts`) from §5; 308 with path and query; skip `/sw.js` and `/.well-known/*`. Check the middleware `matcher` covers static paths; if not, add host-conditioned `redirects` in `ui/vercel.json`. Unit tests for every row, including `?bookingId=` links. Env flag `RETIRED_HOST_REDIRECTS_ENABLED` for rollback.
- [ ] **K-15** `rg 'kamehomes\.space'` after all K tasks returns only the allow-list (historical docs, legacy source origins in migration tooling, K-14 map, ICS UID). Feed it to plan 03's `check:brand` guard.

### 6.4 PWA and push (dev only for migration; prod is a fresh origin)

- [ ] **PW-01** App boot check: on `dev.kamehomes.space`, unregister service workers, clear caches, `location.replace()` to `dev.kamespace.com`. Ship one release before the dev move.
- [ ] **PW-02** Middleware serves a self-unregistering `/sw.js` on `dev.kamehomes.space` (`skipWaiting`, `registration.unregister()`, `client.navigate(newUrl)`). Keep 90 days.
- [ ] **PW-03** Manifest `id` / `start_url` stay relative. Prod installs start fresh at `kamespace.com` (legacy had no service worker). Test install on Android and iOS against `dev.kamespace.com`, then prod at T0+1d.
- [ ] **PW-04** `push-fanout` prunes endpoints on `404/410` (verify). Dev subscriptions from the old origin die with PW-02; the app re-prompts on the new origin.
- [ ] **PW-05** Bump `pwa-version.json` in the dev-move release. Test with `bun run build && cd ui && bun run preview`.

### 6.5 Supabase Auth

- [ ] **SA-01** Plan 01 backup of current Auth config exists for both projects.
- [ ] **SA-02** mt-prod (plan 02 1.4): Site URL `https://kamespace.com`; Redirect URLs `https://kamespace.com/**` only (no old hosts needed). mt-dev: **add** `https://dev.kamespace.com/**` next to the old dev host before the dev move.
- [ ] **SA-03** mt-dev Site URL → `https://dev.kamespace.com` at the dev move.
- [ ] **SA-04** Auth email templates (magic link / OTP, invite, recovery, email change) on both projects: no literal host; use `{{ .SiteURL }}` / `{{ .RedirectTo }}`. Custom SMTP sender (if Auth sends through Resend) → `@kamespace.com` after EM-02 verifies.
- [ ] **SA-05** Turnstile hostnames (TS-01) include the new hosts before anyone signs in there, or OTP sign-in fails.
- [ ] **SA-06** After DM6: remove the old dev host from mt-dev Redirect URLs.

### 6.6 Email: Resend sending, inbound, mailboxes

- [ ] **EM-01** Same Resend account as mt-prod (plan 02 6.1). Confirm whether that is a new account; if so, `kamespace.com` goes straight into the new one and there is no domain move between accounts.
- [ ] **EM-02** Add and verify `kamespace.com` in Resend by **T-21d**. Turn on click/open tracking only if it is on today (Q9).
- [ ] **EM-03** Warm-up from verification to T0: internal test mail and dev-environment mail (switch dev's `RESEND_FROM_EMAIL` early). Gmail "Show original" shows SPF/DKIM/DMARC `pass`; domain registered in Google Postmaster Tools.
- [ ] **EM-04** Inbound: add `inbound.kamespace.com` to Resend inbound → the same `approval-email-webhook` on each environment. Test a real reply to `approvals+<slug>@inbound.kamespace.com` on dev; on prod as part of plan 02 T0 smoke.
- [ ] **EM-05** mt-prod secrets (plan 02 6.1): `RESEND_FROM_EMAIL` → `@kamespace.com` sender, `RESEND_APPROVAL_INBOUND_DOMAIN=inbound.kamespace.com`. Dev: same at the dev move. Redeploy functions after secret changes.
- [ ] **EM-06** In-flight approvals at cutover: legacy asked PMO via Gmail, not inbound, so plan 02 §6.3 covers them. For **dev**, keep `inbound.kamehomes.space` during the overlap.
- [ ] **EM-07** Tell the PMO office (Azure North) the new sender and approval address before T0 so their filters don't drop it (Q6).
- [ ] **EM-08** Mailboxes (DM3): create addresses, forward every old `@kamehomes.space` address, test both directions. Set `SUPPORT_TEAM_EMAIL`, `VAPID_SUBJECT` (`mailto:`), `VITE_PLATFORM_CONTACT_EMAIL`.
- [ ] **EM-09** Resend event webhook (bounces → `email_suppressions`) is on `*.supabase.co`; confirm suppressions aren't keyed by sender domain.
- [ ] **EM-10** System Health shows Resend `ok` after EM-05 on dev and prod; update `probeClassifiers_test.ts` fixtures.
- [ ] **EM-11** Follow-up issue: `List-Unsubscribe` + `List-Unsubscribe-Post` on non-transactional mail before marketing volume grows.
- [ ] **EM-12** If any admin, super-admin or owner signs in with an `@kamehomes.space` address, don't change their login email here. Handle per person after T0 via Supabase email change, with both mailboxes working.

### 6.7 Google (operator; full setup in plan 05)

- [ ] **G-01** Add `kamespace.com` to OAuth **Authorized domains**; JS origins `https://kamespace.com` (prod client) and `https://dev.kamespace.com` (dev client). Redirect URIs unchanged. Done together with plan 02 6.2.
- [ ] **G-02** Maps key referrers for the new hosts (plan 05 G-33 owns the full key hardening).
- [ ] **G-03** Search Console: verify `kamespace.com` as a domain property (DNS TXT) and keep `kamehomes.space` verified. After T0: submit `https://kamespace.com/sitemap.xml`, run **Change of Address** (DM9).
- [ ] **G-04** Google Business Profile (if any) website → `https://kamespace.com`.
- [ ] **G-05** Gmail Postmaster Tools for `kamespace.com` (EM-03).

### 6.8 Meta (operator)

- [ ] **MT-01** Developer app: App Domains `kamespace.com`; Site URL; Privacy, Terms and User Data Deletion URLs on `https://kamespace.com/...`. Do it before T0 while the old URLs still work (a legal-URL change can trigger review).
- [ ] **MT-02** OAuth redirect URIs and webhook callback stay on `*.supabase.co`; confirm.
- [ ] **MT-03** `META_OAUTH_ALLOWED_RETURN_ORIGINS`: mt-prod `https://kamespace.com`; dev adds `https://dev.kamespace.com` before the dev move. Test "Connect Facebook page" on dev.
- [ ] **MT-04** Business Manager domain verification for `kamespace.com`.
- [ ] **MT-05** Page and Instagram website/bio links, Messenger greeting and saved replies with URLs.
- [ ] **MT-06** After T0, re-scrape key URLs in the Sharing Debugger.

### 6.9 PayMongo, Turnstile, PostHog, Sentry, Telegram

- [ ] **PM-01** Checkout return URLs follow `PUBLIC_GUEST_APP_ORIGIN`; test a sandbox checkout on dev after the dev move. Webhook stays on `*.supabase.co`.
- [ ] **PM-02** PayMongo account business website → `https://kamespace.com` (KYC field; ask support whether it triggers re-review).
- [ ] **TS-01** Turnstile widget hostnames: add `kamespace.com`, `dev.kamespace.com` in Phase 1. Remove the old dev host after DM6.
- [ ] **PH-01** PostHog Authorized URLs (toolbar, heatmaps) for the new hosts; dashboard filters on `$host`; annotation on T0 and on the dev move.
- [ ] **SN-01** Sentry (if adopted): allowed domains, environment detection via K-07.
- [ ] **TG-01** Telegram webhooks on `*.supabase.co`, no change. BotFather description text with a URL → new host. Stored Telegram templates with links: plan 02 rewrite (prod) / DA-02 (dev).

### 6.10 Data

- [ ] **DA-01** Read-only scan (column scanner pattern from `30-rewrite-storage-urls.sql`): count `kamehomes.space` per `(table, column)` in `public`, plus `cron.job` commands and Vault secret names. Counts only. Run on local, dev, and the plan 02 R3 rehearsal DB.
- [ ] **DA-02** Dev and local: idempotent `scripts/domain/sql/rewrite-app-origin.sql` for config columns only (`org_settings.public_guest_app_origin`, `app_settings` origins, announcement links, host email/Telegram templates by exact host replacement, custom pages, AI knowledge, marketing drafts), with a reverse map in gitignored `backups/domain/<run-id>/`. One `activity_log` event per org touched (actor system), per `audit-logging`.
- [ ] **DA-03** mt-prod: covered by plan 02 stage `rewrite` once K-12 targets `https://kamespace.com`. Add the extra config columns from DA-02 to that stage if the R3 scan shows hits outside its current list.
- [ ] **DA-04** History untouched: sent-email logs, inbox messages, published posts, activity log, AI conversation logs.
- [ ] **DA-05** AI knowledge: after X-01, re-sync and re-embed guides; delete stale chunks.
- [ ] **DA-06** Verify: DA-01 again. Config hits = 0; history counts unchanged.

### 6.11 Marketing, SEO and offline material

- [ ] **MK-01** `marketing/social` `SITE` and captions → `kamespace.com`; re-render in the same pass as plan 03 M-03.
- [ ] **MK-02** Host and team note at T0: new address, sign in again (sessions reset at cutover anyway). Teammates using the dev PWA re-install from `dev.kamespace.com`.
- [ ] **MK-03** Off-app checklist for the owner: QR codes and signage in the unit, house manual PDF, Airbnb/Booking listing text, Google Business Profile, social bios, email signatures, business cards. Old links keep working, so reprinting is optional.
- [ ] **SE-01** `robots.txt` and `sitemap.xml` on `kamespace.com` (origin comes from the request); canonical tags on the new host. Check with `curl` as Googlebot.
- [ ] **SE-02** JSON-LD `url` fields follow the origin; pair with plan 03 W-08.

### 6.12 Docs and agent tooling

- [ ] **X-01** Living docs: `docs/architecture/deployment.md`, `overview.md`, `validation-and-env.md`, `pwa.md`, `docs/PROJECT.md`, `ci-cd-environment-matrix.md`, `multi-tenant-dev-prod-setup.md`, `github-environments-setup.md`, `production-deployment.md`, `dev-staging-environment.md`, the prod env matrix, and route guides that show URLs (via `route-guides`). Historical docs and Lighthouse baselines keep old hosts.
- [ ] **X-02** Agent tooling: `.claude/commands/kh-*`, `.cursor/commands`, `.cursor/rules/project-context.mdc`, `CLAUDE.md` dual-track paragraph, `.opencode`; re-run `bun run setup:ai-tooling`.
- [ ] **X-03** Runbook `docs/archive/operations/domain-move-runbook.md`: every dashboard field with old value, new value, date, who.

### 6.13 Tests

- [ ] **Q-01** Update fixture hosts in the 6 test files from §1.2; keep one test per helper proving the old dev host still behaves during the overlap.
- [ ] **Q-02** New unit tests: host map (K-14), `isPreviewHost` (K-07), Telegram link builder (K-04), default-logo detection (K-05), load-test refusal (K-11).
- [ ] **Q-03** Playwright smoke (mocked): boot on a retired dev host triggers the PW-01 redirect.
- [ ] **Q-04** `bun run ci:quality`, `test:edge`, `test:edge:handlers`, `test:e2e:smoke` green.

---

## 7. Phases and order

**Phase 0: Decisions and inventory (no changes).** Confirm DN-01 (deadline plan 02 T-21d). Answer DM3–DM10 and §13. Export the old zone (DN-03). Record every dashboard field's current value. Exit: decisions recorded here.

**Phase 1: Prod readiness, dual-domain (no visible change).** DN-04 records, V-01/V-02 domains (not on Production yet), EM-02/EM-04 Resend, DM3 mailboxes, G-01/G-03, MT-01/MT-03/MT-04, TS-01, PH-01, SA-02. Start EM-03 warm-up. Exit: all `kamespace.com` hosts resolve with valid TLS; Resend, Search Console and Meta verified; every allow-list has the new hosts.

**Phase 2: Code (K-_, PW-01/02, Q-_).** Lands on `develop` **before plan 02 R3**. Exit: CI green, K-15 grep clean, K-12 re-run on a local restore shows 0 old-origin hits.

**Phase 3: Dev move (Track B).** mt-dev `PUBLIC_GUEST_APP_ORIGIN`, Site URL, `RESEND_*`, Meta return origins; `dev.kamehomes.space` 308 → `dev.kamespace.com` (K-14); K-13 CD target; DA-02 on dev. Run the full §9 matrix on dev. Exit: §9 green on dev, including a dev PWA released by PW-02.

**Phase 4: Cutover day (inside plan 02 T0).** Plan 02's runbook owns the order. This plan adds:

- T-21d: DN-01 confirmed, EM-02 verified, EM-03 warm-up running. If not, plan 02 takes the `app.kamehomes.space` fallback (§7 fallback track).
- T-7d: PMO notice (EM-07); host and team note ready (MK-02).
- T-2d: DN-06 TTLs.
- T0 step 5 (secrets): mt-prod `PUBLIC_GUEST_APP_ORIGIN=https://kamespace.com`, `RESEND_*`, `SUPPORT_TEAM_EMAIL`, `VAPID_SUBJECT`, `META_OAUTH_ALLOWED_RETURN_ORIGINS`; edge functions deployed with K-01/K-02.
- T0 step 7: attach `kamespace.com` to Production; `www`/`app` redirects live.
- T0 step 8: legacy apex + `www` 308 → `https://kamespace.com/*` from the legacy project.
- T0 step 9 smoke adds the **P** rows of §9.
- T+1h: G-03 sitemap + Change of Address; MT-06 re-scrape; PH-01 annotation.

**Phase 5: Hypercare (T0 → T+30d, shared with plan 02 §9).** Daily for 7 days: CORS rejections by origin, Auth redirect failures, Resend bounces/complaints and DMARC reports, inbound approvals, Turnstile failures by hostname, 308 hit counts per old host and path, Search Console coverage.

**Phase 6: Overlap end and legacy project handover (T+30d, before plan 02 §10.2).** V-06: move the old-apex redirect onto `kame-homes`, test, then let plan 02 delete the legacy project. Remove the old dev host from CORS, Auth, Turnstile, Maps, Google, Meta (DM6). DMARC → `quarantine`.

**Phase 7: Long tail.** T+60d: drop `inbound.kamehomes.space` MX if no mail for 60 days. T+90d: DMARC `reject` on `kamespace.com`; `kamehomes.space` `reject` + null SPF. Yearly: review old-domain redirect hits; keep the domain registered (DM4). Move this plan to done after Phase 6, with the long-tail items as dated reminders in the `docs/README.md` backlog.

**Fallback track (only if plan 02 falls back to `app.kamehomes.space`).** Phases 0–3 still run. Phase 4 becomes a standalone prod flip after plan 03 Phase 7: everything in Phase 4 plus a sign-out wave for prod users, PW-01/PW-02 extended to `app.kamehomes.space` (prod then has installed PWAs on the old origin), the old prod host kept in every allow-list for 30 days, and a data rewrite from `app.kamehomes.space` to `kamespace.com` (DA-02 on mt-prod).

---

## 8. Scenarios and edge cases

| Scenario                                                                                | What happens                                                                   | Handling                                                                                   |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Guest opens an SD form link from a legacy email (`kamehomes.space/sd-form?bookingId=…`) | 308 → `kamespace.com/sd-form?bookingId=…` → property resolved from the booking | One hop; §9 row 8                                                                          |
| Legacy email logo or QR (`kamehomes.space/images/...`)                                  | 308 → same path on `kamespace.com`                                             | Keep `/images/*` paths forever (plan 03 K-3)                                               |
| Guest scans a printed QR code in the unit                                               | 308 to `kamespace.com`                                                         | Permanent redirect; reprint optional (MK-03)                                               |
| Legacy Vercel project deleted while the apex still redirects from it                    | Every old link breaks                                                          | V-06 moves the redirect first; plan 02 §10.2 waits for it                                  |
| `kamespace.com` not ready by T-21d                                                      | Cutover would launch on an unverified sender or missing DNS                    | Plan 02 fallback to `app.kamehomes.space`; this plan switches to the fallback track        |
| Day-one booking emails from the new sender land in spam                                 | Guests miss confirmations                                                      | EM-02 by T-21d, EM-03 warm-up, DMARC from day one; check Gmail and Outlook in the T0 smoke |
| PMO filters only trust the old sender                                                   | Approval requests dropped                                                      | EM-07 notice; check the first approval after T0 arrives                                    |
| Load test pointed at `kamespace.com`                                                    | Old guard only knew `app.kamehomes.space`                                      | K-11 before Phase 2 ends                                                                   |
| `isPreviewHost` treats `dev.kamespace.com` as prod (substring match)                    | Dev events and errors pollute prod analytics                                   | K-07 exact hostname rules + test                                                           |
| Teammate's dev PWA on `dev.kamehomes.space`                                             | Old worker would keep serving a cached old build                               | PW-01 one release early + PW-02                                                            |
| Teammate signed in on the old dev host during the dev move                              | Session lives in old-origin storage                                            | Sign in again; old dev host stays in Auth redirect list 30 days for in-flight OAuth        |
| OAuth or magic link started on the old dev host, finished after the move                | PKCE verifier is in old-origin storage                                         | Rare; user retries                                                                         |
| PayMongo checkout opened on dev before the move, paid after                             | Returns to old host → 308                                                      | Plan state comes from the webhook, not the return page                                     |
| Turnstile not updated in time                                                           | OTP sign-in and guest forms fail on the new host                               | TS-01 in Phase 1; §9 checks every Turnstile form on dev                                    |
| `PUBLIC_GUEST_APP_ORIGIN` unset somewhere                                               | Falls back to DB value, then the code default                                  | C-01 sets it explicitly; System Health `envRegistry` flags it                              |
| `www.kamespace.com` or `app.kamespace.com` typed by a user                              | 308 to apex                                                                    | V-02                                                                                       |
| Saved guest trip `.ics` events                                                          | URL inside points at the old host; UID unchanged                               | Redirect covers the URL; UID kept so no duplicates                                         |
| Airbnb/Booking iCal feeds                                                               | On `*.supabase.co/functions/v1/ical-export`                                    | No change; confirm `ChannelSyncCard` shows a supabase.co URL                               |
| Admin login on an `@kamehomes.space` address                                            | Changing it would break access                                                 | EM-12                                                                                      |
| Search ranking during the move                                                          | Temporary dip                                                                  | 308s, canonical, sitemap, Change of Address                                                |
| Someone registers `kamehomes.space` after it lapses                                     | Phishing via every old link                                                    | DM4                                                                                        |
| Brand mismatch between T0 and plan 03 Phase 7 ("Kame Homes" on `kamespace.com`)         | Mild confusion                                                                 | Accepted by owner; plan 03 closes it; plan 05 waits for both                               |

---

## 9. End-to-end verification matrix

Run on `dev.kamespace.com` in Phase 3 (all rows) and on `kamespace.com` at plan 02 T0 (rows marked **P**).

| #    | Flow                                                                                                            | Check                                                                |
| ---- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1 P  | Host Google sign-in                                                                                             | Lands on the new host; `list-organizations` passes CORS              |
| 2 P  | Host email OTP sign-in (Turnstile)                                                                              | Email from the new sender, OTP works, captcha passes                 |
| 3    | Guest portal sign-in (Google + OTP)                                                                             | Returns to the right guest page                                      |
| 4 P  | Guest booking form end to end with uploads                                                                      | Submission stored; confirmation email with new-host links and logo   |
| 5    | Booking through each status with sandbox email                                                                  | Every workflow email's links use the new host                        |
| 6 P  | Approval reply to `approvals+<slug>@inbound.kamespace.com`                                                      | Webhook processes it; booking advances                               |
| 7    | Approval reply to the old dev inbound address                                                                   | Same result during the overlap                                       |
| 8 P  | Legacy links on the old apex: `/sd-form?bookingId=`, `/form`, `/calendar`, `/bookings/<id>`, `/images/logo.png` | One 308 hop, correct final page                                      |
| 9    | Old dev links with query and hash                                                                               | Kept intact                                                          |
| 10   | Team invite email → accept                                                                                      | Link on the new host; accept works                                   |
| 11   | Org verification, billing, super-admin step-up emails                                                           | New-host links, new sender                                           |
| 12   | PayMongo sandbox plan checkout                                                                                  | Returns to the billing tab on the new host; webhook updates the plan |
| 13   | Meta connect page + test post                                                                                   | OAuth returns to the new host; link preview shows it                 |
| 14   | Telegram admin message with a booking link                                                                      | Opens the org/property booking page on the new host (K-04)           |
| 15   | Web push: subscribe, trigger, click                                                                             | Delivered; opens the new-host URL                                    |
| 16   | Dev PWA installed from the old dev host                                                                         | Next open unregisters and lands on the new host; re-install works    |
| 17   | Share links from inbox, stay guide, document share, parking direct link                                         | Copy uses the new host                                               |
| 18 P | `robots.txt` / `sitemap.xml` on `kamespace.com`; `www.` and `app.` redirect                                     | Allow + sitemap on apex; single 308 on the others                    |
| 19   | Crawler HTML for a property page                                                                                | Canonical and OG URLs on the new host                                |
| 20   | Google Maps on property settings, listing and search pages                                                      | Loads (referrer allowed)                                             |
| 21 P | `/admin` System Health                                                                                          | Resend `ok`, env registry shows the new origin, no CORS errors       |
| 22   | PostHog events and replay                                                                                       | New `$host`; dev detected as preview, apex as production             |
| 23   | AI assistant asked for the booking link or website                                                              | Answers with the new host                                            |
| 24 P | Deliverability: Gmail and Outlook                                                                               | Inbox; SPF, DKIM, DMARC pass                                         |
| 25   | 375 / 768 / 1024 px spot check of sign-in and guest form                                                        | Assets and fonts load; no layout change                              |

---

## 10. Rollback

- **Dev move:** set mt-dev secrets, Site URL and Vercel Preview env back; disable K-14 with `RETIRED_HOST_REDIRECTS_ENABLED=false`; both dev hosts stay allow-listed during the overlap. DA-02 reverse map restores data.
- **Cutover day:** owned by plan 02 §8 (rollback = re-attach the legacy apex to legacy, unfreeze). `kamespace.com` simply stops being attached to Production; nothing on it needs reverting.
- **After plan 02 go:** forward-fix. Every `kamespace.com` setting is additive; the old prod host was never live on mt-prod.

---

## 11. Risks

| Risk                                                             | Likelihood      | Impact                                | Mitigation                                          |
| ---------------------------------------------------------------- | --------------- | ------------------------------------- | --------------------------------------------------- |
| `kamespace.com` or Resend verification late                      | Medium          | Cutover delayed or on fallback domain | DN-01 and EM-02 deadlines at T-21d                  |
| New sender domain in spam on day one                             | Medium          | Guests miss booking mail              | Warm-up, DMARC, Postmaster, T0 deliverability check |
| A third-party allow-list forgotten (Turnstile, Auth, Maps, Meta) | Medium          | Sign-in or forms broken               | Phase 1, §9 on dev, plan 02 R3 on the final domain  |
| Plan 02 tooling still targets `app.kamehomes.space`              | High until K-12 | Rewritten URLs point at a dead host   | K-12 before R3                                      |
| Legacy redirect lost when the legacy project is deleted          | Medium          | Every old link breaks                 | V-06 before plan 02 §10.2                           |
| Old domain lapses                                                | Low             | Phishing on guest links               | DM4                                                 |
| Concurrent sessions' uncommitted files on `develop`              | Medium          | Wrong files in the PR                 | Clean worktree branch; never `git add -A`           |

---

## 12. Acceptance criteria

1. Every §9 row passes on dev; every **P** row passes on prod at plan 02 T0.
2. `rg 'kamehomes\.space'` outside the allow-list returns nothing.
3. DA-06: 0 config rows with an old host on dev and mt-prod.
4. Resend shows `kamespace.com` verified; DMARC reports show SPF and DKIM pass for 30 days.
5. Search Console Change of Address accepted.
6. Old-apex redirect served by `kame-homes` before the legacy project is deleted.
7. `kamehomes.space` renewed 2+ years ahead with redirects live.
8. Runbook has old value, new value, date and owner for every dashboard field changed.
9. Docs updated in the same PRs; route guides via `route-guides`; this plan moved to done after Phase 6.

---

## 13. Open questions

1. Is `kamespace.com` registered, and in which registrar account? (Plan 02 Q2 TODO.)
2. Where do human mailboxes live today (`@kamehomes.space`)? Which addresses exist and who reads them?
3. Does mt-dev already have `inbound.kamehomes.space` configured in Resend?
4. Does any admin, owner or super-admin sign in with an `@kamehomes.space` address (EM-12)?
5. Who is the PMO contact at Azure North for the sender change notice?
6. Are there printed QR codes or signage with the old domain in the unit?
7. DM10: register defensive variants?
8. Is Resend click/open tracking on today?

---

## 14. Docs and checklists for each change

- `docs/architecture/deployment.md`, `overview.md`, `docs/PROJECT.md`: host map, env values, redirect behaviour.
- `docs/architecture/validation-and-env.md`, prod env matrix: env values per environment.
- `docs/architecture/pwa.md`: dev retired-host kill switch.
- Route guides (`route-guides`): pages that show or copy URLs (inbox share, stay guide, parking direct link, channel sync).
- `scripts/README.md`: domain rewrite script, host map.
- `CLAUDE.md`, `.cursor/rules/*`, `.claude/README.md`, `.opencode/README.md`: dev and prod hostnames; keep Cursor and Claude copies in sync.
- Plan 02 (`lib.sh` target via K-12, §10.2 waits for V-06) and plan 03 (§13 points here).
- Activity log: DA-02 emits one event per org touched; everything else `activity-log: N/A — DNS/config/allow-list only`.
- Plans and permissions: N/A, no gated feature.
- Mobile: no layout change; §9 row 25 covers the phone check.

Back to [planned index](./README.md).
