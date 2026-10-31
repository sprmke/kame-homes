-- Doc 14 (Index the database), Phase 14.3 static analysis: foreign-key index audit +
-- access-pattern cross-check. See docs/workflow/planned/production-readiness-checklist/
-- 14-index-the-database.md "Implementation status" for the full audit table.
--
-- Scope: every FK column on a table that grows with tenant *activity* (not tenant
-- *count* — see doc 10's same distinction) that lacked a supporting index (as sole or
-- composite-leading column) in a grep-driven audit of all prior migrations. FK gaps on
-- static/config/settings/team-membership tables (bounded by org/property/parking count,
-- not activity) are documented in the doc's audit table but intentionally NOT indexed
-- here, per Phase 14.4's write-cost tradeoff — an index earns its place only on a table
-- that actually grows.
--
-- CONCURRENTLY caveat (Phase 14.5): this repo has no existing precedent for running
-- `CREATE INDEX CONCURRENTLY` from a Supabase-CLI-applied migration (grepped for
-- CONCURRENTLY and transaction-control overrides across all prior migrations — none
-- found), and `CONCURRENTLY` cannot run inside a transaction block, which is how the
-- Supabase CLI applies each migration file. Since local/dev tables here are still small,
-- these use plain `CREATE INDEX IF NOT EXISTS` for a safe automated deploy. Before
-- running this migration against hosted prod once traffic/data volume is non-trivial,
-- re-run each `CREATE INDEX` statement below manually with `CONCURRENTLY` against
-- hosted dev/prod during a low-traffic window instead of relying on this file's plain
-- form for that deploy — see docs/archive/operations/migration-runbook.md "Index
-- deployment procedure" for the exact steps.

-- ── guest_submissions (bookings) ────────────────────────────────────────────────────
-- parking_pinned_id: parking-broadcast "pinned to a specific parking" lookup
-- (parking_booking_broadcasts flow) joins/filters guest_submissions by this FK.
CREATE INDEX IF NOT EXISTS idx_guest_submissions_parking_pinned_id
  ON public.guest_submissions (parking_pinned_id)
  WHERE parking_pinned_id IS NOT NULL;

-- parking_request_organization_id: parking booking-broadcast fan-out scopes candidate
-- parkings/orgs by this column (see _shared org broadcast lookups in
-- 20261017120000_parking_booking_broadcast.sql's own query surface).
CREATE INDEX IF NOT EXISTS idx_guest_submissions_parking_request_org_id
  ON public.guest_submissions (parking_request_organization_id)
  WHERE parking_request_organization_id IS NOT NULL;

-- guest_auth_user_id: authenticated guest portal ("my trips") looks up a guest's own
-- bookings by their auth user id — distinct from guest_user_id (already indexed).
CREATE INDEX IF NOT EXISTS idx_guest_submissions_guest_auth_user_id
  ON public.guest_submissions (guest_auth_user_id)
  WHERE guest_auth_user_id IS NOT NULL;

-- ── finance_line_items ──────────────────────────────────────────────────────────────
-- finance_telegram_reminder_log.line_item_id: telegramFinance.ts queries
-- `.in('line_item_id', lineItemIds)` on every reminder-cron sweep to skip already-sent
-- reminders; this table grows with every finance reminder sent.
CREATE INDEX IF NOT EXISTS idx_finance_telegram_reminder_log_line_item_id
  ON public.finance_telegram_reminder_log (line_item_id);

-- ── notifications / notification_reads ──────────────────────────────────────────────
-- notifications.booking_id / conversation_id: CASCADE-delete FKs with no supporting
-- index — a booking or conversation delete/cascade currently forces a full-table scan
-- of notifications to find dependent rows. notifications already has org/property/
-- parking composite indexes (20261015120000_notifications.sql); these two were the
-- remaining unindexed FK columns on a table that grows with every workflow event.
CREATE INDEX IF NOT EXISTS idx_notifications_booking_id
  ON public.notifications (booking_id)
  WHERE booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_conversation_id
  ON public.notifications (conversation_id)
  WHERE conversation_id IS NOT NULL;

-- notification_reads.notification_id: notifications-list left-joins
-- `notification_reads!left(id)` per notification to compute unread state; the existing
-- idx_notification_reads_user_notification (user_id, notification_id) already covers
-- lookups led by user_id, but the FK's own referencing column (for CASCADE deletes when
-- a notification is removed) has no leading-column index.
CREATE INDEX IF NOT EXISTS idx_notification_reads_notification_id
  ON public.notification_reads (notification_id);

-- ── social inbox (messages/threads) ─────────────────────────────────────────────────
-- social_messages.organization_id: org-wide inbox surfaces (inbox summary, cross-
-- conversation admin queries) scope by organization_id directly, not only via
-- conversation_id (already indexed via idx_social_messages_conversation_sent).
CREATE INDEX IF NOT EXISTS idx_social_messages_organization_id
  ON public.social_messages (organization_id, sent_at DESC);

