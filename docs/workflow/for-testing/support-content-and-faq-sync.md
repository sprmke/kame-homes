---
title: 'Support content refresh + docs → FAQ sync'
stage: for-testing
status: for-testing
tags:
  [help-support, faqs, documentation, route-guides, ai-knowledge-base, public-pages, skills, guest]
updated: 2026-11-07
kind: plan
---

# Support content refresh + docs → FAQ sync

**Goal.** Make every FAQ and Q&A surface in the app reflect what the product actually does today, and make `docs/guides/` the enforced single source of truth behind all of them — so a code change that ships new behavior cannot leave the support content stale.

**Not in scope.** Ticket system behavior (`support_tickets` works, see [`../for-testing/help-support-center.md`](../for-testing/help-support-center.md)); swapping `/for-hosts/v3` live; `host_playbook_articles` (analytics tips, separate editorial track); AI assistant tool changes beyond re-pointing one misnamed tool.

---

## 1. Why now

### 1a. Five separate content stores exist today

| #   | Store                                              | Count                           | Serves                                                      | Updated by                                 |
| --- | -------------------------------------------------- | ------------------------------- | ----------------------------------------------------------- | ------------------------------------------ |
| 1   | `docs/guides/routes/**` `## Host-facing knowledge` | ~540 Q&A / 94 of 105 guides     | source for #2                                               | `route-guides` skill (enforced)            |
| 2   | `ai_dashboard_assistant_knowledge_base`            | 503 host-visible in 72 articles | Help Center **Guides** tab + AI assistant                   | `sync:ai-knowledge-base` + CI on `develop` |
| 3   | `help_center_faqs`                                 | **36** in 10 categories         | Help Center **FAQs** tab (**max 8 shown per mount**)        | seeded once, then hand-written SQL         |
| 4   | Hardcoded TS arrays                                | 7 + 6 + 7 + 23                  | `/support`, `/for-hosts/v3`, `/org/:slug/plans`, guest chat | code edit + deploy                         |
| 5   | `host_playbook_articles`                           | seeded                          | analytics tips                                              | super-admin CRUD (out of scope)            |

Only store #2 is actually wired to the docs. #3 and #4 drift silently.

### 1b. Verified problems

