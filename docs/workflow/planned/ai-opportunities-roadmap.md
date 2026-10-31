---
stage: planned
title: 'AI Opportunities Roadmap — Guest Form Management'
status: planned
tags: [planning, planned-modules, ai, roadmap]
updated: 2026-08-06
---

# AI Opportunities Roadmap — Guest Form Management

**Status:** Idea backlog, not an implementation plan for any single item. Each idea below should get its own focused plan in `docs/workflow/planned/` (same pattern as the Marketing 1-4 plans or `custom-pages-module.md`) before implementation.

## Context

GFM already ships six AI features (all Gemini-primary, Groq/Llama-4-Scout fallback, server-side only): downpayment receipt validation at booking submission, Guest Inbox AI-suggest/auto-reply (Meta + web chat), marketing caption generation, an AI-integration health card in Property Settings, a Gemini Live voice receptionist for guest calls, and smart bookings CSV import. This doc is a full sweep of every guest, admin, and dev-facing page/feature to find where AI can help next — beyond what's already built — covering hosts, guests, platform admins, and developers.

## Already shipped (baseline — don't re-propose these)

| Feature                           | Where                                                                                                         | Model                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Receipt AI validation             | `submit-form`, `validate-booking-receipts` → `_shared/receiptValidationService.ts`                            | Gemini 2.5 Flash (vision), Groq fallback |
| Guest Inbox AI suggest/auto-reply | `social-inbox-ai-suggest` → `_shared/socialInboxAiService.ts`                                                 | Gemini 2.5 Flash, Groq fallback          |
| Marketing caption generation      | `generate-marketing-caption` → `_shared/marketingCaptionAi.ts`                                                | Gemini 2.0 Flash, Groq fallback          |
| AI integration health card        | `AiIntegrationCard.tsx` / `useAiIntegration.ts` (Property Settings)                                           | checks Gemini/Groq key + latency         |
| Voice Receptionist                | `voice-receptionist-*` fns, `useVoiceSession.ts`, guest chat page                                             | Gemini Live (native audio)               |
| Smart CSV import (bookings)       | Bookings import wizard + `IMPORTED` status — [`smart-ai-data-importer.md`](../done/smart-ai-data-importer.md) | Gemini column mapping, preview/fix queue |

## Idea catalog

Each idea: **Title** — Problem → AI approach · Data/APIs needed · Effort (S/M/L) · Impact (Low/Med/High)

### For guests

1. **Natural-language property search** — Filters are manual dropdowns; guests can't say what they actually want. → Parse free-text query ("2BR near the beach, pet friendly, under 5k") into structured filters against the existing properties/search API. · Gemini text + existing property search endpoint · M · Med
2. **AI review summarization on property detail** — Guests skim dozens of reviews. → Condense guest reviews into a pros/cons highlight block on `PropertyDetailPage.tsx`. · Gemini text, existing `get-guest-review`/review data · S · Med
3. **ID-photo verification at booking submit** — Guest-entered name can silently mismatch the uploaded valid ID; no check today. → Extend the receipt-validation pattern: OCR the ID upload, cross-check name/details against form fields, surface a soft warning before submit. · Gemini vision (reuse `receiptValidationService.ts` pattern), `submit-form` · M · High
4. **Free-text special-request classifier** — Guests write requests in prose; admins re-read the whole thread to extract intent (early check-in, extra pets, etc.). → Classify/structure the "special requests" field into tags surfaced on the booking detail page for admin triage. · Gemini text · S · Med
5. **Stay Guide Q&A chatbot** — Guests message hosts for info already in the Stay Guide (wifi password, check-in steps). → Ground a small chat/voice tool specifically on the guest's own Stay Guide content (narrower than the general voice receptionist), answering FAQs without a host reply. · Gemini + existing Stay Guide content, could reuse voice receptionist tool-calling infra · M · Med
6. **Guest review sentiment pre-flag** — Negative reviews post publicly before a host can respond. → Sentiment-score review submissions at `submit-guest-review`; auto-flag strongly negative ones for host follow-up before the voucher/public flow completes. · Gemini text · S · Med
7. **Wishlist price/availability digest** — Guests save properties to `/account/wishlist` and never hear about changes. → Periodic AI-written digest email summarizing what changed across saved properties. · Gemini text + existing wishlist data, needs a cron · M · Low-Med

### For hosts/admins (property & org)

