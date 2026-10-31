---
title: 'ASVS 5.0 L2 (selected)'
status: active
updated: 2026-10-19
launch_gate: B
readiness: unverified
---

# ASVS 5.0 Level 2 (selected controls)

Not a full certification. Controls that map to this stack:

| Area               | Control                                      | Status                               |
| ------------------ | -------------------------------------------- | ------------------------------------ |
| V2 Auth            | MFA / step-up on destructive super-admin     | 🟡 QA #7                             |
| V3 Session         | Sign-out clears caches                       | 🟡 PR-015                            |
| V4 Access          | Server-side permission leaves                | 🟡 catalogs + `resolveScoped*Access` |
| V5 Validation      | Server Zod on writes                         | 🟡 PR-018                            |
| V7 Error           | No stack/secrets in JSON                     | 🟡 pentest item                      |
| V8 Data protection | PII buckets private; signed URLs             | 🟡 PR-016                            |
| V9 Communication   | TLS; HSTS at edge                            | 🟡 verify:deployed-preview           |
| V10 Malicious      | MIME sniff uploads                           | 🟡 remaining paths PR-016            |
| V11 Business logic | Workflow orchestrator; payments server-price | 🟡 PR-104                            |
| V12 Files          | Storage policies + path tenant scope         | 🟡 PR-016                            |
| V13 API            | Rate limits; inventory                       | 🟡                                   |
| V14 Config         | Secrets not in git; `check-tracked-secrets`  | 🟡                                   |
| V15 Code           | CI quality + static guards                   | 🟡 PR #145                           |
