-- Phase 2: Gmail listener retired in favor of Resend inbound approval-email-webhook.
-- History cursor table is unused after cutover.

DROP TABLE IF EXISTS public.gmail_listener_state;
