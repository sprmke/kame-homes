---
title: 'Sitewide automated testing (unit + Playwright + CI)'
status: planned
tags: [planning, testing, vitest, playwright, deno, ci-cd]
updated: 2026-09-11
stage: done
kind: plan
---

# Sitewide automated testing

## Goal

Give Kame Homes a **single, maintainable testing system** so every feature change has a known place to add coverage, CI/CD can block broken logic and critical UI before develop/prod deploys, and agents (Cursor, Claude Code, OpenCode) update tests in the **same change** as code. We use a **testing pyramid**: fast unit tests as the default for rules and invariants; a small, mocked Playwright suite for journeys that wire UI + routing + API contracts; Deno tests for edge `_shared` and handler logic; live/local and third-party paths stay **tagged out of PR CI**. We do **not** try to E2E every page, field, and modal. That would be slow, flaky, and unmaintainable.

## Scope

### In

- Canonical layout, naming, tags, and scripts for **Vitest** (UI), **Deno test** (edge), **Playwright** (mocked E2E).
- Coverage map for **every shipped route/module** (unit vs E2E vs manual).
- CI: PR quality job + develop deploy gate + optional nightly live.
- AI tooling: always-on rule, skill, agent/command updates, MCP usage, same-change governance. Compatible with **Cursor, Claude Code, and OpenCode**.
- Docs: `docs/PROJECT.md`, route-guide Testing column, `docs/guides/testing/README.md`, stale CLAUDE/`verify`/`test-runner` text.
- Reuse and tighten existing parking / vouchers / plans / team / assistant Playwright plus existing Vitest + Deno files. Do not scatter a second style.

### Out

- 100% line-coverage mandates, visual screenshot regression of every screen, or Cypress/Jest.
- Hitting **production** with Playwright (no live guest PII, no real PayMongo charges).
- Replacing route guides or Host-facing knowledge with tests.
- Live Meta OAuth, Resend inbound, PayMongo settlement, Gemini live, Telegram bots in PR CI.
- Component/DOM unit tests of shadcn primitives (`ui/src/components/ui/`).
- Editing shipped migrations to “make tests green.”

## Approach

### Decision: both, not either/or

| Layer                     | Tool                                        | When                                                                                                        | CI                                                      |
| ------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Unit (default)**        | Vitest Node (`ui/src/**/*.test.ts`)         | Pure UI logic: Zod helpers, workflow mirrors, plan presentation, RBAC catalogs, dates, copy groups, gates   | Every PR                                                |
| **Unit (edge)**           | Deno (`_shared/*_test.ts`)                  | State machines, orchestrator branches, entitlements, permissions, pricing, anti-spam, assistant classifiers | Every PR                                                |
| **Handler / integration** | Deno (`supabase/functions/tests/*.test.ts`) | Edge handlers with branching; mock DB/services                                                              | Every PR (exclude `*integration_test.ts` / live Gemini) |
| **E2E mocked**            | Playwright `ui/e2e/`                        | Cross-page journeys, auth/RBAC nav, form → status UI, checkout handoff                                      | Smoke on PR; fuller suite on `develop`                  |
| **E2E live local**        | Playwright `@live`                          | Optional acceptance against `./dev.sh`                                                                      | Nightly or manual; never PR                             |
| **Post-deploy smoke**     | `ci-smoke.sh`                               | Gateway + function list                                                                                     | After develop deploy                                    |
| **Manual**                | `docs/guides/testing/*-manual.md`           | Third-party, OTP email, payments, Meta                                                                      | Humans / QA batch                                       |

### When to write a **unit** test

Write a unit test if the change is **deterministic logic** that can fail without a browser:

- Status graphs, `canTransition`, revert-to-review, document completion, plan skip lists.
- Permission leaf catalogs, `COARSE_PLAN_FEATURES`, template seeds vs client mirrors.
- Zod schemas, validators, currency/date/Manila helpers, upload limits.
- Feature gates, upgrade-modal reasons, email-send prerequisites, cooldown math.
- Assistant risk classifier, tool allow-lists, OCR parse helpers.
- Client/server **mirrors** (same rule in `ui/` and `_shared/`): test **both** or share a fixture table.

**Do not** unit-test React layout, Tailwind classes, or “button is visible.” That is E2E or a short browser verify.

### When to write a **Playwright E2E** test

Write E2E only if a **user journey** can break while units stay green:

- Routing + query params + mocked API shape (guest form submit → success → CTA).
- Host session mock + nav RBAC (Read Only cannot open Settings).
- Multi-step wizards (onboarding, copy-settings, plan checkout).
- Status rail **click path** (Proceed → confirm modal → mocked `transition-booking`).
- Guest vs host two-surface flows (parking already does this).

