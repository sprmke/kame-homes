---
title: 'Local seed dataset: one org, one property, one parking'
status: planned
tags: [dev, seed, testing, local, fixtures]
updated: 2026-11-07
stage: planned
kind: plan
---

# Local seed dataset: one org, one property, one parking

Plan to replace the current pile of overlapping local seeds (`supabase/seed.sql` + 10 `scripts/dev/seed-*.sql` files) with **one canonical local dataset** that exercises every supported module at every level: org, property, parking, super admin, public, and guest portal.

## 1. Goal

After `bun run db:reset` (or `bun run seed:local` on a running stack), local dev should have exactly:

| Level         | Count | Identity                                                          |
| ------------- | ----- | ----------------------------------------------------------------- |
| Organization  | 1     | `kame-homes` — Kame Space                                         |
| Property      | 1     | `kame-home` — Monaco 2604, Azure North Residences                 |
| Parking       | 1     | `monaco-level-2-slot-27` — Azure Monaco, Level 2, Slot 27         |
| Development   | 1     | Azure North Residences                                            |
| Subscription  | 1     | Business (`pro`) plan, active                                     |
| Bookings      | ~70   | Property + parking bookings, every workflow status, 12 months     |
| Guest account | 1     | Signed-in guest with trips, vouchers, wishlist, tickets, messages |

…and every module table listed in §6 has realistic rows, so any page can be opened and used without hand-seeding data.

**Non-goals**

- Not production data. No real PII, no live credentials.
- Not the Playwright mocked fixtures (`ui/e2e/`). Those stay mocked and independent.
- Not the marketing showcase static data (`mockProperties.ts`). That is public marketing content, not local DB rows.
- Not a substitute for the 320-listing performance seed (`seed:mock-listings`), which stays opt-in.

## 2. Decisions already locked

| Decision            | Choice                                                                 | Why                                                                                           |
| ------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Canonical identity  | `kame-homes` / `kame-home` / `monaco-level-2-slot-27`                  | Matches `ui/vercel.json`, docs, and the assistant + parking live harnesses.                    |
| Org count           | 1                                                                      | Plan tier changes happen from `/admin/pricing/subscriptions`; cross-tenant probes stay in QA scripts with their own temporary orgs. |
| Search fixtures     | Moved to an optional script, not loaded on reset                       | Default dataset stays one org / one property / one parking.                                    |
| Plan                | Business (`pro`)                                                       | Unlocks every gate except the retired `business_plus` / `commission` tiers.                    |
| Data freshness      | Booking dates relative to `CURRENT_DATE`                               | Calendar, dashboard, analytics, and finance always look current no matter when you reset.      |
| Cleanup safety      | Seeded rows carry fixed UUIDs + `local_seed` tags; purge only those     | Reference/catalog data is never deleted, and prod-synced rows are never touched.               |

## 3. Current state audit (evidence, 2026-11-07)

Local DB (`supabase_db_guest-form-management`):

```
orgs 1 | properties 5 | parkings 4 | developments 4 | bookings 77
```

The single org is `kame-homes`. It carries five properties, only one of which has data:

| Property             | Bookings |
| -------------------- | -------- |
| `kame-home`          | 69       |
| `azure-north-1br`    | 4        |
| `azure-north-studio` | 4        |
| `azure-bali-1br`     | 0        |
| `azure-north-2br`    | 0        |

Four parkings exist; **none has a single booking**. Two auth users exist for the same owner (`ddd…01` and `d74…c0`), plus the real Google account (`sprmke.dev@gmail.com`), which is not a member of the org.

### 3.1 Data that exists

`guest_submissions` 77 (all statuses, but all property-only), `finance_line_items` 38, `maintenance_items` 29, `activity_log` 48, `property_page_views` 24, `notifications` 3, plus platform/reference singletons.

### 3.2 Module tables that are completely empty

Every one of these pages cannot show real data today:

- **Team / RBAC:** `organization_members`, `organization_invitations`, `organization_custom_roles`, `property_members`, `property_invitations`, `property_custom_roles`, `parking_members`, `parking_invitations`, `parking_custom_roles`
- **Plans:** `org_subscriptions`, `org_subscription_events`, `org_subscription_properties`, `org_payment_transactions`
- **Pricing:** `property_pricing_date_overrides`, `parking_pricing_date_overrides`, `property_blocked_dates`, `parking_blocked_dates`, `property_smart_pricing_settings`, `property_smart_pricing_runs`, `property_smart_pricing_recommendations`, `calendar_sync_events`, `property_calendar_feeds`
- **Marketing:** `marketing_themes`, `marketing_templates`, `marketing_media_assets`, `marketing_generations` (via job tables), `marketing_ai_sessions`, `marketing_publications`, `marketing_generation_jobs`, `marketing_generation_references`, `marketing_ai_post_versions`
- **Inbox:** `social_channel_connections`, `social_conversations`, `social_messages`, `inbox_thread_metrics`, `meta_inbox_oauth_state`
- **Reviews:** `guest_reviews`, `host_guest_reviews`, `review_reports`, `review_automation_rules`
- **Public pages:** `custom_pages`, `public_page_configs`
- **Support:** `support_tickets`, `support_ticket_messages`
- **Notifications:** `notification_reads` (only `notification_preferences` has 1 row)
- **Import:** `import_batches`, `import_batch_rows`
- **AI:** `ai_platform_org_settings`, `ai_platform_property_settings`, `ai_platform_org_credit_wallet`, `ai_platform_org_credit_ledger`, `ai_platform_usage_daily`, `ai_dashboard_assistant_org_settings`, `ai_dashboard_assistant_conversations`, `ai_dashboard_assistant_messages`, `ai_voice_receptionist_org_settings`
- **Guest portal:** `guest_profiles`, `guest_saved_properties`, `guest_requests`, `guest_chat_ai_feedback`
- **Super admin:** `feature_availability_overrides`, `ops_reports` (has 2 legacy rows), `platform_super_admins`, `super_admin_audit_events` (1 row)
- **Parking operations:** `parking_booking_broadcasts`, `parking_payment_transactions`, `parking_blocked_dates`

