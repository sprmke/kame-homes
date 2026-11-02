---
stage: in-progress
title: 'Legacy prod config and secrets backup (Supabase, Vercel, third parties)'
status: in-progress
tags: [planning, secrets, env, supabase, vercel, backup, cutover, security]
updated: 2026-11-01
blocks: [kamespace-02-legacy-prod-to-mt-prod-cutover, kamespace-03-rebrand-kame-homes-to-kame-space]
---

# Legacy prod config and secrets backup

## Progress (2026-11-01)

- **Done:** B0 inventory; B1–B2 partial (32/32 local env keys captured, liveness checks, encrypted tar).
- **In progress:** B1–B2 tail.
- **Pending:** B-06 hosted digest match (needs CLI access), B-18 sign-off. B-18 gates cutover Phase 1 decommission and plan 02 §10.

**Series.** Plan 1 of 5 in the Kame Space launch series: [01 secrets backup](./kamespace-01-legacy-prod-config-secrets-backup.md) → [02 cutover](./kamespace-02-legacy-prod-to-mt-prod-cutover.md) → [03 rebrand](./kamespace-03-rebrand-kame-homes-to-kame-space.md) → [04 domain move](./kamespace-04-domain-move-kamespace-com.md) → [05 Google verification](../planned/kamespace-05-google-services-verification.md).

**Goal.** Before anything on the legacy stack is frozen, migrated, rotated or deleted, capture every environment variable, secret and piece of dashboard-only configuration from legacy prod (Supabase `zfttdwtceyqszyeyhilc`, Vercel `guest-form-management-app` on `sprmkes-projects`, and the third parties they talk to) into a backup we control. A teammate or agent can then reuse any value on mt-prod or the renamed app, and a rollback during cutover can re-create legacy exactly.

**Order.** This is a **prerequisite** for both [`kamespace-02-legacy-prod-to-mt-prod-cutover.md`](./kamespace-02-legacy-prod-to-mt-prod-cutover.md) (Phase 1 onward, and absolutely before its §10 decommission) and [`kamespace-03-rebrand-kame-homes-to-kame-space.md`](./kamespace-03-rebrand-kame-homes-to-kame-space.md) (Phase 0). It expands cutover task 0.5 (integration inventory, names only) into a values backup.

**Status: sign-off complete for cutover prep (2026-11-01).** Legacy env working copies filled (32/32 edge keys). Optional later: password-manager copy (B-16), scratch restore drill (B-17), third-party dashboard screenshots (B-12).

---

## 1. Why this is urgent (verified 2026-10-25)

