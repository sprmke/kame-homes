---
stage: planned
title: 'Google services verification and production readiness (Sign-in, Maps, Gemini, Search Console)'
status: planned
tags:
  [planning, google, oauth, verification, maps, gemini, privacy, third-party, production-readiness]
updated: 2026-10-25
depends_on: [kamespace-03-rebrand-kame-homes-to-kame-space, kamespace-04-domain-move-kamespace-com]
---

# Google services verification and production readiness

**Series.** Plan 5 of 5 in the Kame Space launch series. Read them in order:

| #   | Plan                                                                                                       | Role                                                         |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 01  | [`kamespace-01-legacy-prod-config-secrets-backup.md`](./kamespace-01-legacy-prod-config-secrets-backup.md) | Back up every legacy env var, secret and dashboard setting   |
| 02  | [`kamespace-02-legacy-prod-to-mt-prod-cutover.md`](./kamespace-02-legacy-prod-to-mt-prod-cutover.md)       | Move legacy data, storage and accounts onto mt-prod          |
| 03  | [`kamespace-03-rebrand-kame-homes-to-kame-space.md`](./kamespace-03-rebrand-kame-homes-to-kame-space.md)   | Rename the product everywhere                                |
| 04  | [`kamespace-04-domain-move-kamespace-com.md`](./kamespace-04-domain-move-kamespace-com.md)                 | Move every hostname, mailbox and allow-list to kamespace.com |
| 05  | **this plan**                                                                                              | Google verification + every Google service production-ready  |

**Goal.** Any person with any Google account (consumer Gmail or Google Workspace), host or guest, on any tenant, can sign in with Google on `kamespace.com` and sees a consent screen that names **Kame Space** with its logo, with no "Google hasn't verified this app" or "Access blocked" screen. Every other Google service we depend on (Maps Platform, Gemini API, Search Console, Fonts) runs on production terms: right project, paid billing where required, restricted keys, quotas, budgets, owners and disclosures.

**Output.** Besides the console work, this plan rewrites the operator guide [`google-services-approval.md`](../../archive/operations/google-services-approval.md) and [`google-cloud-console-cleanup.md`](../../archive/operations/google-cloud-console-cleanup.md) for the new name, domain, accounts and console layout, so the next person can repeat or audit it.

**Status: planned, not started.** The facts below come from read-only checks of the repo. Nothing in Google Cloud has been inspected or changed.

---

## 1. What exists today (verified 2026-10-25)

### 1.1 Docs

| Doc                                                                                                                   | State                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`docs/archive/operations/google-services-approval.md`](../../archive/operations/google-services-approval.md)         | Good base. Says only Sign-in + Maps remain, Sign-in needs light **brand verification** (non-sensitive scopes, no CASA), lists GCP cleanup and Maps key hardening. **Outdated:** product name "Kame Homes", `kamehomes.space` domains and referrers, single project, old console menu names, no Gemini, no dev/prod split, no Supabase-domain consent issue, no Workspace-admin case. |
| [`docs/archive/operations/google-cloud-console-cleanup.md`](../../archive/operations/google-cloud-console-cleanup.md) | Step list to disable Gmail/Calendar/Sheets/Drive. Still valid; needs the project-per-environment model and the legacy project retirement from plan 02 §10.4.                                                                                                                                                                                                                         |
| [`docs/workflow/wont-do/google-oauth-verification.md`](../wont-do/google-oauth-verification.md)                       | Historical: the Gmail/CASA pivot to Resend inbound. Not a guide. Leave as is, add a one-line pointer to this plan.                                                                                                                                                                                                                                                                   |

**Decision:** update the two operations docs in place (paths are linked from other docs), don't start a new guide from scratch.

### 1.2 Google services the code uses

