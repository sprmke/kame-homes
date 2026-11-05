# Live probes (hosted-dev) — 2026-10-19

SHA of functions being deployed: `3e269a98` (PR #145). UI: Vercel `dev.kamehomes.space` (may lag `develop`).

| Probe                                                    | Result                                                                                                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET …/functions/v1/get-health`                          | HTTP 200, `{ success, status: ok, db: ok }`, ~4.0s cold                                                                                               |
| `GET https://dev.kamehomes.space/`                       | HTTP 200, HSTS on, CSP **Report-Only**, nosniff, referrer-policy, permissions-policy                                                                  |
| `x-robots-tag`                                           | **absent**                                                                                                                                            |
| `/robots.txt`                                            | Allows `/` and public listings; disallows `/org/`, `/admin`, guest-private paths. **Dev is indexable** unless Search Console / noindex added (PR-103) |
| `/sitemap.xml`                                           | HTTP 200                                                                                                                                              |
| `list-public-pricing-plans` with `Accept-Encoding: gzip` | HTTP 200, gzip body (magic `1f 8b`)                                                                                                                   |

CORS / abuse scripts: wait until function deploy finishes (~92/311 at capture).
