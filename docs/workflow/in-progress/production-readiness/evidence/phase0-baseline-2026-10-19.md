# Phase 0 baseline — 2026-10-19

**Baseline SHA: `c0f04aff`** (`develop` after #145–#181 except #153). Edge functions on hosted dev `fworvijbrwpyngycotbz` deployed from it with `deploy-supabase-dev.sh --functions-only`; the UI deploys from the same commit on Vercel (`dev.kamehomes.space`).

## How it got here

| Step                                                               | Result                                                                                                                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| CD Dev quality gate on `b8fe276b` (same `supabase/` as `c0f04aff`) | `@smoke` + `@ci` passed after #177 and #179                                                                                        |
| CD Dev deploy job                                                  | Failed at the migration step: dev has 12 migrations not in `develop` (PR-130, uncommitted work from another session). Not repaired |
| Functions deploy from `develop`                                    | Done locally with the dev script (user decision). No new migrations since `3e269a98`, so schema needed no change                   |

## Post-deploy checks (hosted dev, baseline)

| Check                                                            | Result                                                      |
| ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `get-health`                                                     | 200                                                         |
| Cross-tenant IDOR (`probe-readiness-idor-dev`)                   | No cross-tenant access                                      |
| RBAC matrix (`probe-readiness-rbac-dev`)                         | Full Access / Operations / Read Only match seeded templates |
| Upload byte sniffing (`probe-readiness-uploads-dev`)             | HTML / PDF as PNG rejected, real PNG accepted               |
| Guest-link tokens past grace (`probe-readiness-guest-token-dev`) | 401 without and with forged token, 200 inside grace         |
| Team invite abuse (`probe-readiness-invites-dev`)                | 403 / 404 / 200 / 410 / 410 as expected                     |
| Public listing page view stored (PR-117)                         | Browser visit → `POST property-page-view` 200, count 9 → 10 |
| `dev.kamehomes.space/robots.txt` (PR-103)                        | `Disallow: /`                                               |
| CSP header (PR-012)                                              | New policy served (report-only)                             |
| `get-public-property` warm latency                               | 1.2–1.4s (was 2.1–2.5s before #180)                         |