| Service                          | Where                                                                                                                                                                                                                                                                                                                                             | Auth model                                                                          | Needs Google review?                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sign in with Google**          | Supabase Auth `signInWithOAuth({ provider: 'google' })` in `useHostGoogleAuth.ts`, `useGuestAuthActions.ts`, `AcceptInvitePage.tsx`, `OnboardingProfileHeader.tsx` (`prompt: 'select_account'`). Button: `ui/src/components/auth/GoogleSignInButton.tsx`. No `scopes` option is passed, so Supabase asks for the defaults `openid email profile`. | OAuth web client in GCP; `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in Supabase Auth | **Yes: brand verification only** (non-sensitive scopes). No security assessment, no CASA.                                                                 |
| **Maps Platform**                | `useGoogleMapsLoader.ts`, `PropertyLocationPicker.tsx` (Places Autocomplete, Geocoder), `ListingMapView.tsx`, `propertyMapEmbed.ts` (Embed API), `ChatMapLinkCard.tsx` (Static API)                                                                                                                                                               | Browser API key `VITE_GOOGLE_MAPS_API_KEY`                                          | No review. Needs billing, key restrictions, quotas, ToS compliance                                                                                        |
| **Gemini API**                   | `_shared/ai/llmTransport.ts`, `geminiLiveEphemeral.ts` (voice receptionist live session), marketing studio, assistant; `generativelanguage.googleapis.com`                                                                                                                                                                                        | Server API keys `GEMINI_API_KEY(S)`; ephemeral tokens to the browser for Live       | No review. Needs **paid tier** for production data terms (see [`ai-paid-provider-and-production-quotas.md`](./ai-paid-provider-and-production-quotas.md)) |
| **Search Console**               | Ownership of `kamespace.com` (plan 04 G-04); also **required** for OAuth brand verification (authorized domain ownership)                                                                                                                                                                                                                         | DNS TXT                                                                             | Domain verification only                                                                                                                                  |
| **Google Fonts**                 | `fonts.googleapis.com/css2` (CSP allows it)                                                                                                                                                                                                                                                                                                       | None                                                                                | No. Privacy disclosure (visitor IP goes to Google), or self-host                                                                                          |
| **Not Google** (avoid confusion) | iCal channel sync (`calendar-sync-cron`, `ical-export`), PMO approvals (Resend inbound), Telegram, PostHog                                                                                                                                                                                                                                        |                                                                                     |                                                                                                                                                           |
| **Removed** (must stay removed)  | Gmail API listener, Google Calendar, Google Sheets, service account                                                                                                                                                                                                                                                                               | Lived in the **legacy** GCP project                                                 | Their scopes and APIs must not be on the project we submit                                                                                                |

### 1.3 Why users see an "unverified" screen today (to confirm in G-00)

Three different causes produce three different screens. Each has a different fix, so diagnose before changing anything.

| Screen the user sees                                                                | Cause                                                                                                                                                      | Fix                                                                         |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| "Access blocked: <app> has not completed the Google verification process" (403)     | Audience / publishing status is **Testing** and the account isn't a listed test user                                                                       | Publish to **In production** (G-07)                                         |
| "Google hasn't verified this app" with "Advanced → Go to … (unsafe)"                | The project's consent configuration lists or the request asks for **sensitive or restricted scopes** (legacy Gmail, Calendar, Sheets) without verification | Remove those scopes and APIs (G-03); keep only `openid`, `email`, `profile` |
| Plain consent that says "to continue to `<ref>.supabase.co`", no logo, generic name | Brand not verified, and the OAuth redirect host is the Supabase project domain                                                                             | Brand verification (G-08); optionally a Supabase custom auth domain (GV3)   |

---

## 2. Gate and sequencing

- **Prerequisites:** plan 01 B-18 (backup of current GCP settings: projects, clients, consent config, keys, restrictions); plan 02 Phase 1.4/6.2 (prod OAuth client exists for mt-prod).
- **Submit verification only when the final identity is live**, because changing app name, logo or domains after approval triggers re-review:
  - plan 03 Phase 7 done: the app, homepage and legal pages say **Kame Space**.
  - `kamespace.com` serves the prod app: owner-confirmed, it becomes the prod origin at plan 02 T0 (plan 04 Phase 4). Search Console domain property verified and mailboxes live (plan 04 Phase 1).
- **Recommended timing:** submit the day plan 03 Phase 7 is live in prod (the domain is already live since cutover). Brand verification usually takes a few business days. Until then users see the unverified-brand consent described in §1.3, never a block screen, provided Phases 0–1 here ran before cutover.
- **Before cutover:** Phases 0–1 (diagnosis, clean prod project, prod OAuth client) should be done before plan 02 T0, because plan 02 6.2 creates the prod OAuth client. Creating it straight in the clean `kame-space-prod` project avoids a second client swap later.
- Phases 0–1 (diagnosis and cleanup) can start now. They change nothing users see if done in order.

---

## 3. Decisions (recommended; confirm before starting)

| #       | Decision                                           | Recommendation                                                                                                                                                                                                                                                                                                       | Why                                                                                                                                                                                     |
| ------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GV1** | Projects                                           | **One GCP project per environment**: `kame-space-prod` (submitted for verification) and `kame-space-dev`. The **legacy** project (Gmail/Calendar/Sheets, service account) is never submitted; it is retired by plan 02 §10.4.                                                                                        | A clean prod project shows reviewers only what we use. Dev experiments can't add scopes to the verified app.                                                                            |
| **GV2** | Owning account                                     | Projects live under an account on the company domain (Workspace or Cloud Identity on `kamespace.com`, plan 04 DM3), with **two** human owners and billing admins. The same account (or another Owner/Editor) verifies `kamespace.com` in Search Console.                                                             | Google checks that a project Owner/Editor owns the authorized domains. One personal Gmail as sole owner is a lock-out risk.                                                             |
| **GV3** | Supabase custom auth domain (`auth.kamespace.com`) | **Recommended for prod** (paid Supabase add-on). Google then shows "to continue to auth.kamespace.com" instead of a random `supabase.co` ref. Activate it, add the new callback to the OAuth client, keep the `supabase.co` callback too. Webhooks, iCal feeds and cron targets stay on `supabase.co` (plan 04 DM8). | The `supabase.co` host on the consent screen is what makes users think the app is suspicious, even after verification. Confirm the add-on behaviour in Supabase docs at execution time. |
| **GV4** | Scopes                                             | Only `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`. Any future Google feature that needs more (Calendar, Gmail, Drive, Business Profile) gets its own plan with the sensitive/restricted review cost up front.                                                                                    | Keeps verification light and permanent.                                                                                                                                                 |
| **GV5** | Dev project audience                               | `kame-space-dev`: External, **In production**, unverified, non-sensitive scopes only. No logo uploaded (an uploaded logo makes the brand need verification). Name "Kame Space Dev".                                                                                                                                  | Non-sensitive unverified apps sign in without a warning screen; Testing mode would block every teammate not on the list.                                                                |
| **GV6** | Maps keys                                          | **One browser key per environment**, HTTP-referrer restricted to that environment's hosts, API-restricted to the Maps APIs we use. Turn on Static API URL signing if the Static preview stays.                                                                                                                       | A leaked key can't be used elsewhere; dev traffic can't burn prod quota.                                                                                                                |
| **GV7** | Gemini                                             | Paid tier keys in each environment's project, restricted to the Generative Language API, executed by [`ai-paid-provider-and-production-quotas.md`](./ai-paid-provider-and-production-quotas.md). This plan only checks it is done before launch.                                                                     | Free-tier terms allow Google to use prompts for product improvement; guest PII flows through the model.                                                                                 |
| **GV8** | Google Fonts                                       | Self-host the fonts in `ui/public/fonts` (folder already exists) and drop `fonts.googleapis.com` from CSP, **or** disclose it in the Privacy page. Recommend self-host.                                                                                                                                              | Removes a third-party request on every page load and a privacy-policy line.                                                                                                             |

---

## 4. Tasks

Every console change: record old value, new value, date and who in the runbook table (X-03). Prod changes are dashboard work, not deploys, but still announce them in the same message as **`kamewave`** when they touch the prod project or prod Supabase.

### Phase 0: Diagnose (read-only)

- [ ] **G-00** For **every** GCP project that holds a Google OAuth client used by any environment (legacy `zftt…`, mt-dev `fwor…`, mt-prod): record project id, owning account, owners, billing account, Google Auth Platform **Audience** (Internal/External, Testing/In production, test users), **Data access** scopes, **Branding** fields, verification status, OAuth clients (type, JS origins, redirect URIs, last used), API keys (restrictions), enabled APIs with 30-day traffic. Reproduce the screen a fresh consumer Gmail sees on dev and prod and match it to §1.3. Output: a table in the runbook.
- [ ] **G-01** Confirm which `GOOGLE_CLIENT_ID` each Supabase project uses (dashboard → Auth → Providers → Google; never print the secret). Confirm local `supabase/.env.local` points at the **dev** client.
- [ ] **G-02** Answer GV1–GV8 and §8 questions.

### Phase 1: Project structure and cleanup

- [ ] **G-03** In the project we will submit: remove every Gmail, Calendar, Sheets and Drive scope from **Data access**; delete the old "Connect Google" OAuth client (callback `…/functions/v1/google-mail-oauth-callback`); disable Gmail, Calendar, Sheets, Drive APIs after 7 days of zero traffic ([`google-cloud-console-cleanup.md`](../../archive/operations/google-cloud-console-cleanup.md) steps 1–2).
- [ ] **G-04** If prod currently shares the legacy project: create `kame-space-prod` (GV1), link billing, add the two owners (GV2), set **Essential Contacts** (security, legal, billing) to monitored mailboxes, create a new Web OAuth client, then swap Supabase mt-prod's Google provider to it. Google `sub` is per Google account, not per client, so existing Supabase identities still match (plan 02 D3). Test sign-in with an existing account before removing the old client.
- [ ] **G-05** Same for `kame-space-dev` (GV5).
- [ ] **G-06** OAuth web client (per environment):
  - Authorized JavaScript origins: the environment's app hosts (prod `https://kamespace.com` only, since the old apex just redirects; dev `https://dev.kamespace.com` and, during the plan 04 DM6 overlap, the old dev host; local only on the dev client: `http://localhost:5173`, `http://127.0.0.1:5173`).
  - Redirect URIs: `https://<ref>.supabase.co/auth/v1/callback`; plus `https://auth.kamespace.com/auth/v1/callback` if GV3; dev client also `http://127.0.0.1:54321/auth/v1/callback` and `http://localhost:54321/auth/v1/callback` (matches `supabase/config.toml`).
  - No localhost entries on the prod client.