**One happy path + 1–3 failure/edge journeys per domain**, not every field. Edge cases of the **rule** belong in unit tests.

### When **not** to automate (document instead)

- Real PayMongo / GCash QR / webhook settlement.
- Google OAuth, email OTP, super-admin step-up against real mail.
- Meta OAuth, Telegram live send, Resend inbound GAF approval.
- Pixel-perfect marketing animations, Remotion, Polotno canvas internals.
- Super-admin irreversible destroyers.

Keep a **manual** guide with a checklist. Tag Playwright `@live` only when a local harness already exists.

### Why mocked E2E (not live) is the CI default

This app is a Vite SPA + 200+ edge functions + Supabase Auth. Live E2E needs Docker, seed data, allow-listed Google users, and is slow. Parking already proved the maintainable pattern: **route intercepts + localStorage session seam + shared harness**. Copy that, do not invent per-file ad hoc mocks.

Live local (`PLAYWRIGHT_LOCAL_LIVE=1`) stays a **second** suite for parking/assistant-style confidence, not the deploy gate.

## Canonical layout (do not scatter)

```
ui/src/<feature>/lib/foo.ts
ui/src/<feature>/lib/foo.test.ts          # Vitest, colocated

supabase/functions/_shared/bar.ts
supabase/functions/_shared/bar_test.ts    # Deno, colocated

supabase/functions/tests/<topic>.test.ts  # handler / multi-module
supabase/functions/tests/*integration_test.ts  # excluded from PR CI

ui/e2e/
  shared/                    # auth seam, intercept helpers, ids, tags
  features/
    <domain>/                # bookings | guest-form | parking | plans | team | …
      guest/ host/ org/ property/ admin/ flows/ live/
      shared/<domain>Harness.ts
      *.spec.ts

docs/guides/testing/
  README.md                  # index + pyramid + CI commands
  <domain>-playwright.md     # mocked E2E how-to
  <domain>-manual.md         # intentional gaps
```

**Naming**

| Kind       | Pattern                           | Example                            |
| ---------- | --------------------------------- | ---------------------------------- |
| UI unit    | `*.test.ts` next to source        | `workflow.ts` → `workflow.test.ts` |
| Edge unit  | `*_test.ts` next to source        | `statusMachine_test.ts`            |
| Playwright | `<surface><Journey>.spec.ts`      | `propertyBookingProceed.spec.ts`   |
| Harness    | `<domain>Harness.ts` in `shared/` | `bookingWorkflowHarness.ts`        |

**Playwright tags** (use in `test.describe` titles or `test.info().annotations`):

| Tag      | Meaning                   | CI                            |
| -------- | ------------------------- | ----------------------------- |
| `@smoke` | < ~8 min; must stay green | PR + develop                  |
| `@ci`    | Mocked domain suite       | develop (and optional PR job) |
| `@live`  | Needs local Supabase      | nightly / manual              |
| `@demo`  | Headed video/slow         | never CI                      |

**Scripts (target)**

| Script                       | Role                                                        |
| ---------------------------- | ----------------------------------------------------------- |
| `bun run test`               | Vitest UI                                                   |
| `bun run test:edge`          | Deno `_shared` (no `*integration_test.ts`)                  |
| `bun run test:edge:handlers` | `supabase/functions/tests/*.test.ts` minus live/integration |
| `bun run test:e2e:smoke`     | Playwright `@smoke` chromium only                           |
| `bun run test:e2e:ci`        | Mocked `@ci` minus `@live` `@demo`                          |
| existing `test:e2e:<domain>` | Keep; point at feature folders                              |

**Existing assets to keep (do not rewrite)**

- `ui/vitest.config.ts` (Node, no DOM) — keep; do not switch to jsdom unless a rare helper needs it.
- `playwright.config.ts` (port 4173, `webServer: bun run dev:ui`) — add `grep`/`grepInvert` for tags; keep `chromium-side-by-side` out of CI.
- Parking / vouchers / plans / team / assistant specs and harnesses — extract duplicated auth/intercept into `ui/e2e/shared/` **once** (Phase 0), then migrate domains gradually.

## Coverage map (every module)

Legend: **U** = unit required for rules · **E** = mocked Playwright (smoke or domain) · **M** = manual / live only · **—** = no dedicated test (redirect or static).

### Public marketing & marketplace

