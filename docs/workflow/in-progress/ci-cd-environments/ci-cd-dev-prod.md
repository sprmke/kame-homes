---
title: 'CI/CD dual-track (develop → multi-tenant; main → legacy prod)'
status: active
stage: in-progress
kind: plan
tags: [workflow, in-progress, deployment, ci-cd, supabase, vercel, multi-tenancy]
updated: 2026-09-16
---

# CI/CD Dual-Track Implementation Plan

## Shipped summary (2026-08-08)

| Phase | Scope                                                                   | Status                                                                                                                                                                                                                            |
| ----- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | Dual-track inventory, Vercel verify, manual dev deploy                  | **Done** (operator)                                                                                                                                                                                                               |
| **B** | CI scripts + GitHub Actions (`cd-dev`, preprod/prod/rollback scaffolds) | **Done** (repo)                                                                                                                                                                                                                   |
| **C** | Docs, agent rules, `scripts/README.md`                                  | **Done**                                                                                                                                                                                                                          |
| **D** | Legacy live cutover (`main` / `zftt…` → multi-tenant for real users)    | **Deferred** — separate approval window                                                                                                                                                                                           |
| Phase | Scope                                                                   | Status                                                                                                                                                                                                                            |
| ----- | -----                                                                   | ------                                                                                                                                                                                                                            |
| **F** | mt-dev now · mt-prod at release (`develop`/`main`, subdomains)          | **In progress** — Phase A active; Phase B pending — [`multi-tenant-dev-prod-environments.md`](./multi-tenant-dev-prod-environments.md) · [`ci-cd-environment-matrix.md`](../../../archive/operations/ci-cd-environment-matrix.md) |

**One-time operator steps:**

- GitHub Environment `development` secrets → [`github-environments-setup.md`](../../../archive/operations/github-environments-setup.md)
- **mt-dev + mt-prod wiring** → [`multi-tenant-dev-prod-setup.md`](../../../archive/operations/multi-tenant-dev-prod-setup.md) (Phase A now; Phase B at release)

> **For agentic workers:** mt-prod Supabase and **`cd-prod.yml`** are **inactive until Phase B**. Legacy cutover still requires **`kamewave`**. Do not enable `CUTOVER_ENABLED` until mt-prod exists and migration is planned.

**Design:** [`ci-cd-dev-prod-design.md`](./ci-cd-dev-prod-design.md)

**Goal:** Isolate live users (`main` + legacy Vercel/Supabase) from multi-tenant work (`kame-homes` + `fwor…`), then add safe CD on the multi-tenant track.

