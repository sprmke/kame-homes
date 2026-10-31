---
stage: done
title: 'Super Admin Console Overhaul — IA, design consistency, Overview dashboard, Org hub'
status: in-progress
tags: [planning, planned-modules, super-admin, admin, ui, dashboard, ia]
updated: 2026-09-06
---

# Super Admin Console Overhaul

## Status (2026-09-05)

**UX correction (2026-09-05):** the Org hub shipped in Phase 4 used routed pill tabs
(`SuperAdminSecondaryNav`) for its 8 sections and grew the global Platform sidebar with a
duplicate "Organization" block on every org page — flagged by the user as inconsistent with the
rest of the console. Rebuilt as a **single scrollable page** on `AdminSectionNavLayout` (the same
sticky left-nav-card component Property/Org/Development Settings already use): sections are
in-page anchors, not routes; the global sidebar no longer grows an org-scoped section; deep links
from other pages (`superAdminPaths.organizationHubSection`) now land on the hub and scroll to the
right anchor. See [`admin/orgs.md`](../../guides/routes/admin/orgs.md).

**UX correction #2 (2026-09-05):** Host Detail (`/admin/hosts/:hostId`) had the same pill-tab
pattern (`Organizations` / `Properties` as two routed tabs) and no stat-card/search/pagination
parity with the rest of the console. Rebuilt as one page: 3 stat cards (Organizations / Properties
/ Parking slots, the first two doubling as the mode switch), search, a **mode dropdown** replacing
the tabs, an org filter (Properties mode, shown only when the host owns >1 org), status/type
filters, a shared grid/table view toggle, and pagination — `list-host-organizations` gained `?q=`,
`list-host-properties` gained `?orgId=`. Old `/orgs` and `/orgs/properties` sub-routes redirect to
the single page. See [`admin/host-detail.md`](../../guides/routes/admin/host-detail.md).

| Phase | Scope                                                                                                                                                              | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Shared primitives + grouped sidebar nav + distinct icons                                                                                                           | ✅ done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 1     | Consistency pass — Payment settings, Parking payouts, AI Management, Development detail (back link), `/admin/orgs/:slug/properties`, Approvals toolbar, Host shell | ✅ done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2     | Overview dashboard — `super-admin-overview` fn + KPIs / charts / attention / recent activity + range toggle                                                        | ✅ done (edge fn verified against local data)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 3     | `/admin/orgs` index — `list-organizations-admin` fn + page + nav entry                                                                                             | ✅ done (verified)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 4     | Org hub — `SuperAdminOrgShell` + Overview / Subscription / Listings / Approvals / Support / Settings; `get-organization-admin`; redirect old route                 | ✅ done (verified)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 5     | Org hub AI-credits section; `_shared/superAdminApprovalsQueue.ts` extraction + org-scoping                                                                         | ✅ done — **audit-log hooks deferred to Phase 6 backlog**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 6     | Missing-module backlog                                                                                                                                             | ✅ **4 of 10 built + verified**: audit log (migration + `logSuperAdminAction` wired into 6 mutation sites + `/admin/audit` + org-hub Activity tab), AI usage dashboard (`/admin/ai-usage`), platform settings (`platform_settings` singleton + `/admin/platform-settings`, storage only — consumer wiring is a follow-up), ⌘K search. Remaining 6 (bookings oversight, financial reporting, users/identity admin, host broadcast, org danger zone, announcements unification) spun out to [`super-admin-console-followups`](../planned/super-admin-console-followups.md) — each needs its own review pass (impersonation, org delete, outbound email are security-sensitive). |
| 7     | Docs + Playwright QA                                                                                                                                               | ✅ docs updated; headless Playwright walk done — 15 `/admin/*` routes × 4 breakpoints (375/768/1024/1440): 0 nav timeouts, body errors, horizontal overflow, or console errors. Screenshots spot-checked.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

**Server-side summary counts:**