| Surface                      | Guide              | U                              | E                          | M                          | Notes                                       |
| ---------------------------- | ------------------ | ------------------------------ | -------------------------- | -------------------------- | ------------------------------------------- |
| `/` landing                  | `index-landing.md` | low                            | smoke: renders + nav       | optional                   | Mock listings if API-backed                 |
| `/for-hosts` + `/pricing`    | `for-hosts.md`     | `planPresentation` (exists)    | smoke: pricing cards       | —                          | Align with `list-public-pricing-plans` mock |
| `/search`                    | `search.md`        | search intent parsers          | smoke: typeahead + results | smart-search manual exists |                                             |
| `/properties` listing/detail | `properties.md`    | amenity/facet helpers          | smoke: list → detail       | —                          |                                             |
| `/hosts/:orgSlug`            | `properties.md`    | superhost badge helper         | optional                   | —                          |                                             |
| `/parkings*`                 | `parkings.md`      | parking rank/pricing           | **exists**                 | live local exists          | Extend, don’t duplicate                     |
| `/developments*`             | `developments.md`  | low                            | smoke list                 | —                          |                                             |
| Legal/about/contact          | `legal.md`         | —                              | optional smoke             | —                          | Static; one “pages load” spec max           |
| Auth host/guest              | `auth.md`          | reserved names, OTP validators | smoke: form validation UI  | real OAuth M               | Never automate Google login in CI           |

### Guest operational

| Surface               | Guide                       | U                                         | E                               | M                 | Notes                       |
| --------------------- | --------------------------- | ----------------------------------------- | ------------------------------- | ----------------- | --------------------------- |
| Calendar              | `calendar.md`               | booked-date merge, buffers                | smoke: pick range → form        | —                 | Mock `get-booked-dates`     |
| Guest form            | `form.md`                   | schema, sensitive fields, Airbnb skip-pay | **core smoke** submit → success | —                 | Highest guest priority      |
| Success               | `success.md`                | —                                         | with form spec                  | —                 | Parking CTA already covered |
| SD form / review      | `sd-form.md`                | voucher wheel (exists)                    | vouchers domain **exists**      | —                 | Add SD submit happy path    |
| Stay guide            | `stay-guide.md`             | token/content helpers                     | smoke: token page               | stay-guide manual |                             |
| Showcase              | `property-showcase.md`      | —                                         | optional                        | showcase manual   | Animation-heavy             |
| GAF document redirect | `guest-booking-document.md` | token allow-list                          | optional                        | —                 |                             |
| Legacy pay-parking    | `bookings/parking.md`       | —                                         | **exists** redirect spec        | —                 |                             |

### Guest account

| Surface          | Guide                  | U               | E                       | M   | Notes                   |
| ---------------- | ---------------------- | --------------- | ----------------------- | --- | ----------------------- |
| Profile          | `account/profile.md`   | upload limits   | smoke: load + save mock | —   |                         |
| Stays / messages | `account/stays.md`     | —               | smoke: list             | —   | Auth mock guest session |
| Vouchers wallet  | `account/vouchers.md`  | voucher catalog | **exists**              | —   |                         |
| Favorites        | `account/favorites.md` | —               | optional                | —   |                         |
| Tickets          | `account/tickets.md`   | —               | optional                | —   |                         |

### Host app-level

| Surface          | Guide              | U                          | E                       | M              | Notes |
| ---------------- | ------------------ | -------------------------- | ----------------------- | -------------- | ----- |
| Sign-in redirect | `sign-in.md`       | —                          | smoke redirect          | —              |       |
| Onboarding       | `onboarding.md`    | setup-guide steps (exists) | `onboardingSmoke` `@ci` | verification M |       |
| Accept invite    | `accept-invite.md` | token expiry helpers       | smoke: invalid token    | email M        |       |

### Org dashboard

| Surface                | Guide                 | U                       | E                             | M          | Notes                        |
| ---------------------- | --------------------- | ----------------------- | ----------------------------- | ---------- | ---------------------------- |
| Org dashboard          | `org/dashboard.md`    | KPI aggregators if pure | smoke load                    | —          |                              |
| Org bookings           | `org/bookings.md`     | filters                 | optional                      | —          | Prefer property bookings E2E |
| Setup guide            | `org/setup-guide.md`  | steps (exists)          | optional                      | —          |                              |
| Org settings           | `org/settings.md`     | OTP-gated field lists   | smoke: non-payment save       | OTP M      |                              |
| Properties list + copy | `org/properties.md`   | copy groups (exists)    | smoke: wizard dry-run         | —          |                              |
| Parkings list          | `org/parkings.md`     | —                       | with parking host             | —          |                              |
| Org team               | `org/team.md`         | org permission catalog  | smoke: invite disabled        | —          |                              |
| Activity               | `org/activity.md`     | catalog mirror          | smoke: table renders          | —          |                              |
| Plans                  | `org/plans.md`        | presentation (exists)   | **exists** checkout/downgrade | PayMongo M |                              |
| Help/support           | `org/help-support.md` | —                       | optional                      | —          |                              |

