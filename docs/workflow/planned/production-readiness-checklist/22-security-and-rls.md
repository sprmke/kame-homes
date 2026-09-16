---
title: 'Security and RLS'
status: active
tags: [workflow, planned, production-readiness, security, rls, privacy]
updated: 2026-09-16
stage: planned
kind: plan
---

# 22 — Security & RLS

**Launch blocker.** Application authorization is doc 21; this doc covers the database layer, transport, headers, secrets, and privacy.

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

- [ ] RLS audit across every table; enabled with deny-by-default where no non-service path exists; advisor findings closed.
- [ ] Every direct-client query and realtime channel verified RLS-protected and tested as `anon` + `authenticated`.
- [ ] `SECURITY DEFINER` inventory complete with pinned `search_path` and least-privilege grants.
- [ ] Security headers live; CSP enforcing (past Report-Only) with reports monitored.
- [ ] XSS audit of all `dangerouslySetInnerHTML`; email/PDF placeholder escaping verified with a hostile guest-name fixture.
- [ ] SSRF and open-redirect protections verified.
- [ ] Bundle grep confirms no secrets; rotation runbook per secret.
- [ ] Privacy: data inventory, export/delete path, accurate legal copy, AI disclosure.
- [ ] Prompt-injection guards verified on every guest-content-to-AI path.

## Docs / Plans / activity-log

- **Docs:** `.cursor/rules/admin-auth.mdc`, `docs/PROJECT.md`, `docs/architecture/integrations.md`, legal pages, `docs/archive/operations/migration-runbook.md`.
- **Plans / Team RBAC:** N/A directly; pairs with doc 21.
- **activity-log:** invoke `audit-logging` — security-relevant events (permission changes, secret rotation, PII export/delete, super-admin actions).
