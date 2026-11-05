# Skeleton loaders

Loading UI must mirror the **layout that appears after data loads**, on phone and desktop. Generic spinners and full-page swaps that hide chrome are reserved for pre-shell gates only.

## Invariants

1. **Chrome stays mounted.** Page hero (`AdminMobilePage` / `AdminPageHeader`), nav, sidebars, and marketing footer stay visible. Only the **data region** shows a skeleton.
2. **Shape matches content.** Reuse domain skeletons from `ui/src/components/skeletons/` (or add a sibling module). Do not reuse unrelated dashboards (e.g. property dashboard skeleton on org analytics).
3. **Default view.** The skeleton shows the page's default view: default tab (org Plans opens on **Billing**), default list mode (org listings follow `defaultOrgListingViewMode`: list under 5 items, table at 5+ on desktop, grid at 5+ below `lg`), bookings `?view=` (table on desktop, cards on phone).
4. **Route skeletons carry page chrome.** Page chrome is rendered by the lazy page, so route skeletons render the same `AdminMobilePage` (title, subtitle, `titleId`, `dense`, `className`, date-filter overlap placeholder, desktop header actions) as the loaded page. Without it the hero and header jump when the chunk resolves.
5. **State-aware fallbacks.** Show a skeleton only on the first load (`isLoading && !data`); cached data stays on screen during refetches so a refresh never replaces a populated page. Match the page's default/selected state (`?view=`, default tab, section nav) rather than showing empty-state chrome.
6. **Cheap by construction.** Skeletons are static markup: no timers, observers, fetches, or shared query subscriptions. They reuse the same `StatCardSkeleton` / table / card primitives as the loaded page so metrics and spacing line up at 375, 768, and 1024px+.
7. **Static-first.** Fixed labels, titles, subtitles, descriptions, section/card headings, tab labels, column headers, legend labels and known icons are rendered immediately, never skeletonized. Skeletons cover only async values, rows, media, charts and permission-gated actions. `StatCardSkeleton` takes `title` + `icon` (+ `changeLabel` / `footer`) for exactly this reason.

## Route registry