- **Support** (`list-support-tickets-admin?summary=true`) and **Approvals**
  (`list-super-admin-approvals?summary=true`, via `summarizeApprovalQueue` in the shared queue
  module) — ✅ **done + verified**. Both summary-card components take an optional `summary` prop
  (server-fed, org-scopable) and fall back to the page-derived count when it's absent.
- **Developments** — still page-derived. Low priority (small, slow-growing catalog); add
  `?summary=true` to `list-developments` when it matters.
- **Pricing plans** — no fix needed; the catalog is a fixed ~6-row list, so page 1 is the whole set.

**Deliberately deferred:**

- **Nav-label "Platform AI"** — kept as "AI Management" to match the page H1 and avoid clashing
  with the _Platform AI_ card inside.
- **Page titles** — `AdminLayout` already sets `/admin/*` titles from the active nav label; a
  page-level `usePageTitle` runs before the layout's and loses. Detail-route titles want a
  `resolveAdminPageTitle` extension — out of scope for the visual pass.

## Phase 6 — built (4 of 10)

Route guide: [`docs/guides/routes/admin/platform-tools.md`](../../guides/routes/admin/platform-tools.md).

| Module                        | Shipped                                                                                                                                                                                                                                                                                                            | Edge fn(s)                                             | Verified                                                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Super-admin audit log**     | `super_admin_audit_events` table + `logSuperAdminAction()` fire-and-forget writer, wired into org plan assign, verification approve/reject/request-changes, parking payout disburse/clawback, AI kill-switch update, AI credit-wallet adjust, platform settings update. `/admin/audit` + org-hub **Activity** tab. | `list-super-admin-audit`, `_shared/superAdminAudit.ts` | ✅ end-to-end: PUT `platform-settings` → row appears in `list-super-admin-audit` with correct actor/action/summary/metadata                                                                        |
| **AI usage & cost dashboard** | `/admin/ai-usage` — spend trend, cost-by-feature, top-25-orgs table with quota-breach flags, range toggle                                                                                                                                                                                                          | `super-admin-ai-usage`                                 | ✅ real numbers against local data (2 orgs, $0.32/270 calls in 30d)                                                                                                                                |
| **Platform settings**         | `platform_settings` singleton + `/admin/platform-settings` (signups on/off, maintenance mode + message, default plan, support email, legal URLs, public rate limit)                                                                                                                                                | `platform-settings`                                    | ✅ GET/PUT round-trip verified; **consumer wiring (signup gate, maintenance banner, default plan, rate-limit enforcement) is a follow-up** — saving here does not yet change guest-facing behavior |
| **Global ⌘K search**          | Command palette (`cmdk`, mounted in `SuperAdminShell`) fanning out over orgs/properties/parkings/tickets                                                                                                                                                                                                           | `super-admin-search`                                   | ✅ opens on ⌘K/Ctrl-K, real hits for "kame"                                                                                                                                                        |

## Phase 6 — remaining (6 of 10, spun out)

Not built this pass — each involves outbound email, org deletion, or impersonation and needs a
dedicated review before shipping. See [`super-admin-console-followups.md`](../planned/super-admin-console-followups.md).

| Module                            | Sketch                                                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Bookings oversight**            | `/admin/bookings` — platform-wide booking search for support ("find this guest's booking across every org").                             |
| **Financial / revenue reporting** | MRR trend (needs `org_subscription_events` history), plan-mix over time, churn, parking commission earned, failed subscription payments. |
| **Users / identity admin**        | List all auth users + guest accounts; impersonate org owner; manage `SUPER_ADMIN_EMAILS` from UI.                                        |
| **Host broadcast**                | Send an announcement/email to selected hosts/orgs from `/admin/announcements`.                                                           |
| **Org-hub danger zone**           | Suspend / delete org, impersonate owner — needs dedicated edge functions with confirm + audit.                                           |
| **Announcements unification**     | Platform + development announcements in one screen with schedule + preview.                                                              |

---

## Original plan