### Property dashboard

| Surface                            | Guide                             | U                               | E                                | M                   | Notes                 |
| ---------------------------------- | --------------------------------- | ------------------------------- | -------------------------------- | ------------------- | --------------------- |
| Dashboard                          | `org/property/dashboard.md`       | —                               | smoke                            | —                   |                       |
| Bookings list                      | `org/property/bookings.md`        | pipeline filters                | smoke: filters                   | —                   |                       |
| Booking detail + workflow          | `org/property/bookings-detail.md` | **statusMachine + workflow.ts** | **core E2E proceed/back/cancel** | emails M            | Highest host priority |
| Finance                            | `org/property/finance.md`         | recurrence math                 | smoke: add entry mock            | —                   |                       |
| Pricing + calendar + smart pricing | `org/property/pricing.md`         | engine tests **exist**          | smoke: save rate mock            | AI preview M        |                       |
| Maintenance                        | `org/property/maintenance.md`     | recurrence                      | smoke                            | —                   |                       |
| Notifications                      | `org/property/notifications.md`   | —                               | smoke bell                       | push M              |                       |
| Templates                          | `org/property/templates.md`       | placeholder replace             | smoke preview                    | send M              |                       |
| Public pages                       | `org/property/public-pages.md`    | —                               | smoke editor load                | custom-pages manual |                       |
| Team                               | `org/property/team.md`            | leaf catalog                    | **exists** nav RBAC              | —                   | Expand templates      |
| Activity                           | `org/property/activity.md`        | —                               | optional                         | —                   |                       |
| Marketing                          | `org/property/marketing.md`       | caption validators              | smoke studio load                | Meta publish M      |                       |
| Inbox                              | `org/property/inbox.md`           | AI safety helpers               | smoke thread list                | Meta M              |                       |
| Settings                           | `org/property/settings.md`        | automation toggles, doc reqs    | smoke non-payment                | OTP M               |                       |
| Announcements                      | `org/property/announcements.md`   | types (lib)                     | optional                         | —                   |                       |
| Help                               | `org/property/help-support.md`    | —                               | optional                         | —                   |                       |

### Parking host dashboard

| Surface                            | Guide                     | U                      | E          | M          | Notes                               |
| ---------------------------------- | ------------------------- | ---------------------- | ---------- | ---------- | ----------------------------------- |
| Parking dashboard/bookings/pricing | parking guides            | `parkingStatusMachine` | **exists** | live local | Fill finance/team/inbox smoke later |
| Settings / OTP                     | `org/parking/settings.md` | same as property       | optional   | OTP M      |                                     |

### Super admin (`/admin/*`)

| Surface                              | Guide                      | U                            | E               | M              | Notes                |
| ------------------------------------ | -------------------------- | ---------------------------- | --------------- | -------------- | -------------------- |
| Overview KPIs                        | `admin/overview.md`        | aggregations if extracted    | smoke shell     | —              | Step-up OTP is **M** |
| Orgs hub, hosts, developments        | admin guides               | listing filters              | smoke directory | —              |                      |
| Approvals                            | `admin/approvals.md`       | verification state machine   | smoke queue     | —              |                      |
| Plans/subscriptions/PayMongo         | admin pricing              | entitlement math             | optional        | real billing M |                      |
| Parking payouts                      | `admin/parking-payouts.md` | commission math              | optional        | ledger M       |                      |
| Support / FAQs / announcements       | admin support              | —                            | optional        | —              |                      |
| AI usage / audit / platform settings | `admin/platform-tools.md`  | rate-limit helpers **exist** | optional        | kill-switch M  |                      |

### Edge / backend (not a page)

| Module                                   | U                   | Handler test            | Live           | Notes                |
| ---------------------------------------- | ------------------- | ----------------------- | -------------- | -------------------- |
| `statusMachine` + `workflowOrchestrator` | **P0**              | `transition-booking`    | cron M         | booking-workflow §6  |
| `submit-form` / completion tokens        | **P0**              | submit-form             | —              | no PDF on submit     |
| Parking orchestrators / payment fulfill  | expand              | claim/pay mocks         | PayMongo M     |                      |
| `planEntitlements` / checkout / dunning  | expand (some exist) | webhooks mock           | PayMongo M     |                      |
| Team permissions property+org            | **P0**              | members PATCH           | —              | client mirror Vitest |
| Assistant tools/risk/safety              | expand (some exist) | chat handler            | `@live` Gemini | keep live out of PR  |
| Captcha / rate limit                     | exist               | —                       | Turnstile M    |                      |
| Calendar sync                            | exist               | cron mock               | iCal M         |                      |
| Activity log                             | exist               | emitters                | —              |                      |
| Email send-booking-workflow              | exist               | keep                    | Resend M       |                      |
| Import parse                             | add                 | import-preview          | —              |                      |
| Crons (sd-refund, superhost, telegram)   | lead-window math    | cron handler with clock | scheduled M    |                      |

