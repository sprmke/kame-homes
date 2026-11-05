---
stage: planned
title: 'Google services production hardening (post-launch follow-ups)'
status: planned
tags: [planning, google, maps, gemini, fonts, billing, legacy-cleanup, production-hardening]
updated: 2026-11-03
split_from: kamespace-05-google-services-verification
---

# Google services production hardening

**Split from** [`../done/kamespace-05-google-services-verification.md`](../done/kamespace-05-google-services-verification.md), which closed on 2026-11-03 with sign-in brand verification approved and published.

**Goal.** Close the remaining Google items that were deliberately left out of the launch gate: Maps spend controls, the billing upgrade, Gemini's paid tier, Fonts disclosure, legacy project retirement, and the docs rewrite.

**Not in scope.** Google sign-in, consent branding, scopes, OAuth client config, and Search Console ownership. Those are done and verified. Any change to name, logo, homepage, privacy, terms, or authorized domains would reopen a brand review.

**Why this is not a launch blocker.** Sign-in works for every Google account today. These items affect cost, data terms, privacy accuracy, and cleanup only.

---

## 1. Items

| ID       | Item                                                                             | Why it matters                                                                                                                                                        | Trigger                                             | Effort |
| -------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------ |
| **H-01** | Upgrade the Cloud Billing account to paid                                        | The console shows an expired free trial and asks for an upgrade by **2026-12-03**. Maps and Gemini paid calls stop or fail after that. Sign-in does not need billing. | **Before 2026-12-03** if Maps must keep rendering   | 10 min |
| **H-02** | Confirm Maps key referrer + API restrictions, remove localhost from the prod key | Key is public by design; keep it scoped to `kamespace.com` and the five Maps APIs                                                                                     | Next console session                                | 10 min |
| **H-03** | Maps per-API daily quota caps                                                    | The real ceiling against quota theft                                                                                                                                  | Same session as H-02                                | 10 min |
| **H-04** | Billing budget + alerts                                                          | Email before the bill gets painful; does not stop spend                                                                                                               | Same session as H-01                                | 5 min  |
| **H-05** | Maps ToS review note                                                             | Caching limits for Google-derived coordinates                                                                                                                         | Docs pass                                           | 10 min |
| **H-06** | Gemini paid tier + key restriction                                               | Free tier lets Google use prompts for product improvement; guest PII flows through the model                                                                          | Before AI features are marketed as production-grade | 20 min |
| **H-07** | Self-host Google Fonts or disclose them                                          | Removes a third-party request and a privacy-policy line                                                                                                               | Docs pass                                           | 30 min |
| **H-08** | Sign-in button visual pass + Workspace-admin help answer                         | Compliance and support content; code already uses the official mark and wording                                                                                       | Next auth QA                                        | 30 min |
| **H-09** | System Health probe for the Google provider                                      | Detects a disabled provider before users do                                                                                                                           | Next health-module pass                             | 20 min |
| **H-10** | Retire legacy GCP projects, clients, keys, secrets                               | Old credentials stay valid until deleted                                                                                                                              | After local dev moves off the legacy client         | 1 h    |
| **H-11** | Rewrite `google-services-approval.md` / `google-cloud-console-cleanup.md`        | The runbook section already records current state; the guides still describe the old setup                                                                            | Docs pass                                           | 1 h    |
| **H-12** | Confirm Supabase Auth Google "additional scopes" is empty; optional guard test   | A scope added there would be requested even though the project declares three                                                                                         | Next Supabase session                               | 10 min |

---

## 2. Tasks

### Phase 1: Billing and Maps spend controls

- [x] **H-01** Cloud Billing → confirm the account linked to project `967953419734` is an **active paid account**, not an expired trial. Upgrade if prompted. Record the upgrade date.
  - **Done 2026-11-05:** project `967953419734` is linked to active billing account `018005-834EF9-A2DB34` (`billingEnabled: true`). The closed free-trial account `01B239-2BCD82-EB49F8` is no longer used.