- [ ] **G-07** Audience: External, **In production** for prod and dev. Remove stale test users.

### Phase 2: Prerequisites from plans 03 and 04 (check, don't redo)

- [ ] **G-10** Homepage `https://kamespace.com/` (or the URL entered in Branding) is public, not a login wall, shows the name **Kame Space** exactly as on the consent screen, explains what the app does, and links Privacy and Terms. Check as a logged-out visitor and as Googlebot (crawler HTML from `ui/middleware.ts`).
- [ ] **G-11** Privacy policy on the **same domain** (`/privacy`): states that Google Sign-In gives us name, email and profile picture, used only to create and secure the account; not sold, not used for ads; how to delete the account and data; that we do not access Gmail, Calendar or Drive. Also lists Google Maps, Gemini (already mentions the voice receptionist) and, unless GV8 self-hosts, Google Fonts. Use `human-copy`; legal review if plan 03 R3 changed the operator entity.
- [ ] **G-12** Terms page on the same domain. Account deletion path works and is described (Google asks for it in reviews).
- [ ] **G-13** `kamespace.com` verified in Search Console as a **domain property** by a project Owner/Editor account (plan 04 G-04). If GV3, `auth.kamespace.com` is covered by the domain property.
- [ ] **G-14** Support mailbox (`support@kamespace.com` or the DM3 choice) receives mail; developer contact mailbox too.
- [ ] **G-15** Logo: square, 120×120 px, PNG or JPG, under 1 MB, the final Kame Space mark (plan 03 W-05), no Google marks.

