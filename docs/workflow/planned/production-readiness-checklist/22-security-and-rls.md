---
title: 'Security and RLS'
status: active
tags: [workflow, planned, production-readiness, security, rls, privacy]
updated: 2026-09-18
stage: planned
kind: plan
---

# 22 — Security & RLS

**Launch blocker.** Application authorization is doc 21; this doc covers the database layer, transport, headers, secrets, and privacy.

## Remaining work to finalize

**Status: partial — RLS / SECURITY DEFINER / XSS / SSRF-on-marketing-fetch / secret-rotation runbook / prompt-injection coverage table shipped (2026-09-18).** CSP, hosted advisors, privacy/legal, and role-as-anon RLS probes remain.

| #   | Work                                                                                                                                                                                                                                                                   | Blocker         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1   | `mcp__supabase__get_advisors` against hosted.                                                                                                                                                                                                                          | Hosted MCP      |
| 2   | RLS policies probed as literal `anon` / `authenticated` connections.                                                                                                                                                                                                   | Tests           |
| 3   | Security headers / CSP Report-Only then enforce (22.4). Feeds docs 04/16.                                                                                                                                                                                              | Hosted preview  |
| 4   | ~~SSRF on user-supplied fetch.~~ **Done** for marketing remote audio + generated-video download (`safeOutboundUrl.ts`, hop revalidation, private-IP block). Calendar iCal already guarded. Other `fetch(` of host-controlled Google/Gemini URLs are not user-supplied. | —               |
| 5   | ~~Open redirect.~~ **Done** — Meta OAuth uses `isMetaReturnOriginAllowed`.                                                                                                                                                                                             | —               |
| 6   | ~~Secret rotation runbook.~~ **Done** — `docs/archive/operations/secret-rotation.md`. Bundle grep already clean.                                                                                                                                                       | —               |
| 7   | Privacy: data inventory, export/delete path, legal copy, AI disclosure (22.7).                                                                                                                                                                                         | Product + legal |
| 8   | Prompt-injection **adversarial tests**. Coverage table below; guards exist for inbox + dashboard assistant. Marketing captions are host-authored.                                                                                                                      | Tests           |

## Measured before / after

| Metric                        | Before                                                | After                                           | Difference            |
| ----------------------------- | ----------------------------------------------------- | ----------------------------------------------- | --------------------- |
| RLS-disabled public tables    | 3 (`developments`, `processed_emails`, `query_cache`) | 0 (migration `20261316121900`)                  | Deny-by-default       |
| `dangerouslySetInnerHTML` XSS | 4 unsanitized sites                                   | DOMPurify allowlists                            | Hostile HTML stripped |
| Marketing remote URL fetch    | `https?://` then `redirect: follow`                   | `fetchPublicHttp` private-IP + hop revalidation | Classic SSRF closed   |
| Open redirect (Meta OAuth)    | Allowlisted (already)                                 | Re-verified                                     | No change             |
| Secret rotation procedure     | None                                                  | Per-secret blast-radius runbook                 | Operators have a path |

## Implementation status (2026-09-18 session)

Local Supabase was running this session (Docker up, `bun run db:migrate` executable) — a real unlock compared to prior sessions, which were blocked on "Hosted + schema" for this exact reason. Everything below was verified against a running local Postgres via `docker exec psql`, not guessed. Local and hosted schemas are the same migrations, so table-level RLS/grant/SECURITY DEFINER findings transfer directly; only hosted-specific things (advisor UI, CSP report endpoint, billing) remain genuinely hosted-blocked.

