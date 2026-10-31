---
name: property-dashboard-qa
description: >-
  Deep QA of property-level dashboard pages under /org/:orgSlug/property/:propertySlug/*
  (Dashboard, Bookings, Finance, Pricing, Maintenance, Team, Marketing, Inbox,
  Notifications, Templates, Public Pages, Plans, Settings, Help). Use when the
  user asks to review, verify, critique, or regression-test property dashboard
  modules, plan gates, or team permissions — or before shipping property UX.
---

# Property dashboard QA (GFM)

Act as a **multi-property host** using the dashboard day-to-day. Do **not** only
diff code against docs — question whether the product makes property management
easier (including AI), and whether plan tiers + team RBAC behave as sold.

## Scope (property only)

Routes under `/org/:orgSlug/property/:propertySlug/…`:

| Nav label           | Section                    | Guide                                          |
| ------------------- | -------------------------- | ---------------------------------------------- |
| Dashboard           | index                      | `docs/guides/routes/org/property/dashboard.md` |
| Bookings (+ detail) | `bookings`, `bookings/:id` | `bookings.md`, `bookings-detail.md`            |
| Finance             | `finance`                  | `finance.md`                                   |
| Maintenance         | `maintenance`              | `maintenance.md`                               |
| Pricing             | `pricing`                  | `pricing.md`                                   |
| Team                | `team`                     | `team.md`                                      |
| Marketing           | `marketing`                | `marketing.md`                                 |
| Inbox               | `inbox`                    | `inbox.md`                                     |
| Notifications       | `notifications`            | `notifications.md`                             |
| Templates           | `templates`                | `templates.md`                                 |
| Public Pages        | `public-pages` (+ editors) | `public-pages.md`                              |
| Plans & Billing     | `plans`                    | `docs/guides/routes/org/plans.md`              |
| Settings            | `settings`                 | `settings.md`                                  |
| Help & Support      | `help-support`             | `help-support.md`                              |

Redirects to document but not re-QA as primary: `calendar` → pricing, `custom-pages` → public-pages, `staff`/`operations` → notifications.

Org-level and parking are **out of scope** unless a property deep-link escapes there.

## Authority sources

1. Live UI + edge responses (local `./dev.sh` or `--ui-only`)
2. Route guides above
3. `docs/architecture/plans-feature-matrix.md` + `planFeatures.ts`
4. Team RBAC: `propertyPermissions.ts`, `propertyTeamTemplates.ts`, `propertyPermissionCatalog.ts`
5. Booking workflow: `.cursor/rules/booking-workflow.mdc` when testing bookings detail

If docs and product disagree, **fix the doc in the same change** (or note the product bug).

## Preconditions

```bash
./dev.sh   # or ./dev.sh --ui-only
# Auth: Google/OTP as org owner, or local magic-link inject (see scripts below)
bun scripts/dev/qa-walk-property-pages.mjs <orgSlug> <propertySlug>
```

Local seed tip: many properties may all be **Free**. For paid-tier checks, temporarily change `org_subscriptions.plan_id` on **local only**, or use `feature_overrides` — never touch hosted prod without `kamewave`.

## Per-page checklist (host lens)

For **each** section:

1. **Load** — title (`usePageTitle`), no hard error, empty/loading states sane
2. **Nav** — item visible only with correct `PROPERTY_NAV_VIEW_PERMISSION`; Help always reachable when allowed by section gate
3. **Primary jobs** — can a busy host finish the main task in ≤3 clicks from the page?
4. **Deep links** — every in-page `Link`/`href` must use `propertySectionPath` / org helpers — **never** bare `/bookings`, `/finance`, `/maintenance`
5. **Permissions** — Operations vs Read Only vs Full Access (seeded templates); leaf edit buttons hidden when denied
6. **Plan gates** — Free / Starter / Pro / Business behaviors from feature matrix; upgrade modal + TierBadge; server must enforce (not UI-only)
7. **AI promise** — where AI exists (booking review, inbox suggest, marketing gen, dashboard assistant): is it helpful, gated correctly, and recoverable on downgrade?
8. **Mobile** — 375px: hero, bottom tabs / More, 44px targets
9. **Docs** — guide Progress overview + host Q&A still true

## Plan × permission smoke matrix

| Actor                | Expect                                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Org owner            | Full nav + all leaves                                                                                                                                                  |
| Full Access template | Same operational catalog                                                                                                                                               |
| Operations           | Bookings/maintenance/inbox/marketing; **no** finance / settings / team manage                                                                                          |
| Read Only            | View bookings/maintenance/templates/public pages/pricing/team/inbox; **no** finance nav                                                                                |
| Free plan            | Core booking loop; paid features watermark / upgrade (import, telegram enable, Meta connect, marketing studio, AI assistant send, public-pages save, calendar sync, …) |
| Starter+             | `bookingImport`, `customTemplates`, `quickReplies`, `customRoles`, reporting exports, team seats >1                                                                    |
| Pro+                 | `marketingStudio`, `publicPagesAutosave`, `propertyShowcase`, `calendarSync`, `aiValidations`                                                                          |
| Business+            | `aiDashboardAssistant`, `aiReceptionist`, `aiChatAutoReply`, `metaChatChannel`, `aiMarketingGeneration`, Meta publish unlimited                                        |

## Findings output

Write/update under **`docs/workflow/qa/property-dashboard/`**:

- `README.md` — index + severity legend + how to re-run
- One file per module: `NN-<section>.md` with **Looks good**, **Issues**, **Improvements**, **Doc gaps**, **Evidence** (live / code / doc)

Severity: `P0` blocks host day-to-day · `P1` wrong gate / broken link · `P2` UX friction · `P3` polish.

## Related skills

- `verify` — static + playwright proof for a single change
- `route-guides` / `documentation-maintenance` — sync guides when fixing
- `admin-dashboard` / `booking-workflow` — bookings deep dive
- `multi-tenancy` — property vs org scope

## Deep interaction pass (Phase 3+)

Beyond smoke + plan/RBAC probes, exercise at least once per major surface:

1. **Settings** — save a non-payment section; note payment OTP when payment dirtied
2. **Marketing** — open Design editor; Download PNG; Publish plan gate
3. **Bookings detail** — GAF (or equivalent) upload → Mark complete
4. **Notifications** — Telegram module enable + Save and test (invalid token proves validation; real bot optional)
5. **Inbox** — Channels → Connect Meta (expect Business upgrade on Pro; OAuth only on Business + credentials)

Write evidence to `docs/workflow/qa/property-dashboard/18-*.md` / `19-*.md` (or bump the latest phase file).

## Phase 4 (Business + live integrations)

1. Temporarily set local org to **Business** (`pricing_plans.code = pro`); restore afterward.
2. **Telegram** — module **Send preview** (expect live “Preview sent”); shared **Save and test** with a real BotFather token.
3. **Inbox** — **Connect Meta** must start Facebook OAuth (no upgrade modal). Stop before sharing a human FB session unless the user is present.
4. **Marketing Publish** — empty-state Inbox link; Publish disabled until a channel exists.
5. Record findings in `19-phase4-*.md`.

## Don'ts

- Don't mark complete after reading guides only
- Don't claim plan-tier coverage without Free **and** at least one paid tier (or explicit code-path + matrix verification when live paid seed is unavailable)
- Don't skip updating outdated route guides when you prove a mismatch
- Don't log BotFather tokens, chat IDs, or Meta Page tokens into findings docs or chat