### 3.3 Identity drift that causes the "which property is this?" confusion

| Surface                        | Org slug     | Property slug  | Parking slug               |
| ------------------------------ | ------------ | -------------- | -------------------------- |
| `scripts/dev/seed-local-org-bootstrap.sql` | `kame-homes` | `kame-home`    | —                          |
| `supabase/seed.sql` (active)              | `kame-homes` | 4 Azure units  | 4 Azure slots              |
| `scripts/dev/seed-dashboard-demo-data.sql` | `kame-homes` | `kame-home`    | —                          |
| `scripts/dev/seed-monaco-2612-*.sql`       | `kame-home`  | `monaco-2612`  | —                          |
| `scripts/dev/ai-qa-run.mjs`                | `kame-home`  | `monaco-2612`  | —                          |
| `scripts/dev/qa-phase4-*.mjs`              | `kame-home`  | `monaco-2612`  | —                          |
| `ui/e2e/features/parking/shared/parkingLiveLocalHarness.ts` | `kame-homes` | — | `monaco-level-2-slot-27` |
| `ui/e2e/shared/ids.ts` (mocked, not local DB) | `sample-stays-ph` | `solea-mactan` | —                    |

The `monaco-2612` and `kame-home`-as-org references are **already broken after a fresh reset**. Nothing currently creates them.

### 3.4 Seed wiring today

`supabase/config.toml` `[db.seed].sql_paths` loads, in order:

1. `scripts/dev/seed-local-org-bootstrap.sql` — owner + org + `kame-home`
2. `supabase/seed.sql` — 4 Azure properties + 4 parkings + 3 developments
3. `scripts/dev/seed-dashboard-demo-data.sql` — 69 bookings + finance + maintenance on `kame-home`

Everything else (`seed-analytics-demo-data`, `seed-marketing-guest-reviews`, `seed-host-announcements`, `seed-ai-qa`, `seed-agent-e2e`, `seed-monaco-2612-*`) is manual and most targets stale slugs.

## 4. Target canonical dataset

### 4.1 Fixed identities

| Entity                  | UUID                                     | Notes                                                        |
| ----------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| Organization            | `405ea07f-cc21-4bcc-b540-28729be79f0d`   | keep                                                         |
| Org owner (auth user)   | `d74b9d44-6244-40f0-9160-7c281738e8c0`   | `seed-owner@example.com` / `seed-password`                   |
| Development             | `a1111111-1111-4111-8111-111111111101`   | Azure North Residences                                       |
| Property                | `e5555555-5555-4555-8555-555555555501`   | `kame-home` — Monaco 2604                                    |
| Parking                 | `c3333333-3333-4333-8333-333333333301`   | `monaco-level-2-slot-27`                                     |
| Guest account           | `5eed0000-0000-4000-8000-000000000001`   | `guest.demo@example.com` / `seed-password`                   |
| Team: manager           | `5eed0000-0000-4000-8000-000000000002`   | `manager.demo@example.com` — property **Full Access**        |
| Team: operations        | `5eed0000-0000-4000-8000-000000000003`   | `operations.demo@example.com` — property **Operations**      |
| Team: read only         | `5eed0000-0000-4000-8000-000000000004`   | `viewer.demo@example.com` — property **Read Only**           |
| Team: parking staff     | `5eed0000-0000-4000-8000-000000000005`   | `parking.demo@example.com` — parking **STAFF**               |

All seeded collections use the `5eed…` UUID namespace so they can be purged surgically:

| Range            | Collection                                   |
| ---------------- | -------------------------------------------- |
| `5eed1000-…`     | property bookings                            |
| `5eed1100-…`     | parking bookings                             |
| `5eed2000-…`     | finance line items / refunds / transactions  |
| `5eed3000-…`     | maintenance items                            |
| `5eed4000-…`     | marketing content                            |
| `5eed5000-…`     | inbox threads, messages, channels            |
| `5eed6000-…`     | reviews, reports                             |
| `5eed7000-…`     | activity log                                 |
| `5eed8000-…`     | support tickets                              |
| `5eed9000-…`     | custom pages, notifications, imports, misc   |

Rows that already support tagging keep a tag too: `booking_source = 'local_seed'`, `created_by = 'local_seed'`. Seeded content also gets `metadata.local_seed = true` where a JSONB metadata column exists. The fixed UUID range is the authoritative marker; tags are for readability.

### 4.2 Business plan and entitlements

- One `org_subscriptions` row: plan `pro` (display name **Business**), `pricing_model = 'subscription'`, `status = 'active'`, `source = 'admin'`, period start `CURRENT_DATE`, end `+1 year`.
- One `org_subscription_properties` row linking the property.
- `org_subscription_events` row recording the admin grant.
- No `feature_overrides`.
- Tier testing: flip plan from `/admin/pricing/subscriptions` (or run `bun run seed:plan -- --plan=free|starter|growth|pro`). No second org needed.

### 4.3 Data volume targets

Volume is chosen to exercise pagination, empty states, and charts without becoming unwieldy.

| Area                | Target                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------- |
| Property bookings   | 60–70 across 12 months, every status, ≥1 per `find_us` channel, ≥3 pets, ≥2 parking requests   |
| Parking bookings    | 12–15, every parking status, ≥1 broadcast awaiting claim, ≥1 paid, ≥1 cancelled               |
| Finance             | 45+ line items across expense/income categories and 6 months; 3 pending, 2 overdue, 2 refunds |
| Maintenance         | 20 items across open / in progress / resolved, all priorities, 3 with photos                  |
| Pricing             | 12 date overrides (weekends + holidays), 6 blocked dates, 1 smart-pricing run + 3 recommendations |
| Marketing           | 3 themes, 6 templates, 12 media assets, 4 drafts, 2 scheduled, 3 published, 2 AI sessions      |
| Inbox               | 6 threads (Facebook, Instagram, web chat) with 30 messages, 2 unread, 1 handoff, 1 AI replied |
| Reviews             | 10 property guest reviews (4–5★, 2 with photos), 2 host reviews, 1 reported review             |
| Activity            | 40 entries spanning 30 days and every category                                                |
| Notifications       | 12 across booking / finance / maintenance / inbox, half read                                  |
| Support             | 4 tickets: open, awaiting host, resolved, reopened                                            |
| Analytics           | 90 days of `property_page_views`, 1 AI analytics review                                        |
| Guest portal        | 4 trips (past, current, upcoming, cancelled), 3 vouchers, 4 wishlist items, 2 requests         |
| Super admin         | 2 pending approvals, 3 ops reports, 20 audit events, 1 announcement per severity              |