**Redirect-only routes** (`/calendar` → property calendar, org inbox → properties, etc.): one Playwright redirect spec covering the table in `docs/guides/routes/README.md`, not per-legacy-path files.

## Implementation tasks

Execute **one phase per session** (`/clear` between). Do not start Phase 1 until Phase 0 CI is green on a PR.

### Phase 0 — Foundation, layout, AI tooling, CI of what exists

Goal: organized system + agents know the rules + existing tests run in CI. No new domain coverage except extracting shared E2E helpers.

- [x] Add `docs/guides/testing/README.md`: pyramid, layout, scripts, tags, “same change as code.”
- [x] Add always-on **`.cursor/rules/testing.mdc`**: unit vs E2E vs manual; colocated files; `@smoke`/`@live`; same-change requirement; do not use Playwright MCP as the regression suite.
- [x] Add skill **`.agent/skills/testing/SKILL.md`** (symlink via existing agents-skills setup): decision table, file paths, how to extend a harness, CI commands. Cursor/Claude/OpenCode all load `.agent/skills`.
- [x] Update **`documentation-maintenance.mdc`**, **`route-guides.mdc`**, **`docs/guides/_template.md`**, **`route-guides` skill**: every page guide gets a **Testing** row (Unit path / E2E spec / Manual / N/A).
- [x] Update **`plans-and-permissions`** skill checklist: new gate → unit matrix (allow/deny).
- [x] Update **`audit-logging`** skill: new action catalog row → Deno test if classifier/summary changes.
- [x] Update **`CLAUDE.md`** Conventions Testing (delete “none exist yet”).
- [x] Update **`.claude/skills/verify/SKILL.md`**, **`.cursor/agents/test-runner.md`**, **`.claude/agents/test-runner.md`**: run `bun run test` + `bun run test:edge` + relevant Playwright; distinguish MCP exploratory vs committed specs.
- [x] Update **`.cursor/commands`** / **`.claude/commands`** `/kh-check-before-pr` if it only mentions lint/build.
- [x] Add `testing.mdc` to **`opencode.json` `instructions`** (OpenCode does not auto-load always-on Cursor rules beyond the listed set).
- [x] `ui/e2e/shared/`: `authSeam.ts`, `ids.ts`, `interceptEdge.ts` extracted from parking/team harnesses without breaking parking specs.
- [x] Playwright config: CI project **chromium-ci** (`grep: /@smoke|@ci/`, `grepInvert: /@live|@demo/`); side-by-side not in CI.
- [x] Scripts: `test:edge:handlers`, `test:e2e:smoke`, `test:e2e:ci`.
- [x] **CI `ci.yml` + `cd-dev.yml` quality**: add `bun run test:edge` (Deno on ubuntu: install Deno or use `denoland/setup-deno`); keep Vitest; **do not** add full Playwright yet if it flakes — add **`test:e2e:smoke` only if Phase 0 smoke is ≤3 specs that already pass** (parking guest request + team RBAC + one voucher or plans). If smoke is not stable, land Deno+Vitest first and add smoke in Phase 1.
- [x] `scripts/dev/ci-quality-gate.sh`: same as CI (add Deno).
- [x] `docs/PROJECT.md`: Testing section (commands, pyramid, CI jobs).
- [x] `docs/guides/README.md`: link testing index.
- [x] Filename convention: allow `*.test.ts` / `*_test.ts` / `*.spec.ts` in `check-ui-filename-conventions.sh` if not already.
- [x] `bun run check:ai-tooling-sync` after new skill/rule/agent edits.

**AI tooling research (include in Phase 0 docs, implement only what is listed)**