**Goal.** Turn `/admin/*` from a set of loosely-related list pages into one coherent console:
a real Overview dashboard (KPIs + charts + attention queue), a shared page/section/settings
design system so every page looks and behaves the same, grouped navigation, a single
**Organization hub** (`/admin/orgs/:orgSlug`) that pulls subscriptions / hosts / listings /
approvals / verification / AI / support into one place, and a backlog of missing modules.
Every page must be responsive at 375 / 768 / 1024 / 1440+.

**Auth boundary is unchanged.** All new edge functions go through `serveSuperAdmin`
(`_shared/serveEdge.ts`) / `verifySuperAdminJwt` (`_shared/superAdminAuth.ts`). Gate is
`SUPER_ADMIN_EMAILS`. RLS is not the boundary — keep edge checks.

---

## 1. Current state inventory (17 routes)

| Route                                                | Component                                                     | Scaffold today                                                              | Verdict                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `/admin`                                             | `SuperAdminOverviewPage`                                      | 3-col grid of nav-link cards, **no data**                                   | ❌ Not a dashboard — rebuild                                                     |
| `/admin/developments`                                | `SuperAdminDevelopmentsPage`                                  | header + summary + toolbar + table/grid + meta + pagination + add dialog    | ✅ Reference pattern                                                             |
| `/admin/developments/:slug`                          | `SuperAdminDevelopmentDetailPage` → `DevelopmentSettingsCard` | renders card directly, **no header, no back link, no page title**           | ⚠️ Inconsistent                                                                  |
| `/admin/approvals`                                   | `SuperAdminApprovalsPage`                                     | header + summary + **hand-rolled inline filter bar** + table/grid           | ⚠️ Toolbar not shared; summary counts are page-scoped                            |
| `/admin/support`                                     | `SuperAdminSupportPage`                                       | header + summary + shared toolbar + table/grid                              | ⚠️ Summary counts page-scoped; no page title                                     |
| `/admin/support/faqs`                                | `SuperAdminHelpFaqsPage`                                      | header + summary + bespoke grouped list w/ move up/down                     | ⚠️ Bespoke; per-page select floats alone                                         |
| `/admin/announcements`                               | `SuperAdminAnnouncementsPage`                                 | header + single editor `Card` + Save in header                              | ⚠️ Dev announcements are a separate link-out; no scheduling/preview surface      |
| `/admin/hosts`                                       | `SuperAdminHostsPage`                                         | full shared scaffold                                                        | ✅ Good (add page title)                                                         |
| `/admin/hosts/:hostId` (+ `orgs`, `orgs/properties`) | `SuperAdminHostShell`                                         | pill tabs + Outlet                                                          | ⚠️ Sub-pages have no header; bare loading/empty states cause layout jump         |
| `/admin/settings` ("AI Management")                  | `SuperAdminSettingsPage`                                      | 3 big cards in a 2-col grid                                                 | ⚠️ Route/label mismatch; 3rd card orphaned; no real "platform settings" anywhere |
| `/admin/pricing/plans`                               | `SuperAdminPricingPlansPage`                                  | full shared scaffold + edit dialog                                          | ✅ Good (stray validation `<p>` at bottom)                                       |
| `/admin/pricing/payment-settings`                    | `SuperAdminPaymentSettingsPage`                               | **hand-rolled `<form>` in a bordered `<div>`, raw `<input type=checkbox>`** | ❌ Raw controls, no `Card`, no summary                                           |
| `/admin/pricing/subscriptions`                       | `SuperAdminOrgSubscriptionsPage`                              | full shared scaffold + server summary + 2 cron buttons                      | ✅ Good, dense                                                                   |
| `/admin/parking/payouts`                             | `SuperAdminParkingPayoutsPage`                                | settings `<form>` in bordered `<div>` + raw `Table` ledger                  | ⚠️ Not `Card`, no summary, table overflows on mobile                             |
| `/admin/properties`                                  | `SuperAdminPlatformPropertiesPage`                            | full shared scaffold                                                        | ✅ Good (add page title)                                                         |
| `/admin/orgs/:orgSlug/properties`                    | `SuperAdminPropertiesPage`                                    | **bare `<h1>` + `<ul>`, hand-rolled skeleton**                              | ❌ Looks unfinished — fold into Org hub                                          |

