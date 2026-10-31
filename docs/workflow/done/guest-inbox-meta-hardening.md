---
title: 'Guest Inbox — Meta (Facebook/Instagram) production hardening'
status: active
tags: [workflow, done, inbox, meta]
updated: 2026-08-20
stage: done
kind: plan
---

# Guest Inbox (Meta Facebook/Instagram) — Production Hardening Plan

## Context

The Guest Inbox's Meta (Facebook + Instagram) integration is the module that lets hosts receive and reply to guest DMs from inside the app. A full audit was requested because the module has grown organically (OAuth, webhooks, AI auto-reply, backfill sync) without a recent end-to-end review, and one specific symptom — **hosts must disconnect and reconnect Meta to see new messages** — was flagged as a real production papercut.

This session's deep-dive (direct reads of every `meta-inbox-*`/`social-inbox-*` edge function, the frontend `ui/src/features/dashboard/inbox/` module, the DB schema, and Meta's current official developer docs) found:

- **Realtime is not the problem.** Supabase Realtime is correctly wired end-to-end (`useInboxRealtime` in `ui/src/features/dashboard/inbox/hooks/useInbox.ts`, DB publication + `REPLICA IDENTITY FULL`, RLS select policies for the direct client subscription). The actual root cause is upstream: Meta's webhook subscription (`{pageId}/subscribed_apps`) is only ever established once, at connect time, in `persistMetaPageConnection` (`supabase/functions/_shared/metaInboxGraph.ts:197-283`). If that subscription silently drops (or fails, or Meta revalidates and rejects it), the failure is swallowed into an `error_message` column with **no retry, no health-check, and no recovery path** other than a full Disconnect → Reconnect — which itself hard-deletes every synced conversation and message (`ON DELETE CASCADE` from `social_conversations` → `social_messages`) and re-runs a full Graph API backfill. So "disconnect and reconnect" is the _only_ lever hosts have, and it's a destructive one.
- **The 24h messaging window is correctly implemented** (`isWithinMessagingWindowFromInbound`, enforced at send time, with existing UI countdown/disabled-composer treatment in `InboxConversationView.tsx`) — this part is already solid. What's missing is Meta's official `HUMAN_AGENT` message tag, which is still current (confirmed via Meta's official docs this session, not deprecated) and legitimately extends replies to 7 days for non-promotional follow-ups — a real capability gap, not just a UX gap.
- **Historical note:** this plan was written while comment support still existed in the inbox. The current product direction is now **messages only**, so any older references here to Facebook/Instagram comment ingestion or reply flows should be treated as obsolete.
- Secondary findings worth folding in while the module is open: no retry/backoff on transient Meta API failures, no token-expiry/revocation monitoring despite a DB column reserved for it, a non-constant-time webhook signature comparison, an infinite-scroll pattern that can trigger live Graph API calls purely from scroll position, and thread/message fetch errors rendering as an indistinguishable empty state.

**Decisions confirmed with the user before finalizing this plan:**

- Disconnect's default behavior changes from always-destructive to **non-destructive by default** (stops syncing, keeps history) — permanent deletion becomes an explicit opt-in checkbox, not the default action.
- The **HUMAN_AGENT tag is in scope** — adds a real, Meta-sanctioned, explicitly operator-triggered way to reply 24h–7d after a guest's last message, for non-promotional follow-ups only. Never used by AI auto-reply.

Everything below is scoped as 8 independently-shippable phases, ordered by risk/value, each sized for a single PR. Every phase updates its own docs in the same PR per this repo's "docs are the source of truth" rule (`route-guides` skill, `docs/archive/operations/*.md`).

---

## Phase 1 — Webhook subscription health-check + lightweight resubscribe

**Fixes the core symptom.** Nothing currently re-verifies `{pageId}/subscribed_apps` after initial connect (`subscribeMetaPageWebhooks`, `metaInboxGraph.ts:105-120`, called once inside `persistMetaPageConnection`).

**Backend:**

- New `supabase/functions/_shared/metaInboxWebhookHealth.ts`: `verifyMetaPageWebhookSubscription(pageId, token)` (GET `{pageId}/subscribed_apps`, check app + expected fields), `reconcileMetaConnectionWebhook(conn)` (verify → re-subscribe if needed → update `webhook_subscribed_at`/`webhook_last_verified_at`/`webhook_verify_attempts`/`error_message`; never touches `status`, never deletes anything).
- New migration `supabase/migrations/20261101120000_meta_inbox_webhook_health.sql`: adds `webhook_last_verified_at TIMESTAMPTZ`, `webhook_verify_attempts INT NOT NULL DEFAULT 0` to `social_channel_connections`; registers a `pg_cron` + `pg_net` job (`meta-inbox-webhook-healthcheck-every-10m`, `*/10 * * * *`) following the exact existing pattern in `supabase/migrations/20261018120001_parking_broadcast_expire_cron.sql` — this repo's scheduled jobs run via hosted `pg_cron`/`pg_net`, never `config.toml` schedule.
- New `supabase/functions/_shared/metaInboxHealthcheckCron.ts` (secret verification mirroring `_shared/parkingBroadcastExpireCron.ts`) + new `supabase/functions/meta-inbox-webhook-healthcheck/index.ts` (`serveCronPost`, matches `supabase/functions/expire-parking-broadcasts/index.ts`).
- New authenticated `supabase/functions/meta-inbox-resubscribe/index.ts` — same `resolveInboxAccess(req, 'manage', ...)` auth shape as `meta-inbox-disconnect`, calls `reconcileMetaConnectionWebhook` per connection, **never deletes data**.
- `meta-inbox-status/index.ts` — add `webhookNeedsAttention: attempts >= 3` to the response.
- `supabase/config.toml` — register the new healthcheck function (`verify_jwt = false`, matching `expire-parking-broadcasts`).

**Frontend:**

- `lib/inboxApi.ts` — `resubscribeMetaInbox(...)`. `hooks/useInbox.ts` `useInboxMutations` — `resubscribeMeta` mutation, invalidates only `INBOX_CONNECTIONS_KEY` (nothing was deleted).
- `components/InboxChannelsTab.tsx` — when `webhookNeedsAttention`, show a "Fix connection" button (distinct from the OAuth-based "Reconnect" button, which stays for token/link failures) calling `resubscribeMeta`.

**Done when:** an unsubscribed webhook self-heals within one 10-minute cycle with zero data loss; "Fix connection" clears the warning without any disconnect/reconnect. Update `docs/archive/operations/scheduled-jobs-and-testing.md` (new job row + local-testing steps) and both inbox route guides (new "Fix connection" action).

---

## Phase 2 — Decouple disconnect (data wipe) from resubscribe/reconnect

**Backend:**

- `_shared/metaInboxLifecycle.ts` — `clearOrgMetaInbox`/`clearPropertyMetaInbox`/`clearParkingMetaInbox` gain `{ deleteConversations: boolean }` (**default `false`**): default path unsubscribes + sets `status='disconnected'`, clears `encrypted_access_token`, leaves conversations/messages untouched; `deleteConversations: true` reproduces today's full-wipe path unchanged.
- `_shared/metaInboxScope.ts` — `resolveMetaConnectionIdsForScope` currently filters `status='connected'` only; rewrite to include `status IN ('connected','disconnected')` (sourced from the already-unfiltered `listOrgDefaultMetaConnections`/property/parking equivalents) so soft-disconnected conversations stay visible in the thread list. Do **not** touch `resolveEffectiveMetaConnection`'s connected-only filtering (drives Channels-tab "active Page" display and new-webhook attachment — must stay connected-only).
- `meta-inbox-disconnect/index.ts` — accept `body.deleteMessages?: boolean` (default `false`), thread through.
- `prepareOrgMetaInboxConnect`/property/parking equivalents — skip the wipe-before-reconnect step when the incoming Page id matches an existing soft-disconnected row for that scope (let `persistMetaPageConnection`'s upsert resume the same row/id, preserving history). **Flag for manual QA against a real Facebook Page before merge** — this is the one part of this phase not fully verifiable by static reading.

**Frontend:**

- `lib/inboxApi.ts` `disconnectMetaInbox` gains `deleteMessages?: boolean`. `hooks/useInbox.ts` `disconnectMeta` mutation only wipes local query cache when `deleteMessages === true`.
- `components/InboxChannelsTab.tsx` — redesign the disconnect dialog: default copy makes clear existing conversations stay; add an unchecked-by-default "Also permanently delete synced conversations and messages" checkbox that toggles `deleteMessages`, escalating to this repo's existing destructive-confirm pattern (reuse whatever org/property deletion already uses) when checked.
- Conversation view — when a connection is `status='disconnected'`, keep its conversations visible read-only, composer disabled with "This channel is disconnected — reconnect Meta to reply" (reuse the window-closed disabled-composer pattern).

**Done when:** default Disconnect preserves all history; reconnecting the same Page resumes the same connection row (no fresh backfill); the opt-in checkbox reproduces today's full wipe exactly. Update both route guides for the two-tier model.

**Depends on:** Phase 1 (gives "Fix connection" as the first recovery attempt before Disconnect is ever needed).

---

## Phase 3 — HUMAN_AGENT message tag (extend reply window to 7 days)

**Backend:**

- `metaInboxGraph.ts` `sendMetaMessage` — add `tag?: 'HUMAN_AGENT'`; when set, `messaging_type: 'MESSAGE_TAG'` + `tag: 'HUMAN_AGENT'` instead of `'RESPONSE'`.
- `_shared/socialInboxAiService.ts` — add `isWithinHumanAgentWindowFromInbound` (7-day check), alongside the existing 24h helper.
- `social-inbox-send/index.ts` + `_shared/inboxSendReplyAction.ts` — when the 24h window is closed but `body.useHumanAgentTag === true` (explicit, never inferred) and the 7-day window is open, send tagged instead of rejecting.
- **Do not modify `_shared/metaInboxAutoReply.ts`** — auto-reply stays 24h-only, always.
- New migration adding `social_messages.message_tag TEXT NULL` for audit visibility of tagged sends.

**Frontend:**

- `lib/inboxFormat.ts` — `isWithinHumanAgentWindow`. `InboxConversationView.tsx` composer — when 24h closed but 7d open, enable composer with an explicit "Reply window closed — send as a support follow-up (non-promotional only)" toggle that sets `useHumanAgentTag: true`; both windows closed → composer stays fully disabled as today.

**Done when:** a 24h–7d-old DM is only replyable via the explicit toggle, sent tagged, and recorded with `message_tag='human_agent'`; auto-reply behavior is unchanged; >7d-old DMs remain fully blocked. Update route guides with the new reply-window tiers.

---

## Phase 4 — Legacy comment support note (obsolete)

**Backend:**

Comment support has since been removed from the inbox. Keep this phase only as historical context for why old docs may mention comment-specific scopes, webhooks, or reply windows.

---

## Phase 5 — Caching / query / pagination refinement

- `hooks/useInbox.ts` `useInboxThreads`'s `getNextPageParam` currently lets scroll (`IntersectionObserver` in `InboxThreadList.tsx`) silently trigger live Graph API "sync" pages once local DB pages are exhausted. Change so scroll-triggered pagination never auto-fetches a live-sync page; once local pages are exhausted but `metaHasMore` is true, stop auto-pagination and surface an explicit "Load older from Meta" button that triggers the sync page on click only.
- `staleTime`/`gcTime` tuning: explicitly **measure before changing** — only add per-query overrides if post-Phase-1 profiling shows redundant refetches.
- DB index review: run `EXPLAIN ANALYZE` on the property/parking-scoped thread list query at realistic volume; current indexes (`idx_social_conversations_org_last_message`, `idx_social_messages_conversation_sent`, `idx_social_channel_connections_org_status`) look adequate — only add a new migration if a sequential scan actually shows up.

**Done when:** scrolling a long thread list no longer triggers live Meta API calls; an explicit control exists for pulling more history.

---

## Phase 6 — Security hardening

- **Constant-time webhook signature check** — `verifyMetaWebhookSignatureAsync` (`metaInboxGraph.ts:446-466`) uses plain `hex === expected`; add a small `timingSafeEqual` helper and use it.
- **Token-expiry/revocation monitoring** — extend Phase 1's reconcile function to call Graph's `/debug_token`, populate the currently-unused `social_channel_connections.token_expires_at`, and proactively flag `error_message` when a token is invalid or expiring soon.
- **Retry/backoff on transient failures** — no retry exists anywhere in the Meta send path today. Add a small retry helper (check `_shared/` for an existing generic one first) wrapping Graph POSTs in `sendMetaMessage`/`replyMetaPublicComment`; retry only network errors / 5xx / 429, never 4xx; apply at call sites in `social-inbox-send`, `inboxSendReplyAction.ts`, `metaInboxAutoReply.ts`.
- **Authorization sanity pass** — re-verify `_shared/inboxAccess.ts` `resolveInboxAccess`/`conversationAllowedInScope` after Phases 2 and 4 broaden connection-id scoping; do **not** add RLS-based enforcement — the service-role-bypasses-RLS pattern is this repo's established, intentional architecture.

**Done when:** signature check is constant-time; a revoked token is flagged proactively before it breaks a guest-facing send; transient 5xx/429s are retried before surfacing an error.

---

## Phase 7 — UX polish: error states, connect/backfill progress, disconnect copy

- `useInboxThreads`/`useInboxMessages`'s `isError` is currently never surfaced (only `useInboxConnections`'s error is wired up) — add a `'load-error'` empty-state variant (`InboxThreadListEmpty.tsx`) and an inline error+retry banner in `InboxConversationView.tsx`, matching the existing correct treatment for connection errors.
- Verify `MetaInboxSyncProgress.tsx` doesn't misfire for Phase 1's resubscribe-only action (should only appear for genuine backfill/connect).
- Final pass over all inbox empty/loading/error/disconnected-state copy against `minimal-ui-copy` and `mobile-responsive` conventions.

**Done when:** a failed fetch is visually distinguishable from "no messages yet" everywhere, with working retry.

**Depends on:** last among UI phases — needs to account for every new state introduced by Phases 1-6.

---

## Phase 8 — Documentation consolidation (final audit pass)

- Re-read and update `docs/guides/routes/org/property/inbox.md` + `.../parking/inbox.md` end-to-end (not just incremental diffs) to reflect cumulative behavior: webhook health/resubscribe, two-tier disconnect, HUMAN_AGENT window, comment-scope fix, new error states.
- Confirm `docs/archive/operations/scheduled-jobs-and-testing.md` has the healthcheck job documented with local-testing steps (mirroring the `sd-refund-cron`/`gmail-listener` sections).
- Final drift check: `meta-app-review.md` scope table vs. `_shared/metaInboxConfig.ts`.

---

## Verification (per phase, and end-to-end once all ship)

- `bun run lint / type-check / build` after each phase.
- Local Supabase: `bun run db:migrate` for new migrations, `bun run dev:api` to serve functions, exercise via `supabase/functions/meta-inbox-*` locally with a real (or sandboxed) Facebook Page — Meta requires HTTPS for OAuth/webhooks, so use the ngrok flow documented in `_shared/metaInboxConfig.ts`'s comments / `docs/archive/operations/dev-staging-environment.md`.
- Manual QA checklist per phase's "Done when" criteria above, especially Phase 1 (unsubscribe a Page's webhook via Graph directly, confirm self-heal) and Phase 2 (reconnect the same Page after a soft disconnect, confirm the connection row and its conversations survive with the same `id`).
- Drive the real UI with Playwright MCP for the frontend-facing changes (disconnect dialog, window-closed composer states, error-state empty views) per this repo's `verify` skill — there's no automated test suite for this repo yet.
- `mcp__supabase__get_advisors` after new migrations to catch RLS/index issues before deploy.

### Critical files

- `supabase/functions/_shared/metaInboxGraph.ts`, `metaInboxLifecycle.ts`, `metaInboxScope.ts`, `metaInboxConfig.ts`, `socialInboxAiService.ts`
- `supabase/functions/social-inbox-send/index.ts`, `meta-inbox-disconnect/index.ts`, `meta-inbox-status/index.ts`
- `ui/src/features/dashboard/inbox/hooks/useInbox.ts`, `components/InboxChannelsTab.tsx`, `components/InboxConversationView.tsx`, `components/InboxThreadList.tsx`
- `docs/guides/routes/org/property/inbox.md`, `docs/guides/routes/org/parking/inbox.md`, `docs/archive/operations/meta-app-review.md`, `docs/archive/operations/scheduled-jobs-and-testing.md`