## 5. Seed architecture

### 5.1 File layout

One folder, numbered, each file idempotent and safe to re-run:

```
scripts/dev/seed/
  00-reference-guards.sql       -- asserts plans/FAQs/playbook/knowledge base exist; no writes
  01-identity.sql               -- auth users, org, development, property, parking, memberships
  02-subscription.sql           -- pro plan, subscription, events
  03-settings.sql               -- org/property/parking settings JSONB + settings tables
  04-team.sql                   -- org/property/parking members, invitations, custom roles
  05-bookings-property.sql      -- property bookings (all statuses)
  06-bookings-parking.sql       -- parking bookings + broadcasts + payments
  07-finance.sql                -- line items, refunds, payment transactions
  08-maintenance.sql            -- maintenance items
  09-pricing.sql                -- overrides, blocked dates, smart pricing, calendar
  10-marketing.sql              -- themes, templates, media, publications, AI sessions
  11-reviews.sql                -- guest + host reviews, reports, automation rules
  12-inbox.sql                  -- channels, conversations, messages, metrics
  13-public-pages.sql           -- custom pages, page configs
  14-support.sql                -- tickets + messages
  15-notifications.sql          -- notifications, reads, preferences
  16-activity.sql               -- activity log
  17-analytics.sql              -- page views, analytics review, benchmark cache
  18-ai.sql                     -- org/property AI settings, wallet, usage, assistant threads
  19-super-admin.sql            -- approvals, ops reports, audit, feature availability, announcements
  20-guest-portal.sql           -- guest profile, saved properties, requests, chat
  21-refresh-public-cache.sql   -- rebuild public_listing_search / catalog version
  99-verify.sql                 -- invariants; raises on failure
```

`supabase/seed.sql` becomes a thin, commented include that points at `scripts/dev/seed/` (or is removed and `config.toml` lists the numbered files directly). `scripts/dev/seed-local-org-bootstrap.sql` and `seed-dashboard-demo-data.sql` are deleted after their content moves into 01/05/07/08.

### 5.2 Load order

`config.toml`:

```toml
[db.seed]
enabled = true
sql_paths = [
  "../scripts/dev/seed/00-reference-guards.sql",
  "../scripts/dev/seed/01-identity.sql",
  # … 02 … 21
  "../scripts/dev/seed/99-verify.sql",
]
```

Postgres runs these in one `db reset` transaction sequence. Every file starts with `BEGIN;` and ends with `COMMIT;` (or is written defensively with `ON CONFLICT`), so a failure leaves the previous state intact.

### 5.3 Idempotency and purge rules

- Single-row / singleton tables: `INSERT … ON CONFLICT (pk) DO UPDATE`, never `DELETE`.
- Collections: `DELETE FROM <table> WHERE id::text LIKE '5eed%'` then `INSERT`. This refreshes seed rows only.
- Never delete or truncate: `pricing_plans`, `help_center_faqs`, `host_playbook_articles`, `ai_dashboard_assistant_knowledge_base`, `ai_limit_profiles`, `ai_limit_assignments`, `social_reply_templates`, `app_settings`, `platform_*` singletons, migrations, storage buckets, or any row outside the `5eed…` / `local_seed` marker.
- Refuse destructive cleanup when non-seed rows exist on a seed target. Example: do not remove the four Azure properties if a non-`local_seed` booking points at them.
- Dates are relative: compute from `CURRENT_DATE` so the seed is always "today ± N days". Use `to_char(date, 'MM-DD-YYYY')` for text date columns and ISO for query columns.

### 5.4 Commands

| Command                        | Does                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `bun run db:reset`             | Drops and rebuilds local DB, then loads the canonical dataset. Primary path.          |
| `bun run seed:local`           | Applies `scripts/dev/seed/*.sql` to a running local DB. Idempotent.                   |
| `bun run seed:refresh`         | Purges `5eed…` rows, then reapplies. Keeps auth users and org.                        |
| `bun run seed:verify`          | Runs the invariant checker (§12) against the local DB.                                |
| `bun run seed:attach-admin`    | Attaches the local Google account to the org/property/parking as Admin (no PII in repo). |
| `bun run seed:plan -- --plan=` | Switches the org plan through the real admin path.                                    |
| `bun run seed:search-fixtures` | Optional Azure typeahead fixture (was `supabase/seed.sql`).                           |
| `bun run seed:integrations`    | Optional external-integration stubs (Telegram/Meta/Resend) — see §11.                 |
| `bun run seed:mock-listings`   | Existing 320-listing performance seed. Unchanged, never on reset.                     |

`seed:attach-admin` reads `ADMIN_ALLOWED_EMAILS` / `SUPER_ADMIN_EMAILS` from `supabase/.env.local`, matches `auth.users.email`, then inserts/updates org membership, property member (Full Access), parking member (MANAGER), and `platform_super_admins`. If no matching account exists it prints exactly what to do (sign in once through Google, then re-run).

`scripts/dev/seed/99-verify.sql` runs after every reset and fails loudly, so a broken seed is never silent.

## 6. Module coverage matrix

Every module below gets a scenario list. "Data" is the table(s) the page reads. Implementation phases reference these IDs.

### 6.1 Org level

Base path: `/org/kame-homes`