### Navigation

- Sidebar (`buildSuperAdminNavSections`) = **one flat "Platform" group of 13 items**. No sub-grouping.
- Overview page **duplicates the same 13 links** as cards (`SUPER_ADMIN_PLATFORM_DESTINATIONS`).
- **3 items share the `CreditCard` icon** (Pricing plans / Payment settings / Property subscriptions).
- Nav label "AI Management" but route is `/admin/settings`.
- Mobile bottom nav is derived from these sections (`splitAdminBottomNav`) — regrouping must keep it working.

---

## 2. Critique — themes

1. **No information architecture.** 13 peer nav items with no grouping; Overview is a redundant link menu.
2. **Two classes of page.** ~7 pages use the full shared scaffold (header → summary → toolbar → table/grid → results meta → pagination → empty/loading/error). ~6 are hand-rolled (Payment settings, Parking payouts settings, AI Management, Development detail, Org properties, parts of Approvals + Host shell).
3. **Raw form controls.** `<input type="checkbox">` in Payment settings; bordered `<div>`/`<form>` instead of `Card` in Payment settings + Parking payouts. No shared "settings row" primitive, so every settings block is re-invented.
4. **Misleading metrics.** Approvals / Support / Developments / Pricing summary cards are computed from the **current page** of rows. Only Subscriptions uses a real server-side aggregate.
5. **Overview has zero signal.** No KPIs, no charts, no "what needs attention", no recent activity — despite `recharts` + a proven `org-dashboard` chart set already in the repo.
6. **Org data is scattered.** Subscriptions page, Hosts→Orgs, Approvals, Verification, `/admin/orgs/:slug/properties` (a dead-end bare list), AI credit wallet (org-keyed, buried on the AI page). There is no `/admin/orgs` index and no per-org hub.
7. **Detail views are dialog-only.** Approvals (3 dialogs), tickets, FAQ editor, plan editor — no deep-linkable detail routes for auditing/sharing.
8. **Responsive gaps.** Parking payouts ledger = 5-col `Table` + action buttons, overflows < 768. Host tab sub-pages jump between states. Development detail unaudited. Org properties bare list.
9. **Inconsistent page titles.** Several pages never call `usePageTitle` (Hosts, Approvals, Developments, Platform Properties, Settings).
10. **No audit trail.** Plan assigns, approvals, payout disbursements, kill-switch flips leave no record.

---

## 3. Missing features / modules

| Module                                                                | Why                                                                                                                    | Priority |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------- |
| **Organizations index + hub** (`/admin/orgs`, `/admin/orgs/:orgSlug`) | User's explicit ask — one place to manage an org's subscription, hosts, listings, approvals, verification, AI, support | P0       |
| **Overview dashboard** (KPIs + charts + attention + activity)         | The `/admin` landing must answer "is the platform healthy?"                                                            | P0       |
| **AI usage & cost dashboard**                                         | `ai-platform-usage` edge fn exists, nothing renders it — cost per org / feature / trend, quota breaches                | P1       |
| **Platform settings** page                                            | Branding, default plan, signup on/off, maintenance mode, support email, legal URLs, rate limits — nowhere today        | P1       |
| **Audit log**                                                         | Record + view super-admin actions                                                                                      | P1       |
| **Global search (⌘K)**                                                | Jump to any org / host / property / parking / ticket / booking                                                         | P1       |
| **Bookings oversight**                                                | Platform-wide booking search for support ("find this guest's booking")                                                 | P2       |
| **Financial / revenue reporting**                                     | MRR, plan mix, churn, parking commission earned, failed subscription payments                                          | P2       |
| **Users / identity admin**                                            | See all auth users + guest accounts; impersonate owner; manage `SUPER_ADMIN_EMAILS` from UI                            | P2       |
| **Host broadcast**                                                    | Send an announcement/email to selected hosts/orgs                                                                      | P2       |
| **Verification tiers management**                                     | Surface `host-verification-tiers` (in-progress) config here                                                            | P2       |
| **Support upgrades**                                                  | SLA timers, assignment, canned responses, link ticket → org/booking                                                    | P2       |
| **Announcements unification**                                         | Platform + development announcements in one screen, with schedule + preview                                            | P2       |
| **Developments**                                                      | Bulk import + map view                                                                                                 | P3       |

