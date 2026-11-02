---
title: 'Production audit — kamespace.com (2026-11-02)'
status: active
stage: in-progress
kind: evidence
readiness: partial
launch_gate: 'A–F'
launch_blocker: true
last_verified: '50ffe009 2026-11-02'
---

# Production audit — kamespace.com

First pass that treats `fwor…` as production (it has been since 2026-10-27) and audits the **live**
site rather than the preview.

| Fact                    | Value                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| Production UI           | `https://kamespace.com` (legacy `kamehomes.space` still serves the old app on `zftt…`)                  |
| Production backend      | `fworvijbrwpyngycotbz` — shared with `dev.kamehomes.space`, which is **not** a separate staging backend |
| Production branch       | `main` (the site does **not** follow `develop`)                                                         |
| Live data at audit time | 1 org (`kame-homes`), 1 property (`monaco-2604`)                                                        |

## Findings

### 1. Production was blocked from search engines (blocker — fixed in code)

```
$ curl -s https://kamespace.com/robots.txt
User-agent: *
Disallow: /
```

Lighthouse mobile on production: **SEO 69**, single failing audit `is-crawlable` ("Page is blocked from indexing"). Two causes:

1. `DEFAULT_INDEXABLE_HOSTS` only listed `kamehomes.space`; the kamespace rebrand never added `kamespace.com` ([#215](https://github.com/sprmke/kame-homes/pull/215)).
2. Even after that, the middleware replaces the defaults with `SEO_INDEXABLE_HOSTS` whenever Vercel sets it, and production still carries the pre-rebrand list, so `kamespace.com` stayed blocked ([#216](https://github.com/sprmke/kame-homes/pull/216) unions the env list with the defaults so a stale env can only ever _add_ hosts).

Both merged to `main`. **As of this pass the live site still serves the old build** (see finding 4), so the robot fix is not live yet.

### 2. Production sitemap pointed at the dev host (fixed)

```
$ curl -s https://kamespace.com/sitemap.xml | head -3
<url><loc>https://dev.kamehomes.space/</loc></url>
```

`PUBLIC_GUEST_APP_ORIGIN` on the production project was still `https://dev.kamehomes.space`, so the
sitemap (and every absolute link built from that helper, including guest form links in email) pointed
at the preview host. Set to `https://kamespace.com` on `fwor…` (2026-11-02). Verified: the production
sitemap now lists `https://kamespace.com/…`.

### 3. Missing anti-clickjacking header on production (fixed in code)

ZAP baseline flagged `Missing Anti-clickjacking Header`; production sends no `X-Frame-Options` and the
CSP is Report-Only, so `frame-ancestors 'self'` does not apply. Added
`X-Frame-Options: SAMEORIGIN` ([#215](https://github.com/sprmke/kame-homes/pull/215)).

### 4. Production is behind `main` (operator — Vercel configuration)

Merges to `main` produce Vercel deployments in the **Preview** environment
(`gh api repos/sprmke/kame-homes/deployments` shows `Preview – kame-homes` for every `main` commit),
and `kamespace.com` keeps serving an older build:

- `kamespace.com` CSS has no `--brand-ink` (added in #210 on `develop`), and no `x-frame-options` after #215 merged.
- A deployment for a `main` commit shows `Deployment has failed` on Vercel while the same tree builds locally.

Until the `kame-homes` Vercel project's production branch is set to `main` (or the deployment is
promoted to `kamespace.com`), production cannot receive any of the merged fixes. This is a dashboard
setting, not a code change.

### 5. Mobile performance on production

`BASE_URL=https://kamespace.com node scripts/performance/lighthouse-medians.mjs --runs=3`
([`lighthouse-medians-2026-11-02.md`](./lighthouse-medians-2026-11-02.md)):

| Route                          | Perf | A11y | BP  | SEO | LCP   | CLS   |
| ------------------------------ | ---- | ---- | --- | --- | ----- | ----- |
| `/`                            | 60   | 100  | 100 | 69  | 9.6s  | 0     |
| `/properties`                  | 61   | 100  | 100 | 69  | 9.0s  | 0     |
| `/parkings`                    | 62   | 100  | 100 | 66  | 8.6s  | 0     |
| `/developments`                | 62   | 100  | 100 | 66  | 8.0s  | 0     |
| `/search`                      | 60   | 100  | 100 | 69  | 9.1s  | 0.058 |
| `/for-hosts`                   | 60   | 100  | 100 | 63  | 8.3s  | 0     |
| `/for-hosts/pricing`           | 63   | 100  | 100 | 63  | 6.8s  | 0     |
| `/properties/monaco-2604`      | 60   | 100  | 96  | 69  | 11.0s | 0     |
| `/properties/monaco-2604/form` | 59   | 100  | 96  | 63  | 11.7s | 0     |

- **A11y is 100 on every route** on the older production build.
- SEO 63–69 is the robots blocker (finding 1) — the only SEO audit that fails.
- Perf 59–63 with LCP 6.8–11.7s: Lighthouse attributes ~832 KiB of image savings, 370 ms render-blocking,
  332 KiB unused JS. Part of this is already improved on `develop` (#152/#156/#172) but cannot reach
  production until finding 4 is resolved.

## Operator actions

| #   | Action                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Set the `kame-homes` Vercel project production branch to `main` (or promote the latest `main` deployment to `kamespace.com`), then confirm the build is green |
| 2   | Update or delete `SEO_INDEXABLE_HOSTS` in Vercel (Production + Preview) so the intent matches the code defaults                                               |
| 3   | Re-check `kamespace.com/robots.txt` (`Allow: /` + `Sitemap: https://kamespace.com/sitemap.xml`) and `x-frame-options` after the release                       |
| 4   | Confirm `RESEND_FROM_EMAIL` / `SUPPORT_TEAM_EMAIL` are production values (they were updated 2026-11-02)                                                       |