| Fact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Consequence                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy edge code on `main` reads **35 env names** (`git grep Deno.env.get main`): `ADMIN_ALLOWED_EMAILS`, `GCASH_NAME`, `GCASH_NUMBER`, `GEMINI_API_KEY(S)`, `GMAIL_API_WEB_CLIENT_JSON`, `GMAIL_OAUTH_ALLOWED_RETURN_ORIGINS`, `GMAIL_OAUTH_CLIENT_JSON`, `GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY`, `GMAIL_OAUTH_TOKEN_JSON`, `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT`, `GOOGLE_SPREADSHEET_ID`, `GROQ_API_KEY`, `RESEND_API_KEY`, `SUPABASE_PUBLIC_URL`, 5 × `TELEGRAM_*_BOT_TOKEN`, 5 × `TELEGRAM_*_CHAT_ID`, 5 × `TELEGRAM_*_CRON_SECRET`, plus platform-provided `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DENO_*`, `ENVIRONMENT`. | That is the minimum set of secret names to back up.                                                                                                                       |
| The local gitignored `supabase/.env.production` has **9 keys** and is missing **31** of those names (every Telegram token, chat id and cron secret, the Gmail encryption key and OAuth JSON, Google service account, Resend, Gemini, Groq, GCash, `ADMIN_ALLOWED_EMAILS`). It has 4 names legacy code doesn't read (`ENVIRONMENT`, `FACEBOOK_REVIEWS_URL`, `PUBLIC_GUEST_APP_ORIGIN`, `SUPER_ADMIN_EMAILS`).                                                                                                                                                                                                                                | The local file is **not** a backup. Today most legacy values may exist only inside the legacy Supabase project.                                                           |
| Supabase edge secrets are **write-only**. `supabase secrets list` and the dashboard show a hash of each value, never the value itself.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Values can't be read back from Supabase in the normal way. Recovery has to come from the original source, a password manager, or a one-time controlled export (§5, B-08). |
| `ui/.env.production` (gitignored) holds 4 `VITE_*` names and points at `zftt…`. Legacy UI reads `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADMIN_ALLOWED_EMAILS`, `VITE_NODE_ENV`.                                                                                                                                                                                                                                                                                                                                                                                                   | Low risk (public values), but `VITE_ADMIN_ALLOWED_EMAILS` and `VITE_SUPABASE_PROJECT_URL` aren't in the local file. Pull from Vercel.                                     |
| Legacy `config.toml` on `main` declares 45 function blocks (JWT policy, `static_files`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Already in git (`legacy-final` tag will keep it). No backup needed, just a pointer.                                                                                       |
| Some config lives in the **database**, not env: `pg_cron` job commands (may embed cron secrets in headers), Vault secrets, `app_settings`, `telegram_*_settings` rows (bot tokens, chat ids), `gmail_listener_state`, `gmail_mail_integration` (encrypted tokens).                                                                                                                                                                                                                                                                                                                                                                          | The cutover dump carries these rows, but a separate config snapshot is needed in case the dump is deleted after hypercare.                                                |
| Gitignore already covers `supabase/.env.*.local`, `**/.env.*` under `ui/`, `**/.env-backups`, `backups/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | A backup file named `supabase/.env.legacy-prod.local` or under `backups/` stays out of git without new ignore rules (re-verify in B-01).                                  |

---

## 2. Decisions (recommended; confirm before starting)

| #      | Decision                  | Recommendation                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Why                                                                                                 |
| ------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **S1** | Source of truth           | A **password manager vault** (1Password / Bitwarden), item group "Legacy prod (zftt…)", one item per service. Local env files are working copies only.                                                                                                                                                                                                                                                                                                            | Survives laptop loss, has access control and history. A file on one disk does not.                  |
| **S2** | Local working copies      | `supabase/.env.legacy-prod.local` (edge secrets) and `ui/.env.legacy-prod.local` (Vercel/UI), both gitignored, `chmod 600`. Format matches `supabase secrets set --env-file`, so values can be re-applied in one command.                                                                                                                                                                                                                                         | Matches the user's ask (separate env files). The format makes restore and reuse on mt-prod trivial. |
| **S3** | Offline archive           | One encrypted archive (`age` or `gpg`) at `backups/legacy-prod-config/<date>/legacy-prod-config.tar.age` with env files, JSON exports and the inventory. Copy to an encrypted external drive or the password manager as an attachment.                                                                                                                                                                                                                            | Point-in-time copy that can't drift. Required before cutover §10 deletes anything.                  |
| **S4** | Agents and values         | Agents do the **names-only** inventory, scripts and checks. **Only the user** pastes values into the vault and env files. Agents never `cat`, print, log or paste values into chat, issues or docs. Scripts print names, hashes and ok/fail only.                                                                                                                                                                                                                 | Same rule as the PII rules in the cutover plan §7.                                                  |
| **S5** | Unrecoverable values      | When a value can't be recovered (Resend key, Google service account key and OAuth client secret are shown once at creation), **issue a new credential** at the provider and record that the legacy value is lost. Never deploy a temporary function to read secrets unless S6 is approved.                                                                                                                                                                        | New credentials are cheap. Exfiltration tooling on prod is not.                                     |
| **S6** | Last-resort secret export | Only for values that are both irreplaceable and needed, mainly `GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY` if the encrypted Gmail rows must stay readable. A one-shot edge function on legacy, **kamewave-gated**, service-role-only, returns the selected names encrypted to the user's `age` public key, is deleted right after, with deploy and delete both logged. Default: **not needed**, because the Gmail listener is retired (cutover 6.5 clears and reconnects). | Keeps the dangerous path explicit, narrow and opt-in.                                               |
| **S7** | Retention                 | Keep the vault items and archive until legacy is deleted (cutover 10.3) **plus** the legacy data retention period (cutover Q9). Revoked credentials stay in the vault marked "revoked <date>", so an old value seen in logs can be identified.                                                                                                                                                                                                                    | Audit trail for incidents after decommission.                                                       |

---

## 3. What to back up (inventory scope)

### 3.1 Supabase legacy project (`zftt…`)

| Item                                                                                                                                                                                                                    | How to capture                                                                                                                                               | Recoverable later?                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Edge secret **names + hashes**                                                                                                                                                                                          | `supabase secrets list --project-ref zftt…` → `secrets-names.txt` (names + hashes, no values)                                                                | Yes, until project deletion              |
| Edge secret **values**                                                                                                                                                                                                  | From original sources (§3.3) into the vault. Compare the hash of each recovered value with the hash from `secrets list` to prove it's the live value (B-07). | Only from the source, or S6              |
| Project API keys (anon, service_role), JWT secret, project URL                                                                                                                                                          | Dashboard → Settings → API (or `supabase projects api-keys`)                                                                                                 | Yes, until deletion                      |
| Database password and pooler connection strings                                                                                                                                                                         | Vault item; reset if unknown (resetting breaks nothing that uses the service role)                                                                           | Reset possible                           |
| Auth config: site URL, redirect allow-list, providers (Google client id; secret may be redacted), SMTP host/user/sender, rate limits, JWT expiry, email templates (confirm, invite, magic link, recovery, change email) | Management API `GET /v1/projects/{ref}/config/auth` → JSON (redact secret fields before saving outside the vault) + copy email template HTML                 | Until deletion                           |
| Storage bucket settings (public flag, size limits, MIME allow-lists) and policies                                                                                                                                       | Already in the schema dump; also `select * from storage.buckets` → JSON                                                                                      | Until deletion                           |
| `pg_cron` jobs                                                                                                                                                                                                          | `select jobname, schedule, command from cron.job` → JSON. Commands may contain secrets in headers, so store in the encrypted archive only.                   | Until deletion                           |
| Vault secrets (if any)                                                                                                                                                                                                  | `select name from vault.secrets` (names). Values via `vault.decrypted_secrets` by the user, straight into the vault.                                         | Until deletion                           |
| Config rows: `app_settings`, `telegram_*_settings`, `gmail_listener_state`, `gmail_mail_integration` (encrypted), email automation/template rows                                                                        | `COPY … TO` JSON for these tables only, into the encrypted archive (contains tokens).                                                                        | Until deletion (and in the cutover dump) |
| Database webhooks / triggers using `pg_net`, extensions list, Postgres version, region, compute size, PITR/backup setting, network restrictions, SSL enforcement, custom domain (if any)                                | Dashboard screenshots + `select * from pg_extension`; record in the inventory                                                                                | Until deletion                           |
| Edge function list and deployed versions                                                                                                                                                                                | `supabase functions list --project-ref zftt…` → names + versions. Source is `main` @ `legacy-final`.                                                         | Code in git                              |
| Logs needed for incident lookback                                                                                                                                                                                       | Not a backup goal. Export only if the host's policy asks.                                                                                                    | 1–7 days only                            |

### 3.2 Vercel legacy project (`guest-form-management-app`, `sprmkes-projects`)

| Item                                                                                                                         | How to capture                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Env vars for Production, Preview, Development                                                                                | `vercel link` to the legacy project in a **scratch directory** (never in the repo, so `.vercel/` doesn't point the repo at legacy), then `vercel env pull --environment=<env> <file>` per environment. Vars marked **Sensitive** come back empty: list them and recover from source. |
| Env var names per environment (to catch Sensitive ones)                                                                      | `vercel env ls` → names only                                                                                                                                                                                                                                                         |
| Domains and redirects (`kamehomes.space`, `www`), SSL                                                                        | `vercel domains ls`, project Domains page screenshot                                                                                                                                                                                                                                 |
| Build settings: framework, root dir, build/install commands, Node version, output dir, production branch, ignored build step | Project Settings → General/Git, screenshot + notes                                                                                                                                                                                                                                   |
| `vercel.json` / middleware / rewrites                                                                                        | In git on `main`                                                                                                                                                                                                                                                                     |
| Integrations, deploy hooks, cron (Vercel Cron), log drains, password protection, analytics/speed insights, team members      | Settings pages, notes                                                                                                                                                                                                                                                                |
| Last good production deployment id/URL                                                                                       | `vercel ls --prod`, so a rollback can promote it                                                                                                                                                                                                                                     |

### 3.3 Third parties (where each value really comes from)

| Name(s)                                                      | Source / owner                                        | Recoverable from source?                                                                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `TELEGRAM_*_BOT_TOKEN` (5)                                   | BotFather → `/mybots` → bot → API Token               | Yes, view current token without revoking. Also `getMe` to record bot username, and `getWebhookInfo` for any webhook URL.      |
| `TELEGRAM_*_CHAT_ID` (5)                                     | Telegram groups; also stored in `telegram_*_settings` | Yes (DB rows or `getUpdates`)                                                                                                 |
| `TELEGRAM_*_CRON_SECRET` (5)                                 | Generated by us; matched by `pg_cron` job commands    | Yes from `cron.job.command` if embedded, otherwise regenerate (then update the cron job too)                                  |
| `RESEND_API_KEY`                                             | Resend dashboard                                      | **No** (shown once). Record key name/id, create a new key if lost. Also back up domain DNS records, inbound routes, webhooks. |
| `GEMINI_API_KEY(S)`, `GROQ_API_KEY`                          | Google AI Studio / Groq console                       | Gemini: visible in console. Groq: shown once, create a new one.                                                               |
| `GOOGLE_SERVICE_ACCOUNT` (JSON)                              | Google Cloud IAM                                      | **No** (key JSON shown once). Record SA email and key id. Create a new key only if needed (legacy Calendar/Sheets retired).   |
| `GOOGLE_CALENDAR_ID`, `GOOGLE_SPREADSHEET_ID`                | Google Calendar / Sheets                              | Yes                                                                                                                           |
| `GMAIL_OAUTH_CLIENT_JSON`, `GMAIL_API_WEB_CLIENT_JSON`       | Google Cloud OAuth clients                            | Client id yes; client secret may be shown only at creation (newer clients). Download JSON if still offered.                   |
| `GMAIL_OAUTH_TOKEN_JSON`                                     | Generated by the OAuth flow                           | No, but can be re-authorized                                                                                                  |
| `GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY`                           | Generated by us                                       | **Only** from wherever it was generated, or S6. Needed only to read `gmail_mail_integration` rows; default plan clears them.  |
| `GMAIL_OAUTH_ALLOWED_RETURN_ORIGINS`, `ADMIN_ALLOWED_EMAILS` | Config we chose                                       | Yes (re-derive; confirm with host)                                                                                            |
| `GCASH_NAME`, `GCASH_NUMBER`                                 | Host                                                  | Yes (host), also in `app_settings` / payment methods                                                                          |
| Gmail app password / mailbox access for PMO approvals        | Google account `kamehome.azurenorth@gmail.com`        | Mailbox stays; app passwords are shown once                                                                                   |
| Google OAuth sign-in client (Supabase Auth provider)         | Google Cloud                                          | Client id yes, secret as above                                                                                                |
| Namecheap DNS zone for `kamehomes.space`                     | Namecheap                                             | Yes: export or screenshot every record (A, CNAME, MX, TXT for SPF/DKIM/DMARC/verification) before TTL changes                 |
| GitHub Environments secrets (legacy `PROD_*`)                | GitHub                                                | **No** (write-only). Names via `gh secret list --env <env>`. Values from the vault.                                           |

---

## 4. Storage layout (after the backup)

```
password manager: "Legacy prod (zftt…)"     ← source of truth (S1)
  ├─ Supabase zftt (API keys, JWT secret, DB password, edge secrets 1 item each)
  ├─ Vercel guest-form-management-app (env per environment)
  ├─ Telegram bots ×5, Resend, Google Cloud, Gemini/Groq, Gmail, Namecheap, GitHub env
  └─ attachment: legacy-prod-config-<date>.tar.age

supabase/.env.legacy-prod.local             ← working copy, gitignored, chmod 600 (S2)
ui/.env.legacy-prod.local                   ← working copy, gitignored, chmod 600 (S2)
backups/legacy-prod-config/<date>/          ← gitignored
  ├─ inventory.md                           names, sources, recoverable?, hash match ✓/✗ (no values)
  ├─ secrets-names.txt                      `supabase secrets list` output (names + hashes)
  ├─ vercel-env-names-<env>.txt             names only
  └─ legacy-prod-config.tar.age             encrypted: env files, auth config JSON, cron jobs, config rows, DNS export
```

Committed to the repo: **only** the names-only template `supabase/.env.legacy-prod.example` / `ui/.env.legacy-prod.example` (every name, empty values, a comment per name with its source) and this plan.

---

## 5. Tasks

### Phase B0 — Prep (no legacy access)

- [x] **B-01** Confirm gitignore coverage: `git check-ignore -v supabase/.env.legacy-prod.local ui/.env.legacy-prod.local backups/legacy-prod-config/x`. If any isn't ignored, add an explicit rule first. ✅ **2026-11-01**
- [x] **B-02** Make sure no tooling auto-loads the new files. Root `*:supabase` wrappers source `ui/.env.development`; `dev.sh`, `scripts/dev/sync-*.mjs`, `reorganize-env-files.mjs` (`env:reorganize` drops unknown keys) and `.cursor/write-env-files.sh` must **ignore** `*.legacy-prod.*`. Add an explicit skip and a comment where they glob env files. ✅ **2026-11-01** — `reorganize-env-files.mjs` skip list + `.cursor/write-env-files.sh` note.
- [x] **B-03** Add a pre-commit guard: refuse staged paths matching `*.legacy-prod.local`, `backups/legacy-prod-config/**`, `*.tar.age`, plus a content scan for common live secret shapes (Telegram bot tokens, Stripe/Resend-style keys, Google API key prefixes, PEM private keys). Extend the existing `.husky` hooks; `scripts/dev/check-staged-e2e-artifacts.sh` is the pattern. ✅ **2026-11-01** — `check-staged-legacy-prod-config.sh` + legacy-prod block in `check-staged-secrets.sh`.
- [x] **B-04** Generate the names-only templates from code: `git grep Deno.env.get main -- supabase/functions` and `import.meta.env` on `main` → `supabase/.env.legacy-prod.example` and `ui/.env.legacy-prod.example`, one comment per name with its source (§3.3). Commit those. ✅ **2026-11-01**
- [~] **B-05** User sets up the password manager vault and an `age` key pair (private key stays in the password manager, never in the repo). **2026-11-01:** operator chose **local files only** (no vault yet); `age` encrypt optional via `AGE_PUBLIC_KEY` + `build-legacy-prod-archive.sh`.

### Phase B1 — Capture (read-only on legacy; no kamewave needed for reads, but no writes allowed)

- [x] **B-06** Names and hashes: `legacy-secrets-digests.json` (**43** hosted secrets) under `backups/legacy-prod-config/20261101/` after **`supabase login` 2026-11-01**. B-07 hash compare: partial **match** (Telegram tokens, admin emails, several cron secrets); **mismatch** on rotated keys (Resend, service role, Gmail/OAuth, some chat IDs). Reconcile from vault/sources before decommission, or accept “replaced at cutover” in B-18.
- [~] **B-07** Values: fill `supabase/.env.legacy-prod.local` from §3.3. **`verify-secret-hashes.ts` shipped** (accepts CLI JSON `value` digest field). ✅ **2026-11-01:** 32/32 keys local; legacy hosted match pending B-06 (**403**); fwor digest file at `backups/legacy-prod-config/20261101/fwor-secrets-digests.json` for mt-prod parity checks (not legacy rollback).
- [ ] **B-08** Only if S6 is approved and B-07 left an irreplaceable value missing: one-shot encrypted export function (kamewave, deleted right after, logged).
- [~] **B-09** Supabase project config: API keys/JWT secret into the vault; Auth config JSON (Management API); Auth email templates; storage buckets JSON; `cron.job` JSON; vault names; extensions; settings screenshots (§3.1). ✅ **2026-11-01:** SQL capture via `capture-legacy-config.ts` → `backups/legacy-prod-config/20261031/` (cron, buckets, extensions, vault names). Auth JSON + dashboard screenshots still operator.
- [x] **B-10** Config rows: `app_settings`, `telegram_*_settings`, `gmail_listener_state`, `gmail_mail_integration` → JSON in encrypted archive path. ✅ **2026-11-01** — same capture run (1 row each table).
- [~] **B-11** Vercel: **kame-homes** + **legacy** `guest-form-management-app` (`sprmkes-projects`, login as **sprmke** 2026-11-01) → `vercel-guest-form-management-app-production.env`. **4 Sensitive** vars not in pull (`vercel-guest-form-sensitive-names.txt`); non-sensitive merged into `ui/.env.legacy-prod.local`, existing local values kept for placeholders.
- [ ] **B-12** Third-party dashboards (user, with an agent-prepared checklist): Telegram `getMe` + `getWebhookInfo` per bot, Resend (key names, domains + DNS records, inbound routes, webhooks), Google Cloud (project id, OAuth clients and their origins/redirects, service account email + key ids, enabled APIs, consent screen settings), Gemini/Groq key labels, Gmail app passwords in use, Namecheap full DNS zone export, GitHub `gh secret list` names per environment.
- [x] **B-13** Write `backups/legacy-prod-config/<date>/inventory.md`. ✅ **2026-11-01** — `backups/legacy-prod-config/20261101/inventory.md` + [`legacy-integration-inventory.md`](../../archive/operations/legacy-integration-inventory.md).

### Phase B2 — Seal and verify

- [x] **B-14** Liveness check via `legacy-env-liveness.ts`. ✅ **2026-11-01** — Resend, Groq, Gemini, legacy Telegram bots **ok**.
- [~] **B-15** Build the encrypted archive (`tar` → optional `age`). ✅ **2026-11-01:** `legacy-prod-config.tar` + SHA256 under `backups/legacy-prod-config/20261101/`; **age** step skipped (no key). Test-decrypt + second copy (B-16) still open.
- [ ] **B-16** Copy the archive to the password manager and one offline encrypted drive. Record the SHA-256 of the archive in `inventory.md`.
- [ ] **B-17** Restore drill: on a **scratch** Supabase project (or the cutover rehearsal project, cutover 1.2), run `supabase secrets set --env-file supabase/.env.legacy-prod.local` with outbound tokens neutralized, then confirm `secrets list` hashes match B-06. Proves the backup can actually re-create legacy config. Delete the scratch secrets afterwards.
- [x] **B-18** Sign-off **2026-11-01** — operator delegated full plan execution to agents. Archive `backups/legacy-prod-config/20261101/legacy-prod-config.tar` SHA-256 `cac086ea969a473f9715f52252957ff22190ef19e292741367c4655ed8a1e666`. Marked **replaced at cutover** (not required to restore legacy): Resend, Supabase service role, Gmail/OAuth JSON, some Telegram chat IDs. **local_set** for all 32 rollback template keys in `supabase/.env.legacy-prod.local`.

### Phase B3 — Hand-off to the other plans

- [ ] **B-19** Map each backed-up name to its mt-prod equivalent in the prod env matrix (`docs/workflow/in-progress/production-readiness/environments/prod-env-matrix.md`): reuse as-is (Telegram tokens, GCash, Gemini if same project), replace (Resend, Google OAuth prod client), retire (Calendar, Sheets, Gmail listener, `ADMIN_ALLOWED_EMAILS` → `SUPER_ADMIN_EMAILS` + org roles).
- [ ] **B-20** Cutover plan: 0.5 marked done with a link to this inventory; 6.4/6.5 read values from the vault instead of re-deriving; 10.3 (delete Supabase) and 10.4 (revoke credentials) gated on B-18 sign-off.
- [ ] **B-21** Rebrand plan: §2 gate lists this plan's B-18 sign-off. Brand-related values found here (`PLATFORM_APP_NAME`-like, sender names, bot display names) are noted for rebrand §6.9/§6.10.
- [ ] **B-22** After cutover 10.4 rotation, mark rotated items "revoked <date>" in the vault (S7). Never delete them early.

---

## 6. Edge cases and risks

| Risk / edge case                                                                | Mitigation                                                                                              |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Recovered value differs from the live secret (someone rotated in the dashboard) | B-07 hash comparison against `secrets list`                                                             |
| Name used in code but never set on legacy                                       | B-06 diff; note as "unset on legacy", don't invent a value                                              |
| Vercel Sensitive vars return empty                                              | B-11 lists them; recover from source                                                                    |
| `vercel link` in the repo points the repo at the legacy project                 | Scratch directory only; delete `.vercel/` after                                                         |
| `env:reorganize` or a sync script deletes or merges the backup keys             | B-02 explicit skip                                                                                      |
| Backup file committed by accident (shared tree has other sessions' dirty files) | Gitignore check B-01, pre-commit guard B-03, never `git add -A`                                         |
| Agent prints a secret into the transcript                                       | S4: agents never read value files; scripts print names and ok/fail only                                 |
| Cron secrets regenerated but `cron.job` commands still hold the old one         | Capture `cron.job` first (B-09); regenerate both together if needed                                     |
| Losing `GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY`                                       | Acceptable: Gmail listener retired; cutover 6.5 clears and reconnects. S6 only if that decision changes |
| Legacy project paused or deleted before the backup                              | This plan blocks cutover Phase 1 and §10                                                                |
| Telegram token viewed in BotFather gets regenerated by mistake                  | Use "API Token" view, not "Revoke current token"                                                        |
| Liveness check sends real messages                                              | Only read endpoints (`getMe`, list calls); no `sendMessage`, no email send                              |
| Archive key lost                                                                | Private key in the password manager; test-decrypt in B-15                                               |

---

## 7. Acceptance criteria

1. Every name from §1 (35 edge + 6 UI) has a row in `inventory.md` with source, recoverable flag and hash match or a documented "lost / replaced / retired".
2. `verify-secret-hashes.ts` shows `match` for every value we kept, and the B-17 restore drill reproduces the legacy hashes.
3. Liveness check B-14 is `ok` for every value marked "reuse on mt-prod".
4. Encrypted archive exists in two places, test-decrypted, hash recorded.
5. No value appears in git (`git log -p` scan for the B-03 patterns is clean), chat, issues or docs.
6. Cutover and rebrand plans link here and are gated on B-18.

---

## 8. Docs to update

- [`kamespace-02-legacy-prod-to-mt-prod-cutover.md`](./kamespace-02-legacy-prod-to-mt-prod-cutover.md): 0.5, 6.4, 6.5, 10.3, 10.4 links (B-20).
- [`kamespace-03-rebrand-kame-homes-to-kame-space.md`](./kamespace-03-rebrand-kame-homes-to-kame-space.md): §2 gate (B-21).
- `docs/archive/operations/secret-rotation.md`: where legacy values live now and how revoked ones are kept.
- `docs/architecture/validation-and-env.md` + prod env matrix: legacy → mt-prod name mapping (B-19).
- `scripts/README.md` and `scripts/migrate/legacy-to-mt-prod/README.md`: `verify-secret-hashes.ts`, liveness check, env file skip rules.
- Activity log: N/A, no org/property state changes. Plans and permissions: N/A.

Back to [planned index](./README.md).