---

## 4. Design system standardization

New shared primitives in `ui/src/features/dashboard/super-admin/components/shared/`:

| Primitive                                                                                | Replaces / used by                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SuperAdminPage`                                                                         | Standard `AdminPageHeader` + `usePageTitle` + spacing wrapper for every route                                                                                                                                                                                                                |
| `SuperAdminListPage`                                                                     | Generic list scaffold: header slot, `SuperAdminSummaryCards`, `SuperAdminToolbar`, table/grid switch, `SuperAdminResultsMeta`, `AdminListPagination`, empty/loading/error. Collapses Developments / Hosts / Pricing / Subscriptions / Support / Platform Properties / Approvals into config. |
| `SuperAdminSummaryCards` + `SuperAdminStatCard`                                          | One metric card (wrap `AdminMetricCard`); **server-fed** counts, not page-scoped                                                                                                                                                                                                             |
| `SuperAdminToolbar`                                                                      | Shared search + filter selects + per-page + view toggle — kills the hand-rolled bar in Approvals                                                                                                                                                                                             |
| `SuperAdminSettingsCard` + `SuperAdminSettingsRow`                                       | `Card`-based label / description / control rows @ 44px — replaces raw `<form>`s in Payment settings, Parking payouts settings, and the 3 AI cards                                                                                                                                            |
| `SuperAdminDetailHeader`                                                                 | Title + back link + meta + actions for detail pages (Development detail, Org hub, Host shell)                                                                                                                                                                                                |
| `SuperAdminSecondaryNav`                                                                 | Scrollable pill tabs — extracted from `SuperAdminHostShell`, reused by Org hub + AI/Settings                                                                                                                                                                                                 |
| `SuperAdminSection`                                                                      | Card with header + optional action — dashboard panels                                                                                                                                                                                                                                        |
| `SuperAdminChartCard` + `SuperAdminAreaChart` / `SuperAdminDonut` / `SuperAdminBarChart` | recharts, themed via CSS vars — mirror `org-dashboard/OrgRevenueBookingsChart` + `OrgBookingStatusDonut`                                                                                                                                                                                     |

Rules:

- No raw `<input type="checkbox">` / bordered `<div>` settings — use `Checkbox` / `Switch` inside `SuperAdminSettingsCard`.
- Every route calls `usePageTitle(appPageTitle(...))`.
- Distinct nav icons: `LayoutDashboard` (Overview), `Building2` (Organizations), `Landmark` (Developments), `Building` (Properties), `Car` (Parking payouts), `BadgeCheck` (Approvals), `Users` (Hosts), `CreditCard` (Pricing plans), `Receipt` (Subscriptions), `Wallet` (Payment settings), `LifeBuoy` (Support), `HelpCircle` (FAQs), `Megaphone` (Announcements), `Sparkles` (Platform AI), `Settings` (Platform settings).
- Follow `minimal-ui-copy` (no decorative helper text) and `mobile-responsive` (44px targets, tables scroll in `overflow-x-auto`, card fallback < `lg`).

### Regrouped sidebar nav

```
Overview            /admin
Organizations
  Organizations     /admin/orgs
  Hosts             /admin/hosts
  Developments      /admin/developments
  Properties        /admin/properties
Billing & catalog
  Pricing plans     /admin/pricing/plans
  Subscriptions     /admin/pricing/subscriptions
  Payment settings  /admin/pricing/payment-settings
  Parking payouts   /admin/parking/payouts
