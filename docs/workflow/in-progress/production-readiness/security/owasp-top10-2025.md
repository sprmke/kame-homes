---
title: 'OWASP Top 10:2025'
status: active
updated: 2026-10-19
stage: in-progress
kind: reference
readiness: unverified
launch_gate: B
---

# OWASP Top 10:2025

Status vs this repo. Evidence older than the baseline SHA is stale. Live probes: after Phase 0.6.

| ID  | Category                              | Status | Notes / ledger                                                                                                                                                 |
| --- | ------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 | Broken Access Control                 | 🟡     | Edge JWT + org/property/parking scope is the real ACL, not RLS. Remaining: guest-token IDOR (PR-008), role×endpoint parity (PR-014), outsider IDOR in Phase 7. |
| A02 | Security Misconfiguration             | 🔴     | GitHub `development` env missing smoke secrets (PR-025). CSP still Report-Only (PR-012). Maps key referrer lock unverified (PR-084).                           |
| A03 | Software Supply Chain Failures        | 🟡     | Frozen lockfile in CI. Actions SHA-pin and bun audit: checklist 38 (PR-107).                                                                                   |
| A04 | Cryptographic Failures                | 🟡     | TLS at Vercel/Supabase. Secrets in Vault/Edge. No passwords stored. Guest access HMAC. Re-verify headers via `verify:deployed-preview`.                        |
| A05 | Injection                             | 🟡     | PostgREST parameterized. Prompt injection: inbox + assistant guards exist; adversarial tests PR-013.                                                           |
| A06 | Insecure Design                       | 🟡     | Workflow state machine server-side. Payment amounts server-side (PR-104). Double-booking still app-level (PR-032).                                             |
| A07 | Authentication Failures               | 🟡     | Supabase Auth + allow lists. Attack Protection captcha Dashboard (PR-002). Step-up OTP for super-admin (QA #7). Shared-device sign-out PR-015.                 |
| A08 | Software or Data Integrity Failures   | 🟡     | Webhook event-id dedupe (PR-019). No unsigned updates. Restore drill missing (PR-024).                                                                         |
| A09 | Security Logging Failures             | 🟡     | `activity_log` + `handleEdgeError`. PostHog keys on Edge; operator projects PR-026. PII-in-logs pass already done once; re-verify.                             |
| A10 | Mishandling of Exceptional Conditions | 🟡     | Fail-open vs fail-closed documented in rate limiter. Cron fail-closed when `ENVIRONMENT=production`. Third-party down: checklist 37.                           |