- [x] **H-02** APIs & Services → Credentials → the production Maps key:
  - Application restrictions: HTTP referrers, `https://kamespace.com/*` and `https://www.kamespace.com/*` only. Remove localhost; the dev key keeps it.
  - API restrictions: Maps JavaScript, Places, Geocoding, Maps Embed, Maps Static.
  - **Referrers verified 2026-11-05:** the production key accepts `https://kamespace.com/*` and `https://www.kamespace.com/*`, and rejects localhost and unknown origins.
  - **API targets verified 2026-11-05:** the only key in the project (`Kame Space - Maps - Prod`) is limited to `maps-backend`, `places-backend`, `geocoding-backend`, `maps-embed-backend`, and `static-maps-backend`.
- [x] **H-03** Google Maps Platform → Quotas: set daily caps. Suggested start: JavaScript 2,000 map loads, Places 1,000, Geocoding 500, Embed 1,000, Static 500. Raise after a week of real traffic if needed.
  - **Done 2026-11-05:** daily project caps set to Maps JavaScript 2,000 map loads, Places 1,000, Geocoding 500, Static 500. Current peak is under 40 map loads a day. The Embed API exposes no daily quota metric, so it relies on the budget alert.
- [x] **H-04** Billing → Budgets & alerts: $25/month scoped to `967953419734`, alerts at 50 / 90 / 100%, email to billing admins.
  - **Done 2026-11-05:** budget `9b279d6f-a9f9-40f5-a365-32e66a912b68` on billing account `018005-834EF9-A2DB34`, $25/month scoped to `projects/967953419734`, alerts at 50 / 90 / 100% to billing admins.
- [ ] **H-05** Write the Maps ToS conclusion in `google-services-approval.md`: attribution visible, no Google-derived coordinate caching beyond the limits.
- [x] **H-06** Probe the key from a non-allowed referrer; expect `REQUEST_DENIED`. Confirm maps still render on a property page and the settings picker.
  - **Verified 2026-11-05:** unknown referrers return `REQUEST_DENIED`; the property map renders in light and dark with no development watermark or error dialog; Places Autocomplete and Geocoder return `OK` in the browser.

### Phase 2: Gemini, fonts, support

- [ ] **H-06** Gemini: paid API key, restricted to the Generative Language API, per project, quota tier and budget alert. Track execution in [`ai-paid-provider-and-production-quotas.md`](./ai-paid-provider-and-production-quotas.md).
- [ ] **H-07** Self-host the fonts in `ui/public/fonts` and drop `fonts.googleapis.com` / `fonts.gstatic.com` from the CSP, or add the disclosure to the privacy page. Check the PWA precache budget if self-hosting.
- [ ] **H-08** `GoogleSignInButton` visual check at 375 / 768 / 1024; short Workspace-admin help answer for hosts whose admin blocks third-party apps (`human-copy`).
- [ ] **H-09** Add a System Health probe for the Google provider if the pattern allows it without exposing secrets.
- [ ] **H-12** Supabase → Auth → Providers → Google: **additional scopes** must be empty. Optional guard test that fails if `scopes:` is added to a Google `signInWithOAuth` call without a plan reference.

### Phase 3: Legacy retirement and docs

- [ ] **H-10** Create a dev OAuth client in `967953419734` with localhost callbacks, point `ui/.env.development` at it, then delete the legacy project's clients, service accounts, keys and secrets. Rotate anything that existed in both stacks.
- [ ] **H-10** Shut down or delete projects `351108343134` and `615353244509` once nothing points at them.
- [ ] **H-11** Rewrite the two operations guides for Kame Space, the project map, and current console names; update `docs/architecture/validation-and-env.md` and route guides.

---

## 3. Acceptance criteria

1. Billing is an active paid account with a budget alert, or the team has explicitly accepted that Maps stops after 2026-12-03.
2. Every Maps key is referrer- and API-restricted, with daily caps and a budget alert.
3. Gemini runs on a paid key with a restriction and a budget alert.
4. Fonts are self-hosted or disclosed.
5. Legacy Google projects, clients, keys and secrets are deleted or shut down; local dev uses the new dev client.
6. The two operations guides describe the current setup.

---

## 4. Notes

- Sign-in approval stays valid. Do not change branding, homepage, privacy, terms, or authorized domains without planning for a re-review.
- `fworvijbrwpyngycotbz.supabase.co` cannot be verified in Search Console. If it ever becomes a blocker, the fix is a Supabase custom auth domain (`auth.kamespace.com`), not deleting the redirect.
- Never re-add a `*.vercel.app` host as an authorized domain.

Back to [planned index](./README.md).