| Tool                                        | Use for tests                                                                                                                               | Cursor                   | Claude Code              | OpenCode                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------ | ---------------------------- |
| Skill `testing`                             | Same-change: pick unit vs E2E, paths, tags                                                                                                  | `.cursor/skills` symlink | `.claude/skills` symlink | `skills.paths`               |
| Rule `testing.mdc`                          | Always-on for Cursor; listed in OpenCode instructions; Claude via CLAUDE.md pointer                                                         | always-on                | cite in CLAUDE.md        | `opencode.json` instructions |
| Playwright **test** (`ui/e2e`)              | Regression suite                                                                                                                            | `bun run test:e2e:*`     | same                     | same                         |
| Playwright **MCP** (`.mcp.json`)            | Agent _explores_ UI while writing a spec; **not** CI                                                                                        | yes                      | yes                      | yes                          |
| Playwright **CLI** skill (`playwright-cli`) | Token-cheap snapshots while implementing                                                                                                    | yes                      | yes                      | yes                          |
| Context7 MCP                                | Current Vitest / Playwright / Deno test API docs                                                                                            | yes                      | yes                      | yes                          |
| Supabase MCP **read-only**                  | Inspect schema when writing edge tests; **no** writes                                                                                       | yes                      | yes                      | yes                          |
| `test-runner` agent                         | Run lint + unit + edge after edits                                                                                                          | Cursor agent             | Claude agent             | N/A (run scripts)            |
| `debugger` agent                            | Failed spec triage                                                                                                                          | yes                      | yes                      | —                            |
| `/kh-check-before-pr`                       | Local CI parity including new test scripts                                                                                                  | command                  | command                  | command if linked            |
| Hook PostToolUse                            | Optional one-line “tests?” reminder for `ui/` + `functions/` — **only if** it does not duplicate docs-sync noise; prefer skill + rule first | Cursor/Claude hooks      | same                     | OpenCode plugin              |

**Do not add:** Jest, Cypress, Testing Library DOM suite, claude-mem, extra MCP servers, coverage-percent gates in Phase 0, screenshot golden files.

### Phase 1 — Booking core (highest product risk)

- [x] Deno: `statusMachine_test.ts` covering `.cursor/rules/booking-workflow.mdc` §6 invariants (graph, D2 empty docs, SD=0 skip, Airbnb source, revert-to-review, manual force allow-list).
- [x] Deno: `workflowOrchestrator` branches with **mocked** DB/email/PDF (side-effect names, plan skip vs host skip, no email on backward).
- [x] Vitest: `ui/.../bookings/lib/workflow.test.ts` mirroring pipeline/nested docs (keep client/server in lockstep; shared fixture tables in one file imported by both if Deno/Vitest import paths allow — otherwise duplicate tables with a comment “keep in sync”).
- [x] Expand existing booking email prerequisite Vitest files; add `workflowSensitiveGuestDiff` tests.
- [x] Playwright `@smoke`: host booking detail **Proceed PENDING_REVIEW → PENDING_DOCUMENTS** (mocked `transition-booking` + `get-booking`); guest form **submit** mocked `submit-form` → success. New folder `ui/e2e/features/bookings/` + `ui/e2e/features/guest-form/`.
- [x] Docs: `docs/guides/testing/booking-workflow-playwright.md`; update bookings-detail + form route guides Testing rows.
- [x] Wire `@smoke` into CI if not done in Phase 0.

### Phase 2 — Auth, team RBAC, plans

- [x] Unit: property + org permission catalogs vs server allow-list (detect leaf drift).
- [x] Expand `propertyTeamNavRbac.spec.ts` to Operations vs Read Only vs Full Access (still mocked).
- [x] Plans: keep checkout/downgrade specs; add unit cases for suspension (`planEntitlementsSuspended` exists) + UI gate reasons.
- [x] Playwright smoke: unauthenticated dashboard redirect; guest vs host login **pages render** (no real OAuth).
- [x] Docs: team + plans testing guides (team guide exists; extend).

### Phase 3 — Guest operational remainder

- [x] Calendar smoke (availability mock + disabled booked nights).
- [x] SD form submit mock (status `READY_FOR_CHECKOUT`).
- [x] Stay-guide token 404 vs happy mock.
- [x] Unit: `guestPublicPaths`, date normalizers, form Airbnb payment skip.
- [x] Manual guides stay for showcase/OCR; do not E2E canvas.

### Phase 4 — Parking (extend, don’t rewrite)

- [x] CI already runs parking mocked via `test:e2e:ci` include.
- [x] Unit: `parkingStatusMachine` transitions (if missing).
- [x] Optional smoke: parking finance/settings load.
- [x] Keep `@live` local out of PR; document in parking-playwright.md (already).

### Phase 5 — Property/org operational modules

For each module, **unit the math/gates**, **one Playwright load+primary save mock**:

- [x] Finance (recurrence, totals).
- [x] Pricing (blocked dates merge — some calendar tests exist on edge).
- [x] Maintenance (mirrors finance patterns).
- [x] Property settings (load smoke; OTP payment **manual**).
- [x] Copy property settings (`copyPropertySettingsDryRun.spec.ts` dry-run preview).
- [x] Templates preview (load smoke in `dashboardModulesSmoke.spec.ts`; save paths manual).
- [x] Notifications list mock (telegram + in-app shell in `dashboardModulesSmoke.spec.ts`).
- [x] Org settings non-sensitive save mock (`orgSettingsSave.spec.ts` socials PATCH).