8. **Booking briefing summary** — `BookingDetailPage.tsx` has a long history/thread; admins re-read it every visit. → One-paragraph AI TL;DR at the top: guest history, special requests, open risks. · Gemini text, existing booking/thread data · S | Med · High
9. **Dynamic pricing suggestions** — **Promoted → [`../for-testing/smart-pricing-ai.md`](../for-testing/smart-pricing-ai.md)** (Smart Pricing; Phases 0–3 shipped 2026-09-04, for-testing). Deterministic `base × multiplier` engine over the property's own calendar history + forward occupancy, Autopilot or Review-and-apply, optional AI rationale pass. Pro+ `smartPricing` plan key.
10. **Finance narrative + expense anomaly digest** — `finance-summary` shows numbers only; admins manually spot problems. → Monthly AI-generated narrative: biggest expense categories, revenue trend, one or two suggested actions; flag outlier line items. · Gemini text over `finance-bookings`/`finance-line-items` data · M · High
11. **Maintenance ticket auto-drafting from inbox** — Guests report issues ("AC not working") in chat; admins manually create maintenance items. → Detect maintenance-shaped messages in Guest Inbox and offer a one-click "create maintenance item" pre-filled by AI. · Gemini text, `maintenance-items` fn, inbox message stream · M · Med
12. **Marketing strategy suggestions** — Marketing Studio generates captions/videos on demand, but has no signal on _when_ to promote. → Analyze occupancy/booking trends per property and recommend campaigns ("low occupancy in 2 weeks — suggest a flash-sale post for these dates"), surfaced in Marketing Studio. · Gemini text over booking + pricing data · M · High
13. **Inbox conversation triage** — All Meta/web-chat threads look equal in the list; urgent ones aren't surfaced. → Auto-tag threads by intent/urgency (question, complaint, booking-related, spam) for sort/filter in the inbox list. · Extend `socialInboxAiService.ts` classification · S/M · Med
14. **Auto-reply guardrail check** — Auto-reply (off by default) could promise something outside policy (refund amount, dates) with no check. → Add a policy-compliance pass before an auto-reply sends, rejecting/flagging risky drafts. · Extend `socialInboxAiService.ts` · S · Med (risk mitigation)
15. **AI-drafted template starting point** — House-rules/instruction templates start blank. → Generate a first-draft template from a short prompt describing the property, which the admin edits. · Gemini text, existing templates schema · S · Low-Med
16. **AI-condensed Telegram digest** — Finance/maintenance/staff Telegram crons send raw hourly reminders. → Replace with one AI-summarized "N things need attention today" digest across modules. · Gemini text over existing cron data sources · S/M · Med
17. **Org verification pre-check** — `submit-org-verification` docs are reviewed manually by super-admins. → AI pre-screens submitted docs (completeness, obvious mismatches) before human review, same pattern as receipt validation. · Gemini vision, `submit-org-verification`/`approve-org-verification` · M · Med

### For platform super-admins

18. **Approvals queue pre-screening** — `/admin/approvals` host/property applications are reviewed one by one with no summary. → AI-generated per-application summary + flags (incomplete, suspicious) to speed triage. · Gemini vision/text over submitted docs · M · Med
19. **Platform health narrative** — `/admin` overview and Platform Properties show raw stats. → Executive-summary digest: churn-risk hosts, fastest-growing properties, cross-platform anomalies. · Gemini text over `dashboard-stats`/platform data · M · Med

### For developers / internal tooling

20. **Ambiguous Gmail-match fallback** — `gmail-listener` matches Azure approval replies to bookings; unmatched emails likely fail silently today. → AI fallback classifier suggests the best-guess booking match for a human to confirm instead of a silent miss. · Gemini text, existing Gmail listener context · M · Med
21. **Docs-drift CI check** — `documentation-maintenance.mdc` requires updating docs alongside behavior changes, but nothing enforces it. → CI check that diffs changed routes/edge-functions against touched docs paths and warns (rule-based, optionally AI-assisted for judgment calls) if docs weren't touched. · GitHub Actions, no new AI dependency required for v1 · S · Med
22. **Edge function error digest** — Supabase logs require manually reading via MCP/dashboard. → Periodic AI-summarized digest of edge function errors grouped by root cause. · Gemini text over `get_logs`/`get_advisors` output, needs a cron · M · Med

## Recommended shortlist (where to start)

Ranked by impact vs. effort, and picked to cover guest/host/dev without clustering all in one area:

1. **#8 Booking briefing summary** — smallest effort, reuses existing AI patterns, immediate daily-use value for every admin.
2. **#3 ID-photo verification at booking submit** — directly extends the already-shipped receipt-validation pipeline; closes a real fraud/error gap.
3. **#10 Finance narrative + expense anomaly digest** — reuses existing finance data, high visibility.
4. **#12 Marketing strategy suggestions** — builds on Marketing Studio's existing caption AI rather than starting fresh.
5. **#9 Dynamic pricing suggestions** — highest ceiling on revenue impact; larger effort, so sequence after the smaller wins above prove the pattern.
6. **#21 Docs-drift CI check** — cheapest possible win, no AI dependency required, fixes a documented sharp edge in how this repo already works.

Each of these, if picked up, should get its own focused plan in `docs/workflow/planned/` before implementation — this roadmap doc is the idea backlog, not an implementation spec for any one of them.

Back to [planned work index](./README.md).