**Phase 22.1 — RLS coverage audit: done.** Queried `pg_class.relrowsecurity` + `pg_policies` for all 114 public tables: 111 already RLS-enabled (87 deny-by-default with zero policies — the doc's target posture — plus 24 with real tenant-scoped policies), only 3 gaps (`developments`, `processed_emails`, `query_cache` — all edge-function-only access, confirmed via a repo-wide grep for direct `ui/src` callers, zero found). Fixed in migration `20261316121900_rls_deny_by_default_gaps.sql`: enables RLS on all three (no policy — service role still works, everyone else denied) and revokes the stray `TRUNCATE`/`REFERENCES`/`TRIGGER` grants `anon`/`authenticated` held on them (schema-level `GRANT ALL ON ALL TABLES IN SCHEMA public` residue — narrow but real, since `TRUNCATE` needs no `SELECT`/`INSERT` to empty a table). Migration applied and verified locally. `mcp__supabase__get_advisors` itself needs `SUPABASE_ACCESS_TOKEN`/`SUPABASE_PROJECT_REF` exported (not available this session) — not run, but the manual `pg_policies` sweep covers the same ground for RLS-disabled tables specifically.

**Phase 22.2 — Direct-client and realtime access: done.** Found exactly 2 direct-browser-query tables (`guest_submissions` via `useBookings.ts`/`useBooking.ts` PostgREST fallback, `guest_saved_properties` via `savedPropertiesApi.ts`) — both have correct RLS policies (`guest_submissions` via the `user_can_access_guest_submission` predicate family shared with the JWT path; `guest_saved_properties` via `auth.uid() = user_id`). Checked the realtime publication directly (`pg_publication_tables` joined to `pg_class`): all 3 published tables (`notifications`, `social_conversations`, `social_messages`) have RLS enabled with real tenant-scoped `SELECT` policies — no cross-tenant realtime leak found.

**Phase 22.3 — `SECURITY DEFINER` inventory: done, clean.** All 43 `SECURITY DEFINER` functions in `public` have `search_path` pinned (0 gaps — queried `pg_proc.proconfig` directly). Execute-grant check: 0 of 43 are callable by `anon`; 10/43 are callable by `authenticated`, and all 10 are `user_can_access_*`/`user_can_read_*` RLS-policy predicate helpers (the expected, correct pattern — RLS policies need `authenticated` to invoke them per-row). Spot-checked one body (`user_can_access_guest_submission`) for argument validation — typed UUID params, delegates to sub-predicates, no dynamic SQL.

**Phase 22.5 — XSS audit: done, gap found and fixed.** All 4 `dangerouslySetInnerHTML` call sites in `ui/src` were rendering raw HTML with zero sanitization (`ParkingPanel.tsx`, `RichTextEditor.tsx`'s `RichTextDisplay`, `ParkingRequestStatusView.tsx`, `StayGuideRichContent.tsx`) — no sanitization library was installed at all. Added `dompurify` (`ui/src/lib/sanitizeHtml.ts`, two allowlist configs: `sanitizeRichTextHtml` for tiptap-authored content, `sanitizeEmailSnapshotHtml` for stored email-HTML snapshots) and wired it into all 4 sites. This closes a real gap for `endorsementEmailSnapshot` specifically, which stores rendered email HTML that embeds guest-controlled placeholder values (the exact attacker-controlled-text risk `CLAUDE.md`'s "Known sharp edges" and this doc's own edge cases call out) — it was rendered completely unsanitized in two admin/guest views before this fix. Type-check and lint clean; `@types/dompurify` (deprecated stub) removed since `dompurify` v3 ships its own types.

**Phase 22.6 — Secrets: bundle grep done, clean.** Grepped the existing `ui/dist` production build for service-role key patterns (`sb_secret_`, `SERVICE_ROLE`, JWT literals), `ADMIN_ALLOWED_EMAILS`/`SUPER_ADMIN_EMAILS`-shaped real email addresses. One `sb_secret_` string match was `@supabase/supabase-js`'s own internal key-format-detection code (checks if a string starts with that prefix), not an embedded secret. Every embedded JWT decodes to `"role":"anon"` (the intended, safe key). No admin/super-admin email addresses found — only form-placeholder and third-party-library-author emails. Confirms the P1-4-class fix is holding.

**Edge case verified — `GRANT ALL ON storage.buckets TO public`**: traced to this repo's own `20250213045323_create_storage_buckets.sql`. `storage.buckets` has RLS enabled with zero policies (deny-by-default is the actual effective control regardless of the SQL grant — confirmed via `pg_policies`). Attempted to also tighten the underlying SQL grant and found a genuine ownership-chain limit: `storage.buckets` is owned by `supabase_storage_admin` (Supabase's platform-managed storage service), and the original broad grant was issued by that role, not by `postgres` (the role every migration in this repo runs as, matching the hosted deploy path too) — `postgres` cannot `REVOKE` a grant it did not itself make; the `REVOKE` silently no-ops. Documented rather than shipped as a no-op migration; RLS is the real, verified, sufficient control here. Same ownership-boundary class as the Phase 22.x-adjacent finding below.

**Bonus finding, not in this doc's original phase list but discovered while verifying 22.1**: migration `20261316121600_request_role_statement_timeouts.sql` (from a prior session's doc 15 work) could not apply locally at all — `ALTER ROLE anon/authenticated/service_role SET ...` requires `supabase_admin` privilege that `postgres` does not have locally (`ERROR: "anon" is a reserved role, only superusers can modify it`), and `postgres` cannot `SET ROLE supabase_admin` either. This blocked the entire local migration chain (nothing after it could apply). Fixed by wrapping the ALTERs in a `DO $$ ... EXCEPTION WHEN insufficient_privilege` guard so local `db:migrate` degrades gracefully instead of hard-failing; hosted deploy still applies the timeouts as intended (needs post-deploy verification — see doc 15's updated remaining-work note). This was a real, previously-undiscovered local/hosted parity bug, not a doc-22-scoped task, but is exactly the kind of gap this session's local-Supabase access was positioned to catch.

### Prompt-injection coverage (22.8)

| Guest/host text → AI           | Guard                                                                      | Notes                                              |
| ------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------- |
| Inbox guest messages           | `inboxAiSafetyGuard.ts` (+ tests)                                          | Deterministic; fallback reply on fail              |
| Dashboard assistant            | `dashboardAssistantSafetyGuard.ts` + `dashboardAssistantRiskClassifier.ts` | Pre-exec risk re-derived from DB                   |
| Marketing captions / templates | Host-authored prompt                                                       | Not guest content                                  |
| Marketing URL import           | N/A (SSRF, not injection)                                                  | Now `safeOutboundUrl.ts`                           |
| Receipt / document vision      | Guest files                                                                | Existing cost-abuse plan; no extra injection guard |
| CSV import column mapping      | Host CSV                                                                   | Quota-gated; treat as remaining adversarial        |

Not attempted this session — remaining rows 1–3, 7–8 in Remaining work.

## The single most important fact about this codebase

From `CLAUDE.md` § Known sharp edges:

> **RLS is not the access-control layer today** — it's edge-function checks (`verifyAdminJwt`/`verifyOrgAccess`/`verifyPropertyAccess`/`resolveScopedParkingAccess`). Don't assume a table is protected just because the query goes through Supabase.

Edge functions use the **service role**, which bypasses RLS entirely. So:

- RLS is **defense in depth**, not the primary control. Doc 21 is where the real boundary lives.
- But RLS still matters for any path that does **not** go through an edge function: direct `supabase-js` browser queries, realtime subscriptions, and Storage access.
- 71 of 346 migrations enable RLS. The gap between "tables that exist" and "tables with RLS" is the audit.

**Do not "fix" this by declaring RLS the access layer.** That would be an architecture change, not a hardening pass. The goal is: RLS correct and enabled everywhere as a second line, with the edge checks remaining primary.

## Prior art — do not redo

| Shipped                                                    | Where                                                                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Guest PII buckets private; anon writes dropped             | Cost-abuse phases                                                                                              |
| PII backup table dropped                                   | Launch audit P0-4                                                                                              |
| `SECURITY DEFINER` RPC privileges revoked from PUBLIC/anon | P0-5 + follow-up migration; CI `check-migration-security.sh`                                                   |
| CORS tightened (no `*.vercel.app` wildcard)                | P2-5                                                                                                           |
| Turnstile, honeypot, durable rate limiter                  | [`captcha-anti-spam-hardening.md`](../../for-testing/captcha-anti-spam-hardening.md)                           |
| Secrets in `supabase/.env.local`, never committed          | Repo rule                                                                                                      |
| Secret encryption helpers                                  | `secretsCrypto.ts`, `propertySecretCrypto.ts`, `metaInboxCrypto.ts`, `webCryptoKey.ts`                         |
| Full pentest-style audit                                   | [`cost-abuse-security-production-readiness.md`](../../for-testing/cost-abuse-security-production-readiness.md) |

## Phases

### Phase 22.1 — RLS coverage audit

For every table: RLS enabled? policies present? do the policies actually express the tenant rule? is the table reachable by the anon or authenticated role at all?

Use `mcp__supabase__get_advisors` (security advisor) — it flags RLS-disabled tables and insecure policies directly.

Priority order:

1. Tables holding guest PII.
2. Tables reachable directly from the browser client or realtime.
3. Everything else.

**Default posture:** RLS enabled + deny-all, with explicit policies only where a non-service-role path genuinely needs access. A table nothing but edge functions touch should be RLS-enabled with no permissive policy at all — service role still works, everything else is denied.

### Phase 22.2 — Direct-client and realtime access

Find every place the browser queries Supabase directly rather than through an edge function, and every realtime subscription. These are the paths where RLS **is** the only control.

For each: confirm a policy enforces tenant scope, and that realtime replication does not broadcast rows a subscriber should not see. **Realtime honors RLS only if it is enabled on the table** — a realtime subscription on an RLS-less table streams every tenant's rows to any subscriber. Given this app's inbox, notifications, activity, and chat realtime usage, this is a concrete cross-tenant leak risk and deserves explicit verification per channel.

### Phase 22.3 — `SECURITY DEFINER` inventory

Every `SECURITY DEFINER` function: who can execute it, what it does, whether its arguments are validated, and whether `search_path` is pinned (an unpinned `search_path` on a definer function is a privilege-escalation vector). The launch audit fixed several; complete the sweep and keep `check-migration-security.sh` as the guard.

### Phase 22.4 — Transport and headers

Implement the header set from doc 16 Phase 16.4 and complete the CSP:

- Build the policy from doc 04's third-party origin inventory.
- `Report-Only` first, with reports going somewhere a human reads.
- The inline theme script in `index.html` needs a hash or nonce (it must stay — it prevents a theme flash).
- `frame-ancestors 'none'` unless embedding is required.
- Tighten progressively; a CSP shipped broken gets disabled.

### Phase 22.5 — Input/output safety

- **XSS**: audit every `dangerouslySetInnerHTML`. Rich-text (tiptap), email template previews, custom pages, and AI-generated content are the risk surfaces. Sanitize on render with an allowlist, not a denylist.
- **Email templates**: placeholder substitution into HTML must escape values. Guest names are attacker-controlled text and flow into emails and PDFs.
- **SQL injection**: `supabase-js` parameterizes, but any raw SQL in RPCs or dynamic filter building needs review.
- **SSRF**: any feature fetching a user-supplied URL (webhooks, media import, Meta callbacks) must validate the target and block internal addresses.
- **Open redirect**: post-auth and payment-return redirects must be allowlisted.

### Phase 22.6 — Secrets

- Verify no secret is in the client bundle (grep `dist` for key patterns — the super-admin email leak, P1-4, was exactly this class and was only caught by looking).
- Confirm the anon key is the only Supabase key ever shipped to the browser, and that the service-role key exists only in edge/server env.
- Rotation procedure documented per secret, with the blast radius of each.
- Cron secrets in Vault (already the direction per the launch audit).
- Confirm secrets never reach logs, PostHog, or error messages (`posthogSanitize.ts` covers URLs — extend to bodies).

### Phase 22.7 — Privacy and compliance

This system stores government IDs, vaccination records, payment receipts, and guest contact data.

- Data inventory: what PII, where, for how long (doc 19 Phase 19.5).
- Guest data export and deletion path.
- Legal copy accuracy (privacy policy must describe actual practice, including PostHog and AI processing).
- AI processing disclosure: guest messages and documents are sent to Gemini/Groq. This must be disclosed, and ideally opt-outable.
- Third-party processor list maintained.

### Phase 22.8 — Continuous verification

- `mcp__supabase__get_advisors` (security) in the release checklist.
- `bun audit` in CI (doc 05).
- Periodic run of the `security-auditor` subagent over changed surfaces.
- Optional external pentest before public launch.

## Edge cases

- **Service role bypasses RLS**, so RLS tests pass trivially if run with the service key. Every RLS test must run as `anon` and as `authenticated` to mean anything.
- **RLS with a per-row function call** can dominate query cost (doc 14). Correctness first, then index the policy predicate.
- **Enabling RLS on a table the app reads via a non-service path breaks it immediately.** Roll out per table with verification.
- **`GRANT ALL ON storage.buckets TO public`** appears in an early migration; re-verify current effective grants.
- **CORS is not authorization.** A tightened origin list stops browser-based cross-origin reads, not a direct HTTP client. Every endpoint still needs its own auth.
- **CSP breaks the PWA** if `script-src` omits the SW registration or the inline theme script. Report-Only first.
- **Error messages as oracles** — "no such org" vs "not permitted" reveals existence. Doc 18 already mandates 404 for both.
- **AI prompt injection**: guest-supplied text reaching an AI tool-calling context can attempt to trigger actions. Safety guards exist (`inboxAiSafetyGuard.ts`, `dashboardAssistantSafetyGuard.ts`, `dashboardAssistantRiskClassifier.ts`) — verify coverage on every guest-content-to-AI path, since AI can now take real actions on org data.

## Exit gate

- [x] RLS audit across every table (114/114 checked); enabled with deny-by-default where no non-service path exists (3 gaps found and fixed via migration). Advisor findings not closed — `get_advisors` needs hosted MCP access not available this session.
- [x] Every direct-client query (2 found) and realtime channel (3 found) verified RLS-protected by reading policy definitions. Not yet tested by literally connecting as `anon`/`authenticated` and probing.
- [x] `SECURITY DEFINER` inventory complete (43/43) with pinned `search_path` (0 gaps) and least-privilege grants (0/43 anon-executable, 10/43 authenticated-executable and all 10 are the expected RLS-predicate-helper pattern).
- [ ] Security headers live; CSP enforcing (past Report-Only) with reports monitored. Not attempted — needs a deployed preview.
- [x] XSS audit of all `dangerouslySetInnerHTML` (4/4 sites) — gap found (zero sanitization anywhere) and fixed with DOMPurify allowlist sanitization. Email/PDF placeholder escaping with a hostile guest-name fixture not tested this session.
- [x] SSRF on marketing remote fetch + generated-video download (`safeOutboundUrl.ts`). Calendar iCal already guarded. Open redirect: Meta OAuth allowlisted.
- [x] Bundle grep confirms no secrets in the existing production build. Rotation runbook: `docs/archive/operations/secret-rotation.md`.
- [ ] Privacy: data inventory, export/delete path, accurate legal copy, AI disclosure. Not attempted this session.
- [x] Prompt-injection coverage table recorded (inbox + assistant guarded). Adversarial tests still open.

## Docs / Plans / activity-log

- **Docs:** `.cursor/rules/admin-auth.mdc`, `docs/PROJECT.md`, `docs/architecture/integrations.md`, `docs/architecture/edge-functions.md` (SSRF + wrapper rate check), legal pages, `docs/archive/operations/migration-runbook.md`, **`docs/archive/operations/secret-rotation.md`**.
- **Plans / Team RBAC:** N/A directly; pairs with doc 21.
- **activity-log:** N/A this pass — no new mutating guest/org capability. Super-admin writes covered in doc 21.