### Phase 3: Branding configuration (prod project)

- [ ] **G-20** Google Auth Platform → **Branding**: app name `Kame Space`, user support email, logo, homepage, privacy and terms URLs, authorized domains `kamespace.com` (on the dev project keep `kamehomes.space` only while the old dev host is still a JS origin), developer contact emails.
- [ ] **G-21** **Data access**: exactly the three non-sensitive scopes (GV4).
- [ ] **G-22** GV3 if approved: activate the Supabase custom domain on mt-prod, add the callback (G-06), test sign-in on dev-equivalent first if the add-on allows it, otherwise in a quiet window with the old callback still registered.

### Phase 4: App and code checks

- [ ] **G-30** Confirm no code path requests extra scopes: grep `signInWithOAuth` callers for `scopes`, check Supabase Auth Google provider "additional scopes" is empty on both projects. Add a unit test or lint check that fails if `scopes:` is added to a Google `signInWithOAuth` call without a plan reference.
- [ ] **G-31** `GoogleSignInButton.tsx` follows Google's Sign-in branding guidelines (official "G" mark, "Sign in with Google" / "Continue with Google" wording, colours, padding, no custom icon). Check `/for-hosts/login`, guest sign-in, invite accept, onboarding switch-account at 375 / 768 / 1024 px (`mobile-responsive`).
- [ ] **G-32** Workspace users: add a short Help & Support answer for hosts whose company Google Workspace blocks third-party apps (their admin must allow the Kame Space client ID under Admin console → Security → API controls). Keep copy short (`human-copy`).
- [ ] **G-33** Maps keys (GV6): per-environment keys; referrers for the environment's hosts only (prod key: `https://kamespace.com/*` only; dev key: both dev hosts during the overlap, `http://localhost:5173/*` on dev only); API restrictions to Maps JavaScript, Places, Geocoding, Maps Embed, Maps Static (drop Static if `ChatMapLinkCard` previews are removed); Static URL signing secret if kept; per-API daily quota caps; budget alert on the billing account. Update `VITE_GOOGLE_MAPS_API_KEY` per Vercel environment and redeploy.
- [ ] **G-34** Maps ToS review: keep Google attribution visible on every map; check what `PropertyLocationPicker` stores (place id vs lat/lng from Geocoder). Maps terms limit caching of Google-derived coordinates; host-placed pins are the host's own data. Document the conclusion in `google-services-approval.md`; open an issue if a change is needed.
- [ ] **G-35** Gemini (GV7): confirm paid tier, key restriction to the Generative Language API, per-environment project, quota tier and budget alert; Live voice uses ephemeral tokens only (no long-lived key in the browser). Track execution in the AI plan; tick here when done.
- [ ] **G-36** Fonts (GV8): self-host and remove `fonts.googleapis.com` / `fonts.gstatic.com` from `ui/vercel.json` CSP, or add the disclosure in G-11. Check the PWA precache budget after adding font files.
- [ ] **G-37** System Health: `uiEnvRegistry.ts` / `envRegistry.ts` already list `VITE_GOOGLE_MAPS_API_KEY`; add a check that the Google provider is enabled on the Supabase project, if the probe pattern allows it without exposing secrets.