| ID  | Module        | Route                       | Data                                                                                     | Scenarios required                                                                                         |
| --- | ------------- | --------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| O1  | Dashboard     | `/dashboard`                | `guest_submissions`, `finance_line_items`, `maintenance_items`, `notifications`, `activity_log` | occupancy today, arrivals/departures, revenue MTD, open maintenance, recent activity, portfolio rollup        |
| O2  | Properties    | `/properties`               | `properties`, `property_page_views`                                                      | exactly one row, ACTIVE, cover image, unit details                                                          |
| O3  | Parkings      | `/parkings`                 | `parkings`, `parking_settings`                                                           | exactly one row, ACTIVE, rate, slot label                                                                   |
| O4  | Team          | `/team`                     | `organization_members`, `organization_invitations`, `organization_custom_roles`          | owner + 2 admins, 1 pending invite, 1 custom org role                                                       |
| O5  | Plans         | `/plans`                    | `org_subscriptions`, `pricing_plans`                                                     | Business active, usage counters, upgrade/downgrade dialog, plan comparison, no commission tier              |
| O6  | Analytics     | `/analytics`                | org rollup (bookings, page views), `platform_analytics_benchmark_cache`                   | 90-day trend, channel split, benchmark comparison, CSV export                                               |
| O7  | Activity      | `/activity`                 | `activity_log`                                                                           | 40 entries, 30 days, all categories, filters, export                                                        |
| O8  | Inbox         | `/inbox`                    | `social_conversations`, `social_messages`, `social_channel_connections`                  | shared org inbox view, unread badge, assignment                                                             |
| O9  | Reviews       | `/reviews`                  | `guest_reviews`, `host_guest_reviews`                                                    | org rollup, reply flow, reported review                                                                     |
| O10 | Settings      | `/settings`                 | `organizations.settings`, `org_settings`                                                 | brand color, logo, contact, payment methods, email automations, verification approved, Telegram settings     |
| O11 | Help & Support| `/help-support`             | `support_tickets`, `support_ticket_messages`, `help_center_faqs`, `host_playbook_articles` | 4 tickets in different states, FAQ search, playbook articles                                               |

### 6.2 Property level

Base path: `/org/kame-homes/property/kame-home`

| ID  | Module          | Route                      | Data                                                                                                                   | Scenarios required                                                                                                   |
| --- | --------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| P1  | Dashboard       | `/dashboard`               | bookings, finance, maintenance, activity                                                                                | today's arrivals/departures, occupancy, revenue, tasks, quick actions                                                 |
| P2  | Bookings        | `/bookings`                | `guest_submissions`                                                                                                     | every status, pending docs, pet docs, parking request, SD refund, cancelled, imported; filters + pagination           |
| P3  | Booking detail  | `/bookings/:id`            | `guest_submissions`, `booking_cancellation_requests`, `booking_refunds`, `booking_ai_reviews`, `activity_log`           | one detail per status, GAF/pet PDFs, receipts, refund request, AI review, timeline                                    |
| P4  | Finance         | `/finance`                 | `finance_line_items`, `booking_refunds`, `org_payment_transactions`                                                     | income/expense, pending, overdue, refunds, ledger + calendar view, PDF/CSV export                                     |
| P5  | Pricing         | `/pricing`                 | `property_pricing_date_overrides`, `property_blocked_dates`, `property_smart_pricing_*`                                 | weekday/weekend rate, holiday override, blocked dates, smart pricing recommendations, channel sync state               |
| P6  | Pricing calendar| `/pricing/calendar`        | same as P5 + bookings                                                                                                   | occupied / blocked / override days, month + range select                                                              |
| P7  | Analytics       | `/analytics`               | `property_page_views`, `property_analytics_reviews`, bookings, `guest_reviews`                                          | 90-day traffic, conversion, channels, origins, AI review tab, export                                                  |
| P8  | Maintenance     | `/maintenance`             | `maintenance_items`                                                                                                     | open / in progress / resolved, priorities, costs, photos                                                              |
| P9  | Marketing       | `/marketing`               | `marketing_themes`, `marketing_templates`, `marketing_media_assets`, `marketing_publications`, `marketing_ai_sessions` | themes, templates, media library, draft/scheduled/published, AI session history, review rail                          |
| P10 | Team            | `/team`                    | `property_members`, `property_invitations`, `property_custom_roles`                                                     | Full Access / Operations / Read Only members, pending invite, custom role, permission matrix                          |
| P11 | Inbox           | `/inbox`                   | `social_channel_connections`, `social_conversations`, `social_messages`, `inbox_thread_metrics`                         | Facebook + Instagram + web chat threads, unread, handoff, AI reply, quick replies                                     |
| P12 | Reviews         | `/reviews`                 | `guest_reviews`, `host_guest_reviews`, `review_reports`, `review_automation_rules`                                      | review list, reply, report, automation rule enabled                                                                   |
| P13 | Activity        | `/activity`                | `activity_log`                                                                                                          | property-scoped feed, filters                                                                                         |
| P14 | Announcements   | `/announcements`           | `developments.settings.announcements`, `platform_host_settings.announcements`                                           | one per severity, dismiss state                                                                                       |
| P15 | Notifications   | `/notifications`           | `notifications`, `notification_reads`, `notification_preferences`, `telegram_*`                                         | unread + read, activity / push / Telegram tabs, Telegram module status                                                |
| P16 | Templates       | `/templates`               | `property_template_folders`, `property_template_contents`                                                               | default templates + one custom folder + one custom template                                                           |
| P17 | Public Pages    | `/public-pages`            | `custom_pages`, `public_page_configs`                                                                                   | one published page, one draft, editor sections, stay-guide config                                                      |
| P18 | Settings        | `/settings`                | `properties.settings`, `property_settings_copy_log`, `telegram_*_settings`, `ai_platform_property_settings`, `property_cancellation_policy_versions` | every settings section filled: details, location, media, amenities, house rules, check-in, payment, cancellation, email, AI, Telegram, parking link |
| P19 | Plans           | `/plans`                   | org subscription + property entitlements                                                                                | Business features shown as included, usage pooled org-wide                                                            |
| P20 | Help & Support  | `/help-support`            | support tickets + FAQs                                                                                                  | tickets filtered to property                                                                                          |

### 6.3 Parking level

Base path: `/org/kame-homes/parking/monaco-level-2-slot-27`

