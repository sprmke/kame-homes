---
title: 'Phase 6 tooling pass (gitleaks, semgrep, OSV, ZAP) — 2026-11-02'
status: active
stage: in-progress
kind: evidence
readiness: verified
launch_gate: B
launch_blocker: false
last_verified: '2224ef7c 2026-11-02'
---

# Phase 6 tooling pass — 2026-11-02

Checklist 38 (supply chain) and plan 6.5 (security tooling) call for gitleaks, SAST, dependency scanning and a ZAP baseline against hosted dev. None of it had been run before; this pass runs all four and triages the results.

Environment: local checkout at `develop` `2224ef7c`, hosted dev `fworvijbrwpyngycotbz` / `dev.kamehomes.space`.

## 1. Secret scanning — gitleaks (full history)

```
gitleaks detect --source . --config .gitleaks.toml
2877 commits scanned · ~86 MB
```

Raw result: **146 findings, 0 real secrets**. Breakdown:

| Rule               | Count | What it actually is                                                                                                                                                         |
| ------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jwt`              | 57    | The local Supabase demo JWT (`"iss":"supabase-demo"`, `http://127.0.0.1:54321`) hard-coded in local scripts, tests and `supabase/snippets`                                  |
| `curl-auth-header` | 46    | `.claude/settings*.json` shell history for local `curl` calls with the same demo key                                                                                        |
| `generic-api-key`  | 43    | False positives: column names (`guest2_valid_id_url`), storage keys (`guest-voice-receptionist-consent-v1`), a redaction test fixture (`sk_live_abc123`), seeded role UUIDs |

No `sbp_…`, `re_…`, `sk_live_…`, Meta, Google or GitHub token appears anywhere in history (checked by regex over every finding).

Added `.gitleaks.toml` (default rules + documented allowlists for the demo stack, tests, tool state and QA fixtures) and `scripts/dev/check-gitleaks.sh`, which now reports **OK — no secrets in history**. The allowlist is by path/regex, so a real secret in any _other_ file still fails.

## 2. SAST — semgrep

```
semgrep --config p/owasp-top-ten --config p/secrets --config p/typescript ui/src supabase/functions
119 rules · 4471 files · 2 findings
```

| Finding                         | Location                                                                               | Triage                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `react-dangerouslysetinnerhtml` | `ui/src/features/guest/marketing/parkings/components/ParkingRequestStatusView.tsx:352` | **False positive.** The HTML is `sanitizeEmailSnapshotHtml()` (DOMPurify, `EMAIL_SNAPSHOT_CONFIG`) |
| `react-dangerouslysetinnerhtml` | `ui/src/features/guest/stay-guide/components/StayGuideRichContent.tsx:109`             | **False positive.** `sanitizeRichTextHtml()` (DOMPurify, `RICH_TEXT_CONFIG`)                       |

No SQL-injection, shell, or secret-pattern findings.

## 3. Dependency advisories — OSV + `bun audit`

```
osv-scanner scan source -r .      → 195 advisories across 4 lockfiles
bun audit                         → 61 advisories (1 critical, 26 high, 26 moderate, 8 low)
```

Triage by surface:

| Surface                                                     | Advisories | Runtime impact                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun.lock` (root + `ui`)                                    | 87         | Mostly build/lint tooling (Vercel CLI, ESLint, knip, lighthouse/puppeteer). Two reach shipped code: **zod** (memory exhaustion on huge constrained collections; fix is zod 4.x, a major upgrade) and **quill 1.3.7** (XSS; not imported by the app bundle — `grep` finds no `quill` import) |
| `package-lock.json` (root, kept in sync by tooling commits) | 87         | Same trees as above; the dual lockfile is itself a supply-chain smell (two files to keep in sync)                                                                                                                                                                                           |
| `marketing/social/bun.lock` (Remotion studio, off-app)      | 5          | Build-time only                                                                                                                                                                                                                                                                             |
| `.agents/skills/mcp-builder/requirements.txt`               | 16         | `python-multipart` in a vendored skill script, never shipped                                                                                                                                                                                                                                |

Not a code defect for launch, but it needs an owner: see ledger PR-141 (zod 4 upgrade + tooling advisory triage) and PR-142 (retire the duplicate npm lockfile or make it generated-only).

## 4. ZAP baseline — hosted dev

```
docker run ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://dev.kamehomes.space
FAIL-NEW: 0 · WARN-NEW: 11 · PASS: 57
```

| Alert                                                                             | Risk          | Decision                                                                                                                                                                 |
| --------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Content Security Policy header not set / Report-Only found                        | Medium / Info | Expected: CSP ships as `Content-Security-Policy-Report-Only` until PR-012 (enforce) is decided                                                                           |
| **Missing Anti-clickjacking Header**                                              | Medium        | **Fixed** — `ui/vercel.json` now sends `X-Frame-Options: SAMEORIGIN` (CSP `frame-ancestors` only takes effect once CSP is enforced); `check-vercel-headers.sh` guards it |
| Cross-Domain Misconfiguration (`Access-Control-Allow-Origin: *` on static assets) | Medium        | Accepted: public assets, no credentials. Authorisation is bearer-token based; API CORS is allowlisted (`check-cors-origins.sh`)                                          |
| Sub Resource Integrity missing                                                    | Medium        | Accepted: Vercel serves content-hashed immutable bundles; SRI would need per-build hashes in `index.html` for third-party origins only                                   |
| COEP / COOP / CORP missing                                                        | Low           | Accepted for launch: COEP breaks Google Maps embeds; COOP would need an OAuth popup audit                                                                                |
| Timestamp disclosure (Unix)                                                       | Low           | Informational; a build/bundle value, not a session leak                                                                                                                  |
| Suspicious comments                                                               | Info          | Reviewed: code comments only, no credentials or internal hosts                                                                                                           |
| Cache/storage informational alerts                                                | Info          | Matches the intentional cache matrix in `vercel.json`                                                                                                                    |

After the `X-Frame-Options` deploy, re-run the baseline once to confirm the Medium clickjacking warning clears (recorded in the checklist row).

## Commands

```bash
bash scripts/dev/check-gitleaks.sh                      # history secret scan
semgrep scan --config p/owasp-top-ten --config p/secrets --config p/typescript ui/src supabase/functions
bun audit
osv-scanner scan source -r .
docker run --rm -v /tmp/zap:/zap/wrk/:rw ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t https://dev.kamehomes.space -J zap.json -r zap.html -I
```