Operations
  Approvals         /admin/approvals
  Support tickets   /admin/support
Content
  Announcements     /admin/announcements
  FAQs              /admin/support/faqs
Platform
  Platform AI       /admin/settings   (retitled; path kept)
  Platform settings /admin/platform-settings   (new, P1)
```

Overview page keeps a condensed quick-links grid as a _secondary_ element under the dashboard.

---

## 5. Overview dashboard spec

New edge fn `super-admin-overview` (`serveSuperAdmin`), period param `30d | 90d | 12mo` (reuse `dashboardPeriod` helpers). Returns:

- **KPI strip:** total orgs, active subscriptions + MRR, hosts, properties, parkings, pending approvals, open tickets, AI spend (period).
- **Charts row:** orgs & subscriptions growth (area, 12 mo) · plan mix (donut) · MRR / revenue trend (area) · AI cost by feature (bar).
- **Attention panel:** pending approvals · failed subscription payments · undisbursed parking payouts · AI quota breaches · unassigned tickets — each links to the filtered list.
- **Recent activity:** latest org signups · latest subscription changes · latest approval decisions · latest tickets.
- **Quick links:** condensed grid (secondary).

UI: `SuperAdminPage` + period filter (like `OrgDashboardPage`), `SuperAdminSummaryCards`, a 2-col `SuperAdminChartCard` board, `SuperAdminSection` for attention + activity.

---

## 6. Organization hub spec

### Routes

```
/admin/orgs                    SuperAdminOrgsPage      index list (search, plan, verification tier, status; table/grid; server summary)
/admin/orgs/:orgSlug           SuperAdminOrgShell      SuperAdminDetailHeader + SuperAdminSecondaryNav + Outlet
  index → overview             org KPIs, plan, verification tier, owner, counts, recent bookings, attention items
  subscription                 assign plan (reuse Subscriptions logic), billing history, run/skip billing, scheduled downgrade
  listings                     Properties + Parkings tabs (reuse OrgPropertyCard + platform parking list)
  members                      owner + org members + property members (org-team-members), roles
  approvals                    org + listing-verification + review approvals filtered to this org (reuse the 3 dialogs)
  verification                 verification tier + submitted assets + approve/reject (reuse dialogs)
  ai                           AI credit wallet (move AiCreditWalletCard here, org prefilled) + usage/quota + per-feature
  support                      tickets filtered to org (list-support-tickets-admin already accepts orgId)
  settings                     danger zone: suspend / delete org, impersonate owner, reassess superhost