| ID  | Module          | Route                      | Data                                                                                     | Scenarios required                                                                                   |
| --- | --------------- | -------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| K1  | Dashboard       | `/dashboard` (shell)       | parking bookings, finance, activity                                                       | today's arrivals, occupancy, revenue, broadcast state                                                 |
| K2  | Bookings        | `/bookings`                | `guest_submissions` where `parking_id` set, `parking_booking_broadcasts`, `parking_payment_transactions` | every parking status, broadcast pending claim, paid, cancelled                                        |
| K3  | Booking detail  | `/bookings/:id`            | same + `activity_log`                                                                     | claim/decline actions, payment state, vehicle + plate                                                  |
| K4  | Finance         | `/finance`                 | `parking_payment_transactions`, `finance_line_items`                                     | paid / pending / refunded                                                                             |
| K5  | Pricing         | `/pricing`                 | `parking_settings`, `parking_pricing_date_overrides`, `parking_blocked_dates`            | weekday/weekend nightly rate, date overrides, blocked dates                                           |
| K6  | Inbox           | `/inbox`                   | parking-scoped threads                                                                   | one thread, unread state                                                                              |
| K7  | Notifications   | `/notifications`           | `notifications`, `telegram_parking_settings`                                             | activity / push / Telegram tabs                                                                       |
| K8  | Settings        | `/settings`                | `parking_settings`, `parkings.settings`, `telegram_parking_settings`                     | details, location, media, rules, payment, slots, brand color, team links                              |
| K9  | Team            | `/team`                    | `parking_members`, `parking_invitations`, `parking_custom_roles`                         | MANAGER / STAFF / VIEWER members + pending invite                                                     |
| K10 | Activity        | `/activity`                | `activity_log`                                                                            | parking-scoped feed                                                                                    |
| K11 | Announcements   | `/announcements`           | development + platform announcements                                                      | severity variants                                                                                      |
| K12 | Help & Support  | `/help-support`            | tickets                                                                                   | parking-scoped ticket                                                                                  |

### 6.4 Public and guest surfaces

| ID  | Surface                | Route                                         | Data                                                              | Scenarios                                                          |
| --- | ---------------------- | --------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| G1  | Listing detail         | `/properties/kame-home`                       | `public_listing_search`, `properties`, `guest_reviews`            | gallery, amenities, map, reviews, price, availability              |
| G2  | Showcase               | `/properties/kame-home/showcase`              | property settings                                                 | gallery sections, host bio                                         |
| G3  | Stay guide             | `/properties/kame-home/stay-guide`            | property settings + development settings                          | check-in steps, Wi-Fi, house rules, contact                         |
| G4  | Guest form             | `/properties/kame-home/form`                  | `get-form`, availability                                          | prefilled dates, parking request, pets, validation                  |
| G5  | Calendar               | `/properties/kame-home/calendar`              | `get-booked-dates`, pricing overrides                             | booked / blocked / available dates                                  |
| G6  | Success                | `/properties/kame-home/success`               | guest booking token                                              | confirmation state                                                  |
| G7  | SD form                | `/properties/kame-home/sd-form`               | booking + SD fields                                              | upload, validation                                                  |
| G8  | Parking detail/form    | `/parkings/monaco-level-2-slot-27/*`          | `parkings`, `parking_settings`, availability                       | detail, category, list, form                                        |
| G9  | Search                 | `/search`, `/properties`, `/parkings`, `/developments` | `public_listing_search`                                   | one result per type (see §7 for typeahead limitation)               |
| G10 | Guest account          | `/account`                                    | `guest_profiles`, `guest-trips`, `list-guest-vouchers`            | profile, trips, vouchers wallet                                     |
| G11 | Trips / stay           | `/account/trips`, `/trip?token=`              | `guest_submissions`, `get-guest-trip`                             | past, current, upcoming, cancelled                                  |
| G12 | Wishlist / requests    | `/account/wishlist`, `/account/tickets`       | `guest_saved_properties`, `guest_requests`, `support_tickets`     | saved property, open request, ticket thread                         |
| G13 | Guest messages         | `/account/messages`                           | `social_conversations`, `social_messages`                         | one thread with unread message                                      |
| G14 | Guest reviews          | `/account/reviews`, `/guest-review`           | `guest_reviews`, `submit-guest-review`                            | pending review, submitted review                                    |

### 6.5 Super admin

Base path: `/admin`

| ID  | Module                 | Route                                | Data                                                                                       | Scenarios required                                                                                     |
| --- | ---------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| A1  | Overview               | `/admin`                             | aggregates across orgs, bookings, revenue, AI usage                                          | one org, one property, meaningful totals                                                               |
| A2  | Properties             | `/admin/properties`                  | `properties`, settings                                                                      | one row, filters, detail drawer                                                                        |
| A3  | Hosts                  | `/admin/hosts`, `/admin/hosts/:id`   | `organizations`, `guest_submissions`, subscription                                          | one host, plan, verification, bookings                                                                 |
| A4  | Organizations          | `/admin/orgs`, `/admin/orgs/:slug`   | `organizations`, members, subscription                                                      | one org, member list, danger zone                                                                      |
| A5  | Developments           | `/admin/developments`                | `developments`, settings announcements                                                      | one development, edit, announcements                                                                   |
| A6  | Approvals              | `/admin/approvals`                   | org verification pending, listing authorization/recommended pending                        | 1 pending org verification + 1 pending listing authorization + 1 pending recommendation                 |
| A7  | Pricing plans          | `/admin/pricing/plans`               | `pricing_plans`                                                                             | 7 plans (already migrated), edit feature matrix                                                        |
| A8  | Subscriptions          | `/admin/pricing/subscriptions`       | `org_subscriptions`, `org_subscription_events`                                              | active Business subscription, change-plan action                                                       |
| A9  | Payment settings       | `/admin/pricing/payment-settings`    | `platform_payment_settings`                                                                 | all methods configured                                                                                 |
| A10 | Parking payouts        | `/admin/parking/payouts`             | `parking_payment_transactions`                                                              | one platform fee + one host payout row                                                                 |
| A11 | Feature availability   | `/admin/feature-availability`        | `feature_availability_overrides`                                                            | **all features enabled** by default; optional demo overrides script                                    |
| A12 | Announcements          | `/admin/announcements`               | `platform_host_settings.announcements`                                                      | one per severity, archive                                                                              |
| A13 | AI management          | `/admin/ai`, `/admin/ai-usage`       | `ai_platform_*`, `ai_limit_profiles`, usage                                                 | global settings, org settings, wallet, 30 days usage                                                   |
| A14 | Rate limits            | `/admin/rate-limits`                 | `ai_limit_profiles`, `ai_limit_assignments`                                                 | profiles assigned                                                                                      |
| A15 | Health                 | `/admin/health`, `/admin/health/:s`  | `system_health_probe_results`, `system_job_heartbeats`                                      | at least one heartbeat per cron                                                                        |
| A16 | Ops reports            | `/admin/ops-reports`                 | `ops_reports`                                                                               | 3 reports, 2 downloaded                                                                                |
| A17 | Audit                  | `/admin/audit`                       | `super_admin_audit_events`                                                                  | 20 events, filters                                                                                     |
| A18 | Platform settings      | `/admin/platform-settings`           | `platform_settings`, `platform_host_settings`                                               | brand, support, feature defaults                                                                       |
| A19 | Support                | `/admin/support`                     | `support_tickets`, `support_ticket_messages`                                                | tickets in all states                                                                                  |
| A20 | Support FAQs           | `/admin/support/faqs`                | `help_center_faqs`                                                                          | already 109; keep, verify rendering                                                                    |
| A21 | Playbook               | `/admin/playbook`                    | `host_playbook_articles`                                                                    | already 17; keep                                                                                       |