-- social_conversations.connection_id: per-channel-connection conversation lookups
-- (token refresh/disconnect flows resolving all conversations for a given Meta
-- connection) scan social_conversations by this FK.
CREATE INDEX IF NOT EXISTS idx_social_conversations_connection_id
  ON public.social_conversations (connection_id);

-- inbox_thread_metrics.conversation_id / organization_id: per-thread response-time
-- rollups, written on every inbound/outbound message and read by inbox analytics.
CREATE INDEX IF NOT EXISTS idx_inbox_thread_metrics_conversation_id
  ON public.inbox_thread_metrics (conversation_id);

CREATE INDEX IF NOT EXISTS idx_inbox_thread_metrics_organization_id
  ON public.inbox_thread_metrics (organization_id);

-- ── support tickets ──────────────────────────────────────────────────────────────────
-- support_tickets: list-support-tickets-admin / list-support-tickets scope by org,
-- property, and parking independently (see list-support-tickets-admin/index.ts).
CREATE INDEX IF NOT EXISTS idx_support_tickets_property_id
  ON public.support_tickets (property_id)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_parking_id
  ON public.support_tickets (parking_id)
  WHERE parking_id IS NOT NULL;

-- support_ticket_messages.ticket_id: get-support-ticket(-admin) and reply-support-
-- ticket(-admin) all fetch a ticket's message thread by ticket_id, ordered by time —
-- grows with every reply on every ticket.
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_id
  ON public.support_ticket_messages (ticket_id, created_at ASC);

-- ── AI usage / AI dashboard assistant (usage-metered, grows continuously) ──────────
-- ai_platform_usage_events.property_id: property-scoped AI usage rollups/detail views;
-- organization_id already has composite coverage (idx_ai_platform_usage_events_org_*).
CREATE INDEX IF NOT EXISTS idx_ai_platform_usage_events_property_id
  ON public.ai_platform_usage_events (property_id)
  WHERE property_id IS NOT NULL;

-- ai_platform_org_credit_ledger.related_usage_event_id: ledger entries reference the
-- usage event that generated them; a usage-event delete/lookup joins back via this FK.
CREATE INDEX IF NOT EXISTS idx_ai_platform_org_credit_ledger_related_usage_event_id
  ON public.ai_platform_org_credit_ledger (related_usage_event_id)
  WHERE related_usage_event_id IS NOT NULL;

-- ai_dashboard_assistant_conversations: per-property, per-user assistant threads —
-- grows with every dashboard-assistant conversation. organization_id/user_id combo is
-- already covered by idx_ai_dashboard_assistant_conversations_org_user_last_message;
-- property_id is not a leading column anywhere.
CREATE INDEX IF NOT EXISTS idx_ai_dashboard_assistant_conversations_property_id
  ON public.ai_dashboard_assistant_conversations (property_id)
  WHERE property_id IS NOT NULL;

-- ai_dashboard_assistant_messages.conversation_id: already covered by
-- idx_ai_dashboard_assistant_messages_conversation_created (conversation_id, created_at)
-- from 20261018120000_ai_dashboard_assistant.sql — not duplicated here.

-- ai_dashboard_assistant_pending_actions.conversation_id / message_id: user_id is
-- already the leading column of idx_ai_dashboard_assistant_pending_actions_user_status;
-- these two FKs back the "which conversation/message triggered this pending action"
-- lookup and have no covering index.
CREATE INDEX IF NOT EXISTS idx_ai_dashboard_assistant_pending_actions_conversation_id
  ON public.ai_dashboard_assistant_pending_actions (conversation_id);

CREATE INDEX IF NOT EXISTS idx_ai_dashboard_assistant_pending_actions_message_id
  ON public.ai_dashboard_assistant_pending_actions (message_id);

-- ai_dashboard_assistant_action_audit: booking_id/organization_id are already covered
-- by idx_ai_dashboard_assistant_action_audit_org_created and _booking_created. The
-- remaining four FKs (conversation_id, message_id, property_id, user_id) are not a
-- leading column anywhere — this table logs every executed/declined assistant action
-- and grows continuously.
CREATE INDEX IF NOT EXISTS idx_ai_dashboard_assistant_action_audit_conversation_id
  ON public.ai_dashboard_assistant_action_audit (conversation_id);

CREATE INDEX IF NOT EXISTS idx_ai_dashboard_assistant_action_audit_message_id
  ON public.ai_dashboard_assistant_action_audit (message_id);

CREATE INDEX IF NOT EXISTS idx_ai_dashboard_assistant_action_audit_property_id
  ON public.ai_dashboard_assistant_action_audit (property_id)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_dashboard_assistant_action_audit_user_id
  ON public.ai_dashboard_assistant_action_audit (user_id);

-- ai_dashboard_assistant_usage_daily.organization_id: daily usage counters read/upserted
-- per org on every assistant call.
CREATE INDEX IF NOT EXISTS idx_ai_dashboard_assistant_usage_daily_organization_id
  ON public.ai_dashboard_assistant_usage_daily (organization_id);

