# Phase 5.7 static guards — 2026-10-19

Run on worktree `/tmp/kh-p1` at `dddd1977` (stacked on `3e269a98`).

| Guard                               | Result                                        |
| ----------------------------------- | --------------------------------------------- |
| `check-unbounded-select.sh`         | OK                                            |
| `check-select-star.sh`              | OK                                            |
| `check-ai-gateway.mjs`              | OK                                            |
| `audit-auth-matrix.mjs --check`     | ok: 310 functions; 0 zero-authz               |
| `check-cache-class.sh`              | OK                                            |
| `check-serve-public-rate-limit.sh`  | OK                                            |
| `check-authenticated-rate-limit.sh` | OK                                            |
| `check-vercel-headers.sh`           | OK                                            |
| `audit-edge-functions.mjs --check`  | ok: 310 functions; 19 hand-rolled allowlisted |
| `check-tracked-secrets.sh`          | OK                                            |

Not run this slice (need time / local DB / hosted finish): full `ci:quality`, Playwright full, `db:reset`, Lighthouse 3×, `eval:ai`, `check:plan-catalog`.
