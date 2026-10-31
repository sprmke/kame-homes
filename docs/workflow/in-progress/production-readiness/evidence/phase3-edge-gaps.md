| Function | Wrapper | Validation | jsonSuccess/Error | Idempotency | Bounded query | Activity log | Gaps |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `accept-org-invite` | serveAuthenticated | no | yes | no | n/a | yes | no-validation-detected |
| `accept-parking-invite` | serveAuthenticated | no | yes | no | n/a | yes | no-validation-detected |
| `accept-property-invite` | serveAuthenticated | no | yes | no | n/a | yes | no-validation-detected |
| `activity-log-export` | serveAuthenticated | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `activity-log-retention-cron` | serveCronPost | no | NO | no | NO (has select) | no | no-validation-detected; no-jsonSuccess/jsonError; unbounded-select; no-activity-log-reference |
| `ai-platform-credit-wallet` | serveSuperAdmin | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `ai-platform-generation-overrides` | serveSuperAdmin | no | yes | no | NO (has select) | yes | no-validation-detected; unbounded-select |
| `ai-platform-global-settings` | serveSuperAdmin | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `ai-platform-property-settings` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `ai-platform-settings` | serveAuthenticated | no | yes | no | n/a | yes | no-validation-detected |
| `ai-platform-usage` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `analytics-ai-review` | serveAuthenticated | no | yes | no | yes | yes | no-validation-detected |
| `analytics-ai-review-cron` | serveCronPost | no | NO | no | yes | no | no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `analytics-org-summary` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `analytics-summary` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `app-settings` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `apply-org-plan-downgrade` | serveAuthenticated | no | yes | no | n/a | yes | no-validation-detected |
| `approval-email-webhook` | servePublic | yes | yes | no | NO (has select) | yes | unbounded-select |
| `approve-listing-authorization` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `approve-listing-recommended` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `approve-org-verification` | serveAuthenticated | no | yes | no | NO (has select) | yes | no-validation-detected; unbounded-select |
| `booking-ai-review` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `calendar-sync-cron` | RAW serve() | no | NO | no | NO (has select) | no | no-serve-wrapper; no-validation-detected; no-jsonSuccess/jsonError; unbounded-select; no-activity-log-reference |
| `calendar-sync-settings` | serveAuthenticated | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `cancel-booking` | serveAuthenticated | no | yes | no | n/a | yes | no-validation-detected |
| `cancel-parking-booking` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `check-organization-name` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `check-property-name` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `check-tower-unit` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `claim-parking-booking` | serveAuthenticated | no | yes | no | n/a | yes | no-validation-detected |
| `claim-sd-voucher` | servePublic | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `contract-expiry-cron` | serveCronPost | no | NO | no | n/a | no | no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `copy-property-settings` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `create-development` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `create-help-center-faq` | serveSuperAdmin | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `create-host-playbook-article` | serveSuperAdmin | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `create-org-subscription-checkout` | serveAuthenticated | no | yes | no | n/a | yes | no-validation-detected |
| `create-organization` | serveAuthenticated | no | yes | no | NO (has select) | yes | no-validation-detected; unbounded-select |
| `create-parking` | serveAuthenticated | no | yes | no | NO (has select) | yes | no-validation-detected; unbounded-select |
| `create-parking-booking` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `create-parking-payment-checkout` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `create-property` | serveAuthenticated | no | yes | no | NO (has select) | yes | no-validation-detected; unbounded-select |
| `custom-pages-settings` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `dashboard-assistant-briefing` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `dashboard-assistant-chat` | serveAuthenticated | yes | yes | no | yes | no | no-activity-log-reference |
| `dashboard-assistant-confirm` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `dashboard-assistant-conversations` | serveAuthenticated | no | yes | no | yes | yes | no-validation-detected |
| `dashboard-assistant-expire-pending-actions` | serveCronPost | no | NO | no | n/a | no | no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `dashboard-assistant-feedback` | serveAuthenticated | no | yes | no | NO (has select) | yes | no-validation-detected; unbounded-select |
| `dashboard-assistant-global-settings` | serveSuperAdmin | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `dashboard-assistant-settings` | serveAuthenticated | no | yes | no | n/a | yes | no-validation-detected |
| `dashboard-stats` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `decide-contract-consideration` | serveSuperAdmin | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `decline-parking-booking` | serveAuthenticated | no | yes | no | n/a | yes | no-validation-detected |
| `delete-development` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `delete-help-center-faq` | serveSuperAdmin | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `delete-host-playbook-article` | serveSuperAdmin | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `delete-organization` | serveAuthenticated | no | yes | no | NO (has select) | yes | no-validation-detected; unbounded-select |
| `delete-parking` | serveAuthenticated | no | yes | no | n/a | yes | no-validation-detected |
| `delete-property` | serveAuthenticated | no | yes | no | NO (has select) | yes | no-validation-detected; unbounded-select |
| `expire-parking-broadcasts` | serveCronPost | no | NO | no | n/a | no | no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `finance-bookings` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `finance-export` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `finance-line-items` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `finance-summary` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `generate-marketing-caption` | serveAuthenticated | yes | yes | no | NO (has select) | no | unbounded-select; no-activity-log-reference |
| `generate-marketing-media` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `generate-marketing-template` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `get-booked-dates` | servePublic | no | NO | no | NO (has select) | no | no-validation-detected; no-jsonSuccess/jsonError; unbounded-select; no-activity-log-reference |
| `get-booking` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `get-booking-ai-assistant-audit` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `get-booking-ai-review` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `get-booking-asset-url` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `get-development` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `get-external-review-assets` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `get-form` | servePublic | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `get-form-completion` | servePublic | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `get-guest-booking-document` | servePublic | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `get-guest-payment-info` | servePublic | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `get-guest-review` | servePublic | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `get-guest-stay-guide` | servePublic | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `get-guest-trip` | servePublic | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `get-health` | servePublic | no | NO | no | NO (has select) | no | no-validation-detected; no-jsonSuccess/jsonError; unbounded-select; no-activity-log-reference |
| `get-host` | serveAuthenticated | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `get-host-reward-offer` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `get-linked-parking-booking` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `get-listing-authorization-assets` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `get-marketing-generation-job` | serveAuthenticated | yes | yes | no | n/a | no | no-activity-log-reference |
| `get-org-superhost-progress` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `get-org-verification-assets` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `get-organization-admin` | serveSuperAdmin | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `get-parking-booking-status` | servePublic | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `get-parking-broadcast-status` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `get-pay-parking` | servePublic | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `get-platform-host-settings` | serveSuperAdmin | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `get-public-host` | servePublic | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `get-public-parking` | servePublic | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `get-public-platform-status` | servePublic | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `get-public-property` | servePublic | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `get-public-showcase` | servePublic | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `get-residence-unit-types` | servePublic | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `get-sd-form` | servePublic | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `get-support-ticket` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `get-support-ticket-admin` | serveSuperAdmin | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `get-team-invite-preview` | servePublic | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `guest-messages` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `guest-profile` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `guest-trips` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `guest-web-chat-messages` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `guest-web-chat-resume` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `guest-web-chat-start` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `ical-export` | RAW serve() | no | NO | no | NO (has select) | no | no-serve-wrapper; no-validation-detected; no-jsonSuccess/jsonError; unbounded-select; no-activity-log-reference |
| `import-ai-map-columns` | serveAuthenticated | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `import-cancel` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `import-commit` | serveAuthenticated | no | yes | no | NO (has select) | yes | no-validation-detected; unbounded-select |
| `import-list-batches` | serveAuthenticated | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `import-parse-file` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `import-preview` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `import-revert` | serveAuthenticated | no | yes | no | NO (has select) | yes | no-validation-detected; unbounded-select |
| `import-save-mapping` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `import-update-row` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `issue-booking-document-share-token` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `issue-guest-form-completion-token` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `issue-guest-stay-guide-token` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `issue-guest-trip-link` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `list-activity-log` | serveAuthenticated | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `list-bookings` | serveAuthenticated | no | NO | no | n/a | no | no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `list-developments` | serveAuthenticated | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `list-guest-vouchers` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `list-help-center-articles` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `list-help-center-faqs` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `list-help-center-faqs-admin` | serveSuperAdmin | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `list-host-announcements` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `list-host-organizations` | serveAuthenticated | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `list-host-playbook-articles-admin` | serveSuperAdmin | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `list-host-properties` | serveAuthenticated | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `list-hosts` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `list-linkable-property-bookings` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `list-org-listing-verifications` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `list-org-verifications` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `list-organizations` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `list-organizations-admin` | serveSuperAdmin | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `list-parkings` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `list-platform-properties` | serveAuthenticated | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `list-properties` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `list-property-guest-reviews` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `list-public-developments` | servePublic | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `list-public-parkings` | servePublic | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `list-public-place-groups` | servePublic | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `list-public-pricing-plans` | servePublic | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `list-public-properties` | servePublic | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `list-super-admin-approvals` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `list-super-admin-audit` | serveSuperAdmin | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `list-support-tickets` | serveAuthenticated | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `list-support-tickets-admin` | serveSuperAdmin | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `maintenance-items` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `maintenance-summary` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `marketing-generation-sweeper` | serveCronPost | no | NO | no | n/a | no | no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `marketing-generations` | serveAuthenticated | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `marketing-music` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `marketing-templates` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `marketing-themes` | serveAuthenticated | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `meta-inbox-backfill` | RAW serve() | no | yes | no | NO (has select) | no | no-serve-wrapper; no-validation-detected; unbounded-select; no-activity-log-reference |
| `meta-inbox-disconnect` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `meta-inbox-oauth-callback` | RAW serve() | no | NO | no | NO (has select) | no | no-serve-wrapper; no-validation-detected; no-jsonSuccess/jsonError; unbounded-select; no-activity-log-reference |
| `meta-inbox-oauth-complete` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `meta-inbox-oauth-pages` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `meta-inbox-oauth-start` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `meta-inbox-resubscribe` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `meta-inbox-status` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `meta-inbox-webhook` | RAW serve() | yes | yes | no | n/a | no | no-serve-wrapper; no-activity-log-reference |
| `meta-inbox-webhook-healthcheck` | serveCronPost | no | NO | no | n/a | no | no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `moderate-external-review` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `notifications-list` | serveAuthenticated | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `notifications-mark-read` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `org-access` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `org-plan` | serveAuthenticated | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `org-settings` | serveAdmin | no | yes | no | n/a | yes | no-validation-detected |
| `org-subscriptions-admin` | serveSuperAdmin | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `org-team-custom-roles` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `org-team-invitations` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `org-team-members` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `parking-access` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `parking-broadcast-email` | RAW serve() | no | NO | no | n/a | no | no-serve-wrapper; no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `parking-payouts` | serveSuperAdmin | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `parking-pricing` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `parking-settings` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `parking-team-custom-roles` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `parking-team-invitations` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `parking-team-members` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `paymongo-webhook` | servePublic | yes | yes | no | n/a | no | no-activity-log-reference |
| `platform-billing-cron` | serveCronPost | no | NO | no | n/a | no | no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `platform-parking-settings` | serveSuperAdmin | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `platform-payment-settings` | serveSuperAdmin | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `platform-settings` | serveSuperAdmin | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `preview-guest-stay-guide` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `pricing-plans` | serveSuperAdmin | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `property-access` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `property-entitlements` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `property-page-view` | servePublic | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `property-page-views-prune-cron` | serveCronPost | no | NO | no | yes | no | no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `property-pricing` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `property-team-custom-roles` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `property-team-invitations` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `property-team-members` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `property-templates-preview` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `property-templates-settings` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `public-page-configs` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `public-sitemap` | servePublic | no | NO | no | yes | no | no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `publish-to-meta` | serveAuthenticated | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `push-fanout` | servePublic | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `push-subscribe` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `push-unsubscribe` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `query-cache-sweep-cron` | serveCronPost | no | NO | no | n/a | no | no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `reassess-org-superhost` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `reject-listing-authorization` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `reject-org-verification` | serveAuthenticated | no | yes | no | NO (has select) | yes | no-validation-detected; unbounded-select |
| `reopen-support-ticket` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `reply-support-ticket` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `reply-support-ticket-admin` | serveSuperAdmin | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `request-parking-endorsement` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `resolve-owner-default-parking` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `sd-refund-cron` | RAW serve() | no | NO | no | NO (has select) | yes | no-serve-wrapper; no-validation-detected; no-jsonSuccess/jsonError; unbounded-select |
| `search-listings` | servePublic | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `search-suggestions` | servePublic | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `send-booking-workflow-email` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `send-parking-reminders` | serveCronPost | no | NO | no | n/a | no | no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `send-property-custom-template-email` | serveAuthenticated | no | yes | no | n/a | yes | no-validation-detected |
| `send-sd-refund-form-email` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `settings-verification` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `setup-guide-state` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `smart-pricing-apply` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `smart-pricing-cron` | serveCronPost | no | NO | no | yes | no | no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `smart-pricing-preview` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `smart-pricing-settings` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `social-inbox-ai-suggest` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `social-inbox-messages` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `social-inbox-send` | serveAuthenticated | no | yes | yes | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `social-inbox-settings` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `social-inbox-templates` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `social-inbox-threads` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `submit-contract-consideration` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `submit-form` | RAW serve() | no | NO | no | n/a | yes | no-serve-wrapper; no-validation-detected; no-jsonSuccess/jsonError |
| `submit-form-completion` | RAW serve() | no | NO | no | n/a | no | no-serve-wrapper; no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `submit-guest-review` | servePublic | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `submit-listing-authorization` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `submit-listing-recommended` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `submit-org-verification` | serveAuthenticated | no | yes | no | NO (has select) | yes | no-validation-detected; unbounded-select |
| `submit-parking-booking-request` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `submit-pay-parking` | RAW serve() | no | NO | no | n/a | no | no-serve-wrapper; no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `submit-sd-form` | RAW serve() | no | NO | no | n/a | yes | no-serve-wrapper; no-validation-detected; no-jsonSuccess/jsonError |
| `submit-support-ticket` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `super-admin-ai-limits` | serveSuperAdmin | no | yes | no | NO (has select) | yes | no-validation-detected; unbounded-select |
| `super-admin-ai-usage` | serveSuperAdmin | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `super-admin-overview` | serveSuperAdmin | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `super-admin-rate-limits` | serveSuperAdmin | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `super-admin-search` | serveSuperAdmin | no | yes | no | yes | no | no-validation-detected; no-activity-log-reference |
| `super-admin-system-health` | serveSuperAdmin | yes | yes | no | n/a | no | no-activity-log-reference |
| `super-admin-verification` | serveSuperAdmin | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `superhost-assessment-cron` | RAW serve() | no | yes | no | n/a | no | no-serve-wrapper; no-validation-detected; no-activity-log-reference |
| `telegram-admin-cron` | serveCronPost | no | NO | no | n/a | no | no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `telegram-admin-settings` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `telegram-chat-settings` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `telegram-finance-cron` | serveCronPost | no | NO | no | n/a | no | no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `telegram-finance-settings` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `telegram-global-settings` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `telegram-maintenance-cron` | serveCronPost | no | NO | no | n/a | no | no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `telegram-maintenance-settings` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `telegram-marketing-cron` | serveCronPost | no | NO | no | n/a | no | no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `telegram-marketing-settings` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `telegram-parking-settings` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `telegram-staff-cron` | serveCronPost | no | NO | no | n/a | no | no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `telegram-staff-settings` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `transition-booking` | serveAuthenticated | no | NO | yes | n/a | yes | no-validation-detected; no-jsonSuccess/jsonError |
| `transition-parking-booking` | serveAuthenticated | no | yes | yes | n/a | yes | no-validation-detected |
| `update-booking-details` | serveAuthenticated | no | yes | no | NO (has select) | yes | no-validation-detected; unbounded-select |
| `update-development` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `update-help-center-faq` | serveSuperAdmin | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `update-host-playbook-article` | serveSuperAdmin | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `update-organization` | serveAuthenticated | no | yes | no | n/a | yes | no-validation-detected |
| `update-parking` | serveAuthenticated | no | yes | no | NO (has select) | yes | no-validation-detected; unbounded-select |
| `update-platform-host-settings` | serveSuperAdmin | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `update-property` | serveAuthenticated | no | yes | no | NO (has select) | yes | no-validation-detected; unbounded-select |
| `update-support-ticket-status` | serveSuperAdmin | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `upload-app-settings-asset` | RAW serve() | no | NO | no | n/a | no | no-serve-wrapper; no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `upload-booking-asset` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `upload-development-media` | RAW serve() | no | NO | no | NO (has select) | no | no-serve-wrapper; no-validation-detected; no-jsonSuccess/jsonError; unbounded-select; no-activity-log-reference |
| `upload-guest-chat-asset` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `upload-guest-profile-asset` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `upload-inbox-chat-asset` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `upload-listing-authorization-asset` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `upload-marketing-asset` | serveAuthenticated | no | yes | no | n/a | yes | no-validation-detected |
| `upload-marketing-generation-reference` | serveAuthenticated | no | yes | no | NO (has select) | yes | no-validation-detected; unbounded-select |
| `upload-org-settings-asset` | RAW serve() | no | NO | no | n/a | no | no-serve-wrapper; no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `upload-org-verification-asset` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `upload-parking-media` | RAW serve() | no | NO | no | NO (has select) | no | no-serve-wrapper; no-validation-detected; no-jsonSuccess/jsonError; unbounded-select; no-activity-log-reference |
| `upload-parking-settings-asset` | RAW serve() | no | NO | no | n/a | no | no-serve-wrapper; no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `upload-property-media` | RAW serve() | no | NO | no | n/a | no | no-serve-wrapper; no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `upload-property-template-asset` | RAW serve() | no | NO | no | n/a | no | no-serve-wrapper; no-validation-detected; no-jsonSuccess/jsonError; no-activity-log-reference |
| `upload-support-ticket-attachment` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `user-ui-preferences` | serveAuthenticated | no | yes | no | NO (has select) | yes | no-validation-detected; unbounded-select |
| `validate-booking-receipts` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `voice-receptionist-canary` | serveCronPost | yes | NO | no | n/a | no | no-jsonSuccess/jsonError; no-activity-log-reference |
| `voice-receptionist-end` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `voice-receptionist-reaper` | serveCronPost | no | NO | no | n/a | yes | no-validation-detected; no-jsonSuccess/jsonError |
| `voice-receptionist-session` | serveAuthenticated | no | yes | no | n/a | yes | no-validation-detected |
| `voice-receptionist-settings` | serveAuthenticated | no | yes | no | n/a | yes | no-validation-detected |
| `voice-receptionist-start` | serveAuthenticated | no | yes | no | NO (has select) | no | no-validation-detected; unbounded-select; no-activity-log-reference |
| `voice-receptionist-tool` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `voice-receptionist-usage` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
| `voice-receptionist-voice-preview` | serveAuthenticated | no | yes | no | n/a | no | no-validation-detected; no-activity-log-reference |
