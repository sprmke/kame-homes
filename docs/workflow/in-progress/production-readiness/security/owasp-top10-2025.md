---
title: 'OWASP Top 10:2025'
status: active
updated: 2026-11-02
stage: in-progress
kind: reference
readiness: unverified
launch_gate: B
---

# OWASP Top 10:2025

Status vs this repo. Evidence older than the baseline SHA is stale. Live probes: after Phase 0.6.

| ID  | Category                              | Status | Notes / ledger                                                                                                                                                                                                                                        |
| --- | ------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 | Broken Access Control                 | 🟡     | Edge JWT + org/property/parking scope is the real ACL, not RLS. Remaining: guest-token IDOR (PR-008), role×endpoint parity (PR-014), outsider IDOR in Phase 7.                                                                                        |
| A02 | Security Misconfiguration             | 🟡     | ZAP baseline on dev 2026-11-02: **0 fail / 11 warn / 57 pass**; anti-clickjacking fixed (`X-Frame-Options: SAMEORIGIN` now sent + guarded). Remaining: CSP Report-Only (PR-012), Maps key referrer lock (PR-084), `development` env secrets (PR-025). |
| A03 | Software Supply Chain Failures        | 🟡     | 2026-11-02: gitleaks full history clean after documented allowlist (`check-gitleaks.sh`); OSV 195 advisories triaged (dev/build tooling + zod 4 upgrade, PR-141); dual npm+bun lockfile flagged (PR-142); Actions SHA-pinned (#153).                  |
| A04 | Cryptographic Failures                | 🟡     | TLS at Vercel/Supabase. Secrets in Vault/Edge. No passwords stored. Guest access HMAC. Re-verify headers via `verify:deployed-preview`.                                                                                                               |
| A05 | Injection                             | 🟡     | Semgrep (119 rules, 4471 files, 2026-11-02): 2 `dangerouslySetInnerHTML` hits, both DOMPurify-sanitized (triaged FP). PostgREST parameterized. Prompt injection: adversarial tests PR-013.                                                            |
| A06 | Insecure Design                       | 🟡     | Workflow state machine server-side. Payment amounts server-side (PR-104). Double-booking still app-level (PR-032).                                                                                                                                    |
| A07 | Authentication Failures               | 🟡     | Supabase Auth + allow lists. Attack Protection captcha Dashboard (PR-002). Step-up OTP for super-admin (QA #7). Shared-device sign-out PR-015.                                                                                                        |
| A08 | Software or Data Integrity Failures   | 🟡     | Webhook event-id dedupe (PR-019). No unsigned updates. Restore drill missing (PR-024).                                                                                                                                                                |
| A09 | Security Logging Failures             | 🟡     | `activity_log` + `handleEdgeError`. PostHog keys on Edge; operator projects PR-026. PII-in-logs pass already done once; re-verify.                                                                                                                    |
| A10 | Mishandling of Exceptional Conditions | 🟡     | Fail-open vs fail-closed documented in rate limiter. Cron fail-closed when `ENVIRONMENT=production`. Third-party down: checklist 37.                                                                                                                  |