```

- `/admin/orgs/:orgSlug/properties` → **redirect** to `/admin/orgs/:orgSlug/listings`.
- Sidebar shows an "Organization" section (org name + the sections above) whenever the path is under `/admin/orgs/:slug` — extend the existing `buildSuperAdminNavSections(orgSlug)` branch.

### Backend

- `list-organizations-admin` — platform-wide org list w/ plan, verification tier, owner, counts, status (model on `org-subscriptions-admin`, which already joins plan + counts).
- `get-organization-admin` — one org: same fields + recent bookings + attention rollup.
- Reuse: `org-subscriptions-admin`, `apply-org-plan-downgrade`, `platform-billing-cron`, `reassess-org-superhost`, `list-org-verifications`, `list-org-listing-verifications`, `get-org-verification-assets`, `approve/reject-org-verification`, `org-team-members`, `list-support-tickets-admin`, `ai-platform-credit-wallet`, `ai-platform-usage`, `list-host-properties` / `list-platform-properties` (filter by org).

---

## 7. Phasing

Each phase ends with: `documentation-maintenance` skill (write checklist), `route-guides` skill for
every touched page, `verify` skill (type-check / lint / build) + a Playwright walk at 375 / 768 / 1024.

- **Phase 0 — Foundations.** Build the shared primitives (§4) + chart components. Regroup sidebar nav into sections; fix icons; add missing page titles. Pure refactor of `SUPER_ADMIN_PLATFORM_DESTINATIONS` → grouped structure. No behavior change. Keep `splitAdminBottomNav` working.
- **Phase 1 — Consistency pass.** Migrate the ❌/⚠️ pages onto the shared scaffold: Payment settings, Parking payouts, AI Management (→ "Platform AI", 3 cards on a settings-card grid), Development detail (header + back link), Approvals (shared toolbar), Host shell sub-pages (own headers + stable states), Pricing plans (drop stray `<p>`). Server-side summary counts for Approvals / Support / Developments / Pricing. Responsive audit + fixes for every `/admin/*` page. Leave `/admin/orgs/:slug/properties` in place until Phase 4.
- **Phase 2 — Overview dashboard.** `super-admin-overview` edge fn + new `SuperAdminOverviewPage` (KPIs, charts, attention, activity, condensed quick links). Update `docs/guides/routes/admin/overview.md`.
- **Phase 3 — Organizations index.** `list-organizations-admin` + `/admin/orgs` list page + nav entry + `docs/guides/routes/admin/orgs/index.md`.
- **Phase 4 — Org hub core.** `SuperAdminOrgShell` + `SuperAdminSecondaryNav`; sections: overview, subscription, listings, members, verification, approvals (reuse existing components/dialogs). `get-organization-admin`. Redirect `/admin/orgs/:slug/properties` → `…/listings`. Route guides under `docs/guides/routes/admin/orgs/`.
- **Phase 5 — Org hub advanced.** AI (credit wallet moved here + usage/quota), support section, settings/danger zone (suspend/delete/impersonate/reassess), audit-log write hooks on all super-admin mutations.
- **Phase 6 — Missing-module backlog.** Each becomes its own focused plan in `docs/workflow/planned/`: AI usage dashboard, Platform settings page, Global ⌘K search, Bookings oversight, Financial reporting, Users/identity admin, Host broadcast, Audit-log viewer, Announcements unification.
- **Phase 7 — Docs + QA sweep.** Every `docs/guides/routes/admin/*.md` refreshed; new `docs/guides/routes/admin/orgs/*`; `docs/PROJECT.md` routes + env + edge-fn tables; `.cursor/rules/admin-auth.mdc` + `supabase-edge-functions.mdc` if any auth/endpoint added; full Playwright walk of all routes at 4 breakpoints.

---

## 8. Risks / constraints

- **Bottom nav** derives from `buildSuperAdminNavSections` via `splitAdminBottomNav` — regrouping must keep `flattenNavigableNavItems` output sane (primary tabs = Overview + first items).
- **New edge fns** must all use `serveSuperAdmin`; add rows to `supabase/config.toml` per-function JWT policy + `.cursor/rules/supabase-edge-functions.mdc`.
- **`plans-and-permissions`** — these are platform-admin surfaces, not host features → Team RBAC is N/A; Plans entitlement is N/A except the plan-catalog/entitlement viewer which _is_ a super-admin surface (note in that skill's checklist per phase).
- **No prod deploy** without `kamewave`. Local Supabase + migrations only.
- Keep `AdminLayoutOutlet` shell — do not fork a separate super-admin layout.
- Chart theming: reuse the CSS-var approach from `OrgRevenueBookingsChart` so light/dark both work.

---

## 9. Deliverables checklist

- [ ] Phase 0 shared primitives + grouped nav + icons + page titles
- [ ] Phase 1 all `/admin/*` pages on the shared scaffold + responsive-audited + server summaries
- [ ] Phase 2 Overview dashboard (`super-admin-overview` fn + UI)
- [ ] Phase 3 `/admin/orgs` index (`list-organizations-admin`)
- [ ] Phase 4 Org hub (`SuperAdminOrgShell` + 6 sections, `get-organization-admin`, redirects)
- [ ] Phase 5 Org hub advanced (AI, support, danger zone, audit hooks)
- [ ] Phase 6 spun-out plans for each missing module
- [x] Phase 7 docs + Playwright QA at 375 / 768 / 1024 / 1440 (headless walk, 60 route×breakpoint combos clean)