### Phase 5: Submit and respond

- [ ] **G-40** Google Auth Platform → **Verification Center** → submit brand verification for `kame-space-prod`. No demo video or scope justification is needed for non-sensitive scopes; if the form asks, describe Sign-in use in two sentences.
- [ ] **G-41** Watch the developer contact mailbox daily. Reply to Google's Trust and Safety emails on the **same thread**. Common asks: homepage doesn't match app name, privacy policy missing Google data use, domain not owned by a project owner, homepage behind login. Fix and reply; don't resubmit a new request.
- [ ] **G-42** Don't change name, logo, domains or scopes while the review is open.

### Phase 6: Verify end to end

- [ ] **G-50** With **fresh** accounts, in incognito, on desktop and phone: consumer Gmail (host sign-in, guest sign-in, invite accept), Google Workspace account (default policy), an account that previously signed in (no duplicate user; same `auth.users.id`). Expected: consent shows Kame Space + logo, no warning, lands on the right page.
- [ ] **G-51** Dev project: sign-in works without a warning screen for a non-test-user account (GV5).
- [ ] **G-52** Maps on property settings picker, listing map, property embed and chat preview on prod and dev; a request from a non-allowed referrer is refused (curl with a fake `Referer`).
- [ ] **G-53** Gemini assistant, marketing studio and voice receptionist work on paid keys; billing shows usage on the right project.
- [ ] **G-54** Check the Privacy page for every Google service in §1.2 that still applies.