## 7. Search typeahead limitation

With one property and one parking, `public_listing_search` cannot return the 4+ results needed for the **See all** preview. `seed-search-fixtures.sql` moves to `bun run seed:search-fixtures` (opt-in) and keeps the Azure entries. It must be documented as a deliberate temporary deviation:

- Default state: 1 property, 1 parking, 1 development.
- Opt-in state after running the command: 5 properties, 5 parkings, 4 developments.
- `bun run seed:refresh` removes only `5eed…` rows; the search fixtures use their own fixed UUIDs (`b2…` / `c3…` / `a1…`) and are removed only by `bun run seed:search-fixtures -- --remove`.

## 8. Plans and tier testing

- Default org is on **Business (`pro`)**, so every module is available out of the box.
- `/admin/pricing/subscriptions` changes the plan without touching seed files.
- `bun run seed:plan -- --plan=free|starter|growth|pro` is a thin wrapper that calls the real admin edge path/cron-compatible SQL, not a raw row update, so `org_subscription_events` stays honest.
- Gate coverage stays in `bun run test:e2e:plans` (mocked). Local manual checks use the same org and flip plans.
- Feature availability stays fully enabled. A separate optional seed (`bun run seed:feature-flags`) inserts demo overrides for testing the super-admin toggle UI, then removes them on `--remove`.

## 9. E2E and QA script alignment

There are three distinct identities. Document them once, in `docs/guides/testing/local-seed-data.md` and `ui/e2e/shared/ids.ts`:

| Purpose                        | Org            | Property        | Source                                |
| ------------------------------ | -------------- | --------------- | ------------------------------------- |
| Local Supabase seed            | `kame-homes`   | `kame-home`     | `scripts/dev/seed/`                   |
| Playwright mocked harness      | `sample-stays-ph` | `solea-mactan` | `ui/e2e/shared/ids.ts` (do not change) |
| Public marketing showcase mock | `mockProperties.ts` | 81 static slugs | static frontend data (do not change) |

Changes required:

- `scripts/dev/ai-qa-run.mjs`: `AI_QA_ORG` default `kame-home` → `kame-homes`; `AI_QA_PROPERTY` default `monaco-2612` → `kame-home`.
- `scripts/dev/qa-phase4-auth-inject.mjs`, `qa-phase4-api-verify.mjs`, `qa-phase4-telegram-meta.mjs`: replace `/org/kame-home/property/monaco-2612` with `/org/kame-homes/property/kame-home`.
- `scripts/dev/seed-monaco-2612-*.sql`: delete (content merges into canonical seed) or retarget and keep only as an optional showcase.
- `scripts/dev/seed-analytics-demo-data.sql`, `seed-marketing-guest-reviews.sql`: fold into canonical seed; keep thin wrappers only if referenced by docs.
- `scripts/dev/seed-ai-qa.sql`: retarget to canonical ids, tag `local_seed_ai_qa`, keep manual.
- `ui/e2e/features/assistant/shared/assistantLiveLocalHarness.ts` already uses `kame-home`; verify org slug.
- `ui/e2e/features/parking/shared/parkingLiveLocalHarness.ts` already uses `kame-homes` / `monaco-level-2-slot-27`; verify.
- Add `bun run check:seed-identity` (fast grep) to `ci:quality`: fails on `monaco-2612`, `org/kame-home/`, or `seed:monaco` references outside archived docs.

## 10. Super admin "enable everything" stance

Only DB-backed state can be truly enabled locally. Anything that needs an external credential stays **configured but inactive**, with a documented activation step. Be explicit in the guide so nobody thinks Telegram or Meta is broken.

| Area                    | Local default                                                              | Needs                      |
| ----------------------- | -------------------------------------------------------------------------- | -------------------------- |
| Plans / subscriptions   | Active, fully editable                                                     | none                       |
| Feature availability    | all enabled (no overrides)                                                 | none                       |
| AI settings / wallet    | rows seeded, credits granted                                               | `GEMINI_API_KEY`           |
| Dashboard assistant     | org + property settings enabled, 2 historical threads                      | `GEMINI_API_KEY`           |
| Voice receptionist      | settings seeded, disabled                                                  | `GEMINI_API_KEY` + voice   |
| Marketing Studio        | themes/templates/media seeded; publish disabled                            | `META_*` app credentials   |
| Meta inbox              | channels seeded as `disconnected`; threads visible                         | `META_*` credentials       |
| Telegram                | settings rows seeded with placeholder chat id, `enabled = false`           | `TELEGRAM_*` bot token     |
| Resend email            | `RESEND_API_KEY` present in `supabase/.env.local`; templates seeded         | verified from address      |
| PayMongo                | `platform_payment_settings` configured, test keys only if present          | `PAYMONGO_*`               |
| Calendar sync           | `calendar_sync_events` + feeds seeded, sync disabled                       | external calendar          |

