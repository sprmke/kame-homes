# QA seed (Phase 4.2) and cross-tenant probes (Phase 6 A01 / API1) — hosted dev — 2026-10-19

## Seed

`node scripts/dev/seed-readiness-qa-dev.mjs` (idempotent, hosted dev only, through real edge functions).

| Account                            | Org                     | Listing                     |
| ---------------------------------- | ----------------------- | --------------------------- |
| `sprmke.dev+qa-owner@gmail.com`    | `readiness-qa-stays`    | `qa-monaco-1801` **ACTIVE** |
| `sprmke.dev+qa-outsider@gmail.com` | `readiness-qa-outsider` | `qa-outsider-loft` INACTIVE |
| `sprmke.dev+qa-guest@gmail.com`    | none                    | —                           |

Logins: `supabase/.env.qa.dev.local` (gitignored). `list-public-properties` total went 0 → 1. Existing teammate orgs untouched.

Validation seen on the way (server-side, correct):

- `create-organization` rejects a free-text contact role (`Please select a valid contact role`).
- Tower must be one of `Monaco, Bali, Barbados` for Azure North.
- **Supabase Auth captcha is on for hosted dev**: password sign-in without a captcha token returns `captcha_failed`. Evidence for P0-2 on dev (prod still unverified).

## Cross-tenant probes

`node scripts/dev/probe-readiness-idor-dev.mjs` — **no cross-tenant access**.

| Call                               | Owner | Outsider | Guest |
| ---------------------------------- | ----- | -------- | ----- |
| GET list-bookings                  | 200   | 403      | 403   |
| GET dashboard-stats                | 200   | 403      | 403   |
| GET finance-summary                | 200   | 403      | 403   |
| GET app-settings                   | 200   | 403      | 403   |
| GET property-team-members          | 200   | 403      | 403   |
| GET list-activity-log              | 200   | 403      | 403   |
| GET org-settings                   | 200   | 403      | 403   |
| GET org-team-members               | 200   | 403      | 403   |
| GET org-plan                       | 200   | 403      | 403   |
| PATCH update-property (→ INACTIVE) | —     | 403      | 403   |
| POST create-property in owner org  | —     | 403      | 403   |
| PATCH update-organization rename   | —     | 403      | 403   |
| DELETE delete-property             | —     | 403      | 403   |

Owner listing still `ACTIVE` after the denied writes.

Not covered yet: role-scoped members (Full Access / Operations / Read Only) need invites, which send email.