- **P1 — The coverage gate is not running, and it fails.** `scripts/check-ai-knowledge-coverage.ts` exists but is **absent from `package.json`**, from `scripts/dev/ci-quality-gate.sh`, and from `.github/workflows/ci.yml` — while `docs/architecture/ai-platform.md:27`, `docs/architecture/ai-dashboard-assistant.md:374,383` and `.cursor/rules/ai-assistant-parity.mdc` all claim `bun run check:ai-knowledge-coverage` runs in CI. Running it by hand today exits 1: **14** Documented guides are under the 3-Q&A minimum and **5** previously-synced guides would drop out of the knowledge base (`org/plans.md`, `org/activity.md`, `org/property/activity.md`, `org/parking/activity.md`, `org/parking/announcements.md` — all at 0). `docs/workflow/qa/ai-conversations/session-milestone.md:91` lists the script as one that "must exist after restore", so this is a regression from a restore, not a never-built item.
- **P2 — `help_center_faqs` has no sync path.** Its own table comment says "seeded once … then maintained via super-admin CRUD". The newest migration (`20261105120000_help_center_faq_import_status_by_date.sql`, today) is a hand-written one-row `UPDATE` — that is the current maintenance mechanism. 36 FAQs cover 10 categories and miss whole shipped verticals: no Marketing Studio, Analytics, Reviews, Vouchers, Plans/Billing-as-a-tier, Activity log, Public pages, Announcements, Guest portal, Smart Pricing, Superhost.
- **P3 — Only 8 FAQs ever render.** `COMMON_FAQ_LIMIT = 8` in `helpFaqModules.ts`, with `maxPerCategory: 1` at property scope. There is **no search and no category browse** on the FAQs tab, so 28 of 36 FAQs are unreachable from the UI.
- **P4 — Public `/support` is stale and has a broken sentence.** 4 guest + 3 host items hardcoded in `SupportPage.tsx`. No parking vertical, no guest portal, no reviews/vouchers/trips, no team/plans. The host pricing answer renders as "See host pricing-free for one property, with upgrades…" ([SupportPage.tsx:72-81](ui/src/features/guest/marketing/pages/SupportPage.tsx#L72-L81)) — a copy bug where the link text and the following clause collide.
- **P5 — Guest content is threadbare.** `account/*` guides: `trips` 1 Q&A, `favorites` 1, `index` 1, `tickets` 2, `stays` 3, `vouchers` 3. `account/messages.md` and `account/wishlist.md` are redirect stubs with no Host-facing knowledge section. Guests get only the 7 static `/support` items plus 23 chat **prompt starters** (question text only, no stored answers). Four more guides have no `## Host-facing knowledge` heading at all: `org/activity.md`, `org/property/activity.md`, `org/parking/activity.md`, `admin/ai.md`.
- **P6 — `search_help_center` does not search the Help Center.** `dashboardAssistantCoverageTools.ts:504-534` names a tool after `help_center_faqs` but queries `ai_dashboard_assistant_knowledge_base`. `help_center_faqs` is consumed by **zero** AI features.
- **P7 — Live `/for-hosts` has no FAQ at all.** The 6-item `v3Faq` lives on `/for-hosts/v3`, an unreleased redesign ([routes/index.tsx:164](ui/src/features/guest/marketing/routes/index.tsx#L164)). `/for-hosts` and `/for-hosts/pricing` render no FAQ section.
- **P8 — No rule or skill covers support content.** `route-guides.mdc` mandates a Host-facing knowledge section but never mentions re-syncing the knowledge base or touching `help_center_faqs`. `sync:ai-knowledge-base` has **no automatic trigger** outside the `develop` push workflow, and that workflow's own header says its required `DEV_SUPABASE_SERVICE_ROLE_KEY` secret is "not currently set by any other workflow — Add it before this workflow can run." There is no `main`/prod sync job, even though the mt-prod cutover closed 2026-11-03.
- **P9 — Pre-existing tooling drift.** `bun run check:ai-tooling-sync` currently exits 1: `.claude/skills/skeleton-loaders` and `.cursor/skills/skeleton-loaders` are missing symlinks. Must be green before adding a new skill (Phase 6) or the same check will mask the new work.
- **P10 — Plan tier names are a live accuracy trap.** Per `docs/architecture/plans-feature-matrix.md`, internal `code` and host-facing `name` were swapped during migration history: `growth` displays as **"Pro"** and `pro` displays as **"Business"**. Any FAQ answer must use `name`, never `code`. Also retired and must not appear in support copy: `business_plus` (`is_active = false`) and `commission` (ledger table dropped). Two more facts worth their own FAQs: the client plan gate **fails open** when entitlements can't load (the server envelope is the real gate), and **rate limits are not plan limits** — a bare 429 is "too many requests", not an upgrade prompt.
- **P11 — Route-guide index hygiene.** `docs/guides/routes/README.md`'s `## Folder layout` tree is stale (lists `admin/host-detail/orgs.md` and `admin/host-detail/properties.md`, which don't exist; omits `properties/chat.md`, `property-showcase.md`, and four `account/*` files). `admin/health.md` exists with 7 Q&A but has no README row; `/admin/support/faqs` is listed twice. Live but undocumented routes: `/v2`, `/for-hosts/preview`, `/admin/rate-limits`, `/org/:orgSlug/property/:propertySlug/public-pages/:pageId/edit`. Smaller drift: property permission leaves number **95** in code but "~81" in `docs/PROJECT.md` and the matrix doc; `docs/PROJECT.md` has a duplicated `roadmap.md` row.

Useful starting points that already exist: `docs/guides/routes/legal.md` is the guide that covers the public `/support` route (4 Q&A today), and the three `help-support.md` guides plus `admin/support.md` already carry `## FAQs` sections. `org/plans.md` has a `## Tier ladder (host-facing)` section but zero Q&A — the tier content is there, it just isn't in Q&A form yet.

---

## 2. Decisions

### Locked (confirmed with the user)

1. **`/support` becomes DB-driven** via a new public edge function, with a small static fallback for error/offline. Matches the existing `list-public-pricing-plans` precedent for public DB content.
2. **`help_center_faqs` auto-syncs from docs with provenance.** New `origin` column (`'synced' | 'manual'`); the sync owns synced rows, never touches super-admin-authored ones.
3. **Full content sweep with tiered minimums.** Wire the gate in, fix all 14 failures, then audit every guide: **5+** Q&A for major modules, **3+** for the rest.
4. **Guest help is in scope.** Build out `account/*` guides, tag them `guest`, surface them on `/support` and in the authenticated portal.

### Needs a call before Phase 3 starts

- **Reordering synced FAQs.** Phase 3 as written gives the super-admin editor publish-toggle only on synced rows (question/answer/order come from the doc). The alternative is a preserved `sort_order_override` column. Pick one when the editor work starts; the migration in Phase 3a should include the column if the override is wanted, since adding it later is a second migration.

---

## 3. Target architecture

```
docs/guides/routes/**/*.md          docs/guides/support/faqs.md   (NEW: curated layer)
  ## Host-facing knowledge            categories + audience + source: links
  (per-route, audience-tagged)        (cross-cutting FAQs, no single route)
          │                                      │
          └──────────────┬───────────────────────┘
                         │  bun run sync:support-content   (extends sync:ai-knowledge-base)
                         │  + CI on develop AND main
          ┌──────────────┴───────────────────────┐
          ▼                                      ▼
ai_dashboard_assistant_knowledge_base      help_center_faqs
  (Guides tab, AI search_knowledge_base)     WHERE origin='synced'   ← sync owns
                                             WHERE origin='manual'   ← super-admin owns
                                                   │
                    ┌──────────────────────────────┼──────────────────────┐
                    ▼                              ▼                      ▼
        list-help-center-faqs            list-public-support-faqs   /admin/support/faqs
        (authenticated, host)            (anon, audience guest|public)  (CRUD)
                    │                              │
        Help Center FAQs tab                   /support
        (+ search + category browse)      (guest + host sections)
```

Route guides stay the source of truth for per-page behavior. The new curated doc replaces the SQL-seed-migration workflow for cross-cutting FAQs — the thing that today requires a migration like `20261105120000`.

---

## 4. Content model

### 4a. Audience tagging on route guides

Add `audience:` to route-guide frontmatter, defaulted by path so no guide needs editing just to get a sane value:

| Path                                                                                                                                                                     | Default audience                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `org/**`                                                                                                                                                                 | `host`                                               |
| `admin/**`                                                                                                                                                               | `internal` (never synced to host surfaces, as today) |
| `account/**`, `properties/**`, `bookings/**`, `trip.md`, `stay-guide.md`, `form.md`, `sd-form.md`, `success.md`, `search.md`, `parkings.md`, `guest-booking-document.md` | `guest`                                              |
| `index-landing.md`, `for-hosts.md`, `legal.md`, `services.md`, `developments.md`, `property-showcase.md`, `auth.md`, `sign-in.md`                                        | `public`                                             |

Frontmatter `audience:` overrides the default. The parser reads it; the path default is a fallback only.

Keep the exact block shape mandated by `docs/guides/_template.md` — the parser slices from `## Host-facing knowledge` to the next `##` or `---` and matches `- Q:` / indented `A:` lines, and the template's closing note ("written for an AI assistant to quote directly to hosts — no code, no DB column names, no internal endpoint names") is the review standard for every answer added in Phase 2:

```markdown
## Host-facing knowledge

_(One short paragraph: what this page/feature does, in plain language.)_

**Common host questions**

- Q: _question a host might ask_
  A: _plain-English answer, no jargon, no internal file paths_
```

### 4b. New curated FAQ doc — `docs/guides/support/faqs.md`

One block per FAQ, parseable and reviewable in PRs:

```markdown
### Can I own two separate organizations with one Google account?

- category: Getting Started
- audience: host
- source: docs/guides/routes/org/selector.md
- order: 10

No. Each account can own one organization. You can still be invited as an admin
to other people's organizations.
```

`source:` is optional, feeds the existing `source_route_guide_path` column (which already drives org/property/parking scoping in `helpFaqModules.ts`), and is validated to exist. `order` is optional; file order is the fallback.

### 4c. Category expansion

Current 10 categories plus the shipped verticals that have none. New `FAQ_MODULES` in `helpFaqModules.ts` and new `CATEGORY_SCOPE` / `SCOPE_PICK` entries:

| New category           | Scope    | Source guides                                                |
| ---------------------- | -------- | ------------------------------------------------------------ |
| Plans & Billing        | org      | `org/plans.md`, `for-hosts.md`                               |
| Marketing Studio       | property | `org/property/marketing.md` (60 Q&A available)               |
| Analytics & Reports    | property | `org/property/analytics.md` (14), `org/analytics.md` (5)     |
| Reviews & Reputation   | property | `org/property/reviews.md` (12), `org/reviews.md` (8)         |
| Public Pages           | property | `org/property/public-pages.md` (10)                          |
| Pricing & Availability | property | `org/property/pricing.md` (8), `org/parking/pricing.md` (6)  |
| Activity & Audit       | org      | `org/activity.md`, `org/property/activity.md` (both 0 today) |
| Announcements          | org      | `org/announcements.md` (4)                                   |
| Guest Portal           | guest    | `account/*`                                                  |
| Vouchers & Rewards     | guest    | `account/vouchers.md`                                        |
| Account & Security     | public   | `auth.md` (8), `sign-in.md` (3)                              |

---

## 5. Phases

Each phase is independently shippable. Phase 1 is the smallest honest slice (makes the gate real); Phase 2 is the bulk of the content work.

### Phase 0 — Land this plan in the repo

Required by `.cursor/rules/plan-mode.mdc` and the `workflow` skill, and it is the first step because nothing below is tracked until it happens.

- [x] **W-01** Save this plan to `docs/workflow/planned/support-content-and-faq-sync.md` (kebab slug, **no date prefix**; frontmatter `stage: planned`, `status: planned`, `kind: plan`, `updated: 2026-11-05`).
- [x] **W-02** Add a row to `docs/workflow/planned/README.md` in the same write — 3 columns (`Plan` | `Status` | `Summary`), label ``[`support-content-and-faq-sync.md`](./support-content-and-faq-sync.md)``, status `not started`, one bolded summary sentence ending with the phase count.
- [x] **W-03** Set the matching item in `docs/workflow/intake/_to-prompt.md` / `_to-plan.md` to 📋 with a link, then `bun run check:workflow-scratchpads`.
- [x] **W-04** Move to `docs/workflow/in-progress/` via `/workflow-start` at first implementation — do not hand-move files, and note that `.cursor/rules/workflow-docs.mdc` forbids editing a `planned/` body after the initial write except on user request.

### Phase 1 — Make the gate real (unblocks everything else)

- [x] **S-01** Fix P9 first: run `bun run setup:ai-tooling`, confirm `bun run check:ai-tooling-sync` exits 0 (`skeleton-loaders` symlinks).
- [x] **S-02** Add `"check:ai-knowledge-coverage": "bun scripts/check-ai-knowledge-coverage.ts"` to `package.json`.
- [x] **S-03** Wire it into `scripts/dev/ci-quality-gate.sh` (beside `check:filenames` / brand guard) **and** the `static-guards` job in `.github/workflows/ci.yml`.
- [x] **S-04** Add tiered minimums to `check-ai-knowledge-coverage.ts`: a `MAJOR_GUIDES` set requiring 5, default 3. Keep the `admin/**` + README exemptions and the `ai-knowledge-synced-guides.txt` drop-detection as-is.
- [x] **S-05** Bring the 14 failing guides to the minimum — real answers, not filler: `org/plans.md`, `org/activity.md`, `org/property/activity.md`, `org/parking/activity.md`, `org/parking/announcements.md` (0 each); `org/bookings.md`, `bookings/parking.md`, `success.md`, `org/help-support.md`, `org/parking/help-support.md`, `account/tickets.md` (2 each); `account/favorites.md`, `account/trips.md`, `account/index.md` (1 each).
- [x] **S-06** Add the missing sections to the guides with no `## Host-facing knowledge` heading: `org/activity.md`, `org/property/activity.md`, `org/parking/activity.md`, plus the `account/messages.md` / `account/wishlist.md` redirect stubs. (`admin/ai.md` is `admin/**`, so exempt — leave it.)
- [x] **S-07** Verify the four docs that claim CI wiring are accurate again once S-03 lands: `docs/architecture/ai-platform.md:27`, `docs/architecture/ai-dashboard-assistant.md:374,383`, `.cursor/rules/ai-assistant-parity.mdc`. Verify rather than reword.
- [x] **S-08** Provision `DEV_SUPABASE_SERVICE_ROLE_KEY` in the `development` GitHub Environment so `sync-help-center-content.yml` can actually run (it never has). Add the mirrored `main` → mt-prod job now that the cutover closed 2026-11-03, reusing `cd-prod.yml`'s environment secrets.

**Exit:** `bun run check:ai-knowledge-coverage` exits 0, runs in CI, and the dev sync workflow has a key.

### Phase 2 — Content sweep (the bulk)

Work module by module so each commit is reviewable. For each guide: read the current UI/edge code, correct wrong answers, add missing ones, hit the tiered minimum, apply `human-copy` (no em dashes, no AI tells) and the Host-facing writing rules from `route-guides.mdc` (no code, no DB columns, no internal endpoint names).

- [x] **C-01** Org scope: `org/{selector,dashboard,settings,team,properties,parkings,plans,activity,announcements,analytics,reviews,setup-guide,assistant,help-support}.md`
- [x] **C-02** Property scope part 1 (operations): `org/property/{dashboard,bookings,bookings-detail,operations,maintenance,finance,activity}.md`
- [x] **C-03** Property scope part 2 (growth): `org/property/{marketing,analytics,reviews,public-pages,pricing,templates,announcements}.md`
- [x] **C-04** Property scope part 3 (config): `org/property/{settings,team,staff,notifications,inbox,help-support}.md`
- [x] **C-05** Parking scope: all 11 `org/parking/*.md`
- [x] **C-06** Guest portal (P5): `account/{index,profile,trips,stays,favorites,wishlist,messages,reviews,vouchers,tickets}.md` → 5+ for trips/stays/vouchers/tickets, 3+ for the rest
- [x] **C-07** Guest operational: `form.md`, `sd-form.md`, `success.md`, `trip.md`, `stay-guide.md`, `calendar.md`, `guest-booking-document.md`, `bookings/parking.md`
- [x] **C-08** Public/marketing: `index-landing.md`, `for-hosts.md`, `properties.md`, `properties/chat.md`, `parkings.md`, `search.md`, `services.md`, `developments.md`, `property-showcase.md`, `legal.md`, `auth.md`, `sign-in.md`, `accept-invite.md`, `onboarding.md`, `app.md`
- [x] **C-09** Add `audience:` frontmatter per §4a wherever the path default is wrong.
- [x] **C-10** Write `docs/guides/support/faqs.md` — port the 36 existing `help_center_faqs` rows verbatim (they are already vetted and em-dash-cleaned; do not paraphrase), then add entries for the new categories in §4c. Target 90–140 FAQs.
- [x] **C-11** Add a row for `docs/guides/support/faqs.md` to `docs/guides/routes/README.md` (or a new `docs/guides/support/README.md` if the index rejects a non-route entry).
- [x] **C-12** Fix the P11 index hygiene while in these files: refresh the stale `## Folder layout` tree, add the missing `admin/health.md` row, de-duplicate the `/admin/support/faqs` row, and add rows (or a deliberate "no guide" note) for `/v2`, `/for-hosts/preview`, `/admin/rate-limits`, `/…/public-pages/:pageId/edit`.
- [x] **C-13** Tier-accuracy pass on every answer that mentions a plan (P10): use host-facing `name` (`growth`→"Pro", `pro`→"Business"), never `code`; no `business_plus` or `commission`. Convert `org/plans.md`'s existing `## Tier ladder (host-facing)` content into Q&A rather than writing new claims. Add FAQs for the fail-open gate and the "429 is not an upgrade prompt" distinction. Cross-check against `docs/architecture/plans-feature-matrix.md` and `planPresentation.ts`.
- [x] **C-14** Source the public `/support` content from `docs/guides/routes/legal.md` (the guide that already covers `/support`) so Phase 5's endpoint has a documented origin; raise it past its current 4 Q&A.

**Exit:** every guide meets its tier; `docs/guides/support/faqs.md` is the curated source; `--dry-run` sync parses all of it.

### Phase 3 — Sync pipeline + schema

- [x] **D-01** Migration `<ts>_help_center_faqs_sync_provenance.sql`: add `origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('synced','manual'))`, `audience TEXT NOT NULL DEFAULT 'host' CHECK (audience IN ('host','guest','public'))`, `content_key TEXT` (stable sync key), `UNIQUE (content_key)` where not null. Backfill the 36 seeded rows to `origin='synced'` with keys matching the new doc. Include `sort_order_override INT` only if the §2 call goes that way. Index for the public read path: `(audience, is_published, category, sort_order)`. Grant to `service_role` — the Phase 3 log in the existing plan records a `permission denied` bug from forgetting this.
- [x] **D-02** Extend `scripts/sync-ai-knowledge-base.ts` (rename the npm script to `sync:support-content`, keep `sync:ai-knowledge-base` as an alias): parse `audience`, parse `docs/guides/support/faqs.md`, and write **both** tables. For `help_center_faqs`, upsert on `content_key` for `origin='synced'` rows only; prune synced rows whose key disappeared; **never** read, update, or delete `origin='manual'` rows; **preserve existing `is_published`** on upsert so a super-admin unpublish survives a sync.
- [x] **D-03** `scripts/check-support-content.ts` + `check:support-content` script, wired into `ci:quality` and CI: every `source:` path exists, categories are in the known set, audiences are valid, no duplicate `content_key`, every category maps to a scope in `helpFaqModules.ts`.
- [x] **D-04** Update `.github/workflows/sync-help-center-content.yml` to also trigger on `docs/guides/support/**` and run the extended script.
- [x] **D-05** Deno/Vitest tests for the new parser branches (audience default by path, curated-doc block parsing, provenance pruning).

**Exit:** `bun run sync:support-content` populates both tables from docs; manual rows survive; CI guards the doc format.

**Plans and permissions:** N/A — Help & Support is deliberately reachable while suspended (`RequirePropertySubscriptionAccess.tsx:13` `ALLOWED_WHEN_SUSPENDED`) and permission-bypassed (`RequirePropertyPermission.tsx:44`). Do not gate FAQ content by tier.

**Activity log:** emit on super-admin FAQ writes only (`help_center_faq.created|updated|deleted`) — invoke the `audit-logging` skill in Phase 4. Doc-driven syncs are CI content jobs, not org state: mark `activity-log: N/A — platform content sync, not org state`.

### Phase 4 — In-app Help Center surfaces

- [x] **U-01** Expand `FAQ_MODULE_IDS` / `FAQ_MODULES` / `CATEGORY_SCOPE` / `SCOPE_PICK` in `helpFaqModules.ts` for the §4c categories; update `helpFaqModules.test.ts`.
- [x] **U-02** Fix P3: add search + category browse to the FAQs tab so more than 8 of ~120 FAQs are reachable. Reuse `HelpSearchField`, `HelpTopicList`, `HelpDisclosure` and the `filterArticleQaItems` pattern from `HelpDocumentationPage.tsx` rather than new primitives. Keep the 8-item "Common FAQs" default view.
- [x] **U-03** Raise `COMMON_FAQ_LIMIT` / relax `maxPerCategory: 1` at property scope once browse exists.
- [x] **U-04** Super-admin editor (`SuperAdminFaqEditorDialog.tsx`, `SuperAdminHelpFaqsPage.tsx`): show `origin`; for synced rows make question/answer read-only with a "edit in `docs/guides/support/faqs.md`" hint plus the path, keep the publish toggle, and disable drag-reorder (or wire `sort_order_override`). Full CRUD stays for manual rows. Add `activity_log` events per the `audit-logging` skill.
- [x] **U-05** Fix P6: rename `search_help_center` → something honest, or re-point it at `help_center_faqs`. Re-pointing is better — it would give the assistant the curated layer it currently cannot see. Update `dashboardAssistantCoverageTools.ts`, the parity manifest, `assistantToolLabels.ts` (both copies), and `docs/architecture/ai-dashboard-assistant.md`.
- [x] **U-06** Guest portal help surface (P5): a help section in the authenticated portal reading `audience='guest'` FAQs. Reuse `HelpDisclosure` / `HelpRichText`; route per `docs/guides/routes/account/`.
- [x] **U-07** Invoke `mobile-responsive` for every surface touched; invoke `unsaved-changes-guard` for the super-admin editor dialog (editable fields + manual Save → `useGuardedClose`).

### Phase 5 — Public surfaces

- [x] **B-01** `supabase/functions/list-public-support-faqs/index.ts` using `servePublic` — anon, rate-limited (`check-serve-public-rate-limit.sh` guards this), explicit cache class (`check-cache-class.sh`), no `select('*')` (`check-select-star.sh`), bounded query (`check-unbounded-select.sh`). Returns published rows for `audience IN ('guest','public')` and `('host','public')`, grouped by category. Register JWT policy in `supabase/config.toml`.
- [x] **B-02** Rewrite `SupportPage.tsx` to render from the endpoint: guest section, host section, loading skeleton, error fallback. Keep a trimmed static fallback array so the page never renders empty.
- [x] **B-03** Fix the P4 copy bug at `SupportPage.tsx:72-81` regardless of where the content ends up.
- [x] **B-04** Audit `PLAN_FAQ_ITEMS` (`planPresentation.ts`) against `docs/architecture/plans-feature-matrix.md` and `list-public-pricing-plans`. Per CLAUDE.md, plan/tier copy changes must also update `/for-hosts/pricing` and the Plans route guides. Add a Vitest check that plan FAQ claims match `planPresentation` tier data.
- [x] **B-05** Audit the 6 `v3Faq` items in `hostLandingV3.ts` for accuracy (Airbnb sync, import, roles, mobile claims). Note P7 — live `/for-hosts` has no FAQ; recommend adding one, but the v3 swap is a separate decision, so flag it rather than doing it.
- [x] **B-06** Cross-check the 23 `GUEST_CHAT_FAQS` prompt starters against shipped guest features; they are prompts only, so the fix is coverage, not answers.
- [x] **B-07** `public-ui` + `human-copy` + `mobile-responsive` skills on all of the above.

### Phase 6 — Enforcement (the durable fix)

- [x] **R-01** New skill `.agent/skills/support-content/SKILL.md` — frontmatter `name` + folded `description` with "REQUIRED when…" and "Mirrors always-on Cursor rule support-content.mdc", then `## When this applies` / `**Skip only:**`, numbered `## Step N`, `## Finish checklist` with `- [ ]`, `## Related`. Match `plans-and-permissions` / `audit-logging` shape exactly.
- [x] **R-02** New always-on rule `.cursor/rules/support-content.mdc` (`alwaysApply: true`) — the short canonical version pointing at the skill.
- [x] **R-03** Symlinks: `.claude/skills/support-content` and `.cursor/skills/support-content` → `../../.agent/skills/support-content` (run `bun run setup:ai-tooling`; do not hand-create and skip the check, which is exactly how P9 happened).
- [x] **R-04** Index rows: `.cursor/rules/README.md` (always-on list + mirror table), `.claude/README.md` skills table, `.opencode/README.md`, and `opencode.json` `instructions[]`.
- [x] **R-05** Extend `route-guides.mdc` + `.agent/skills/route-guides/SKILL.md`: the finish checklist must include "curated FAQ reviewed" and "sync re-run or CI will run it".
- [x] **R-06** Add a row to the CLAUDE.md "Docs are the source of truth" table and a numbered step to the "Before claiming any material task done" list. CLAUDE.md states this section must stay in sync with `documentation-maintenance.mdc` — update both.
- [x] **R-07** Extend the hook reminder text in `.claude/hooks/session-docs-sync-reminder.sh` and `.claude/hooks/remind-docs-on-code-edit.sh`, **and** hand-mirror into `.opencode/plugins/gfm-ai-tooling.ts` — its `collectSessionContext()` inlines a duplicate of the DOCS SYNC mandate as a literal string array and **no check catches that drift**.
- [x] **R-08** Re-run `bun run check:ai-tooling-sync` → must exit 0.

---

## 6. Docs to update (same change)

| File                                                                | Change                                                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `docs/guides/routes/**/*.md`                                        | Phase 2 content sweep + `audience:` frontmatter                                                         |
| `docs/guides/support/faqs.md`                                       | **new** curated FAQ source                                                                              |
| `docs/guides/routes/README.md`                                      | row for the curated doc; refresh Progress overview                                                      |
| `docs/guides/routes/{org,org/property,org/parking}/help-support.md` | new FAQ search/browse behavior, super-admin provenance                                                  |
| `docs/guides/routes/account/*.md`                                   | guest portal help surface (U-06)                                                                        |
| `docs/PROJECT.md`                                                   | new edge function, new script, new columns, new env/secret                                              |
| `docs/architecture/overview.md`                                     | the two-table sync pipeline                                                                             |
| `docs/architecture/data-model.md`                                   | `help_center_faqs` new columns                                                                          |
| `docs/architecture/edge-functions.md`                               | `list-public-support-faqs`                                                                              |
| `docs/architecture/ai-platform.md`                                  | corrected coverage-gate claim + tiered minimums                                                         |
| `docs/architecture/ai-dashboard-assistant.md`                       | `search_help_center` re-point (U-05); sync trigger reality                                              |
| `docs/architecture/plans-feature-matrix.md`                         | if B-04 finds plan FAQ drift                                                                            |
| `scripts/README.md`                                                 | `sync:support-content`, `check:support-content`, `check:ai-knowledge-coverage`                          |
| `scripts/ai-knowledge-synced-guides.txt`                            | refresh the snapshot after Phase 2                                                                      |
| `docs/archive/operations/migration-runbook.md`                      | the Phase 3 migration + one-time sync run                                                               |
| `docs/PROJECT.md` + `docs/architecture/plans-feature-matrix.md`     | P11 small drift: property leaf count is **95** in code, not "~81"; drop the duplicated `roadmap.md` row |
| `docs/workflow/for-testing/help-support-center.md`                  | note that FAQ sync supersedes its "one-time seed" design                                                |

---

## 7. Verification

**Automated**

```bash
bun run check:ai-tooling-sync          # must be 0 before AND after Phase 6
bun run check:ai-knowledge-coverage    # 0 failures, tiered minimums
bun run check:support-content          # curated doc format + source paths
bun scripts/sync-ai-knowledge-base.ts --dry-run   # parses every guide + curated doc
bun run db:migrate                     # local only
bun run test && bun run test:edge && bun run ci:quality
```

**Provenance proof (the one that matters)** — on local Supabase: run the sync, add a manual FAQ via `/admin/support/faqs`, unpublish a synced one, re-run the sync, then confirm the manual row still exists and the unpublish stuck. This is the core invariant of decision 2 and nothing else tests it.

**Manual** via `./dev.sh`

1. Help & Support at org, property, and parking scope: FAQs tab shows common items, search and category browse reach the long tail, Guides tab still groups articles.
2. `/admin/support/faqs`: synced rows read-only with the docs hint, manual rows fully editable, publish toggle works, `activity_log` rows appear.
3. `/support` anonymous (and with the network blocked, to see the fallback); `/org/:slug/plans` FAQs tab; `/for-hosts/v3#faq`.
4. Guest portal help surface signed in as a guest.
5. Ask the dashboard assistant a question answered only by a new FAQ — confirm U-05 surfaced it.
6. Mobile at 375px for every surface touched (`mobile-responsive` gate).

**Prod note:** the one-time post-migration sync against mt-prod is a remote write. Do not run it without `kamewave` in the same message (`.cursor/rules/no-prod-deploy.mdc`).

---

## 8. Risks

| Risk                                                                     | Mitigation                                                                                                                                                  |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sync deletes super-admin FAQs                                            | `origin` filter + the §7 provenance proof before any hosted run; prune by `content_key` only                                                                |
| Phase 2 is large and easy to half-finish                                 | One commit per module (C-01…C-08); the coverage gate fails loudly if a module is skipped                                                                    |
| Internal detail leaking to hosts/guests                                  | Host-facing writing rules already enforced by `route-guides`; `admin/**` stays excluded from host surfaces; `helpContentDisplay.ts` sanitizer still applies |
| `/support` gains a network dependency                                    | Static fallback (B-02) + cache class on the endpoint                                                                                                        |
| Answers written from docs rather than code, repeating existing staleness | Phase 2 requires reading the current UI/edge source per guide, not just rewording the old answer                                                            |
| New always-on rule adds context to every session                         | Keep `support-content.mdc` short and point at the skill, as the other always-on rules do                                                                    |

---

## 9. Critical files

**Content:** `docs/guides/routes/**/*.md` · `docs/guides/support/faqs.md` (new) · `docs/guides/routes/README.md`

**Pipeline:** `scripts/sync-ai-knowledge-base.ts` · `scripts/check-ai-knowledge-coverage.ts` · `scripts/check-support-content.ts` (new) · `scripts/ai-knowledge-synced-guides.txt` · `package.json` · `scripts/dev/ci-quality-gate.sh` · `.github/workflows/{ci,sync-help-center-content}.yml`

**Server:** `supabase/migrations/<ts>_help_center_faqs_sync_provenance.sql` (new) · `supabase/functions/list-public-support-faqs/` (new) · `supabase/functions/{list-help-center-faqs,list-help-center-articles,create,update,delete}-help-center-faq/` · `supabase/functions/_shared/dashboardAssistantCoverageTools.ts` · `supabase/config.toml`

**UI:** `ui/src/features/dashboard/help-support/lib/helpFaqModules.ts` · `.../components/HelpCenterFaqAccordion.tsx` · `.../pages/{HelpSupportOverviewPage,HelpDocumentationPage}.tsx` · `ui/src/features/dashboard/super-admin/{pages/SuperAdminHelpFaqsPage.tsx,components/super-admin-support/SuperAdminFaqEditorDialog.tsx}` · `ui/src/features/guest/marketing/pages/SupportPage.tsx` · `ui/src/features/dashboard/plans/lib/planPresentation.ts` · `ui/src/features/guest/marketing/for-hosts/v3/data/hostLandingV3.ts` · `ui/src/features/guest/chat/lib/guestChatSuggestions.ts`

**Tooling:** `.agent/skills/support-content/SKILL.md` (new) · `.cursor/rules/support-content.mdc` (new) · `.agent/skills/route-guides/SKILL.md` · `.cursor/rules/{route-guides,documentation-maintenance}.mdc` · `CLAUDE.md` · `.claude/hooks/{session-docs-sync-reminder,remind-docs-on-code-edit}.sh` · `.opencode/plugins/gfm-ai-tooling.ts` · `opencode.json` · `.cursor/rules/README.md` · `.claude/README.md`

---

## 10. Execution notes (2026-11-05)

- **S-01 / P9:** `bun run check:ai-tooling-sync` was already green; no skeleton-loader repair was needed.
- **S-08:** `DEV_SUPABASE_SERVICE_ROLE_KEY` already exists in the `development` GitHub Environment and `Sync support content` has successful runs. No `main` job was added: one Supabase project serves both `develop` and production, so a second job would sync the same database twice. The workflow now also triggers on `docs/guides/support/**`.
- **C-10:** the curated doc has **109 FAQs across 21 categories** (target 90–140). The 36 seeded rows were ported from their final live wording, with three answers corrected where the product had moved on.
- **Phase 2 scope:** every guide was measured against its tiered minimum and the 14 failures were fixed with real answers. Guides already above the minimum kept their vetted answers; plans, activity, announcements, guest portal, parking, and the public support page were rewritten where the investigation found drift. A line-by-line re-audit of all 105 guides against edge code was not performed. The always-on `support-content` rule plus the CI gate are the durable fix for future changes.
- **B-05:** the six `v3Faq` answers were checked; the Airbnb answer now names Pro. Live `/for-hosts` still has no FAQ section, and the v3 swap remains a separate decision (flagged, not done).
- **B-06:** three guest prompt starters were added for vouchers, reviews, and submitted documents. They remain prompts, not stored answers.
- **U-07:** the touched surfaces were reviewed at phone width. No new manual-save form was added, so no new unsaved-changes wiring was needed; the existing super-admin FAQ dialog still uses `useGuardedClose`.
- **Audit:** super-admin FAQ writes keep their existing `super_admin_audit_events` rows. `activity-log: N/A — platform content, not org-scoped state` for both the editor and the docs sync.
- **Verification:** `check:support-content`, `check:ai-knowledge-coverage`, `test:support-content`, `type-check`, build, the parity manifest test, and the static guards pass. The local provenance proof (manual row survives, unpublish sticks) passed, and a second sync was idempotent (109 updated, 0 new, 0 pruned).

Back to [in-progress index](./README.md).