`bun run seed:integrations` is the optional script that flips these to active when the corresponding env var exists; it prints exactly which keys are missing.

## 11. Verification

### 11.1 Invariant checker (`bun run seed:verify`)

Fails if any of these is false:

1. Exactly 1 org, exactly 1 ACTIVE property, exactly 1 ACTIVE parking, exactly 1 development.
2. Org slug `kame-homes`; property slug `kame-home`; parking slug `monaco-level-2-slot-27`.
3. Org subscription is `pro` / `active`.
4. Every `guest_submissions` status in the canonical enum has ≥1 row, on both property and parking where applicable.
5. Every module table in §6 is non-empty (table allowlist).
6. `public_listing_search` has one row per ACTIVE place, and the property/parking are present.
7. No row with `5eed…` id references a missing FK parent.
8. Reference data intact: `pricing_plans` 7 rows, `help_center_faqs` ≥100, `host_playbook_articles` ≥17, `ai_dashboard_assistant_knowledge_base` ≥500, `ai_limit_profiles` ≥8.
9. No duplicate org owner, no orphan parking members.

Exit code 1 and a printed checklist on failure. Run automatically at the end of `db reset` and in `bun run ci:quality`.

### 11.2 Manual smoke after reset

- Sign in as `seed-owner@example.com` (or run `seed:attach-admin` and use Google).
- Open one page per module in §6 at 375px and 1280px.
- Confirm no empty-state where the matrix says data must exist.
- Confirm no page silently 500s from a bad FK or missing settings key.

### 11.3 Preservation check

- `bun run seed:local` twice → same row counts, no duplicates.
- `bun run seed:refresh` → row counts unchanged, `created_at` refreshed only for seeded rows.
- `bun run sync:prod-data` (read-only pull) → runs after seed without FK errors; seeded rows do not collide with prod UUIDs.

## 12. Task breakdown

Each phase is independently reviewable. Do not start a later phase until the earlier phase's acceptance line is true.

### P0 — Plan and inventory (this doc)

- [ ] Plan reviewed and approved.
- [ ] Lock canonical IDs and the module matrix.
- [ ] Add row to `docs/workflow/planned/README.md`.

### P1 — Seed skeleton and guardrails

- [ ] Create `scripts/dev/seed/` with `00-reference-guards.sql` and `99-verify.sql` (stub checks first).
- [ ] Move `seed-local-org-bootstrap.sql` content into `01-identity.sql`; delete the old file.
- [ ] Move `seed-dashboard-demo-data.sql` content into 05/07/08; delete the old file.
- [ ] Update `supabase/config.toml` `[db.seed].sql_paths`.
- [ ] Add `seed:local`, `seed:refresh`, `seed:verify` scripts to `package.json`.
- [ ] Acceptance: `bun run db:reset` creates 1 org / 1 property / 1 parking and 0 extra properties.
- [ ] Add `check:seed-identity` to `ci:quality`.

### P2 — Identity, subscription, settings

- [ ] Single owner auth user; remove the duplicate bootstrap owner.
- [ ] Property (`kame-home`, Monaco 2604) + parking (`monaco-level-2-slot-27`) + development (Azure North Residences) with full settings JSONB.
- [ ] Business subscription + event + property link.
- [ ] Org/property/parking settings tables: branding, contact, payment methods, email automations, cancellation policy version, Telegram placeholders, AI settings.
- [ ] `seed:attach-admin` script.
- [ ] Acceptance: org settings, property settings, parking settings, and Plans render with no empty sections at Business tier.

### P3 — Team and RBAC

- [ ] Org owner + 1 org admin + 1 pending invite + 1 custom org role.
- [ ] Property members for Full Access / Operations / Read Only + pending invite + custom role.
- [ ] Parking members MANAGER / STAFF / VIEWER + pending invite.
- [ ] Acceptance: `/org/.../team`, `/property/.../team`, `/parking/.../team` show members, invites, custom roles, and the permission matrix behaves per template.

### P4 — Bookings (property + parking)

- [ ] 60–70 property bookings, relative dates, all statuses, all channels, pet/GAF/SD/parking-request variants.
- [ ] 12–15 parking bookings, all parking statuses, broadcast, payment rows.
- [ ] Cancellation requests, refunds, AI review rows for the detail page.
- [ ] Acceptance: bookings list filters, pagination, every status tab, and one detail page per status render correctly.

### P5 — Finance and maintenance

- [ ] 45+ finance line items (6 months, categories, pending/overdue/refund).
- [ ] 20 maintenance items (statuses, priorities, photos, costs).
- [ ] Acceptance: `/finance` totals, ledger, calendar view, exports; `/maintenance` filters and detail.

### P6 — Pricing and calendar

- [ ] 12 date overrides, 6 blocked dates, smart pricing settings + run + 3 recommendations, calendar feeds + sync events.
- [ ] Parking rates, overrides, blocked dates.
- [ ] Acceptance: property and parking pricing pages + calendars show occupied/blocked/override states.

### P7 — Analytics

- [ ] 90 days of page views, channel/origin distribution, AI review row, benchmark cache.
- [ ] Acceptance: org + property analytics tabs, charts, AI review, exports.

### P8 — Marketing

- [ ] 3 themes, 6 templates, 12 media assets (Storage URLs or Unsplash), 4 drafts, 2 scheduled, 3 published, 2 AI sessions.
- [ ] Acceptance: Marketing Studio opens with content in every tab; Reviews rail picks up seeded reviews.

### P9 — Inbox

- [ ] 3 channel connections (Facebook, Instagram, web chat), 6 threads, 30 messages, 2 unread, 1 handoff, 1 AI reply, thread metrics.
- [ ] Acceptance: property + parking + org inbox lists, filters, unread badges, quick replies.

### P10 — Reviews, public pages, support, notifications, activity

- [ ] 10 guest reviews + 2 host reviews + 1 report + automation rule.
- [ ] 1 published + 1 draft custom page with page config.
- [ ] 4 support tickets across states + messages.
- [ ] 12 notifications + reads + preferences; Telegram settings.
- [ ] 40 activity log rows across categories and 30 days.
- [ ] Acceptance: every listed page renders real rows and the empty states are reachable only by filtering.

