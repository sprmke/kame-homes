---
title: 'Super admin manual QA'
status: active
tags: [guides, testing, manual, admin]
updated: 2026-09-10
---

# Super admin manual QA

Do not automate in PR CI: step-up OTP email, irreversible org actions, live PayMongo ledger.

## Automated coverage

| Layer     | Path                                                        |
| --------- | ----------------------------------------------------------- |
| Unit      | `supabase/functions/_shared/superAdminVerification_test.ts` |
| E2E shell | `ui/e2e/features/admin/adminShellSmoke.spec.ts` (`@ci`)     |

## Manual checklist

- [ ] Super admin login with allow-listed email
- [ ] Step-up OTP send + verify on a mutating action (e.g. platform settings save)
- [ ] Approvals queue: approve / reject org verification
- [ ] Parking payouts: review ledger row (read-only in staging)
- [ ] Confirm non-super-admin session cannot reach `/admin` routes
