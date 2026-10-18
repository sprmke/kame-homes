---
stage: in-progress
title: 'CAPTCHA & Anti-Spam Hardening — bot defense across auth + public write surfaces'
status: active
tags: [planning, planned-modules, security, anti-spam, captcha, auth, edge-functions]
updated: 2026-09-02
origin_stage: for-testing
readiness: unverified
launch_gate: B
launch_blocker: tbd
last_verified: none
---

# CAPTCHA & Anti-Spam Hardening

Add a defense-in-depth anti-abuse layer across every spammable surface: **Cloudflare Turnstile** (invisible/managed) on the Supabase Auth email-OTP front door and on every unauthenticated write endpoint, plus a **durable DB-backed rate limiter** (replacing the in-memory best-effort one), lightweight **bot heuristics** (honeypot + min-fill-time), and rate limits on the authenticated-but-abusable dashboard endpoints (team invite/resend, guest chat, asset uploads). Env-flag gated for safe rollout; effectively zero friction for real users.

## Progress (2026-09-02)

| Phase                                                                                                                                                                                                                                                                                                                                    | Status     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Foundation (`_shared/botHeuristics.ts` · `captcha.ts` · `rateLimit.ts` · `antiSpam.ts`, `request_rate_limits` migration `20261304120000`, `config.toml` `[auth.captcha]`, env examples, `ui/src/components/security/*` + `ui/src/lib/security/*`)                                                                                    | ✅ shipped | `[auth.captcha] enabled = false` in committed config (protects teammates' local dev); enable per `auth.md` / `validation-and-env.md`.                                                                                                                                                                                                                                                                                                                    |
| 2 — Auth front door (`useGuestAuthActions.sendEmailOtp(email, captchaToken?)`, `AuthPageContent`, `GuestAuthModal`)                                                                                                                                                                                                                      | ✅ shipped | Widget kept **mounted on both the email and OTP steps** so **Resend** (which runs on the OTP step) still has a fresh single-use token — a self-review fix; a step-gated widget silently broke Resend under enforcement.                                                                                                                                                                                                                                  |
| 3 — Anon writes (`submit-form`, `submit-form-completion`, `submit-sd-form`, `submit-guest-review`, `claim-sd-voucher`, `submit-pay-parking` + `useAntiSpamSubmit` in `GuestForm`, `SdFormPage`, `SdFormReviewSection`, `GuestReviewPage`; `sd-form/lib/api.ts` + `pay-parking/lib/api.ts` gain `antiSpam` args)                          | ✅ shipped | `submit-pay-parking` has no live UI caller (page redirects to marketplace) — endpoint hardened for defense-in-depth only.                                                                                                                                                                                                                                                                                                                                |
| 4 — Rate limit only: `submit-parking-booking-request` (+ honeypot in `ParkingRegistrationForm`), `submit-support-ticket` (+ honeypot in `TicketComposeForm`), `guest-web-chat-{start,resume,messages}`, `upload-{guest-profile,guest-chat,inbox-chat,support-ticket}-asset`, `{org,property,parking}-team-invitations` (invite + resend) | ✅ shipped | Via `rateLimitGate()` / `antiSpamGate({ captcha:false })`. Client honeypot wired for the two real user-facing forms (ticket + parking) in the self-review; web-chat/upload/team-invite endpoints are pure server rate limit (no meaningful form to decoy). Friendly 429 copy via existing error toasts + `antiSpamResponse.ts` where wired.                                                                                                              |
| 5 — UX/a11y/resilience                                                                                                                                                                                                                                                                                                                   | ✅ shipped | Invisible-first, degrades to nothing on blocked script, `role="status"` announce on interactive challenge, single-use token reset after every attempt. Responsive: widget is `size="flexible"` (min ~300px) inside centered flex/`space-y` columns on every host — fits the 375px guest form column (~343px), no fixed widths, honeypot is `position:absolute` clipped → no horizontal overflow at 375/768/1024.                                         |
| 6 — Docs & tests                                                                                                                                                                                                                                                                                                                         | ✅ shipped | `PROJECT.md`, `validation-and-env.md`, `edge-functions.md`, `supabase-edge-functions.mdc`, route guides (`form.md`, `sd-form.md`, `bookings/parking.md`, `auth.md`) updated. **Deno tests run green — 29/29 pass** (`bun run test:edge` → 108/108 with the pre-existing `_shared` suite). `--no-check` needed because the repo's edge tree has pre-existing dayjs `.d.ts` type noise (unrelated, not CI-gated); the four new modules `deno check` clean. |

**Self-review fixes (2026-09-02):** (a) auth Turnstile widget kept mounted across both steps so **Resend** keeps a valid token; (b) `CAPTCHA_MODE=monitor` now logs **every** outcome (pass + would-be-block) to PostHog from inside `verifyCaptchaToken` — previously only the dead `assertCaptcha` path logged; (c) removed the unused throwing helpers `assertCaptcha` / `assertWithinRateLimit` — a thrown `Response` loses the `captchaFailed` / `rateLimited` flags through `handleEdgeError`, so `antiSpamGate()` / `rateLimitGate()` (which **return** the `Response`) are the only sanctioned entry points; (d) client honeypot added to `TicketComposeForm` + `ParkingRegistrationForm`.

**Known interaction:** the min-fill-time heuristic (`DEFAULT_MIN_ELAPSED_MS = 1500` in `_shared/botHeuristics.ts`) rejects a public-form POST that arrives <1.5 s after the form mounted. Multi-step guest flows take far longer, but if a Playwright guest-form spec ever fills + submits in under 1.5 s it will get the vague "Your submission could not be processed" 400 — slow the fill or raise the floor.

**Remaining — ops only (no code):** provision a real Cloudflare Turnstile widget pair per environment and set `TURNSTILE_SECRET_KEY` (edge) + `VITE_TURNSTILE_SITE_KEY` (UI), then flip `[auth.captcha] enabled = true` locally / enable Attack Protection on hosted. Everything is inert and safe until then. A live pass/fail-key walk of the Verification checklist below is the sign-off QA step once keys exist.

## Context

Every abusable surface in GFM is currently unprotected or only best-effort protected:

- **Auth front door has no bot defense.** Host _and_ guest share one Supabase Auth identity (`ui/src/lib/supabase/client.ts`), passwordless, via `supabase.auth.signInWithOtp({ shouldCreateUser: true })` in `ui/src/features/guest/auth/hooks/useGuestAuthActions.ts`. `supabase/config.toml` `[auth]` has no `[auth.captcha]` and no rate-limit block. Anyone can script unlimited OTP emails to arbitrary addresses (email bombing, user enumeration, auth-email cost) and mint unlimited guest JWTs.
- **A guest JWT is the only gate for the entire `serveAuthenticated` tier** (`_shared/serveEdge.ts`) — support tickets, guest web chat (Resend + Telegram fan-out), parking booking requests, asset uploads. So the cheap self-service identity _is_ the anti-spam boundary, and it has no bot check.
- **Truly public write endpoints have no durable protection.** `submit-form` (anon; inserts a row, uploads files, sends a Resend email + **3 Telegram messages**), `submit-sd-form` (anon; drives a workflow transition + emails), `submit-guest-review`, `submit-form-completion`, `claim-sd-voucher`, `submit-pay-parking`. Only `_shared/publicRateLimit.ts` exists — an in-memory per-IP counter that resets on every cold start and is not shared across isolates. Its own docstring says "prefer platform WAF for prod hardening."
- **No CAPTCHA, honeypot, or bot heuristic exists anywhere** (repo-wide grep confirms zero hits). A prior planned doc (`guest-trust-safety-reporting.md`) deliberately skipped CAPTCHA _for that feature only_ because it is 100% authenticated — that reasoning does not extend to the anon and self-service-auth surfaces here.

**Intended outcome:** a production-ready anti-abuse layer — CAPTCHA on the auth front door and on unauthenticated write endpoints, plus durable (DB-backed) rate limiting and lightweight bot heuristics everywhere else — env-flag gated for safe rollout, with an invisible/managed challenge that only steps up to an interactive check on suspicion.

## Decisions (confirmed 2026-09-02)

- **Provider:** Cloudflare Turnstile. Free/unlimited, privacy-friendly, natively supported by Supabase Auth (`provider = "turnstile"`, `captchaToken` present in `node_modules/@supabase/auth-js`), good dark-mode theming. hCaptcha (more puzzle friction) and reCAPTCHA v3 (not Supabase-Auth-native, Google tracking) rejected.
- **UX posture:** Invisible-first / managed (`appearance="interaction-only"`). Real users almost never see a widget; it only escalates on a suspicious score.
- **Scope:** Full defense-in-depth — CAPTCHA + durable rate limiter + honeypot/timing heuristics + dashboard/team-invite rate limits.

Ops prerequisite: a free Cloudflare account to create a Turnstile widget → **site key** (public, `VITE_TURNSTILE_SITE_KEY`) + **secret key** (server, `TURNSTILE_SECRET_KEY`), one pair per environment. Cloudflare ships test keys that always pass (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`) or always fail (`2x00000000000000000000AB` / `2x0000000000000000000000000000000AA`) for local/CI.

## Non-goals

- Google OAuth sign-in (Google runs its own bot defense).
- Signed webhooks (`paymongo-webhook`, `approval-email-webhook`, `meta-inbox-webhook`) and `serveCronPost` secret-gated jobs — already cryptographically gated.
- Full WAF / IP-reputation / disposable-email blocking (can layer later at the CDN).
- Read-only public scraping endpoints beyond applying the shared rate limiter.

## Approach — layered

| Layer                    | Mechanism                                                                                                                                               | Where                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Invisible heuristics  | Honeypot field + min-time-to-submit, checked server-side                                                                                                | Every public form + its edge handler                                                                                                          |
| 1. CAPTCHA — auth        | Supabase native Turnstile on `signInWithOtp`                                                                                                            | `config.toml` + `useGuestAuthActions` + 2 auth UI components                                                                                  |
| 2. CAPTCHA — anon writes | `captchaToken` in request body, verified via new `_shared/captcha.ts` (`siteverify`)                                                                    | `submit-form`, `submit-sd-form`, `submit-guest-review`, `submit-form-completion`, `claim-sd-voucher`, `submit-pay-parking` + their UI callers |
| 3. Durable rate limit    | New `_shared/rateLimit.ts` + `request_rate_limits` table (service-role only), keyed by `{scope, identity}` where identity = auth user id else client IP | Layer-2 endpoints, `submit-parking-booking-request`, `guest-web-chat-*`, `submit-support-ticket`, team-invite endpoints                       |
| 4. Retro-fit             | Swap `checkIpRateLimit` call sites to the durable limiter; keep the in-memory one as an L1 fast-path                                                    | `submit-form`, `get-form`, `get-booked-dates`, `get-public-parking`, `search-suggestions`                                                     |

The `serveAuthenticated` endpoints already sit behind the (now bot-checked) auth wall, so a second visible challenge there is redundant friction — they get durable rate limiting + heuristics instead. Only the auth front door and genuinely anonymous write endpoints require a CAPTCHA token.

## Implementation

### Phase 1 — Foundation (shared infra, no behavior change yet)

**Server**

- `supabase/functions/_shared/captcha.ts` (new) — `verifyCaptchaToken(token, remoteIp?): Promise<{ ok, reason? }>`. POSTs to `https://challenges.cloudflare.com/turnstile/v0/siteverify` with `secret` (`Deno.env.get('TURNSTILE_SECRET_KEY')`) + `response` + optional `remoteip`. Fails **open** with a logged `capturePostHogException` when the secret is unset (local/preview) — but fails **closed** in prod (`DENO_DEPLOYMENT_ID` set). Small in-memory LRU of seen tokens to reject intra-isolate replay. Export `assertCaptcha(req, body, scope)` that reads `body.captchaToken` / `formData.get('captchaToken')`, verifies, throws a `Response` 400 `{ success:false, error:'Human verification failed. Please retry.', captchaFailed:true }` on failure.
- `supabase/functions/_shared/rateLimit.ts` (new) — `assertWithinRateLimit({ scope, identity, limit, windowSec })`. Upsert-and-count against `request_rate_limits` via `createServiceClient()` (mirror `assertSettingsVerificationRateLimit` in `_shared/settingsVerification.ts`). Throws a `Response` 429 `{ success:false, error, retryAfterSec }` + `Retry-After` header. `identityFromRequest(req, user?)` = `user?.id ?? clientIpFromRequest(req)` (reuse `clientIpFromRequest` from `_shared/publicRateLimit.ts`). Opportunistic TTL sweep (~2% of calls) like `_shared/idempotency.ts`.
- `supabase/functions/_shared/botHeuristics.ts` (new) — `checkHoneypot(body)` (named decoy field must be empty) + `checkMinElapsed(body, minMs)` (client stamps `formRenderedAt`; reject sub-second submits). Pure, no IO. Returns `{ ok, reason }`.
- `supabase/migrations/<next-ts>_request_rate_limits.sql` (new) — follow `settings_verification_challenges` / `request_idempotency` conventions: `request_rate_limits (id uuid pk default gen_random_uuid(), scope text not null, identity text not null, window_start timestamptz not null, count int not null default 1, created_at timestamptz default now())`, unique `(scope, identity, window_start)`, index on `(scope, identity, window_start desc)` and on `window_start`. `ENABLE ROW LEVEL SECURITY`, **no policies**, `GRANT ALL ... TO service_role`. Leading comment block linking this plan.

**Config / env**

- `supabase/config.toml` — add:
  ```toml
  [auth.captcha]
  enabled = true
  provider = "turnstile"
  secret = "env(TURNSTILE_SECRET_KEY)"
  ```
  Confirm CLI 2.100.0 accepts `[auth.captcha]`; if not, configure via hosted dashboard Auth settings and document it.
- `supabase/.env.example` — new `# Anti-spam` section: `TURNSTILE_SECRET_KEY=` (+ local test-secret comment).
- `ui/.env.example` (+ the `.env.*.example` variants) — `VITE_TURNSTILE_SITE_KEY=` (+ local test-site-key comment).
- `ui/src/vite-env.d.ts` — declare `VITE_TURNSTILE_SITE_KEY`.

**Client widget**

- `ui/src/components/security/TurnstileWidget.tsx` (new) — thin wrapper. Lazy-inject `https://challenges.cloudflare.com/turnstile/v0/api.js` once (module singleton loader, mirror `ui/src/components/auth/GoogleSignInButton.tsx`). Props: `onVerify(token)`, `onExpire`, `onError`, `action`. Reads `useTheme().resolvedTheme` → `theme`; `size="flexible"`, `appearance="interaction-only"`. Renders nothing visible until challenged; reserves layout space only then. If `VITE_TURNSTILE_SITE_KEY` unset → render nothing, immediately `onVerify('')`. Imperative `reset()` via ref.
- `ui/src/lib/security/useCaptchaToken.ts` (new) — hook `{ token, widget, reset, ready }`; form `await`s a fresh token at submit time and drops `<widget/>` anywhere.

### Phase 2 — Auth front door

- `ui/src/features/guest/auth/hooks/useGuestAuthActions.ts` — `sendEmailOtp(email, captchaToken?)` → pass `options.captchaToken`. `verifyEmailOtp` + Google unchanged.
- `ui/src/features/guest/auth/hooks/useHostGoogleAuth.ts` — thread `captchaToken` through its re-exported `sendEmailOtp`.
- `ui/src/features/guest/auth/components/AuthPageContent.tsx` + `ui/src/features/guest/auth/components/GuestAuthModal.tsx` — mount `<TurnstileWidget>` on the **email step only**, directly under the email `<Input>`, above `Continue`. Block `handleContinueEmail` / `handleResend` until a token exists (button stays enabled; if clicked pre-token, show inline "Verifying you're human…" and retry on resolve). On a captcha-shaped `sendEmailOtp` error, `reset()` the widget + surface the existing inline error style. Keep the 30s resend cooldown; each resend needs a fresh single-use token.

### Phase 3 — Anonymous write endpoints

For `submit-form`, `submit-sd-form`, `submit-guest-review`, `submit-form-completion`, `claim-sd-voucher`, `submit-pay-parking`:

- **Server** (`supabase/functions/<fn>/index.ts`): after the method check — `await assertCaptcha(req, body, '<fn>')`, then `await assertWithinRateLimit({ scope:'<fn>', identity: identityFromRequest(req), limit, windowSec })`, then `checkHoneypot` / `checkMinElapsed`. `submit-form` / `submit-sd-form` / `submit-pay-parking` use raw `serve()` + `readJsonBody` / `req.formData()` — read `captchaToken` + `formRenderedAt` + honeypot from the body/formData they already parse. Keep the existing `checkIpRateLimit` line as a cheap first gate.
- **Client**:
  - `ui/src/features/guest/form/components/GuestForm.tsx` — fetch a token before the `fetch` at ~line 1053; `formData.append('captchaToken', token)` + honeypot + `formRenderedAt`. Widget in the final step near submit. Covers `submit-form-completion` (`isCompletionMode`) too.
  - `ui/src/features/guest/sd-form/lib/api.ts` — `submitSdForm`, `submitGuestReview`, `claimSdVoucher` gain a `captchaToken` arg; callers `SdFormPage.tsx`, `GuestReviewPage.tsx` / `SdFormReviewSection.tsx` mount the widget.
  - `ui/src/features/guest/pay-parking/lib/api.ts` — `submitPayParking` gains `captchaToken`; `PayParkingSections.tsx` mounts the widget.
- **Error handling**: extend the per-call parse in these helpers + `GuestForm.tsx` to detect `json.captchaFailed || res.status === 429` → retry toast + `reset()` widget — mirror the 429 special-casing in `ui/src/features/guest/search/lib/publicSearchFetch.ts`.

### Phase 4 — Lightly-authenticated + dashboard hardening (rate limit + heuristics, no CAPTCHA)

- `submit-parking-booking-request` — keep `assertParkingSubmitAllowed`; add `assertWithinRateLimit({ scope, identity: user.id, limit: 10, windowSec: 3600 })` + honeypot in `ParkingRegistrationForm.tsx`.
- `guest-web-chat-start` / `guest-web-chat-messages` / `guest-web-chat-resume` — `assertWithinRateLimit` on `user.id` (~30 msgs / 5 min, ~5 thread-starts / hour).
- `submit-support-ticket` — `assertWithinRateLimit` (~5 / hour / user) + honeypot in `TicketComposeForm.tsx`.
- `org-team-invitations` / `property-team-invitations` / `parking-team-invitations` — rate-limit `invite` + `resend` per `user.id` + per target org (~20 invites/hour, ~3 resends/hour/invitation); surface via the existing `parseTeamApiMutateData` 429 path in `ui/src/features/dashboard/team/lib/teamApiJson.ts`.
- `upload-guest-profile-asset` / `upload-guest-chat-asset` / `upload-inbox-chat-asset` / `upload-support-ticket-attachment` — `assertWithinRateLimit` on `user.id` (~40 / 10 min).

### Phase 5 — UX, accessibility, resilience

- `appearance="interaction-only"` so real users never see it; a shown challenge is inline (not modal) with reserved space. Accessible live-region status ("Verifying…" / "Verification needed" / "Verified") near submit.
- If `api.js` fails to load (network/adblock) within ~6s → `onError` → form proceeds with heuristics + rate-limit only, logs a PostHog event. Never hard-block a real user on a third-party script.
- Always `reset()` after a failed or completed submit (single-use tokens).
- Copy minimal per `minimal-ui-copy` / `DESIGN.md` — one short status line only.
- Responsive `size="flexible"`; verify 375 / 768 / 1024 per `mobile-responsive`.

### Phase 6 — Docs & tests

- `docs/PROJECT.md` — new "Anti-spam & CAPTCHA" subsection (surfaces, provider, env vars, fail-open/closed rule).
- `docs/architecture/validation-and-env.md` — `TURNSTILE_SECRET_KEY` (server) + `VITE_TURNSTILE_SITE_KEY` (client) with the test-key note.
- `docs/architecture/edge-functions.md` — annotate each protected function ("Turnstile-verified" / "durable rate limit `<scope>`").
- `.cursor/rules/supabase-edge-functions.mdc` — one line: new public write endpoints must call `assertCaptcha` + `assertWithinRateLimit`.
- Route guides (`route-guides` skill) — `form.md`, `sd-form.md`, `success.md`, guest-review, pay-parking + the auth pages: note the human-verification step.
- `docs/workflow/planned/README.md` — row added; move this file to `docs/workflow/in-progress/` on `/workflow-start`.
- Tests: Deno tests for `_shared/captcha.ts` (mock `siteverify`), `_shared/rateLimit.ts` (window rollover, limit hit), `_shared/botHeuristics.ts`. Manual QA: local Turnstile **fail** key → every protected path returns the friendly error; **pass** key → normal flow.

## Critical files

**New**

- `supabase/functions/_shared/captcha.ts`, `_shared/rateLimit.ts`, `_shared/botHeuristics.ts`
- `supabase/migrations/<next-ts>_request_rate_limits.sql`
- `ui/src/components/security/TurnstileWidget.tsx`, `ui/src/lib/security/useCaptchaToken.ts`

**Server edits** — `supabase/config.toml`; `submit-form/`, `submit-sd-form/`, `submit-guest-review/`, `submit-form-completion/`, `claim-sd-voucher/`, `submit-pay-parking/`, `submit-parking-booking-request/`, `guest-web-chat-start|resume|messages/`, `submit-support-ticket/`, `{org,property,parking}-team-invitations/`, `upload-guest-*` / `upload-inbox-chat-asset` / `upload-support-ticket-attachment` `index.ts`; retro-fit `get-form/`, `get-booked-dates/`, `get-public-parking/`, `search-suggestions/`.

**Client edits** — `useGuestAuthActions.ts`, `useHostGoogleAuth.ts`, `AuthPageContent.tsx`, `GuestAuthModal.tsx`, `GuestForm.tsx`, `sd-form/lib/api.ts` (+ `SdFormPage.tsx`, `GuestReviewPage.tsx`, `SdFormReviewSection.tsx`), `pay-parking/lib/api.ts` (+ `PayParkingSections.tsx`), `useSubmitParkingBookingRequest.ts` (+ `ParkingRegistrationForm.tsx`), `TicketComposeForm.tsx`, `teamApiJson.ts` consumers, `vite-env.d.ts`, `ui/.env.example`.

**Reuse** — `_shared/publicRateLimit.ts#clientIpFromRequest`, `_shared/settingsVerification.ts` (rate-limit + signed-token pattern), `_shared/idempotency.ts` (service-role table + sweep pattern), `_shared/httpResponse.ts#jsonError`, `_shared/posthog.ts#capturePostHogException`, `ui/src/components/theme/ThemeProvider.tsx#useTheme`, `ui/src/components/auth/GoogleSignInButton.tsx` (script-injection precedent), `ui/src/features/guest/search/lib/publicSearchFetch.ts` (429 handling precedent), migration conventions from `settings_verification_challenges`.

## FOR TESTING — configuration + step-by-step

### What to configure

**Cloudflare (one-time, per environment):** create a Turnstile widget at dash.cloudflare.com → Turnstile. Mode **Managed**, add your hostname(s) (`localhost` for local). You get a **Site key** (public) and a **Secret key** (private). Cloudflare's built-in test keys skip the account step:

|                                      | Always-pass                           | Always-fail                           |
| ------------------------------------ | ------------------------------------- | ------------------------------------- |
| Site key (`VITE_TURNSTILE_SITE_KEY`) | `1x00000000000000000000AA`            | `2x00000000000000000000AB`            |
| Secret key (`TURNSTILE_SECRET_KEY`)  | `1x0000000000000000000000000000000AA` | `2x0000000000000000000000000000000AA` |

**Always set the site key and the secret key together.** Setting only `TURNSTILE_SECRET_KEY` flips the edge to `enforce` while the widget stays invisible → every guest booking/SD/review submit is rejected. If you want to watch first, set `CAPTCHA_MODE=monitor` (nothing blocked, outcomes logged to PostHog).

**Local dev:**

1. `ui/.env.development` (gitignored) → add:
   ```
   VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
   TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
   ```
   (The root `bun run *:supabase` wrappers source this file, so the secret reaches GoTrue for `[auth.captcha]`.)
2. `supabase/.env.local` (gitignored) → add `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA` (this is what the **edge functions** read for `siteverify`). Optional: `CAPTCHA_MODE=enforce`.
3. `supabase/config.toml` → set `[auth.captcha] enabled = true` (committed value is `false`).
4. `bun run db:migrate` (applies `20261304120000_request_rate_limits.sql`), then `bun run stop:supabase && ./dev.sh`.

**Hosted (dev / prod):**

1. Vercel project env → `VITE_TURNSTILE_SITE_KEY` (must be present **before** the build).
2. Supabase project secrets (`supabase secrets set TURNSTILE_SECRET_KEY=…`, optionally `CAPTCHA_MODE=…`) → for the edge `siteverify`.
3. Supabase Dashboard → Authentication → **Attack Protection** → enable **CAPTCHA / Turnstile**, paste the same secret → for the auth-OTP front door.
4. Deploy migrations + functions (`kamewave` required for prod).
5. If you ever add a CSP: `script-src` and `frame-src` must allow `https://challenges.cloudflare.com`.

### Step-by-step test (with the pass/fail test keys)

1. **Auth, pass key** — `/for-guests/login` and the in-context booking modal: enter an email → **Continue**. No visible challenge; OTP arrives in Inbucket. On the code step, **Resend** still works (fresh token). Google button unaffected.
2. **Auth, fail key** — swap both keys to the `2x…` pair, restart. **Continue** → inline error ("captcha … disallowed"), no OTP email. **Resend** on the code step also blocked.
3. **Guest booking form, pass key** — submit a new booking → row in `guest_submissions`, New-Booking-Request email + Telegram fire (check function logs).
4. **Guest booking form, fail key** — submit → toast "Please complete the verification and try again.", **no** `guest_submissions` row, **no** Telegram/Resend in logs, response is `400 { captchaFailed: true }`.
5. **Repeat 3–4** for `/sd-form` (review submit, voucher reveal, refund submit), `/guest-review`, and the `?complete=<token>` completion flow.
6. **Rate limit** — with the pass key, script ~25 rapid `POST /functions/v1/submit-form` (curl, bypassing the UI). After ~20 in 60 s → `429` with `Retry-After` and `{ rateLimited: true, retryAfterSec }`; rows appear in `request_rate_limits`. A normal single submit from the UI still succeeds.
7. **Heuristics** — `POST /functions/v1/submit-form` with `contact_time=x` (honeypot filled) **or** `formLoadedAt=<Date.now()>` → `400` "Your submission could not be processed." and **no** `siteverify` call in logs (heuristics run first).
8. **Monitor mode** — set `CAPTCHA_MODE=monitor`, use the fail key → every submit **succeeds**, and PostHog shows `captcha_monitor` events (outcome `monitored_fail` / `monitored_pass`).
9. **Degradation** — unset `VITE_TURNSTILE_SITE_KEY` → the widget renders nothing, forms still submit (heuristics + rate limit only). Unset `TURNSTILE_SECRET_KEY` while `CAPTCHA_MODE` is unset → `resolveCaptchaMode()` = `disabled`, captcha skipped entirely.
10. **Dashboard rate limits** — send >20 team invites in an hour from one host → `429` in the team error toast; settings-verification OTP is unaffected. Support ticket: submit >6 in an hour → `429`.
11. **Mobile** — `/for-guests/login`, guest booking form, `/sd-form` at 375 / 768 / 1024 px: no horizontal scroll; if Turnstile ever shows an interactive challenge it sits inline with reserved space, no layout jump.
12. **Gates** — `bun run type-check && bun run lint && bun run build && bun run check:filenames`; `bun run test:edge` (needs `deno` on PATH) → all green.

---

## Verification (original checklist)

1. **Local setup** — env with Cloudflare **pass** test keys; `./dev.sh`.
2. **Auth** — `/for-guests/login` + in-context modal: email step shows no visible widget, OTP still sends. Swap to the **fail** key → `sendEmailOtp` returns a captcha error, inline message, widget resets, no OTP email in Inbucket.
3. **Anon writes** — guest booking form with pass key → booking created. Fail key → 400 `captchaFailed`, friendly toast, no `guest_submissions` row, no Telegram/Resend call (function logs). Repeat for sd-form, guest-review, pay-parking, form-completion, claim-sd-voucher.
4. **Rate limit** — 25 rapid `submit-form` POSTs (bypass UI) → after the limit, 429 + `Retry-After`; `request_rate_limits` rows present; real single submits still pass.
5. **Heuristics** — POST with honeypot filled or `formRenderedAt` = now → rejected before `siteverify` is called.
6. **Degradation** — unset `VITE_TURNSTILE_SITE_KEY` → forms still submit (heuristics + rate limit only); unset `TURNSTILE_SECRET_KEY` locally → fails open with a logged warning; simulate prod (`DENO_DEPLOYMENT_ID`) with no secret → fails closed.
7. **Dashboard** — >20 team invites in an hour → 429 via the existing team error toast; settings-verification OTP unaffected.
8. **Gates** — `bun run type-check && bun run lint && bun run build`; Playwright MCP walk of `/for-guests/login` + guest booking form at 375/768/1024 (per `verify` skill); Deno tests for the three shared helpers.
9. **Docs** — `documentation-maintenance` + `route-guides` checklists pass; `bun run check:ai-tooling-sync` clean.