### Phase 7: Keep it production-ready

- [ ] **G-60** Change rule (add to `.cursor/rules/integrations` docs and `google-services-approval.md`): changing app name, logo, homepage, authorized domains or adding any scope means re-verification. Adding a sensitive scope needs a demo video and justification; a restricted scope (Gmail read, Drive full) needs a CASA security assessment and yearly re-assessment.
- [ ] **G-61** Budgets and alerts on the billing account for Maps and Gemini; quota caps per API; monthly cost review on the super-admin cost dashboard ([`super-admin-service-cost-monitoring.md`](./super-admin-service-cost-monitoring.md)).
- [ ] **G-62** Rotation: OAuth client secret and API keys rotated per [`secret-rotation.md`](../../archive/operations/secret-rotation.md); note that Google can disable OAuth clients left unused for a long period, so keep the dev client in use or recreate it when needed.
- [ ] **G-63** Twice-yearly review: owners still correct, Essential Contacts still monitored, no unused APIs enabled, no unrestricted keys (Cloud Console API key list), consent branding still matches the live homepage.
- [ ] **G-64** Legacy project: after plan 02 §10.4, delete the legacy OAuth clients, service account keys and the project itself (or keep it shut down and empty).

### Phase 8: Docs

- [ ] **X-01** Rewrite [`google-services-approval.md`](../../archive/operations/google-services-approval.md): Kame Space name, `kamespace.com`, project-per-environment table, current console menu names (Google Auth Platform: Branding, Audience, Data access, Clients, Verification Center), §1.3 diagnosis table, Gemini and Fonts rows, GV3 custom auth domain, Workspace admin note, change rule (G-60). Verify console names against Google's docs at execution time; they change often.
- [ ] **X-02** Update [`google-cloud-console-cleanup.md`](../../archive/operations/google-cloud-console-cleanup.md) for the project split and legacy retirement.
- [ ] **X-03** Runbook table: every console field changed (old, new, date, who) inside the approval doc or `docs/archive/operations/domain-move-runbook.md` from plan 04.
- [ ] **X-04** `docs/architecture/validation-and-env.md`: `GOOGLE_CLIENT_*` per environment, Maps key per environment, Static signing secret if added.
- [ ] **X-05** Route guides (`route-guides`): `auth.md` (Google sign-in behaviour, Workspace note), privacy/terms page guides if they exist, property settings (map picker key note).
- [ ] **X-06** One-line pointer at the top of [`google-oauth-verification.md`](../wont-do/google-oauth-verification.md) to this plan.
- [ ] **X-07** Production readiness: tick the Google rows in [`OPERATOR-ACTIONS.md`](../in-progress/production-readiness/operator/OPERATOR-ACTIONS.md) and the cloud checklist (`checklist/25-cloud-computing.md`).

---

## 5. Scenarios and edge cases