-- ── payment transactions (grow with every billing event) ───────────────────────────
-- org_payment_transactions: org-plan / org-subscriptions-admin / reconcile flows all
-- look up transactions by subscription and by plan. organization_id is already the
-- leading column of idx_org_payment_transactions_org.
CREATE INDEX IF NOT EXISTS idx_org_payment_transactions_org_subscription_id
  ON public.org_payment_transactions (org_subscription_id)
  WHERE org_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_payment_transactions_plan_id
  ON public.org_payment_transactions (plan_id);

-- parking_payment_transactions: parking-payouts and super-admin-overview scope by
-- organization_id and parking_id independently. booking_id is already covered by
-- idx_parking_payment_transactions_booking.
CREATE INDEX IF NOT EXISTS idx_parking_payment_transactions_organization_id
  ON public.parking_payment_transactions (organization_id);

CREATE INDEX IF NOT EXISTS idx_parking_payment_transactions_parking_id
  ON public.parking_payment_transactions (parking_id);

-- org_subscription_events: portfolio-bundling audit trail — grows with every plan
-- change/property assignment; filtered by property_id and joined against both plan FKs.
-- org_subscription_id is already covered by idx_org_subscription_events_subscription.
CREATE INDEX IF NOT EXISTS idx_org_subscription_events_property_id
  ON public.org_subscription_events (property_id)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_subscription_events_new_plan_id
  ON public.org_subscription_events (new_plan_id)
  WHERE new_plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_subscription_events_previous_plan_id
  ON public.org_subscription_events (previous_plan_id)
  WHERE previous_plan_id IS NOT NULL;

-- ── import batches (grow with every CSV import) ─────────────────────────────────────
-- import_batches.property_id: import history per property.
CREATE INDEX IF NOT EXISTS idx_import_batches_property_id
  ON public.import_batches (property_id);

-- import_batch_rows.resolved_property_id: per-row resolved property, used when an
-- import batch spans multiple properties (org-level import).
CREATE INDEX IF NOT EXISTS idx_import_batch_rows_resolved_property_id
  ON public.import_batch_rows (resolved_property_id)
  WHERE resolved_property_id IS NOT NULL;

-- ── marketing generation (grows with every AI marketing job) ───────────────────────
-- marketing_generation_references.organization_id: org-scoped reference-asset lookups
-- (upload-marketing-generation-reference / generate-marketing-media), independent of
-- the already-indexed property_id.
CREATE INDEX IF NOT EXISTS idx_marketing_generation_references_organization_id
  ON public.marketing_generation_references (organization_id);

-- ── calendar sync events (append-only audit trail, grows with every sync tick) ─────
CREATE INDEX IF NOT EXISTS idx_calendar_sync_events_booking_id
  ON public.calendar_sync_events (booking_id)
  WHERE booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_sync_events_blocked_date_id
  ON public.calendar_sync_events (blocked_date_id)
  WHERE blocked_date_id IS NOT NULL;

-- ── property analytics / smart pricing (grow with every scheduled run) ─────────────
-- property_analytics_reviews.organization_id: cross-property org rollup views, in
-- addition to the already-indexed property_id.
CREATE INDEX IF NOT EXISTS idx_property_analytics_reviews_organization_id
  ON public.property_analytics_reviews (organization_id);

-- property_smart_pricing_recommendations.run_id: recommendations are read/grouped by
-- the run that produced them; grows with every scheduled pricing run.
CREATE INDEX IF NOT EXISTS idx_property_smart_pricing_recommendations_run_id
  ON public.property_smart_pricing_recommendations (run_id)
  WHERE run_id IS NOT NULL;

-- ── guest reviews / guest accounts (grow with every completed stay) ────────────────
CREATE INDEX IF NOT EXISTS idx_guest_reviews_booking_id
  ON public.guest_reviews (booking_id);

-- guest_saved_properties.user_id: authenticated guest's saved-listing wishlist.
CREATE INDEX IF NOT EXISTS idx_guest_saved_properties_user_id
  ON public.guest_saved_properties (user_id);

-- ── telegram notification logs (append-only, grow with every alert sent) ───────────
CREATE INDEX IF NOT EXISTS idx_telegram_admin_notification_log_booking_id
  ON public.telegram_admin_notification_log (booking_id);

CREATE INDEX IF NOT EXISTS idx_telegram_staff_notification_log_booking_id
  ON public.telegram_staff_notification_log (booking_id);

-- Phase 14.3 access-pattern cross-check (doc 14): every pattern in the doc's access-
-- pattern table was cross-referenced against existing migrations and the actual
-- _shared/databaseService.ts / financeService.ts / notificationsAccess.ts query shapes
-- before adding anything here. Patterns already covered by an existing composite index
-- (bookings by property+status, bookings by property/parking+created_at, finance line
-- items by property+occurred_on, activity log by org+created_at+id, notifications by
-- org/property/parking+created_at, social messages by conversation+sent_at) are NOT
-- duplicated — see the doc's "Implementation status" table for the full already-indexed
-- list. No new access-pattern index (beyond the FK-driven ones above) was added in this
-- pass without a confirmed query shape read from the actual service code.