| Mechanism                                     | Role                                                                                                                                                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RouteSkeletonBoundary`                       | Wraps lazy route chunks + provides skeleton to `Suspense` and permission guards (`ui/src/components/skeletons/RouteSkeleton.tsx`).                                                                    |
| `propertyRoute` / `orgRoute` / `parkingRoute` | Third argument: eager skeleton node (`ui/src/features/dashboard/org/routes/guards.tsx`). `RouteSkeletonProvider` wraps the permission guards, so guard loading and the chunk `Suspense` both show it. |
| `RouteSkeletons.tsx`                          | Named `*RouteSkeleton` exports wired from dashboard route modules.                                                                                                                                    |
| `RouteGuardLoading`                           | In-shell guards: `useRouteSkeleton()` or fallback `RouteGuardSkeleton`.                                                                                                                               |
| `RouteGuardSkeleton`                          | **Pre-shell only** (auth, onboarding, org selector, accept invite).                                                                                                                                   |
| `MarketingRouteSuspenseFallback`              | Path-aware marketing `Suspense` fallback (`MarketingRouteFallback.tsx`).                                                                                                                              |
| `GuestAccountRouteSuspenseFallback`           | Account area `Suspense` fallback (sidebar stays mounted).                                                                                                                                             |
| `useOrgListingSkeletonView`                   | Default org listing view for skeletons from cached property / parking lists (read-only, never fetches).                                                                                               |

Super-admin lazy routes use `superAdminRoute(page, skeleton)` in `ui/src/features/dashboard/super-admin/routes/index.tsx`.

Weekly ops reports use two route-specific skeletons: `SuperAdminOpsReportsRouteSkeleton` (real title + **Generate now**, five report rows) and `SuperAdminOpsReportDetailRouteSkeleton` (real title + back link, four fixed severity labels, finding cards).

Nested layouts with lazy children keep their own `Suspense` around `<Outlet />` so switching sections does not unmount the layout (Help & Support: `HelpSupportSectionSkeleton`).

## Module map (eager skeletons)

| File                            | Domains                                                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `AdminSkeletons.tsx`            | Shared admin primitives, list toolbar, bookings, finance, settings nav, listings, org dashboard, plans, team, reviews, guest inbox            |
| `OrgListingSkeleton.tsx`        | Org Properties / Parkings page body, org listing table / grid / list views (inventory + analytics variants)                                   |
| `AnalyticsSkeleton.tsx`         | Org + property analytics                                                                                                                      |
| `AnnouncementsSkeleton.tsx`     | Host announcements list / detail body                                                                                                         |
| `BookingsExtrasSkeleton.tsx`    | Stage KPI strip, kanban                                                                                                                       |
| `FinancePageSkeleton.tsx`       | Property/parking Finance and Maintenance data regions (KPIs, cash-flow / breakdown, toolbar, responsive ledger view)                          |
| `NotificationsSkeleton.tsx`     | Property/parking Notifications hub — section nav, in-app cards, activity feed, Telegram module cards                                          |
| `MarketingSkeletons.tsx`        | Marketing Studio — library, template browser, AI Studio home + conversation, themes, publish history, and design/video/calendar editor chrome |
| `PricingSkeleton.tsx`           | Property/parking pricing body — real-month week rows with day + price cells, property fee rows, parking payout lines + direct-link card       |
| `ParkingSkeleton.tsx`           | Parking dashboard, booking detail                                                                                                             |
| `GuestMarketingSkeleton.tsx`    | Property detail, development detail, browse grids, account gate, property chat                                                                |
| `HelpSupportSkeleton.tsx`       | Help & Support page (module nav, intro, FAQs / guides / tickets), documentation topics                                                        |
| `SuperAdminSkeletons.tsx`       | List/overview/audit bodies, settings cards, card lists, host detail, organization hub                                                         |
| `AiAssistantSkeleton.tsx`       | AI assistant panel chunk                                                                                                                      |
| `GuestPageSkeletons.tsx`        | Guest form page                                                                                                                               |
| `GuestAccountSkeletons.tsx`     | Profile form, voucher wallet rows                                                                                                             |
| `ImportWizardSkeleton.tsx`      | Import wizard commit step                                                                                                                     |
| `TemplateWorkbenchSkeleton.tsx` | Property Templates workbench — library rail (search, grouped rows) beside the editor pane; rail only below `lg`                               |

## Static vs async (what gets a skeleton)

| Render immediately                                               | Skeleton only                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------- |
| Page title / subtitle, section & card headings, descriptions     | Stat values, deltas, counts, amounts, names, emails, statuses |
| Stat card labels, known icons, trend captions (`vs last period`) | Async rows / cards / messages / timeline clips                |
| Tab labels, nav labels, column headers, legend labels            | Chart plots, donuts, calendar bodies, media previews          |
| Field labels, button labels, empty-state copy                    | Permission-gated actions that may not exist                   |
| Known dates/months/day numbers, fixed static list counts         | —                                                             |

`StatCardSkeleton` accepts `title`, `icon`, `changeLabel` and `footer` so KPI labels and icons are
real text from the first paint. `AppSettingsNavLayoutSkeleton` accepts `navLabels`;
`SuperAdminAdminListBodySkeleton` accepts `metricTitles`; pricing/marketing skeletons render
month labels, day numbers, tab names and editor rail labels immediately.

## Route → skeleton map (dashboard + super admin)

Every lazy dashboard route renders a route skeleton while its chunk loads and a body skeleton on
first data load. Both use the same page chrome, so nothing jumps when the chunk or query resolves.

| Route                                     | Route skeleton                             | Body skeleton                                                                                               |
| ----------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `/org/:orgSlug/dashboard`                 | `OrgDashboardRouteSkeleton`                | `OrgDashboardSkeleton`                                                                                      |
| `/org/:orgSlug/bookings`                  | `OrgBookingsRouteSkeleton`                 | `BookingsStageSummarySkeleton` + list view                                                                  |
| `/org/:orgSlug/reviews`                   | `OrgReviewsRouteSkeleton`                  | `ReviewsPageSkeleton`                                                                                       |
| `/org/:orgSlug/settings`                  | `OrgSettingsRouteSkeleton`                 | `AppSettingsNavLayoutSkeleton`                                                                              |
| `/org/:orgSlug/properties` · `parkings`   | `OrgProperties/ParkingsRouteSkeleton`      | `OrgListingPageSkeleton`                                                                                    |
| `/org/:orgSlug/team`                      | `OrgTeamRouteSkeleton`                     | `TeamPageSkeleton`                                                                                          |
| `/org/:orgSlug/plans`                     | `OrgPlansRouteSkeleton`                    | `PlansPageSkeleton`                                                                                         |
| `/org/:orgSlug/analytics`                 | `OrgAnalyticsRouteSkeleton`                | `OrgAnalyticsSkeleton`                                                                                      |
| property `dashboard`                      | `PropertyDashboardRouteSkeleton`           | `DashboardSkeleton`                                                                                         |
| property `bookings`                       | `PropertyBookingsRouteSkeleton`            | `BookingsListBodySkeleton` (table / cards / calendar)                                                       |
| property `bookings/:bookingId`            | `PropertyBookingDetailRouteSkeleton`       | `BookingDetailPageSkeleton`                                                                                 |
| property `notifications`                  | `PropertyNotificationsRouteSkeleton`       | `NotificationsPageBodySkeleton` (6 modules)                                                                 |
| property `templates`                      | `PropertyTemplatesRouteSkeleton`           | `TemplateWorkbenchSkeleton`                                                                                 |
| property `settings`                       | `PropertySettingsRouteSkeleton`            | `AppSettingsNavLayoutSkeleton`                                                                              |
| property `finance`                        | `PropertyFinanceRouteSkeleton`             | `FinancePageBodySkeleton` (view-aware)                                                                      |
| property `maintenance`                    | `PropertyMaintenanceRouteSkeleton`         | `MaintenancePageBodySkeleton` (view-aware)                                                                  |
| property `pricing`                        | `PropertyPricingRouteSkeleton`             | `PricingPageBodySkeleton` (4 stats, real month weeks, 5 fee rows)                                           |
| property `analytics`                      | `PropertyAnalyticsRouteSkeleton`           | `PropertyAnalyticsSkeleton`                                                                                 |
| property `marketing`                      | `PropertyMarketingRouteSkeleton`           | State-aware: library / template browser / AI home / AI conversation / themes / design·video·calendar editor |
| property `team` · `reviews`               | `PropertyTeam/ReviewsRouteSkeleton`        | `TeamPageSkeleton` · `ReviewsPageSkeleton`                                                                  |
| property `inbox`                          | `PropertyInboxRouteSkeleton`               | `InboxPageSkeleton`                                                                                         |
| property `public-pages`                   | `PropertyCustomPagesRouteSkeleton`         | two sectioned `ListingCardGridSkeleton` blocks                                                              |
| property `public-pages/:pageId/edit`      | `PropertyPageEditorRouteSkeleton`          | `PageEditorSkeleton`                                                                                        |
| parking `dashboard`                       | `ParkingDashboardRouteSkeleton`            | `ParkingDashboardSkeleton`                                                                                  |
| parking `bookings`                        | `ParkingBookingsRouteSkeleton`             | `BookingsListBodySkeleton` (table / cards / calendar)                                                       |
| parking `bookings/:bookingId`             | `ParkingBookingDetailRouteSkeleton`        | `ParkingBookingDetailPageSkeleton`                                                                          |
| parking `finance`                         | `ParkingFinanceRouteSkeleton`              | `FinancePageBodySkeleton` (view-aware)                                                                      |
| parking `pricing`                         | `ParkingPricingRouteSkeleton`              | `PricingPageBodySkeleton` (3 stats, payout lines, direct-link card)                                         |
| parking `notifications`                   | `ParkingNotificationsRouteSkeleton`        | `NotificationsPageBodySkeleton` (3 modules)                                                                 |
| parking `settings`                        | `ParkingSettingsRouteSkeleton`             | `AppSettingsNavLayoutSkeleton`                                                                              |
| parking `inbox` · `team`                  | `ParkingInbox/TeamRouteSkeleton`           | `InboxPageSkeleton` · `TeamPageSkeleton`                                                                    |
| announcements (org / property / parking)  | `HostAnnouncementsRouteSkeleton`           | `HostAnnouncementsBodySkeleton`                                                                             |
| help-support (all scopes)                 | `OrgHelpSupportRouteSkeleton`              | `HelpSupportPageSkeleton`                                                                                   |
| `/admin` overview                         | `SuperAdminOverviewRouteSkeleton`          | `SuperAdminOverviewBodySkeleton` (12 KPIs + charts)                                                         |
| `/admin` list pages                       | `SuperAdminListRouteSkeleton`              | `SuperAdminAdminListBodySkeleton` (table → cards)                                                           |
| `/admin/support/faqs` · `/admin/playbook` | `SuperAdminListRouteSkeleton grouped`      | grouped rows (with / without summary)                                                                       |
| `/admin/audit`                            | `SuperAdminAuditRouteSkeleton`             | `SuperAdminAuditBodySkeleton`                                                                               |
| `/admin/rate-limits`                      | `SuperAdminRateLimitsRouteSkeleton`        | `SuperAdminCardListBodySkeleton`                                                                            |
| `/admin/health` · `/admin/ai`             | `SuperAdminHealth/AiRouteSkeleton`         | tab strip + settings / overview body                                                                        |
| `/admin/ops-reports`                      | `SuperAdminOpsReportsRouteSkeleton`        | real title + Generate now, five report rows                                                                 |
| `/admin/ops-reports/:reportId`            | `SuperAdminOpsReportDetailRouteSkeleton`   | real title + back link, four severity labels, finding cards                                                 |
| `/admin` settings pages                   | `SuperAdminSettingsRouteSkeleton`          | `SuperAdminSettingsBodySkeleton`                                                                            |
| `/admin/parking/payouts`                  | `SuperAdminParkingPayoutsRouteSkeleton`    | settings card + payout ledger                                                                               |
| `/admin/hosts/:hostId`                    | `SuperAdminHostShellRouteSkeleton`         | `SuperAdminHostShellBodySkeleton`                                                                           |
| `/admin/orgs/:orgSlug`                    | `SuperAdminOrgShellRouteSkeleton`          | `SuperAdminOrgHubBodySkeleton`                                                                              |
| `/admin/developments/:slug`               | `SuperAdminDevelopmentDetailRouteSkeleton` | `AppSettingsNavLayoutSkeleton`                                                                              |

### Guest / public routes

| Route                                                  | Skeleton                                                                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `/`, `/for-hosts`, marketing landing                   | `PublicLandingPageSkeleton` — hero + alternating feature sections                                                             |
| `/properties`, `/parkings`, `/developments`, `/search` | `PublicListingBrowseSkeleton` — hero, filters sidebar, toolbar, listing grid                                                  |
| `/properties/:slug`                                    | `PropertyDetailPageSkeleton` — gallery, title/meta, stat strip, host, About / amenities / location headings                   |
| `/parkings/:slug`                                      | `ParkingDetailPageSkeleton` — gallery, title/meta, description, booking card                                                  |
| `/developments/:slug`                                  | `DevelopmentDetailPageSkeleton` — hero band, title, stat cards, content block                                                 |
| `/properties/:slug/form`, `/parkings/:slug/form`       | `GuestFormPageSkeleton` — brand header, stepper, step panel                                                                   |
| `/properties/:slug/calendar`                           | `CalendarPageSkeleton` — real month/weekday/day numbers, skeleton availability cells                                          |
| SD form / guest review                                 | `SdFormPageSkeleton` / `GuestReviewPageSkeleton` — real review labels, category rows, feedback/private note/photos            |
| Payment / parking request status                       | `ParkingRequestStatusPageSkeleton` — brand header + status body                                                               |
| Showcase / stay guide                                  | `PublicFullBleedPageSkeleton` — header, hero, content sections                                                                |
| Account profile / vouchers / reviews / messages        | `GuestProfileFormSkeleton` (real labels), `GuestVouchersPageSkeleton`, `GuestReviewsPageSkeleton`, `PropertyChatPageSkeleton` |

## Pre-shell and top-level fallbacks

| Surface               | Skeleton                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `RouteGuardSkeleton`  | Branded `AppLoader` when no route skeleton is registered (onboarding, org hub redirect, accept invite, admin auth) |
| `PageLoadingFallback` | Full-screen `AppLoader` before any app shell mounts (`App.tsx` lazy routes)                                        |

`AppSettingsCardSkeleton` remains for callers that do not yet mount their own page header; prefer `AppSettingsNavLayoutSkeleton` inside an existing `AdminMobilePage` / hub header.

## Adding a new dashboard route

1. Add or reuse a skeleton component that matches the loaded layout and default view (375px first). Render fixed chrome immediately: page/section titles, card headings, tab/column/legend labels and known icons. Skeleton only async values, rows, media and charts. Pass the real counts/labels (`AppSettingsNavLayoutSkeleton navLabels`, `PricingPageBodySkeleton statsCount`, `SuperAdminAdminListBodySkeleton metricTitles`) so the sidebar, KPI row, and list line up with the page.
2. Export a `*RouteSkeleton` from `RouteSkeletons.tsx` if the shape is route-specific. Wrap the body in the page's `AdminMobilePage` with the same props as the loaded page.
3. Pass it as the third argument to `propertyRoute` / `orgRoute` / `parkingRoute`, or wrap with `RouteSkeletonBoundary` (super-admin, guest shells).
4. Page-level `isLoading`: keep shell/header; swap **body** only (`SuperAdminPage` `loadingBody`, `AdminMobilePage` children).

## Verification

- 375 / 768 / 1024px: skeleton aligns with loaded UI; no horizontal scroll.
- Slow 3G: lazy routes show route skeleton, not `AppLoader`, once inside admin/marketing shell.
- No hero / header jump when the route chunk resolves.