Skip Marketing Studio canvas and Inbox Meta connect in this phase.

### Phase 6 — Inbox, marketing, assistant

- [x] Inbox: unit `inboxAiSafetyGuard`; E2E thread list + send mock (no Meta).
- [x] Marketing: smoke studio tabs load; Meta publish **manual**.
- [x] Assistant: keep confirm-cards + smoke; live Gemini stays `@live`. Add Deno tests when adding tools (already assistant parity).
- [x] Update `ai-assistant-parity.mdc`: new tool → Deno catalog test in same change.

### Phase 7 — Guest account + public search/listings

- [x] Wallet/vouchers already; favorites list + empty state (`favoritesSmoke.spec.ts`).
- [x] Search smoke + unit intents (`publicPagesSmoke.spec.ts`, `searchIntents.test.ts`).
- [x] Property listing/detail smoke (`publicPagesSmoke.spec.ts` property detail).
- [x] For-hosts pricing smoke (`publicPagesSmoke.spec.ts` pricing cards).

### Phase 8 — Super admin

- [x] Unit: step-up token binding helpers (`superAdminVerification`) without sending email.
- [x] Playwright: `/admin` redirect if not super-admin (mock session without allow-list); overview page mock `super-admin-overview`.
- [x] Do **not** E2E OTP or irreversible actions.
- [x] Manual: `docs/guides/testing/super-admin-manual.md` for approvals + payouts.

### Phase 9 — Crons, webhooks, import, PWA

- [x] Unit: sd-refund lead window, superhost metrics (exist), import parse.
- [x] Handler tests with frozen clock; no `pg_cron` in CI.
- [x] Webhooks: PayMongo/Meta/Resend **signature verify unit** + duplicate-guard unit; settlement **manual**.
- [x] PWA: keep `assert-lazy-optimizer` + precache budget scripts; no SW E2E in CI (preview-only manual).

### Phase 10 — CI/CD hardening + maintenance

- [x] PR: type-check, lint, filenames, Vitest, Deno unit+handlers, Playwright `@smoke`, build.
- [x] `develop` CD quality: same + Playwright `@ci` (mocked). Fail deploy on red.
- [x] Post-deploy: keep `ci-smoke.sh`; optional later public GET against `dev.kamehomes.space` (no auth).
- [x] Prod CD (when cutover): **same quality job as PR**, not live E2E vs prod.
- [x] Artifacts: Playwright HTML report + traces on failure.
- [x] `cd-prod.yml` today is a scaffold: when it grows a quality job, copy `ci.yml` tests.
- [x] Document flake policy: retry 2 on CI (already); quarantine `@flaky` only with an issue; never skip silently.
- [x] Coverage **inventory** in `docs/guides/testing/README.md` (table of domains), not a hard % gate.

## Same-change governance (every future feature)

When code or a route guide changes:

| Change                                | Required test update                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| New/changed pure helper or mirror     | Colocated unit                                                                                            |
| New plan key or permission leaf       | Unit matrix + catalog drift test                                                                          |
| New workflow transition / side effect | Deno statusMachine + orchestrator; E2E only if host click path changed                                    |
| New page or primary CTA               | Route guide **Testing** row + `@smoke` if it is a money/booking/auth path, else unit + optional load spec |
| New mutating edge function            | Handler test or `activity-log: N/A` plus unit on validator                                                |
| CSS/copy-only                         | No new tests                                                                                              |
| Third-party                           | Manual guide checkbox                                                                                     |

Agents must follow skill `testing` the same way they follow `route-guides` and `audit-logging`. Stale “no test suite” text is a defect.

## Docs to update (Phase 0 unless noted)

| Doc                                                          | Why                                                                   |
| ------------------------------------------------------------ | --------------------------------------------------------------------- |
| This plan                                                    | Status ledger per phase                                               |
| `docs/guides/testing/README.md`                              | Canonical how-to                                                      |
| `docs/PROJECT.md`                                            | Testing + CI                                                          |
| `docs/guides/_template.md` + route-guides skill/rule         | Testing column                                                        |
| `docs/guides/routes/*.md`                                    | Fill Testing rows **as each domain phase lands** (not all in Phase 0) |
| `docs/architecture/deployment.md` or ci-cd in-progress       | Quality job lists tests                                               |
| `.cursor/rules/testing.mdc`, `documentation-maintenance.mdc` | Governance                                                            |
| `CLAUDE.md`, verify + test-runner agents                     | Stop lying about “no tests”                                           |
| `opencode.json`                                              | Load testing rule                                                     |
| `docs/workflow/planned/README.md`                            | Index row (this file)                                                 |
| `docs/workflow/intake/_to-plan.md`                           | 📋 entry                                                              |

