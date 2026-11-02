---
title: Phase 1 prod wiring checklist (fwor-as-prod)
status: active
updated: 2026-11-01
---

# Phase 1 — prod wiring (operator)

Production Supabase is **`fworvijbrwpyngycotbz`**. Legacy guests still use **`zftt…`** until T0.

Local verify (no dashboard writes):

```bash
bun scripts/migrate/legacy-to-mt-prod/verify-phase1-wiring.ts
# Auth allow list (needs valid Management API token):
# Personal Access Token (sbp_…), NOT `supabase login` — see supabase/.env.management.example
# export SUPABASE_ACCESS_TOKEN=sbp_...
bun scripts/migrate/legacy-to-mt-prod/verify-fwor-auth-redirects.mjs
# Apply missing redirect URLs (production Auth config — requires kamewave in shell):
# KAMEWAVE=kamewave SUPABASE_ACCESS_TOKEN=sbp_... bun scripts/migrate/legacy-to-mt-prod/apply-fwor-auth-phase1.mjs
```

## 1.1 Supabase dashboard

- [ ] Rename project display name to production label (optional).
- [ ] Record ref in [`deployment.md`](../../architecture/deployment.md) and `supabase/.env.prod.local` (gitignored template: `supabase/.env.prod.example`).

## 1.3 Extensions

Confirm on fwor: `pgcrypto`, `pg_trgm`, `pg_cron`, `pg_net`, `plpgsql` (see Phase 0.4 inventory).

- [x] **2026-11-02** — `pg_cron` and `pg_net` were missing. Installed both; `pg_trgm`/`pgcrypto`/`supabase_vault`/`uuid-ossp` were present.
- [x] 26 scheduled jobs rebuilt with `scripts/migrate/legacy-to-mt-prod/sql/60-install-extensions-and-crons.sql`; the 13 outbound jobs are parked until T0.
- [ ] At T0: `sql/61-activate-all-crons.sql` after the legacy crons are unscheduled.

## 1.4 Auth

- [ ] Site URL: `https://kamespace.com` (keep `dev.kamehomes.space` until T0; **2026-11-01** allow list includes kamespace + legacy apex)
- [x] Redirect URLs: **`app`**, **`dev`**, **`kamespace.com`** verified **2026-11-01** (`verify-fwor-auth-redirects.mjs`)
- [ ] Site URL → `https://kamespace.com` at T0 (currently `dev.kamehomes.space`)
- [ ] Google provider: **prod** OAuth client (not legacy client if rotating at cutover)

### Dev vs prod URL (same data, different domains)

| URL                           | Vercel                                   | Supabase         | Notes                                                                                 |
| ----------------------------- | ---------------------------------------- | ---------------- | ------------------------------------------------------------------------------------- |
| **`dev.kamehomes.space`**     | `kame-homes` Preview (`develop`)         | **fwor**         | Multi-tenant app + migrated bookings                                                  |
| **`app.kamehomes.space`**     | `kame-homes` Production (`main`)         | **fwor**         | Same `VITE_SUPABASE_*` ref and anon key as dev (verify in built `/assets/index-*.js`) |
| **`kamehomes.space` / `www`** | **`guest-form-management-app`** (`main`) | **zftt… legacy** | Old single-property admin, **not** fwor. Expect different logins and no org hub.      |

**Not a dev/prod database split:** fwor holds the migrated dataset (e.g. ~450 `guest_submissions`, storage buckets synced). If **`app.kamehomes.space`** sends you to **create organization**, you are usually signed into fwor as a **new Auth user** (empty org list), not reading a empty database.

**Accounts on fwor today (hosted DB check):**

- Org **`kame-homes`** owner: **`kamehome.azurenorth@gmail.com`** (not `comhome.azurenorth@…`).
- Platform access: emails on fwor Edge secret **`SUPER_ADMIN_EMAILS`** (e.g. **`sprmke.dev@gmail.com`** if listed) see all orgs via `list-organizations`.
- Sign-in with an email that is **not** an org owner, member, or super-admin → **`/onboarding`** (by design).