### P11 — Guest portal and public surfaces

- [ ] Guest auth user + `guest_profiles`.
- [ ] 4 trips linked by email (past, current, upcoming, cancelled), 3 vouchers, 4 saved properties, 2 requests, 1 guest message thread, 1 pending review.
- [ ] Listing detail, showcase, stay guide, form, calendar, success, SD form, parking form data.
- [ ] Acceptance: guest can sign in and use every `/account/*` page; all public pages render.

### P12 — Super admin

- [ ] Pending org verification + listing authorization + recommendation.
- [ ] 3 ops reports, 20 audit events, 1 platform announcement per severity.
- [ ] AI settings + wallet + 30 days usage; rate limit profiles assigned.
- [ ] Health heartbeats for every cron.
- [ ] Acceptance: every `/admin/*` route in §6.5 renders with data.

### P13 — Align scripts, tests, docs

- [ ] Update `ai-qa-run.mjs`, `qa-phase4-*.mjs`, live harnesses.
- [ ] Retire/retarget `seed-monaco-2612-*`, `seed-analytics-demo-data`, `seed-marketing-guest-reviews`, `seed-host-announcements`, `seed-ai-qa`.
- [ ] Move search fixtures behind `seed:search-fixtures`.
- [ ] Update docs and runbook (see §13).
- [ ] Acceptance: `bun run ci:quality` passes; `check:seed-identity` passes; a fresh clone + `./dev.sh` + `db:reset` lands on the canonical dataset with no manual steps.

### P14 — Optional integration activations

- [ ] `seed:integrations` flips Telegram / Meta / AI / payments when keys exist.
- [ ] `seed:feature-flags` demo overrides.
- [ ] `seed:plan` wrapper.
- [ ] Acceptance: scripts are idempotent, refuse cleanly when keys are missing, and never touch non-seed rows.

## 13. Docs and tooling to update

| Doc / file                                         | Change                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `docs/guides/testing/local-seed-data.md`           | **New.** Canonical identities, commands, module matrix, what is intentionally not enabled. |
| `docs/guides/testing/README.md`                    | Link the new local dataset guide.                                                          |
| `scripts/README.md`                                | Replace the seed table: canonical seed + optional seeds; mark retired scripts.             |
| `supabase/config.toml`                             | New `[db.seed]` order.                                                                     |
| `package.json`                                     | `seed:*`, `check:seed-identity` scripts; remove stale `seed:monaco-2612*`.                  |
| `docs/PROJECT.md`                                  | Local dev / seed section points at the new guide.                                          |
| `docs/architecture/overview.md`                    | One line on canonical local dataset if it lists dev fixtures.                              |
| `.cursor/rules/project-context.mdc` / `AGENTS.md`  | Add canonical local ids to "Local dev gotchas" so agents stop inventing slugs.              |
| `docs/guides/routes/README.md`                     | No route change; only if a route guide’s Testing row changes.                              |
| `docs/workflow/planned/README.md`                  | Row for this plan.                                                                         |

Docs rules that apply during implementation: `documentation-maintenance`, `route-guides` (if any page behavior changes — it should not), `testing`, `audit-logging` (seed inserts are not app mutations; mark `activity-log: N/A — local fixture data`, but seeded `activity_log` rows are fixtures, not events), `plans-and-permissions` (no new feature, mark N/A).

## 14. Risks and mitigations

| Risk                                                                 | Mitigation                                                                                   |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `db reset` wipes a dev's existing local data                          | Document it; keep `seed:attach-admin`; provide `seed:local` for additive use without reset.    |
| Seeded rows collide with prod-synced rows                             | `5eed…` UUID namespace; verify no collisions; purge only by marker.                           |
| Relative dates break assertions in existing seeded tests              | Existing tests use mocked fixtures, not local DB. `test:auth-parity-seed` uses hosted dev.    |
| Removing the Azure properties breaks the typeahead manual test        | Opt-in `seed:search-fixtures`; documented.                                                    |
| External integrations look "broken" because keys are absent           | Explicit `configured but inactive` stance + print missing keys.                               |
| Seed files grow into an unmaintainable monolith                       | One file per domain, `99-verify` gates the contract, `scripts/README.md` lists owners.        |
| Plan flip bypasses event logging                                       | `seed:plan` uses the real admin path, not raw SQL.                                            |
| PII in committed seed                                                 | Only `@example.com` addresses; `seed:attach-admin` reads the real email from env at runtime.   |

## 15. Definition of done

- `bun run db:reset` on a clean clone produces exactly one org, one property, one parking, one development, and a non-empty row in every module table in §6.
- `bun run seed:verify` passes and is wired into `ci:quality`.
- Every module page in §6 opens with realistic data at 375px and 1280px.
- Every booking status and every parking status exists and is actionable.
- Super admin has pending approvals, reports, audit, AI usage, health, and announcements.
- Guest portal works end to end for the seeded guest identity.
- No stale `monaco-2612` / `org/kame-home` references remain outside archived docs (`bun run check:seed-identity`).
- `docs/guides/testing/local-seed-data.md` exists and `scripts/README.md` matches the real commands.
- Work is on a `develop` PR, CI green, branch deleted after merge (`branch-lifecycle`).

## 16. Open questions

1. Should `seed:attach-admin` run automatically from `./dev.sh` when `ADMIN_ALLOWED_EMAILS` contains an account that already exists? (Recommendation: prompt once, then remember.)
2. Do you want the seeded owner to be `seed-owner@example.com` (email/password) or should the only human identity be your Google account attached as Admin? (Recommendation: keep both.)
3. Should marketing media use remote Unsplash URLs (fast, no Storage writes) or upload real files into the local `marketing` Storage bucket (more realistic, slower reset)? (Recommendation: Unsplash for images, one real file per media type to exercise uploads.)
4. Should the 320-listing performance seed stay fully separate, or should `seed:mock-listings` gain a `--within-canonical-org` mode? (Recommendation: stay separate.)