## Success criteria

- PR cannot merge (CI red) if Vitest, Deno `_shared`, or `@smoke` Playwright fails.
- Develop deploy cannot run if quality job fails (already `needs: quality`; job must include tests above).
- New feature PRs that touch workflow/RBAC/plans include tests or an explicit Testing N/A in the route guide.
- `ui/e2e/features/<domain>/` is the only place for new Playwright; no specs under `ui/src/`.
- Agents in Cursor, Claude Code, and OpenCode have the same skill + documented commands.

## Open questions

1. **Deno on GitHub Actions:** use `denoland/setup-deno@v2` with the version in repo docs, or a Bun-installed Deno. Prefer official action.
2. **Playwright smoke on every PR vs develop-only:** prefer PR `@smoke` once Phase 1 specs are stable (<10 min). If ubuntu + Vite build is too heavy, run smoke only on `develop` until cached.
3. **Shared fixture tables across Deno and Vitest:** Deno cannot always import from `ui/`. Default: duplicate small tables with “keep in sync” comments unless a `packages/test-fixtures` workspace is justified (defer; do not add a third package in Phase 0).

## Suggested session order

1. Phase 0 (tooling + CI existing + shared e2e helpers)
2. Phase 1 (booking + guest form) — largest risk reduction
3. Phase 2 (RBAC + plans)
4. Phase 4 parking CI include (cheap; suite exists)
5. Phases 3, 5, 7 (guest + dashboard modules + public)
6. Phases 6, 8, 9 (inbox/marketing/admin/crons)
7. Phase 10 (tune CI times, flake policy)

Start with `/workflow-start sitewide-automated-testing` when implementation begins. Do not implement from this file until that move.

## Implementation status

| Phase                                     | Status                                                                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Foundation + AI tooling + CI existing   | **done** (rule, skill, CI, shared E2E, `ci:quality`, template Testing column, `opencode.json`, `/kh-check-before-pr`)                  |
| 1 Booking core                            | **done** (statusMachine + workflowOrchestrator Deno, workflow Vitest, proceed E2E, route guide Testing rows)                           |
| 2 Auth / RBAC / plans                     | **done** (auth pages + redirect smoke, property + org catalog drift Vitest, team RBAC + plans E2E)                                     |
| 3 Guest operational                       | **done** (form load/submit, calendar, SD form, stay-guide token smoke; guestFormSteps unit)                                            |
| 4 Parking extend                          | **done** (parkingStatusMachine unit, parking smoke/ci + live specs)                                                                    |
| 5 Property/org modules                    | **done** (dashboard module smoke + copy-settings dry-run + org settings save + templates load; finance recurrence unit)                |
| 6 Inbox / marketing / assistant           | **done** (inbox mock thread list, marketing studio tabs, assistant smoke)                                                              |
| 7 Account + public search                 | **done** (search intents unit, property detail smoke, pricing/search public smoke, vouchers, favorites smoke)                          |
| 8 Super admin                             | **done** (verification unit, admin shell smoke, manual guide)                                                                          |
| 9 Crons / webhooks / PWA                  | **done** (sdRefundCronLead + resend webhook verify + inboxAiSafetyGuard units; import parse)                                           |
| 10 CI/CD hardening                        | **done** (PR + develop test jobs, Playwright artifacts on failure, flake policy in testing README)                                     |
| 11 Route guide Testing rows + domain docs | **done** (56 guides backfilled; auth/public/dashboard/org/plans/account domain playbooks; redirect + accept-invite + legal/dev smokes) |
| 12 Onboarding + admin approvals smokes    | **done** (`onboardingSmoke`, `adminApprovalsSmoke`; domain playbooks)                                                                  |

## Phase 11 — Route guide parity + domain playbooks (2026-09-11)

- [x] Create domain guides: `auth-playwright.md`, `public-marketing-playwright.md`, `dashboard-modules-playwright.md`, `org-hub-playwright.md`, `guest-account-playwright.md`, `plans-playwright.md`
- [x] Backfill **Testing** section on all route guides that lacked one (`scripts/dev/backfill-route-guide-testing.mjs`)
- [x] E2E gaps: legacy redirects, accept-invite invalid token, org activity, developments list, terms page
- [x] `@ci` on auth page specs

## Phase 12 — Onboarding + admin approvals (2026-09-11)

- [x] `ui/e2e/features/onboarding/onboardingSmoke.spec.ts` — org step + property listing selection → verify intro
- [x] `ui/e2e/features/admin/adminApprovalsSmoke.spec.ts` — `/admin/approvals` queue shell + mocked pending row
- [x] Domain guides: `onboarding-playwright.md`, `admin-playwright.md`