**Architecture:** **Two Vercel projects**, same git repo — [`guest-form-management-app`](https://vercel.com/sprmkes-projects/guest-form-management-app) (`main`→LEGACY) and [`kame-homes`](https://vercel.com/kame-works/kame-homes) (mt branch→MULTI_TENANT_DEV). CI reuses `scripts/deploy/*`; prod cutover is Phase D only.

**Tech Stack:** GitHub Actions, Vercel, Supabase CLI (`bunx`), existing bash deploy/backup/rollback scripts, Bun quality CI.

## Global Constraints

- **Prime directive:** Do not change LEGACY_PROD data/schema/functions or Vercel Production multi-tenant settings until Phase D cutover is approved.
- Multi-tenant code/migrations ship on **`develop`** only until cutover.
- `kamewave` required for any local/agent prod Supabase mutation (legacy or multi-tenant prod).
- Never `git push --force` to `main`.
- Prefer merging feature → `develop` over renaming if remote `develop` already has divergent history (see Task 0).
- No unattended production DB deploys. Dev CD = auto. Preprod/prod = human promote + Environment approval.
- Expand/contract migrations when Production UI (`main`) and backend diverge in version.

---

## Branch rename? (`feature/…` → `develop`)

**Recommendation: do not rename-only if remote `develop` already exists.**

| Approach                                          | When                                                             | How                                                                                                                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Align `develop` to feature tip (preferred)** | `develop` is stale/unused; feature is the real multi-tenant line | Update `develop` to match feature tip (force-push **only** `develop` after team agrees), keep working on `develop`; delete or stop using the feature branch name |
| **B. Merge feature → `develop` PR**               | `develop` has commits you need                                   | Safer history; resolve conflicts on PR                                                                                                                           |
| **C. `git branch -m develop` + force**            | Local-only confusion                                             | Risk clobbering remote `develop` teammates; need coordinated force-push                                                                                          |

**Best for you now:** **A or B.** Then set **`kame-homes`** Production Branch + env to multi-tenant dev; never touch **`guest-form-management-app`** legacy Production env.

After `develop` carries multi-tenant tip:

1. **`kame-homes`:** Production Branch = `develop` (or keep `feature/…` until switched); Production env = `fwor…`.
2. Leave Production Branch = `main` → **legacy** env vars.
3. CI `cd-dev` triggers on push to `develop` only.

---

## File map (implementation)

| File / area                            | Responsibility                                                                                                                                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`             | Optionally add `develop` to push branches (already has PR)                                                                                                                                                                                                          |
| `.github/workflows/cd-dev.yml`         | Auto deploy MULTI_TENANT_DEV on `develop`                                                                                                                                                                                                                           |
| `.github/workflows/cd-preprod.yml`     | Promote to MULTI_TENANT_PREPROD                                                                                                                                                                                                                                     |
| `.github/workflows/cd-prod.yml`        | Full quality, diff, backup, strict deploy, and real-GET smoke pipeline; gated and inactive until cutover secrets exist                                                                                                                                              |
| `.github/workflows/cd-rollback.yml`    | Dispatch rollback                                                                                                                                                                                                                                                   |
| `scripts/deploy/*`, new `ci-*.sh`      | CI mode, LEGACY deny-list                                                                                                                                                                                                                                           |
| `scripts/dev/prod-deploy-guard-lib.sh` | Keep local safety                                                                                                                                                                                                                                                   |
| Docs + rules                           | AI-facing dual-track (this plan’s Phase E docs are partly done upfront)                                                                                                                                                                                             |
| GitHub Environments                    | `development`, `preproduction`, `production` secrets                                                                                                                                                                                                                |
| Vercel settings                        | **LEGACY:** [`guest-form-management-app`](https://vercel.com/sprmkes-projects/guest-form-management-app) Production=`main`. **NEW:** [`kame-homes`](https://vercel.com/kame-works/kame-homes) Production=`feature/support-multi-users-and-properties` (→ `develop`) |

---

## Phase A — Isolate tracks (no legacy risk)

### Task 0: Align git branches (human + agent guidance)

- [x] Confirm remotes: `origin/main`, `origin/develop`, `origin/feature/support-multi-users-and-properties`.
- [x] Choose **A (align)** — `origin/develop` is an **ancestor** of the multi-tenant feature tip (~0 unique commits on develop; feature is far ahead). Safe to reset `develop` to feature tip.
- [x] Local: `develop` fast-forwarded/reset to `feature/support-multi-users-and-properties` tip (same SHA). Tag `backup/feature-multi-user-YYYYMMDD` for safety.
- [x] **You:** push only `develop` (never `main`) — `552675ff..55c246c8 develop -> develop` (2026-08-07).
- [x] Checkout `develop`; tracking `origin/develop`.
- [ ] Optional later: archive `feature/support-multi-users-and-properties` (do not delete until develop is on origin).

**Verify:** `git log origin/develop -1` equals multi-tenant tip; `origin/main` still `c0128cd1` (legacy production lock message) or current prod line.

---

### Task 1: Inventory project refs

- [x] **LEGACY_VERCEL** = [`guest-form-management-app`](https://vercel.com/sprmkes-projects/guest-form-management-app) — Production branch **`main`**, Supabase LEGACY `zftt…`.
- [x] **MULTI_TENANT_VERCEL** = [`kame-homes`](https://vercel.com/kame-works/kame-homes) — Production branch **`feature/support-multi-users-and-properties`**, Supabase `fwor…`.
- [x] `DEV_PROJECT_REF` + `PROD_PROJECT_REF` guard in `supabase/.env.dev.local`.
- [ ] Optional: **`kame-homes`** Production Branch → **`develop`** when feature branch retired.

| Label              | Supabase ref           | Vercel project              | Git branch (Production)                          |
| ------------------ | ---------------------- | --------------------------- | ------------------------------------------------ |
| LEGACY stack       | `zfttdwtceyqszyeyhilc` | `guest-form-management-app` | `main`                                           |
| Multi-tenant stack | `fworvijbrwpyngycotbz` | `kame-homes`                | `feature/support-multi-users-and-properties` (*) |

(*) **`develop`** matches feature tip — switch `kame-homes` to `develop` when ready.

Canonical copy: [`docs/architecture/deployment.md`](../../../architecture/deployment.md).

**Verify:** Legacy live URL → `zftt…`. `kame-homes` URL → `fwor…`.

---

### Task 2: Vercel dual wiring — **verify** (already implemented?)

**If you already split Vercel + Supabase before this CI/CD plan:** Task 2 is **not** “do it all again.” It is a **5-minute confirmation** that nothing got crossed. Skip to **Quick verify** below. Only use the long guide (Part A onward) for **first-time setup** or **something is wrong**.

**What Task 2 actually means in one sentence:**  
Live app = `guest-form-management-app` + `main` + `zftt…`. Multi-tenant app = `kame-homes` + feature/develop branch + `fwor…`. Same git repo, two stacks — do not mix refs.

#### Quick verify (~5 min) — do this if already wired

| #   | Check                                                                                                       | Pass                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Open **live** guest site → DevTools → Network → any API call                                                | Host is **`zfttdwtceyqszyeyhilc.supabase.co`**                                      |
| 2   | Open **`kame-homes`** URL → Network                                                                         | Host is **`fworvijbrwpyngycotbz.supabase.co`**                                      |
| 3   | [guest-form-management-app](https://vercel.com/sprmkes-projects/guest-form-management-app) → Settings → Git | Production Branch = **`main`**                                                      |
| 4   | [kame-homes](https://vercel.com/kame-works/kame-homes) → Settings → Git                                     | Production Branch = **`feature/support-multi-users-and-properties`** (or `develop`) |
| 5   | You did **not** put `fwor…` keys on legacy project or `zftt…` keys on `kame-homes`                          | Mental ✓                                                                            |

**All five pass → Task 2 done.** Mark checkboxes below and go to **Task 3** (backend deploy to `fwor…`) if not done yet.

**Something fails?** Use the detailed guide under “First-time setup / troubleshooting.”

- [x] Quick verify (table above) passed
- [x] (Optional) Auth on `kame-homes` still works — `/for-hosts/login`

**Verify:** Legacy live URL → `zftt…`. `kame-homes` URL → `fwor…`.

#### First-time setup / troubleshooting — detailed walkthrough

Use only if Quick verify failed or this was never wired. Estimated time: **45–90 minutes**.

---

##### Glossary (read once)

| Term                   | What it means **in your setup**                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Legacy stack**       | Live users today — `main` branch, [`guest-form-management-app`](https://vercel.com/sprmkes-projects/guest-form-management-app), Supabase `zftt…`                                            |
| **Multi-tenant stack** | New app you're building — mt git branch, [`kame-homes`](https://vercel.com/kame-works/kame-homes), Supabase `fwor…`                                                                         |
| **Vercel Production**  | On **each** Vercel project, "Production" = deploys from that project's **Production Branch**. It is **not** the same as "live users" — only `guest-form-management-app` Production is live. |
| **Vercel Preview**     | Extra deploys for PRs / other branches. Optional for `kame-homes`.                                                                                                                          |
| **`VITE_*` env vars**  | Baked into the SPA at **build time**. After changing them you must **redeploy** (Redeploy button) or push again.                                                                            |
| **Anon key**           | Public Supabase key safe in the browser. Different per project (`zftt…` vs `fwor…`).                                                                                                        |

---

##### Big picture

```text
                    SAME GITHUB REPO
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
    git push main                    git push feature/… (or develop)
         │                                   │
         ▼                                   ▼
 guest-form-management-app              kame-homes
 (sprmkes-projects team)                (kame-works team)
 Production Branch: main                Production Branch: feature/support-multi-users-and-properties
         │                                   │
         ▼                                   ▼
 Vercel "Production" env vars           Vercel "Production" env vars
 VITE_SUPABASE_URL → zftt…             VITE_SUPABASE_URL → fwor…
         │                                   │
         ▼                                   ▼
 LEGACY Supabase (live data)            MULTI_TENANT_DEV Supabase (empty/dev data)
```

**Rule:** Never put `fwor…` URLs/keys on `guest-form-management-app`. Never put `zftt…` URLs/keys on `kame-homes`.

---

##### Part A — Audit legacy project (read-only; do not break live users)

**Goal:** Confirm live app is still wired correctly before touching `kame-homes`.

1. Open **[guest-form-management-app](https://vercel.com/sprmkes-projects/guest-form-management-app)** in Vercel.
2. Left sidebar → **Settings** → **Git**.
3. Confirm:
   - **Connected Git Repository** = this monorepo (guest-form-management).
   - **Production Branch** = **`main`**.
4. Left sidebar → **Settings** → **General** → scroll to **Root Directory**.
   - Should be **`ui`** (because `vercel.json` lives in `ui/`). If blank/wrong, builds fail — fix to `ui` before deploying `kame-homes`.
5. Left sidebar → **Settings** → **Environment Variables**.
6. Use the environment filter → select **Production** only.
7. Confirm these exist and point at **LEGACY** (`zftt…`):

| Name                     | Expected shape                                          | Where to verify                                                            |
| ------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | `https://zfttdwtceyqszyeyhilc.supabase.co/functions/v1` | Must contain **`zfttdwtceyqszyeyhilc`**, must end with **`/functions/v1`** |
| `VITE_API_URL`           | Same string as `VITE_SUPABASE_URL`                      | Character-for-character match                                              |
| `VITE_SUPABASE_ANON_KEY` | Long JWT starting with `eyJ…`                           | From Supabase **`zftt…`** → Settings → API → **anon public**               |
| `VITE_NODE_ENV`          | `production`                                            | Guest form hides dev toggles when production                               |

8. Open your **live** public URL (the domain real guests use — from **Settings → Domains** on this project).
9. Browser → **DevTools** → **Network** tab → reload.
10. Filter by `supabase` or `functions`.
11. **Pass:** requests go to **`zfttdwtceyqszyeyhilc.supabase.co`**.

**If anything on legacy Production env looks wrong:** stop and fix legacy first — do not proceed to `kame-homes` until live site passes step 11.

**Do not** add or edit variables on this project unless you intentionally fix legacy — Task 2 changes happen only on `kame-homes`.

---

##### Part B — Gather values for `kame-homes` (from Supabase `fwor…`)

**Goal:** Collect copy-paste values before opening Vercel.

1. Open Supabase Dashboard → project **`fworvijbrwpyngycotbz`** (multi-tenant dev — **not** `zftt…`).
2. **Settings** (gear) → **API**.
3. Copy and save in a local scratchpad (password manager / notes — not git):

| Label                  | Where in Dashboard                       | Example / format                                        |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------- |
| **Project URL**        | Project URL field                        | `https://fworvijbrwpyngycotbz.supabase.co`              |
| **Anon key**           | Project API keys → **anon** → **public** | `eyJhbGciOi…` (long JWT)                                |
| **Functions base URL** | Derive: `{Project URL}/functions/v1`     | `https://fworvijbrwpyngycotbz.supabase.co/functions/v1` |

4. Decide **admin emails** for staging (Google accounts you'll use to test `/for-hosts/login`), e.g. `you@gmail.com,teammate@gmail.com` — no spaces after commas.

You will paste these into **`kame-homes` Production** env vars in Part D.

---

##### Part C — `kame-homes` Git + build settings

**Goal:** Ensure Vercel builds the SPA from `ui/` when you push the multi-tenant branch.

1. Open **[kame-homes](https://vercel.com/kame-works/kame-homes)** in Vercel.
2. **Settings** → **Git**.
3. Confirm:
   - Same GitHub repo connected as legacy project.
   - **Production Branch** = **`feature/support-multi-users-and-properties`** (your current setup).  
     _(Later you can switch this to **`develop`** — see Part J.)_
4. **Settings** → **General** → **Root Directory** = **`ui`**.
   - If empty: click **Edit** → enter `ui` → Save.
   - Wrong root = build looks for `package.json` at repo root and fails.
5. **Settings** → **General** → **Framework Preset** should be **Vite** (auto-detected from `ui/vercel.json`).
6. Optional sanity check — **Build & Development Settings** should match `ui/vercel.json`:
   - **Build Command:** `bun run build`
   - **Output Directory:** `dist`
   - **Install Command:** includes `cd .. && bun install` (monorepo root install)

---

##### Part D — Set `kame-homes` **Production** environment variables

**Goal:** When Vercel builds `kame-homes` Production, the SPA talks to **`fwor…`**, not legacy.

**Important:** On **`kame-homes`**, check the **Production** checkbox when adding each variable — not Preview-only, not Development.

1. **Settings** → **Environment Variables** → **Add New** (repeat for each row).

For **each** variable below:

- **Key** = name in first column
- **Value** = from second column
- **Environments:** enable **Production** ✓
- Optional: also enable **Preview** ✓ (same values — useful for PR deploys)
- **Never** enable Production on `guest-form-management-app` for these fwor values

| Key                      | Value (exact)                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `VITE_NODE_ENV`          | `development`                                                                                      |
| `VITE_SUPABASE_URL`      | `https://fworvijbrwpyngycotbz.supabase.co/functions/v1`                                            |
| `VITE_API_URL`           | `https://fworvijbrwpyngycotbz.supabase.co/functions/v1` _(must match `VITE_SUPABASE_URL` exactly)_ |
| `VITE_SUPABASE_ANON_KEY` | _(paste anon key from Part B)_                                                                     |

2. After saving the four values, the **Production** column on `kame-homes` should list all four keys.
3. **Do not** set `VITE_GOOGLE_MAPS_API_KEY` unless you need maps on staging — optional.

**Why `VITE_NODE_ENV=development` on kame-homes?**  
Multi-tenant integration app keeps guest-form dev toggles available and matches hosted-dev behavior. Legacy live app stays `production`.

**Common mistake:** Adding vars to **Preview only** on `kame-homes` — then Production deploys still use old/missing vars. Production branch deploys use **Production** env.

---

##### Part E — Trigger a Production deploy on `kame-homes`

**Goal:** Get a built URL you can open and register in Auth.

**Option 1 — Git push (recommended)**

```bash
cd /path/to/guest-form-management
git checkout feature/support-multi-users-and-properties   # or develop
git pull origin feature/support-multi-users-and-properties
# trivial commit optional: git commit --allow-empty -m "chore: trigger kame-homes deploy"
git push origin feature/support-multi-users-and-properties
```

**Option 2 — Redeploy without push**

1. Vercel → **kame-homes** → **Deployments**.
2. Find latest deployment for your mt branch.
3. **⋯** menu → **Redeploy** → confirm.

**Wait** for build to finish (typically 2–5 min). Build log should show `bun run build` succeeding.

**Find your URL:**

1. **Deployments** → click the finished deployment.
2. Look for **Domains** / visit link.
3. Typical patterns:
   - `https://kame-homes.vercel.app`
   - `https://kame-homes-<team>.vercel.app`
   - Custom domain if you added one under **Settings → Domains**
4. Copy the **origin only** (no path): e.g. `https://kame-homes.vercel.app`  
   Save this as **`KAME_HOMES_URL`** in your notes — you need it for Auth and Google OAuth.

**Deployment badge:** On `kame-homes`, a deploy from Production Branch shows as **Production** (green). That is correct — it is Production _for the kame-homes project_, not live users.

---

##### Part F — Supabase Auth on **`fwor…` only**

**Goal:** Google sign-in works on `KAME_HOMES_URL` and hits the multi-tenant database.

**Work in Supabase project `fworvijbrwpyngycotbz` — not `zftt…`.**

1. Supabase Dashboard → select **`fworvijbrwpyngycotbz`**.
2. **Authentication** → **Providers** → **Google**.
3. Toggle **Enable**.
4. Leave Client ID / Secret empty for now if Part G not done — complete Part G then paste here.
5. **Authentication** → **URL Configuration**:

| Field                          | Value                                                               |
| ------------------------------ | ------------------------------------------------------------------- |
| **Site URL**                   | `KAME_HOMES_URL` from Part E (e.g. `https://kame-homes.vercel.app`) |
| **Redirect URLs** (Additional) | Add **each** of these (one per line):                               |

Redirect URL list to add:

```text
http://localhost:5173
http://127.0.0.1:5173
https://fworvijbrwpyngycotbz.supabase.co/auth/v1/callback
<KAME_HOMES_URL>
https://*.vercel.app/**
```

- `https://*.vercel.app/**` helps future Preview URLs on `kame-homes` without re-editing Auth each time (Supabase wildcard support).
- Use **https** on Vercel URLs, no trailing slash on the origin.

6. **Save**.

**Do not** add `KAME_HOMES_URL` to Supabase **`zftt…`** Auth — legacy Auth should only know legacy production domains.

---

##### Part G — Google Cloud OAuth (for hosted sign-in on `fwor…`)

**Goal:** Google allows login from your `kame-homes` domain and redirects back to Supabase Auth.

**Recommended:** Create a **separate** OAuth client named e.g. `GFM Kame Homes Staging` — do not reuse the live production OAuth client unless you know it is safe.

1. [Google Cloud Console](https://console.cloud.google.com/) → select project (same or new).
2. **APIs & Services** → **OAuth consent screen** — ensure configured (External or Internal).
3. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**.
4. Application type: **Web application**.
5. **Authorized JavaScript origins** — add:

```text
http://localhost:5173
http://127.0.0.1:5173
<KAME_HOMES_URL>
```

Example: `https://kame-homes.vercel.app`  
Google does **not** support `*.vercel.app` wildcards here — add specific Preview URLs later if needed.

6. **Authorized redirect URIs** — add **exactly**:

```text
https://fworvijbrwpyngycotbz.supabase.co/auth/v1/callback
```

7. Create → copy **Client ID** and **Client secret**.
8. Back in Supabase **`fwor…`** → **Authentication** → **Providers** → **Google** → paste ID + secret → **Save**.

**Local `./dev.sh` OAuth** uses `GOOGLE_CLIENT_ID` in `ui/.env.development` — that is separate from this hosted Auth config.

---

##### Part H — Edge function secrets on `fwor…` (for admin after login)

**Goal:** After Google login, API calls succeed (allow list, optional Gmail connect).

In Supabase **`fwor…`** → **Project Settings** → **Edge Functions** → **Secrets** (or Dashboard → Edge Functions → Manage secrets):

| Secret                        | Value                                                     |
| ----------------------------- | --------------------------------------------------------- |
| `ENVIRONMENT`                 | `development`                                             |
| `ADMIN_ALLOWED_EMAILS`        | Platform bypass + pre-org API testing (org owners bypass) |
| `SUPER_ADMIN_EMAILS`          | Platform `/admin/*` APIs                                  |
| `RESEND_API_KEY`              | Your dev/test Resend key (if testing email)               |
| `EMAIL_TO` / `EMAIL_REPLY_TO` | Dev inbox addresses                                       |

Optional later: `GOOGLE_SERVICE_ACCOUNT`, calendar/sheet IDs, Gmail OAuth secrets — see [`dev-staging-environment.md`](../../../archive/operations/dev-staging-environment.md) §2.5.

These secrets are **not** Vercel vars — they live on Supabase and are used by Edge Functions when the UI calls `fwor…`.

Full backend deploy (migrations + all functions + secrets) is **Task 3** (`bun run deploy:supabase:dev`). Task 2 can pass with Network tab showing `fwor…` even if some API routes 404 until Task 3.

---

##### Part I — Verification checklist

Do every row before marking Task 2 done.

**A. Legacy unchanged**

| #   | Check             | How                                          | Pass                                      |
| --- | ----------------- | -------------------------------------------- | ----------------------------------------- |
| 1   | Live site backend | Open live URL → Network                      | Host contains **`zfttdwtceyqszyeyhilc`**  |
| 2   | Legacy Vercel env | `guest-form-management-app` → Production env | `VITE_SUPABASE_URL` still has **`zftt…`** |

**B. `kame-homes` wired to multi-tenant**

| #   | Check            | How                                    | Pass                                                 |
| --- | ---------------- | -------------------------------------- | ---------------------------------------------------- |
| 3   | Deploy succeeded | Vercel → kame-homes → Deployments      | Latest **Production** = Ready                        |
| 4   | SPA loads        | Open `KAME_HOMES_URL`                  | Page renders (errors OK if backend not deployed yet) |
| 5   | Correct Supabase | Network tab on `KAME_HOMES_URL`        | Requests to **`fworvijbrwpyngycotbz.supabase.co`**   |
| 6   | Env baked in     | View page source / network request URL | Not `zftt…` anywhere                                 |

**C. Auth (if testing login)**

| #   | Check            | How                              | Pass                                           |
| --- | ---------------- | -------------------------------- | ---------------------------------------------- |
| 7   | Admin login page | `KAME_HOMES_URL/for-hosts/login` | Google button loads                            |
| 8   | OAuth redirect   | Sign in with allow-listed email  | Returns to app without `redirect_uri_mismatch` |
| 9   | Super admin      | `SUPER_ADMIN_EMAILS` on Supabase | Admin tab visible; `/admin` loads after login  |

**Quick Network tab tip (Chrome):**  
Reload → filter `fwor` or `zftt` → click any `/functions/v1/` request → **Headers** → Request URL shows which Supabase project the browser uses.

---

##### Part J — Troubleshooting

| Symptom                                      | Likely cause                    | Fix                                                                                                                               |
| -------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Build fails "Cannot find module"             | Root Directory not `ui`         | **Settings → General → Root Directory** = `ui`                                                                                    |
| `kame-homes` still hits `zftt…`              | Wrong env scope or old deploy   | Vars on **Production**; **Redeploy** after env change                                                                             |
| `kame-homes` hits `fwor…` but 404/502 on API | Backend not deployed (Task 3)   | Run `bun run deploy:supabase:dev` on mt branch                                                                                    |
| Google `redirect_uri_mismatch`               | Redirect URI typo               | GCP redirect must be exactly `https://fworvijbrwpyngycotbz.supabase.co/auth/v1/callback`                                          |
| Google `origin_mismatch`                     | Missing JS origin               | Add exact `KAME_HOMES_URL` to GCP authorized origins                                                                              |
| Login works but `/admin` access restricted   | Super admin not configured      | Set `SUPER_ADMIN_EMAILS` on Supabase; the UI reads the capability from `list-organizations`                                       |
| Host APIs 403 before org exists              | Not on allow list               | Set `ADMIN_ALLOWED_EMAILS` on Supabase or complete org onboarding (owner bypass)                                                  |
| Live site broke after Task 2                 | Edited wrong Vercel project     | Revert env changes on **`guest-form-management-app`** only                                                                        |
| Two deploys on push to same branch           | Both projects watch same branch | Normal if both have same Production Branch — **avoid** pointing both at same branch long-term; legacy should stay **`main` only** |

---

##### Part K — Optional: switch `kame-homes` Production Branch to `develop`

`develop` is already aligned to the same commit as `feature/support-multi-users-and-properties` in git.

When you want one canonical branch name:

1. Vercel → **kame-homes** → **Settings** → **Git**.
2. **Production Branch** → change to **`develop`** → Save.
3. Push to `develop` to trigger deploy:
   ```bash
   git checkout develop && git push origin develop
   ```
4. Update **Site URL** in Supabase Auth if the Vercel URL changed.
5. Archive/delete remote `feature/support-multi-users-and-properties` when team agrees.

---

##### Part L — What you deliberately do **not** do in Task 2

- Do **not** change **`guest-form-management-app`** Production env to `fwor…`.
- Do **not** run `bun run deploy:supabase` (legacy prod script) or `db push` against **`zftt…`** for multi-tenant migrations.
- Do **not** merge multi-tenant code to **`main`** until cutover planning.
- Do **not** add `kame-homes` URLs to **legacy** Supabase Auth.

When Part I passes (especially rows 1, 4, 5), Task 2 is complete → proceed to **Task 3**.

---

### Task 3: Deploy multi-tenant backend to **`fwor…`** (laptop)

**Target:** Supabase **`fworvijbrwpyngycotbz`** only — migrations + Edge Functions from your **multi-tenant git branch**. **Never** run prod deploy scripts against **`zftt…`**.

**If you already ran `deploy:supabase:dev` on this project before:** use **Quick verify** below (~5 min). Full walkthrough is for first deploy or when something fails.

#### Quick verify (~5 min) — already deployed?

| #   | Check                                                                                  | Pass                                                                             |
| --- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Supabase Dashboard → **`fwor…`** → **Edge Functions**                                  | Functions from repo listed (e.g. `submit-form`, `list-bookings`, …)              |
| 2   | **Table Editor** or SQL: `SELECT count(*) FROM supabase_migrations.schema_migrations;` | Count > 0; tables like `organizations`, `properties` exist                       |
| 3   | `kame-homes` URL → Network → `/functions/v1/...`                                       | **200** (not 404) on a simple public call                                        |
| 4   | Legacy **`zftt…`** Dashboard → Schema                                                  | Unchanged — no multi-tenant-only tables unless you intentionally migrated legacy |

**All pass → Task 3 done.** Skip to Phase B later, or re-run deploy only when migrations/functions changed on your branch.

- [x] Quick verify passed **or** full deploy below completed
- [x] Edge secrets minimum set on **`fwor…`** (see Part E)
- [x] Smoke on `kame-homes` (Part F)

---

#### Operator guide (Task 3) — full deploy / troubleshooting

**Time:** ~20–45 min first run (migrations + all functions). **Requires:** Supabase CLI login, `supabase/.env.dev.local`, typed confirm `dev`.

##### What this task does (plain language)

Task 2 wired the **frontend** (`kame-homes` → `fwor…` URLs in Vercel).  
Task 3 deploys the **backend** to that same Supabase project:

1. **Database schema** — all files in `supabase/migrations/`
2. **Edge Functions** — all folders in `supabase/functions/`

Live users stay on **`zftt…`** — this script is **`deploy:supabase:dev`**, not `deploy:supabase` (prod).

##### Part A — Preconditions

**A1. Git branch**

```bash
cd /path/to/guest-form-management
git checkout feature/support-multi-users-and-properties   # or develop
git pull
```

You must deploy from the branch that has **multi-tenant** migrations + edge code.

**A2. Local env file (gitignored)**

File: `supabase/.env.dev.local` (copy from `supabase/.env.dev.example` if missing).

| Variable               | Must be                                                  |
| ---------------------- | -------------------------------------------------------- |
| `DEV_PROJECT_REF`      | `fworvijbrwpyngycotbz`                                   |
| `DEV_SUPABASE_URL`     | `https://fworvijbrwpyngycotbz.supabase.co`               |
| `DEV_SERVICE_ROLE_KEY` | Service role from **fwor…** Dashboard → Settings → API   |
| `PROD_PROJECT_REF`     | `zfttdwtceyqszyeyhilc` _(guard — refuses if DEV=LEGACY)_ |

**A3. Supabase CLI logged in**

Use the account that owns **`fwor…`** (dev/staging account):

```bash
bunx supabase@latest login
```

**A4. Preflight checks**

```bash
bun run env:status
```

Expect: linked ref is **`fwor…`** or “nothing” (script will re-link).

Optional — compare local migration files vs remote:

```bash
bun run migrations:status:dev
```

Read-only; safe to run anytime.

---

##### Part B — Run the deploy (from repo root)

**Important for multi-tenant code:** this repo’s edge functions include multi-tenant guards. You **must** pass **`--allow-multi-tenancy`** on the multi-tenant branch (otherwise function deploy refuses).

**Full deploy (schema + functions)** — usual choice:

```bash
bun run deploy:supabase:dev -- --allow-multi-tenancy
```

What happens:

1. Script reads `DEV_PROJECT_REF` from `.env.dev.local`
2. Refuses if `DEV_PROJECT_REF` == `PROD_PROJECT_REF`
3. Shows project ref **`fworvijbrwpyngycotbz`**
4. Prompts: **`Type dev to confirm`** → type exactly `dev` + Enter
5. Links CLI to **`fwor…`**
6. **Backup** dev DB (unless you pass `--skip-backup` — not recommended)
7. `supabase db push`
8. `supabase functions deploy` (with multi-tenancy allowed)

**Split deploy** (if you prefer or need to retry one half):

```bash
# Schema only
bun run deploy:supabase:dev:db -- --allow-multi-tenancy

# Functions only (after schema is current)
bun run deploy:supabase:dev:functions -- --allow-multi-tenancy
```

**Other useful flags:**

| Flag                             | When                                                              |
| -------------------------------- | ----------------------------------------------------------------- |
| `--include-all`                  | Migration history out of sync — see `/fix-migration-issues` skill |
| `--skip-backup`                  | Emergency only — skips pre-push backup                            |
| `--db-only` / `--functions-only` | Same as `:db` / `:functions` npm scripts                          |

**Do not run:**

```bash
bun run deploy:supabase          # PRODUCTION — blocked without kamewave
bun run deploy:supabase:dev        # WITHOUT --allow-multi-tenancy on mt branch → functions step may refuse
```

---

##### Part C — Confirm deploy succeeded

**C1. Terminal** — ends with `Dev deploy complete (linked ref is now fworvijbrwpyngycotbz)`.

**C2. Supabase Dashboard → `fwor…`**

- **Database → Migrations** — recent migrations applied
- **Edge Functions** — long list matching `supabase/functions/`

**C3. SQL Editor (optional)**

```sql
SELECT count(*) FROM supabase_migrations.schema_migrations;

SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY 1
LIMIT 30;
```

Expect multi-tenant tables (`organizations`, `properties`, …) — not an empty DB.

**C4. CLI still linked to dev**

```bash
cat supabase/.temp/project-ref
# fworvijbrwpyngycotbz
```

If you later need legacy prod CLI link for a hotfix, re-link **`zftt…`** explicitly — do not accidentally `db push` multi-tenant schema there.

**C5. Legacy untouched**

Do **not** open legacy prod deploy. Spot-check: **`zftt…`** Dashboard migration count / schema should look like before (no surprise new mt-only tables).

---

##### Part D — If deploy fails (common fixes)

| Error                                               | Meaning                | Fix                                                                                                            |
| --------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `Missing supabase/.env.dev.local`                   | No dev env file        | Copy from `.env.dev.example`, fill `DEV_*`                                                                     |
| `DEV_PROJECT_REF matches PROD_PROJECT_REF`          | Guard tripped          | Set `PROD_PROJECT_REF=zftt…` and `DEV_PROJECT_REF=fwor…` — must differ                                         |
| `Refusing function deploy: multi-tenancy edge code` | Forgot flag            | Add `--allow-multi-tenancy`                                                                                    |
| `db push` migration conflict                        | Remote history differs | `bun run migrations:status:dev`; see `docs/archive/operations/migration-runbook.md` or `/fix-migration-issues` |
| `Aborted (expected: dev)`                           | Confirmation typo      | Re-run; type **`dev`** exactly                                                                                 |
| Auth / login errors on CLI                          | Wrong Supabase account | `bunx supabase@latest login` with **fwor** account                                                             |

Deploy log (audit): `backups/deploy-log.csv` after successful run.

Rollback (dev only): `bun run rollback:supabase:dev` — restores latest dev backup; read runbook before using.

---

##### Part E — Edge Function secrets on **`fwor…`** (after deploy)

Deploy uploads **code**; **secrets** are set in Dashboard (or CLI secrets push). Minimum for admin + guest smoke:

Dashboard → **`fwor…`** → **Project Settings → Edge Functions → Secrets**

| Secret                        | Purpose                               |
| ----------------------------- | ------------------------------------- |
| `ENVIRONMENT`                 | `development`                         |
| `ADMIN_ALLOWED_EMAILS`        | Platform bypass + pre-org API testing |
| `SUPER_ADMIN_EMAILS`          | Platform `/admin/*`                   |
| `RESEND_API_KEY`              | Dev/test email                        |
| `EMAIL_TO` / `EMAIL_REPLY_TO` | Dev inbox                             |

**Defer until feature testing:** Gmail listener, Meta inbox, Telegram, AI keys, Google Calendar/Sheets SA — see [`dev-staging-environment.md`](../../../archive/operations/dev-staging-environment.md) §2.5–2.8.

Template names: [`supabase/.env.example`](../../../supabase/.env.example).

---

##### Part F — Smoke test with **`kame-homes`** UI

After Task 2 (Vercel) + Task 3 (backend):

| Step | URL / action                     | Pass                                          |
| ---- | -------------------------------- | --------------------------------------------- |
| 1    | Open `kame-homes` production URL | SPA loads                                     |
| 2    | Network tab                      | Calls **`fwor…supabase.co/functions/v1/...`** |
| 3    | Public marketing or guest route  | No 404 on functions (data may be empty)       |
| 4    | `/for-hosts/login` → Google      | Login works (Task 2 Auth)                     |
| 5    | `/onboarding` or create org      | Writes go to **`fwor…`** DB (fresh dev data)  |

Empty DB is normal — create test org/property via onboarding; do **not** sync prod data to **`fwor…`** without a planned migration.

---

##### Part G — When to re-run Task 3

Re-run **`bun run deploy:supabase:dev -- --allow-multi-tenancy`** when:

- New migrations merged on your mt branch
- Edge function code changed
- Not needed for UI-only Vercel env changes (Task 2)

---

##### Part H — Task 3 checklist (copy)

- [ ] On multi-tenant git branch (`feature/…` or `develop`)
- [ ] `supabase/.env.dev.local` → `DEV_PROJECT_REF=fwor…`, `PROD_PROJECT_REF=zftt…`
- [ ] `bun run deploy:supabase:dev -- --allow-multi-tenancy` → typed `dev`
- [ ] Dashboard: migrations + functions on **`fwor…`**
- [ ] Edge secrets minimum set
- [ ] `kame-homes` smoke passes
- [ ] **`zftt…`** legacy unchanged

**Verify:** DEV dashboard schema matches repo migrations; LEGACY schema unchanged.

---

## Phase B — Scripts + CI (multi-tenant track)

### Task 4: CI-safe script flags

- [x] Add `--ci` / `CI=1` + `DEPLOY_CONFIRM=dev|prod` to deploy paths (`ci-deploy-lib.sh`, `deploy-supabase-dev.sh`).
- [x] Reject `--skip-backup` when `CI=1`.
- [x] Assert linked/target ref equals expected ref in CI mode.
- [x] Assert target ref **≠** `LEGACY_PROD_PROJECT_REF` when `--allow-multi-tenancy`.
- [x] CI wrappers: `ci-deploy.sh` supports dev + strict mt-prod; `ci-smoke.sh` probes real public GET handlers.
- [x] `bash -n` on deploy CI scripts.

**Verify:** Guard unit-style asserts for expect/deny ref (shell script tests or documented bash -c checks).

---

### Task 5: GitHub Environments + secrets

- [x] Document Environment `development` secrets (operator checklist).
- [ ] **Operator:** create `development` environment + secrets in GitHub UI.
- [ ] **Operator:** `preproduction` when preprod project exists.
- [ ] **Operator:** `production` empty until cutover.

Runbook: [`docs/archive/operations/github-environments-setup.md`](../../../archive/operations/github-environments-setup.md).

**Verify:** Actions can print “ref length only / last 4 chars” in logs, never full DB URL.

---

### Task 6: Workflows

- [x] `cd-dev.yml`: push `develop` → quality → `ci-deploy.sh dev` → smoke.
- [x] `cd-preprod.yml`: `workflow_dispatch` → Environment `preproduction`.
- [x] `cd-prod.yml`: complete gated pipeline (`main` + `CUTOVER_ENABLED` + acknowledge; quality → diff → backup → strict deploy → smoke).
- [x] `cd-rollback.yml`: dispatch validates env; rollback local in v1.
- [x] `ci.yml` runs on push/PR including `develop`.

**Verify:** Push to `develop` deploys only DEV. Push to `main` does **not** multi-tenant CD. Promote prod fails safely until cutover configured.

---

### Task 7: Branch protection

- [x] Documented recommended rules in [`github-environments-setup.md`](../../../archive/operations/github-environments-setup.md).
- [ ] **Operator:** enable branch protection on `main` / `develop` in GitHub Settings.

---

## Phase C — Observability & operator docs

### Task 8: Operator runbook sections

- [x] Update `docs/architecture/deployment.md` matrix (dual-track).
- [x] Update `docs/archive/operations/dev-staging-environment.md` (two-project model).
- [x] Update `docs/archive/operations/production-deployment.md` dual-track pointer.
- [x] Agent rules: `no-prod-deploy.mdc`, `project-context.mdc`.
- [x] `scripts/README.md` + `github-environments-setup.md`.

**Verify:** New agent session reading rules cannot conclude “deploy multi-tenant to main’s Supabase”.

---

## Phase D — Legacy live cutover (separate approval; later)

**Not the same as Phase F** (mt-dev + mt-prod on `kame-homes`). Phase D = replace **legacy live users** on `guest-form-management-app` / `zftt…`.

### Task 9: Choose strategy & rehearse

- [ ] Choose **A** new MULTI_TENANT_PROD + env flip **or** **B** in-place LEGACY upgrade.
- [ ] Full backup LEGACY (Dashboard + dump) with `kamewave` if shell-involved.
- [ ] Apply multi-tenant migrations on PREPROD/PROD target.
- [ ] Data transform/load (bookings → property_id / orgs per multi-tenant model).
- [ ] Storage bucket copy rehearsal.
- [ ] Auth strategy (same project vs migrate users).
- [ ] Maintenance window checklist: freeze writes → migrate → deploy functions → flip Vercel Production → smoke → rollback plan (env flip back + function redeploy from main pre-merge tag).

### Task 10: Go-live cutover

- [ ] Merge `develop` → `main` (multi-tenant now on main).
- [ ] Enable `cd-prod` secrets to intended mt-prod / upgraded LEGACY.
- [ ] Vercel Production env vars → multi-tenant project.
- [ ] Auth redirect Production host on multi-tenant project.
- [ ] Smoke production users path.
- [ ] Monitor; rollback procedure documented.

---

## Phase E — AI-facing awareness (do with Phase A/C)

Docs/rules agents must internalize (implement in same PR as plan docs land if not already):

| Doc                                 | Content                                                             |
| ----------------------------------- | ------------------------------------------------------------------- |
| Design                              | [`ci-cd-dev-prod-design.md`](./ci-cd-dev-prod-design.md)            |
| This plan                           | dual-track tasks                                                    |
| `docs/architecture/deployment.md`   | matrix + links                                                      |
| `.cursor/rules/no-prod-deploy.mdc`  | never multi-tenant deploy to live legacy without cutover + kamewave |
| `.cursor/rules/project-context.mdc` | dual-track pointer                                                  |
| production-deployment §             | dual-track warning                                                  |

---

## Suggested execution order

1. **Phase E + A** (docs + branch align + Vercel Staging) — zero legacy writes
2. **Phase B** (scripts + Actions)
3. **Phase C** polish
4. **Phase D** only when multi-tenant product is ready

---

## Final verification (Phase A–C)

- [ ] Production site still LEGACY ref
- [ ] Staging/`develop` hits MULTI_TENANT_DEV
- [ ] `cd-dev` only on `develop`
- [ ] Prod CD cannot use LEGACY ref
- [ ] `main` force-push protected
- [ ] Guard matrix for local scripts still green

---

## Out of scope for this plan’s “done”

- Building full ETL for every multi-tenant table (Phase D task expands when inventory is known)
- Supabase product “database branching” as dev/prod split (we use **two projects** — see Phase F)
- Auto CD of Edge secrets / Auth UI