| Scenario                                                                       | Risk                                                                    | Handling                                                                                                   |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Prod OAuth client still lives in the legacy project with Gmail/Calendar scopes | Review asks for scope justification or CASA; users keep seeing warnings | G-03/G-04: new clean project or full scope removal before submission                                       |
| Swapping the OAuth client on mt-prod                                           | Existing users can't sign in or get duplicate accounts                  | Google `sub` is account-level; test with an existing account first (G-04); keep old client until confirmed |
| App name or logo changes after approval (late rebrand tweak)                   | Re-review, and a window where the consent shows the old brand           | §2 gate: submit only after plan 03 Phase 7; G-42                                                           |
| Prod still on the `app.kamehomes.space` fallback (plan 02 Q2) at submit time   | Authorized domain / homepage mismatch                                   | Don't submit until prod serves `kamespace.com`; homepage URL on the new domain from day one                |
| Homepage renders differently to Googlebot (crawler HTML) than to people        | Reviewer sees wrong name or no privacy link                             | G-10 checks both                                                                                           |
| Privacy page is a client-rendered SPA route                                    | Reviewer tools may see an empty page                                    | Confirm `ui/middleware.ts` serves meaningful HTML for `/privacy` and `/terms` to crawlers; fix if not      |
| Host's company Workspace blocks unconfigured third-party apps                  | "Access blocked by admin" for that host                                 | G-32 help answer; not something verification can fix                                                       |
| User signed up with email OTP, later uses Google with the same email           | Duplicate or linked identity                                            | Existing Supabase linking behaviour; include in G-50 with one account                                      |
| Dev client left in Testing                                                     | Teammates blocked                                                       | GV5: In production, unverified, no logo                                                                    |
| Someone uploads a logo to the dev project                                      | Dev brand now needs verification; warnings on dev                       | GV5; note in the guide                                                                                     |
| Future feature asks for Calendar or Gmail                                      | Sensitive/restricted review, months and CASA cost                       | GV4 and G-60: separate plan, decide before coding                                                          |
| Supabase custom domain activation misconfigured                                | Sign-in broken for everyone                                             | GV3: keep both callbacks registered; test in a quiet window; rollback = deactivate custom domain           |
| Maps key leaked from the browser bundle (it always is public)                  | Quota theft, bill                                                       | Referrer + API restrictions + quota caps + budget alerts (G-33, G-61)                                      |
| Dev Maps key referrers updated without the old dev host                        | Maps break on the old dev host during overlap                           | G-33 keeps the old dev host until plan 04 Phase 6                                                          |
| Gemini still on free keys at launch                                            | Data terms, 429 cascades                                                | G-35 blocks launch sign-off                                                                                |
| Essential Contacts or owner mailbox unmonitored                                | Missed Google policy or suspension notices                              | GV2, G-04, G-63                                                                                            |
| Google requests more information and no one replies                            | Request closes; restart                                                 | G-41 daily watch, named owner                                                                              |

---

## 6. Acceptance criteria

1. Fresh consumer Gmail and Workspace accounts sign in on prod with a consent screen showing **Kame Space** and its logo, no warning or block screen (G-50), on desktop and phone.
2. Prod project shows **Verified** branding in the Verification Center; Data access lists only `openid`, `email`, `profile`.
3. No Gmail, Calendar, Sheets or Drive API is enabled on any active project; legacy project retired or scheduled per plan 02.
4. Every Maps and Gemini key is restricted, per environment, with quota caps and budget alerts; Gemini is on the paid tier.
5. Privacy page lists every Google service in use; Terms and account deletion path are live on `kamespace.com`.
6. `google-services-approval.md` and `google-cloud-console-cleanup.md` describe the current setup; runbook table complete; route guides updated.

---

## 7. Risks

| Risk                                                 | Likelihood | Impact                         | Mitigation                                                           |
| ---------------------------------------------------- | ---------- | ------------------------------ | -------------------------------------------------------------------- |
| Review delayed by a homepage or privacy policy issue | Medium     | Warning screen stays longer    | Phase 2 checklist before submit; G-41 fast reply                     |
| OAuth client swap breaks sign-in                     | Low        | Nobody can sign in with Google | Test with existing account; keep old client; OTP sign-in still works |
| Console UI or policy changed since this plan         | High       | Steps don't match screens      | X-01 verifies against Google docs at execution                       |
| Single owner loses account access                    | Low        | Can't manage OAuth or billing  | Two owners (GV2)                                                     |
| Surprise Maps or Gemini bill                         | Medium     | Cost                           | Quotas, budgets, restricted keys                                     |

---

## 8. Open questions

1. Which Google account owns each GCP project today, and is prod's OAuth client in the legacy project?
2. Is there (or will there be) a Google Workspace / Cloud Identity on `kamespace.com` to own the projects (GV2)?
3. GV3: approve the Supabase custom domain add-on for prod?
4. GV8: self-host fonts or disclose?
5. Is Maps Static preview in chat worth keeping (needs signing and its own quota)?
6. Who watches the developer contact mailbox during the review?

---

## 9. Docs and checklists for each change

- `documentation-maintenance` + `route-guides` for X-01…X-07.
- `mobile-responsive` for G-31 and G-32 (sign-in surfaces).
- `human-copy` for Privacy, Terms and the Workspace help answer.
- Activity log: `activity-log: N/A — console/config and copy only`.
- Plans and permissions: N/A, no gated feature.

Back to [planned index](./README.md).