**Checks:**

1. Use **`app.kamehomes.space`** or **`dev.kamehomes.space`**, not **`kamehomes.space`**, for multi-tenant prod data.
2. Sign in with the **same Google account** you use on dev (cookie is per subdomain).
3. Confirm Auth redirect allow list includes **`app.kamehomes.space`**.
4. Add operator emails to **`SUPER_ADMIN_EMAILS`** on fwor if they need cross-org access without owning an org.

## 1.5 Vercel `kame-homes`

- [x] Production env → fwor (**2026-11-01** `pull-vercel-env.mjs` + wiring verify)
- [ ] Production branch = `main` (confirm in Vercel dashboard at release)
- [ ] Do **not** attach `kamespace.com` until T0

## 1.6 GitHub `production` environment

- [x] Secrets bootstrapped **2026-11-01** — `bootstrap-github-production-env.sh` (`SUPABASE_PROJECT_REF`, legacy ref, token, DB password, anon)
- [x] `CUTOVER_ENABLED=true` repo variable (verified 2026-11-02) — CD Prod deploys on `main`

## DNS records to add (Namecheap, zone `kamespace.com`)

Vercel project `kame-homes` already has `kamespace.com` and `www.kamespace.com` (308 → apex) attached and verified. The apex still resolves to the Namecheap parking IP, so Production will not serve until these records exist.

| Host                        | Type  | Value                                             | Notes                                    |
| --------------------------- | ----- | ------------------------------------------------- | ---------------------------------------- |
| `@`                         | A     | `216.198.79.1`                                    | same Vercel anycast IP the legacy apex uses |
| `www`                       | CNAME | `cname.vercel-dns.com`                            | Vercel serves the 308 → apex             |
| `resend._domainkey`         | TXT   | copy from Resend → Domains → `kamespace.com`      | DKIM                                     |
| `send`                      | MX    | `feedback-smtp.ap-northeast-1.amazonses.com` (10) | Resend return-path                       |
| `send`                      | TXT   | `v=spf1 include:amazonses.com ~all`               | SPF for the return-path                  |
| `rsend`                     | CNAME | `send.forge.rmta.net`                             | Resend click/open domain                 |
| `inbound`                   | MX    | `receive-apne1.forge.rmta.net` (10)               | Resend **receiving** (PMO approvals)     |
| `resend._domainkey.inbound` | TXT   | copy from Resend → Domains → `inbound.kamespace.com` | DKIM for the inbound subdomain        |
| `send.inbound`              | MX    | `feedback-smtp.ap-northeast-1.amazonses.com` (10) | inbound subdomain return-path            |
| `send.inbound`              | TXT   | `v=spf1 include:amazonses.com ~all`               | inbound subdomain SPF                    |
| `rsend.inbound`             | CNAME | `send.forge.rmta.net`                             | inbound subdomain click/open             |
| `_dmarc`                    | TXT   | `v=DMARC1; p=none; rua=mailto:mail@kamespace.com` | tighten to `quarantine` after hypercare  |

Resend state (2026-11-02): `kamespace.com` added with sending enabled and receiving **disabled**; `inbound.kamespace.com` added with sending + receiving enabled. Both are `pending` until DNS lands.

## Auth and OAuth at T0

- [ ] `site_url` → `https://kamespace.com` (currently `https://dev.kamehomes.space`). Redirect allow-list already contains `kamespace.com/**` and `www.kamespace.com/**`.
- [ ] Google provider: production OAuth client with redirect `https://fworvijbrwpyngycotbz.supabase.co/auth/v1/callback` (current client id is the legacy/shared one).
- [ ] After DNS: verify Resend domains, then update `RESEND_FROM_EMAIL=mail@kamespace.com` and `RESEND_APPROVAL_INBOUND_DOMAIN=inbound.kamespace.com` on `fwor`, and redeploy `send-*`/approval functions.

## 1.2 Rehearsal project (optional)

Throwaway Supabase project for B-17 restore drill; delete after cutover.

Related: [`legacy-cutover-phase-status.md`](./legacy-cutover-phase-status.md).
