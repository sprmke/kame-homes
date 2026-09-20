-- Doc 25/27 code-review follow-up — the original table comment on
-- email_suppressions (20261316122000) claimed "checked by every guest-facing
-- send path," which was inaccurate: at ship time only 3 of the qualifying
-- send functions in _shared/emailService.ts actually called isEmailSuppressed.
-- Two support-ticket notifier functions (sendSupportTicketReplyNotify,
-- sendSupportTicketStatusNotify — both send to ticket.submittedByEmail, an
-- external guest/host address) were gated in the same review pass that
-- caught this comment gap. This migration only corrects the comment to
-- describe what is actually gated and explicitly names what is intentionally
-- not gated (sends to operator-controlled inboxes) — no schema change.

COMMENT ON TABLE email_suppressions IS
  'Resend bounce/complaint suppression list. Checked by every send path whose recipient is an external guest/host address (booking acknowledgement, ready-for-check-in, SD refund form request, support-ticket reply notify, support-ticket status notify) before calling the Resend API. Sends to operator-controlled inboxes (ops EMAIL_TO/EMAIL_REPLY_TO, parking_owner_emails, SUPPORT_TEAM_EMAIL) are intentionally not gated — those addresses are configured by the property/platform operator, not a bounce-prone third party. Edge-only, no direct browser access.';
