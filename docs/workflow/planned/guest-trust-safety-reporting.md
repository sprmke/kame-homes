---
stage: planned
title: 'Guest Trust & Safety Reporting — report a host, property, or organization'
status: planned
tags: [planning, planned-modules, trust-safety, guest, super-admin]
updated: 2026-09-02
---

# Guest Trust & Safety Reporting

Let **signed-in guests** (and prospective guests browsing while signed in) report a **property/listing**, a **host/organization**, or a **conversation** for fraud, misrepresentation, safety, or abuse — routed to a platform-side super-admin Trust & Safety queue with triage, threaded reporter follow-up, an enforcement toolkit (warn → require edit → suspend listing/org → ban user), and a **host appeal** path. Distinct from `support_tickets` (host help desk, delivered to the host) and from `external_reviews` moderation (host-submitted marketing content).

## Goal

Guests need a trustworthy, low-friction way to flag bad actors and unsafe situations, and the platform needs a single operational surface to receive, investigate, and act on those flags with an audit trail. Today there is **no reporting path** — a guest who spots a scam listing, gets harassed in chat, or has a safety incident during a stay has nowhere to go except an unrelated support ticket that is delivered straight to the host being complained about. This feature adds: (1) a reusable **Report** dialog on the public listing page, public host page, guest↔host chat thread, and per-stay view — **authentication required** at the point of submit; (2) a **reporter tracker** in `/account/reports` so a guest sees status and answers follow-up questions; (3) a **super-admin Trust & Safety console** at `/admin/trust-safety` modeled on the existing approvals queue — target-context (booking history, prior reports), related-report grouping, internal notes, a status machine, SLA timers, and enforcement actions that flip real `properties`/`organizations` moderation state and notify the host; (4) a **host-facing policy-notice + appeal flow**; (5) the anti-abuse, privacy, SLA, and documentation work to make it production-ready.

---

## Competitive UX brief

**Job:** a guest/prospective guest flags a listing, host, or message they believe is fraudulent, misrepresented, unsafe, or abusive, and can later see what happened.
**Roles:** guest (reporter) · operator (super-admin / Trust & Safety) · host (subject of a report / appellant).

### Airbnb (guest — the closest analog)

- **Two distinct entry points**, deliberately separated:
  - **Report this listing** — on the listing page, under the price/details block. Flow: pick a reason → _Next_ → free-text details (sometimes required) → _Submit_. Reasons: **inappropriate content or photos · misleading content or photos · not a real place to stay · scam or phishing · discrimination** (discrimination has its own dedicated form). Single modal, no wizard. Confirmation screen only; no case number surfaced to casual reporters.
  - **Report a message** — in Messages, per-message `…` menu → _Report this message_ → reason → optional details → _Submit_, then an optional **Block this person** step (offered only for some reasons). Blocking stops DMs, booking, and reservation acceptance both ways (with a carve-out window around an active reservation).
- **Neighborhood Support** (`/help/article/3290`) — a separate channel for people _without_ an account/booking: "Request a call" for an in-progress disturbance vs "Report a concern" for everything else. **Non-urgent reports get an email: "our team will investigate and follow up via email."** Outcomes for the host: warning → listing suspension → removal, by severity and frequency.
- **Auth:** listing/message reports require being signed in (you're already in the product). Neighborhood Support is the unauthenticated pressure-release valve — a phone line + form, not the in-product report flow.
- **Mobile:** full-screen sheet on the native app; centered modal on web.
- **Host appeal** (`/help/article/1303`): appeals form lives in **Account → Support**; must be signed in; requires listing name, **reservation codes** for the reported stays, the reason for appealing, and supporting docs (timestamped photos, receipts, permits). Six-month window. "You disagree with a review" is explicitly not grounds.

### Booking.com / Vrbo

- **Booking.com:** guest-side reporting is routed through generic customer service / the partner portal — there is no polished per-listing "report" widget, and a 2025 Which? investigation flagged exactly this weakness (fake listings slipping through). **Lesson: an obvious, structured in-listing report control is a differentiator, not a nice-to-have.**
- **Vrbo "Stay Neighborly":** structured intake form — reporter provides **name, email, phone, the listing URL, a description, and supporting documents** (police reports, affidavits, photos, citations). Confirms the value of (a) capturing structured evidence up front and (b) always tying a report to a specific listing URL/id.

### Marketplaces (eBay, Facebook Marketplace)

- Universal pattern: a **`…` overflow menu on the item / seller → "Report listing" / "Report seller" → reason picker → optional details**. Report status and any back-and-forth land in a **Support Inbox / Notifications** area the user can revisit — i.e. reporters _do_ get a durable, checkable record (unlike Airbnb's fire-and-forget listing report).

### Trust & Safety ops tooling (Cinder, industry write-ups)

- **Queues** are the core primitive: route incoming reports by predefined criteria (category, severity, target), so high-priority/sensitive items surface to the right reviewer fast.
- **Severity tiers low/medium/high/critical are wired to downstream workflows and SLAs**, not just labels — severity should _trigger_ routing/escalation.
- **Dedup + grouping**: collapse multiple reports about the same target/actor into one investigation.
- **Human-in-the-loop for appeals, high-risk, and policy calls**; automation for triage, dedup, language detection, risk scoring.
- Standard lifecycle: **policy → risk tiers → triage/queue → decision → enforcement → appeal → audit → continuous improvement.**

### Adopt for Kame Homes

- **Two entry surfaces, one component:** an unobtrusive "Report this listing / host" link on `/properties/:slug` and `/hosts/:orgSlug` **near the footer/overflow**, and a "Report conversation" item in the chat thread `…` menu — all opening the same `ReportDialog` (reason → details → optional evidence → submit → reference code).
- **Reason taxonomy** close to Airbnb's, split by reporter context: content-integrity set for everyone signed in; safety set unlocked when the reporter has a linked booking. Discrimination is its own reason (not a sub-option).
- **Reporters get a durable record** — the eBay/FB model — at `/account/reports` with status + a reply thread, not Airbnb's fire-and-forget.
- **Acknowledgement email with a reference code**, mirroring Neighborhood Support's "we'll follow up by email."
- **Ops console = a Queue** with category/severity/status/target filters, **severity→SLA timers**, **related-reports grouping per target**, internal notes, and a status machine — reusing the shape of the existing `SuperAdminApprovalsPage` + `list-super-admin-approvals`.
- **Enforcement ladder** warning → require-edit → suspend listing → suspend org → ban, each with host notification + email, mirroring Airbnb's escalation-by-severity/frequency.
- **Host appeal flow** modeled on Airbnb's: signed-in, structured (what action, why appealing, evidence), a deadline, resolution = upheld / reversed, "you disagree with the outcome" alone is weak grounds — surfaced in the dashboard as a **policy notice**, not buried in email.
- **Optional "Block this host"** offered to the reporter after a `harassment` conversation report (prevents further guest-initiated contact / new inquiries to that org from this guest).

### Adapt / skip

- **No unauthenticated / Neighborhood-Support-style channel** — explicit user decision. Every reporter is a signed-in Supabase guest identity; that _is_ our anti-spam gate, so **no CAPTCHA, no email-verification step, no disposable-email checks**. (Revisit only if we ever need a non-account safety channel.)
- **No phone/24-7 line.**
- Keep copy minimal (`minimal-ui-copy`) — no competitor helper paragraphs; reason labels + one-line helper text max.
- Parking listings are out of scope here (own vertical + `parking-e2e-phase6` trust/safety plan).

### Sources

- [Airbnb — Neighborhood Support (help/article/3290)](https://www.airbnb.com/help/article/3290) · [Reporting issues topic (help/topic/1397)](https://www.airbnb.com/help/topic/1397) · [How to report discrimination (help/article/1433)](https://www.airbnb.com/help/article/1433) · [Host & guest safety (help/article/3063)](https://www.airbnb.com/help/article/3063/host-and-guest-safety) · [Appeals (help/article/1303)](https://airbnb.com/help/article/1303)
- [Vrbo — Report a concern about a property / Stay Neighborly](https://help.vrbo.com/articles/How-can-I-Stay-Neighborly-as-a-community-member) · [Vrbo trust & safety](https://www.vrbo.com/tlp/trust-and-safety)
- [Booking.com trust & safety for partners](https://www.booking.com/trust_and_safety/partners.html) · [Skift — Booking.com bogus STR listings investigation (2025)](https://skift.com/2025/04/02/booking-com-subject-to-bogus-short-term-rental-listings-investigation-finds/)
- [Facebook — Report a Marketplace seller](https://www.facebook.com/help/ipad-app/196126404168290) · [Report items for sale on Marketplace](https://m.facebook.com/help/395891015688819/)
- [Cinder — Queues for Trust & Safety teams](https://cinder.ai/resources/blog/queues-agility-customization-and-automated-triage-for-trust-safety-teams) · [StrangeBee — incident prioritization / triage](https://strangebee.com/blog/security-incident-prioritization-proven-methods-to-improve-alert-triage/)
- [Hostaway — Airbnb listing suspension: why & what to do](https://www.hostaway.com/blog/airbnb-host-listing-suspension-or-paused/)

---

## Scope

### In

- **Data model:** `trust_safety_reports`, `trust_safety_report_messages`, `trust_safety_report_events`, `trust_safety_enforcement_actions`, `trust_safety_appeals`; `moderation_state` on `properties` and `organizations`; new `notifications.type` values; private bucket `trust-safety-attachments`; a `trust_safety_settings` singleton (thresholds/SLA/dedupe window).
- **Guest submission (all authenticated):** public listing page `/properties/:propertySlug`, public host page `/hosts/:orgSlug`, guest↔host chat (`PropertyChatPage` + `/account/stays` thread), per-stay view in `/account`. Optional discreet link on `sd-form` / `guest-review`. A standalone `/report` help page (target search → same dialog).
- **Tiered category eligibility:** any signed-in user → content-integrity set; signed-in **with a linked booking** → adds the safety-incident set. Enforced server-side.
- **Reporter tracker:** `/account/reports` list + detail, reply when `awaiting_reporter`, status-change emails, "Block this host" offer after a harassment conversation report.
- **Super-admin console:** `/admin/trust-safety` queue + `/admin/trust-safety/:reportId` detail; filters (target type, category, severity, status, assignment, search), pagination, **related-reports-per-target grouping**, duplicate merge, assignment, internal notes, status machine, SLA timers, target-context panel, audit timeline; nav destination + overview card + "new/breaching" badge.
- **Enforcement:** `no_action` / `warning_issued` / `listing_edit_required` (hooks the listing-verification `changes` flow) / `listing_suspended` / `org_suspended` / `user_banned`; revert path; host notification + enforcement-notice email; public exclusion of suspended targets from search + `get-public-property` + showcase/landing; active-booking handling policy (flag ops, don't auto-cancel); pause `org_subscriptions` billing while an org is suspended, resume on revert.
- **Host-facing:** in-app **policy notice** surface (dashboard) for any action taken, and a structured **appeal** (what action, grounds, evidence, deadline) → same console → upheld / reversed → host notified.
- **Anti-abuse:** per-user + per-target-per-category **dedupe window**, per-user daily submission cap, min description length, low-reputation-reporter severity dampening (never auto-dismiss), reporter reputation shown in the admin context panel.
- **SLA + auto-flag crons:** stale-report escalation by severity SLA; auto-severity-bump + optional soft-hide when a target crosses a distinct-valid-report threshold.
- **Docs / launch:** PROJECT.md + architecture docs, route guides for every touched page, `admin-auth.mdc`, migration runbook, `/report` + Terms/Privacy copy, Playwright + Deno tests, manual QA guide, metrics tiles, feature-flag rollout (`signed_in` → `post_stay`).

### Out

- **Unauthenticated / anonymous reporting**, CAPTCHA, email-verification, phone line — explicit user decision; every reporter is a signed-in guest identity.
- Host-reports-guest (reverse direction) — future phase; schema is built generic enough to add it later.
- Parking listings/marketplace reporting — see `parking-e2e-phase6-ranking-trust-safety.md`.
- A dedicated non-super-admin "Trust & Safety agent" RBAC role — v1 is super-admin only; the seam is noted.
- Automated ML/content scanning of listings; published transparency stats; law-enforcement disclosure workflow (store IP hash + audit log only; flag legal, don't build).
- Refund/chargeback automation tied to a report outcome — ops handles case-by-case.

---

## Decisions (previously open questions — now locked)

| #   | Decision                         | Detail                                                                                                                                                                                                                                                             |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Authenticated reporters only** | No anonymous path. The Supabase guest session is the anti-spam gate. Drop Turnstile/CAPTCHA, email-verification, disposable-email checks from the plan. `reporter_user_id` is `NOT NULL`.                                                                          |
| 2   | **Moderation state model**       | New `moderation_state TEXT NOT NULL DEFAULT 'active'` (`active                                                                                                                                                                                                     | changes_requested | suspended`) column on `properties`**and**`organizations`— independent of the host-lifecycle`status` enum, which is left untouched. |
| 3   | **Super-admin alerting**         | v1 = email to `TRUST_SAFETY_TEAM_EMAIL` + a live badge count on the `/admin/trust-safety` nav/overview (`list-trust-safety-reports-admin` returns `newCount` / `slaBreachingCount`). No platform notification-center build.                                        |
| 4   | **Host appeal flow**             | **In v1.** Every enforcement action creates an appealable case with a deadline (default 30 days, from `trust_safety_settings`). The lighter "redacted host-response request" (`awaiting_host` during investigation, pre-enforcement) is deferred to a fast-follow. |
| 5   | **Auto-hide on threshold**       | Off by default; `trust_safety_settings.auto_hide_enabled` opt-in. Threshold bump always alerts; soft-hide only when enabled.                                                                                                                                       |
| 6   | **`user_banned` guardrail**      | v1 = typed-confirmation string (`"BAN <org slug>"`) in the request body + super-admin auth. Two-admin approval is a later hardening.                                                                                                                               |
| 7   | **Billing while suspended**      | Pause the org's `org_subscriptions` billing on `org_suspended` (skip in `subscriptionOrchestrator` cron), resume on revert. Listing-only suspension does not touch billing.                                                                                        |
| 8   | **Reference-code format**        | `TS-YYYY-XXXXXX` (year + 6 base32 chars, no PII). Safe to show guests and hosts.                                                                                                                                                                                   |
| 9   | **Reporter record durability**   | Reporters get a persistent, checkable case at `/account/reports` with a reply thread (eBay/FB model), not Airbnb's fire-and-forget.                                                                                                                                |
| 10  | **Retention**                    | Reports + evidence retained **24 months** after terminal status, then hard-deleted by a cron; enforcement-action + event rows retained **5 years** (audit). Confirm with legal before Phase 1 ships; number lives in `trust_safety_settings`.                      |

---

## Approach

### Category taxonomy + eligibility (server-enforced)

`_shared/trustSafetyReports.ts` owns `CATEGORY`, `CATEGORY_SEVERITY`, `CATEGORY_SLA_HOURS`, `CHANNEL_ALLOWED_CATEGORIES`, `STATUS_TRANSITIONS`; the client mirrors the first four in `ui/src/features/guest/trust-safety/lib/reportCategories.ts`.

| Category                                                        | Reporter must have a linked booking? | Default severity | SLA (h) |
| --------------------------------------------------------------- | ------------------------------------ | ---------------- | ------- |
| `fraud_scam` (scam / phishing / fake listing)                   | No                                   | high             | 24      |
| `inaccurate_listing` (misleading content or photos)             | No                                   | medium           | 72      |
| `inappropriate_content` (offensive text/photos)                 | No                                   | medium           | 72      |
| `impersonation` (host isn't who they claim)                     | No                                   | high             | 24      |
| `prohibited_activity` (illegal / policy-violating use)          | No                                   | high             | 24      |
| `discrimination` (its own reason, dedicated helper copy)        | No                                   | high             | 24      |
| `harassment` (abusive messages / threats)                       | conversation channel OR booking      | high             | 24      |
| `safety_incident` (physical/sexual safety, threats during stay) | **Yes**                              | critical         | 4       |
| `property_hazard` (unsafe conditions, no smoke alarm, etc.)     | **Yes**                              | high             | 24      |
| `hidden_camera` (undisclosed surveillance)                      | **Yes**                              | critical         | 4       |
| `unauthorized_charge` (billing outside the platform / coercion) | **Yes**                              | high             | 24      |
| `other`                                                         | No                                   | low              | 168     |

"Linked booking" = a `guest_submissions` row with `guest_user_id = auth.uid()` (or email match pre-link) for the target property/org, in a status at or past `PENDING_REVIEW`. Booking presence also raises the effective severity one step for content-integrity categories (a paying guest's fraud report outranks a browser's).

### Reporter eligibility — two states, both signed in

| Reporter state                                  | Categories                                                                                                                                                                                            | Friction | Notes                                                                                                               |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| Signed in, **no linked booking** for the target | content-integrity set (`fraud_scam`, `inaccurate_listing`, `inappropriate_content`, `impersonation`, `prohibited_activity`, `discrimination`, `other`); `harassment` only from a conversation channel | none     | rate-limited + deduped; reputation tracked                                                                          |
| Signed in, **with a linked booking**            | full set including the safety-incident categories                                                                                                                                                     | none     | booking auto-attached; safety categories are `critical`/`high` with tight SLA; can attach the conversation snapshot |

If an unauthenticated user clicks a Report link, open the existing `GuestAuthModal` (email OTP + Google/Facebook) first, then resume into `ReportDialog` — same pattern as calendar _Proceed_ / form _Submit_.

### Status machine

`new → triaging → (awaiting_reporter | awaiting_host)* → (action_taken | dismissed | resolved)`
Terminal: `action_taken`, `dismissed`, `resolved`. `resolution` ∈ `no_action | warning_issued | listing_edit_required | listing_suspended | org_suspended | user_banned | duplicate | invalid`. Every transition writes a `trust_safety_report_events` row. Appeals have their own mini-machine: `submitted → under_review → (upheld | reversed | partially_reversed)`.

### Enforcement — single side-effect path

`_shared/trustSafetyEnforcement.ts#applyEnforcement(reportId, action, opts)` (mirrors `workflowOrchestrator` discipline — never inline in a handler; notification/email failures log-and-continue):

| Action                  | Side effects                                                                                                                                                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `warning_issued`        | Host-owner email + `trust_safety_action_taken` notification + event. No state change. Appealable.                                                                                                                                                                                         |
| `listing_edit_required` | `properties.moderation_state = 'changes_requested'`; open/link a listing-verification `changes` item (reuse `_shared/superAdminListingVerifications.ts`); host email + notification listing the specifics to fix. Listing stays live. Resolves when the host re-submits and it re-passes. |
| `listing_suspended`     | `properties.moderation_state = 'suspended'` (+ optional `expires_at`); excluded from `get-public-property`, search, showcase/landing; **active bookings NOT auto-cancelled** — ops notification + booking-detail flag. Host email + notification.                                         |
| `org_suspended`         | `organizations.moderation_state = 'suspended'`; cascades exclusion to all org listings; org dashboard shows a suspension gate (Plans/Help/appeal routes still reachable); **pause `org_subscriptions` billing**. Host email + notification.                                               |
| `user_banned`           | Disable the host's `auth.users` login (Supabase Auth admin) + suspend owned orgs; requires typed confirmation. Host email.                                                                                                                                                                |
| `no_action`             | Event + reporter resolution email. Not appealable (nothing happened).                                                                                                                                                                                                                     |

`revert-trust-safety-enforcement` (also the appeal `reversed` path) restores prior `moderation_state`, resumes billing, writes an event, re-notifies.

### Notifications

- **Super-admin:** email + badge (Decision 3).
- **Host:** `notifications.type` gains `trust_safety_action_taken` and `trust_safety_appeal_resolved` (migration widens `notifications_type_check`; `_shared/notificationService.ts` `NotificationType` updated; run the `notifications` skill).
- **Reporter:** transactional email on receipt (ack + reference code), on `awaiting_reporter`, and on terminal resolution.

### Reuse / precedent

`support_tickets` shapes (threading, attachments, private bucket, service-role edge fns, one-way email) · `list-super-admin-approvals` + `SuperAdminApprovalsPage` (heterogeneous queue, filters, pagination) · `external_reviews.moderationStatus` (state pattern) · `_shared/publicRateLimit.ts` + `_shared/parkingAntiSpam.ts` (rate-limit / dedupe) · `serveAuthenticated` + `serveSuperAdmin` / `verifySuperAdminJwt` · `GuestAuthModal` (auth gate) · `GUEST_ACCOUNT_NAV_ITEMS` + `.../account/routes` (portal nav) · `SUPER_ADMIN_PLATFORM_DESTINATIONS` + `superAdminRoutes` + `adminSidebarNav.ts` (console nav) · `RequirePropertySubscriptionAccess` (suspension gate shape) · `linkGuestBookingsByEmail` (login-time linking).

---

## End-to-end flows

### Guest (reporter)

1. **Discover** — sees "Report this listing" on `/properties/:slug` (footer/overflow), "Report this host" on `/hosts/:orgSlug`, "Report conversation" in a chat thread `…` menu, or "Report a problem with this stay" on a stay in `/account/stays`. Also `/report` as a catch-all.
2. **Auth gate** — if not signed in, `GuestAuthModal` → resume.
3. **`ReportDialog`** — reason picker (only the categories allowed for this reporter/channel), one-line helper per reason, `discrimination` shows dedicated copy; description textarea (min 30 chars); optional evidence upload (images/video/PDF, reuses the media pipeline); for a conversation report, a "include this conversation as evidence" checkbox (default on). Submit.
4. **Confirmation** — success screen with reference code `TS-2026-XXXXXX` + "we've emailed you a copy and will follow up." Ack email sent.
5. **Track** — `/account/reports` lists their reports with status chips; detail view shows the thread + status timeline. When status is `awaiting_reporter`, a reply box is enabled; replying flips status back to `triaging` and notifies the team.
6. **Resolution** — email on terminal status with a plain-language outcome ("we reviewed and took action" / "we didn't find a policy violation" — never disclosing the specific enforcement or the host's response).
7. **Block (harassment only)** — after a `harassment` conversation report, an optional "Also block this host" toggle prevents this guest from sending new inquiries/messages to that org (reuses/extends inbox participant blocking).

### Host (subject / appellant)

1. **Notified only when action is taken** — never sees the raw report or reporter identity. On `warning_issued` / `listing_edit_required` / `listing_suspended` / `org_suspended`: `trust_safety_action_taken` in-app notification + enforcement-notice email.
2. **Policy notice surface** — a dashboard card/banner (org and/or property settings → a new "Policy & Safety" section) showing: action taken, the policy area (redacted category label, not the reporter's words), effective date, what's required to lift it (for `changes_requested`), and the appeal deadline.
3. **Fix path (`listing_edit_required`)** — host edits the listing, re-submits for review; ties into the existing listing-verification `changes` re-review; on pass, `moderation_state → active` automatically, host notified.
4. **Appeal** — "Appeal this decision" opens a structured form: which action, grounds for appeal, evidence upload, acknowledgement that "disagreeing with the outcome alone isn't grounds." Creates a `trust_safety_appeals` row linked to the report; `status → under_review` on the report.
5. **Appeal outcome** — super-admin reviews in the same console; `upheld` (action stands, host notified with reason) / `reversed` (calls `revertEnforcement`, `moderation_state` restored, billing resumed, host notified) / `partially_reversed` (e.g. suspension → warning). `trust_safety_appeal_resolved` notification + email.
6. **Suspended-org UX** — dashboard shows a full-width gate; only Plans/Billing, Help & Support, and the appeal flow are reachable, matching the `RequirePropertySubscriptionAccess` precedent.

### Super-admin (Trust & Safety operator)

1. **Alert** — email to `TRUST_SAFETY_TEAM_EMAIL` on every new report (severity in subject); `/admin/trust-safety` nav badge shows `new` + `sla_breaching` counts.
2. **Queue** (`/admin/trust-safety`) — table with filters (target type, category, severity, status, assignee, search over reporter/target/description/reference), pagination, severity + SLA-countdown chips, an "N related open reports" indicator per target. Bulk: assign, mark duplicate/merge.
3. **Triage** (`/admin/trust-safety/:reportId`) — panels:
   - **Reporter:** identity, reputation (validity rate, prior reports filed), this reporter's other open reports.
   - **Evidence:** attachments gallery + conversation snapshot + booking snapshot (signed URLs).
   - **Target context** (`get-trust-safety-target-context-admin`): booking volume + recent bookings, **all prior reports received** (status/outcome), org/listing verification status, current `moderation_state`, other open reports on the same target (grouped).
   - **Thread:** reporter↔admin messages + internal-only notes (`visibility` toggle).
   - **Status controls:** advance the machine; `awaiting_reporter` / `awaiting_host`; assign.
   - **Audit timeline:** every `trust_safety_report_events` row.
4. **Act** — enforcement panel with per-action confirm dialogs (typed confirm for `user_banned`); `apply-trust-safety-enforcement` sets `resolution` + `status → action_taken`, notifies the host, writes the action + event.
5. **Appeals** — a queue filter/tab surfaces `trust_safety_appeals` in `under_review`; the operator reviews grounds + evidence against the original report and resolves `upheld | reversed | partially_reversed`.
6. **Housekeeping** — merge duplicates (child reports point at the canonical, share its resolution), dismiss `invalid`/`duplicate` with a reporter note, reassign, add internal notes. SLA cron escalates anything past its severity SLA with no `first_response_at`.

---

## Implementation tasks

### Phase 0 — Spec sign-off (no code)

- [ ] Lock the category table above (labels + helper copy) with product; confirm `discrimination` dedicated copy.
- [ ] Legal/privacy sign-off on: 24-month report retention / 5-year audit retention, reporter-identity redaction rules, IP-hash salt handling, PH Data Privacy Act 2012 review, defamation review of guest + host copy. Short policy note in `docs/archive/operations/trust-safety-policy.md`.
- [ ] Confirm SLA hours per severity (4 / 24 / 72 / 168) and appeal window (30 days).
- [ ] Confirm feature-flag shape: `VITE_ENABLE_TRUST_SAFETY_REPORTING` + `VITE_TRUST_SAFETY_CHANNELS` staged group list (`core` = listing/host/chat/stay → `post_stay`).
- [ ] Confirm `TRUST_SAFETY_TEAM_EMAIL` recipient.

### Phase 1 — Data model & shared foundation

- [ ] `supabase/migrations/<ts>_trust_safety_reports.sql` — `trust_safety_reports` (`id`, `reference_code` unique, `reporter_user_id` **NOT NULL** FK → `auth.users`, `reporter_email`, `reporter_name`, `reporter_ip_hash`, `channel` `public_listing|public_host|conversation|stay|post_stay|standalone`, `target_type` `property|organization|host_user`, `target_property_id`, `target_organization_id`, `target_host_user_id`, `related_booking_id`, `related_conversation_id`, `canonical_report_id` (dup merge), `category`, `severity`, `description`, `status`, `resolution`, `assigned_admin_id`, `internal_priority`, `first_response_at`, `sla_due_at`, `resolved_at`, `resolved_by`, `created_at`, `updated_at`). CHECKs on every enum; indexes `(status, severity, sla_due_at)`, `(target_property_id)`, `(target_organization_id)`, `(target_host_user_id)`, `(reporter_user_id)`, `reference_code`, `canonical_report_id`.
- [ ] `supabase/migrations/<ts>_trust_safety_report_messages.sql` — `sender_type` `reporter|admin|system`, `sender_user_id`, `visibility` `all|internal`, `body`, `attachments` JSONB, `created_at`.
- [ ] `supabase/migrations/<ts>_trust_safety_report_events.sql` — immutable audit (`report_id`, `event_type`, `actor_user_id`, `actor_type`, `from_value`, `to_value`, `note`, `metadata`, `created_at`); no UPDATE/DELETE policy.
- [ ] `supabase/migrations/<ts>_trust_safety_enforcement_actions.sql` — `report_id`, `action_type`, `target_*`, `notes`, `expires_at`, `reverted_at`, `reverted_by`, `revert_reason`, `created_by`, `created_at`.
- [ ] `supabase/migrations/<ts>_trust_safety_appeals.sql` — `report_id`, `enforcement_action_id`, `appellant_user_id`, `grounds`, `attachments` JSONB, `status` `submitted|under_review|upheld|reversed|partially_reversed`, `reviewer_id`, `decision_note`, `submitted_at`, `resolved_at`, deadline `appeal_due_at`.
- [ ] `supabase/migrations/<ts>_moderation_state_columns.sql` — `moderation_state` + CHECK on `properties` and `organizations`; partial indexes `WHERE moderation_state <> 'active'`.
- [ ] `supabase/migrations/<ts>_trust_safety_settings.sql` — singleton (SLA hours map, appeal window days, dedupe window hours, per-user daily cap, `auto_hide_enabled`, threshold N / window W, retention months).
- [ ] `supabase/migrations/<ts>_trust_safety_notification_types.sql` — widen `notifications_type_check` with `trust_safety_action_taken`, `trust_safety_appeal_resolved`.
- [ ] RLS: report tables service-role-only for writes; SELECT on `trust_safety_reports` where `reporter_user_id = auth.uid()`; SELECT on `visibility='all'` messages of those reports; `trust_safety_appeals` SELECT where `appellant_user_id = auth.uid()`. No host/org read path on reports. Mirror `support_tickets` RLS helper style.
- [ ] Storage: private bucket `trust-safety-attachments` + policies (service-role write via edge; signed URLs per-request). Types image/*, `video/mp4`, `video/quicktime`, `application/pdf`; cap via `_shared/uploadLimits.ts` (~20 MB).
- [ ] `supabase/functions/_shared/trustSafetyReports.ts` — enums, `CATEGORY_SEVERITY`, `CATEGORY_SLA_HOURS`, `CHANNEL_ALLOWED_CATEGORIES`, `STATUS_TRANSITIONS`, `APPEAL_TRANSITIONS`, `severityForContext()`, `generateReferenceCode()`, DTO mappers.
- [ ] `supabase/functions/_shared/trustSafetyScope.ts` — `resolveReportTarget()` (slug/id → property/org/host ids), `classifyReporterState()` (linked-booking check via `guest_submissions`), conversation-ownership check.
- [ ] `supabase/functions/_shared/trustSafetyRateLimit.ts` — per-user daily cap + `(reporter_user_id, target, category)` dedupe within the settings window; `TrustSafetyRateLimitError { status = 429 }`.
- [ ] `supabase/functions/_shared/trustSafetyEnforcement.ts` — `applyEnforcement()` / `revertEnforcement()` with the side-effect matrix; billing pause/resume hook.
- [ ] `supabase/functions/_shared/trustSafetyAttachments.ts` — path validation (copy `supportTicketAttachments.ts`).
- [ ] `_shared/emailService.ts` — `sendTrustSafetyReportAck`, `sendTrustSafetyAdminNotify`, `sendTrustSafetyReporterUpdate`, `sendTrustSafetyHostEnforcementNotice`, `sendTrustSafetyAppealOutcome` + templates in `_shared/email-templates/`; register `static_files` in `config.toml` for sending functions.
- [ ] `_shared/notificationService.ts` — new `NotificationType` literals + `notifyHostTrustSafetyAction()` (run the `notifications` skill).
- [ ] Deno tests: `trustSafetyReports.test.ts` (gating matrix, severity, status/appeal machines), `trustSafetyRateLimit.test.ts` (dedupe + cap).
- [ ] `subscriptionOrchestrator` — skip billing for orgs with `moderation_state = 'suspended'`; resume logic on revert.

### Phase 2 — Guest submission

**2a — core (listing + host page)**

- [ ] `supabase/functions/get-trust-safety-report-form-context/index.ts` (`serveAuthenticated`) — `?targetType=&propertySlug=|orgSlug=|conversationId=` → resolved target name/image, `allowedCategories` for this caller, whether a booking is linked. Rate-limited.
- [ ] `supabase/functions/upload-trust-safety-attachment/index.ts` (`serveAuthenticated`) — staged upload handshake (copy `upload-support-ticket-attachment`).
- [ ] `supabase/functions/submit-trust-safety-report/index.ts` (`serveAuthenticated`) — validate category ∈ `CHANNEL_ALLOWED_CATEGORIES[channel]` for the resolved reporter state; `trustSafetyRateLimit` + dedupe (return the existing report's reference if duped within window); capture conversation/booking snapshot; insert report + first message + `report_created` event; set `sla_due_at`; `sendTrustSafetyReportAck` + `sendTrustSafetyAdminNotify`; return `{ referenceCode, reportId }`.
- [ ] `ui/src/features/guest/trust-safety/` — `lib/reportCategories.ts` (mirror), `lib/trustSafetyApi.ts`, `lib/reportContext.ts`; `components/ReportDialog.tsx` (reason group, description, evidence picker via `prepareUpload`, conversation-include checkbox, success screen w/ reference code); `hooks/useReportFormContext.ts`, `hooks/useSubmitReport.ts`.
- [ ] Auth gate: `ReportDialog` trigger opens `GuestAuthModal` when no session, resumes on success.
- [ ] Wire `ui/src/features/guest/marketing/pages/PropertyDetailPage.tsx` ("Report this listing") and `HostPublicPage.tsx` ("Report this host").
- [ ] `accessibility` skill pass on `ReportDialog`; `mobile-responsive` skill pass (375/768/1024, 44px).
- [ ] Route-guide updates: `docs/guides/routes/properties.md`, host public page guide.

**2b — authenticated channels**

- [ ] Chat: "Report conversation" in `ui/src/features/guest/chat/components/GuestChatHeaderBar.tsx` + the `/account/stays` thread header → `ReportDialog` (`channel: 'conversation'`, `conversationId`, `bookingId?`).
- [ ] Per-stay: "Report a problem with this stay" in `ui/src/features/guest/account/components/GuestMessagesHub.tsx` / stay detail → `channel: 'stay'`, `bookingId`.
- [ ] `submit-trust-safety-report` — snapshot last N `social_messages` for `conversation` channel into an internal-visibility first message + evidence metadata.
- [ ] Optional discreet link on `SdFormPage.tsx` / `GuestReviewPage.tsx` (`channel: 'post_stay'`, behind the `post_stay` flag group).
- [ ] "Block this host" offer post-`harassment` — extend inbox participant blocking; new `block-host-from-report` edge fn or reuse an existing block endpoint.
- [ ] Route-guide updates: chat/messages guide, `sd-form.md` / `guest-review.md` if touched.

### Phase 3 — Reporter tracker (`/account/reports`)

- [ ] `supabase/functions/list-my-trust-safety-reports/index.ts` (`serveAuthenticated`).
- [ ] `supabase/functions/get-my-trust-safety-report/index.ts` — report + `visibility='all'` messages + status timeline; IDOR-guarded.
- [ ] `supabase/functions/reply-my-trust-safety-report/index.ts` — allowed only while `status='awaiting_reporter'`; appends message + `reporter_replied` event; `status → triaging`.
- [ ] `_shared/guestProfileService.ts` — `linkGuestReportsByEmail()` on login (email → `reporter_user_id`), mirroring `linkGuestBookingsByEmail`.
- [ ] `ui/src/features/guest/account/pages/GuestReportsPage.tsx` + `.../components/` (list + detail thread; reuse `GuestAccountContentCard` shell like `GuestTicketsPage`).
- [ ] `guestAccountNav.ts` — "Reports" item (`ShieldAlert`); `.../account/routes/index.tsx` — `reports/*` route; `guestAccountPaths.ts` — `GUEST_ACCOUNT_REPORTS_PATH`.
- [ ] `sendTrustSafetyReporterUpdate` fired from status transitions.
- [ ] Route guide: `docs/guides/routes/account/reports.md` (+ link from account index). Invoke `route-guides`.

### Phase 4 — Super-admin console

- [ ] `supabase/functions/list-trust-safety-reports-admin/index.ts` (`serveSuperAdmin`) — filters + pagination (copy `list-super-admin-approvals`); returns `newCount`, `slaBreachingCount`, and per-row `relatedOpenCount`.
- [ ] `supabase/functions/get-trust-safety-report-admin/index.ts` — full report: all messages, events, enforcement actions, appeals, evidence signed URLs, resolved target refs, related open reports on the same target.
- [ ] `supabase/functions/get-trust-safety-target-context-admin/index.ts` — target booking volume + recent bookings, prior reports received (by status/outcome), verification + `moderation_state`, reporter reputation (validity rate, prior filed).
- [ ] `supabase/functions/reply-trust-safety-report-admin/index.ts` — message w/ `visibility all|internal`; `all` → `sendTrustSafetyReporterUpdate`.
- [ ] `supabase/functions/update-trust-safety-report-status/index.ts` — machine-guarded transition + event + reporter email hook; sets `assigned_admin_id`, `first_response_at`.
- [ ] `supabase/functions/assign-trust-safety-report/index.ts` · `supabase/functions/merge-trust-safety-reports/index.ts` (set `canonical_report_id`, cascade resolution).
- [ ] `ui/src/features/dashboard/super-admin/pages/SuperAdminTrustSafetyPage.tsx` (queue) + `SuperAdminTrustSafetyDetailPage.tsx` (detail) + `.../components/super-admin-trust-safety/` panels/hooks + `trustSafetyAdminApi.ts`.
- [ ] `.../super-admin/routes/index.tsx` — `trust-safety` + `trust-safety/:reportId`.
- [ ] `superAdminPlatformNav.ts` (`SUPER_ADMIN_PLATFORM_DESTINATIONS`) + `adminSidebarNav.ts` + `SuperAdminOverviewPage.tsx` badge `StatCard`.
- [ ] `.cursor/rules/admin-auth.mdc` — document the new `serveSuperAdmin` endpoints.
- [ ] Route guide: `docs/guides/routes/admin/trust-safety.md`. Invoke `route-guides`.

### Phase 5 — Enforcement & host-facing (incl. appeals)

- [ ] `supabase/functions/apply-trust-safety-enforcement/index.ts` (`serveSuperAdmin`) — validate action vs target type; `applyEnforcement`; write action + `enforcement_applied` event; set `resolution` + `status → action_taken`; host email + notification; `user_banned` requires typed confirmation string.
- [ ] `supabase/functions/revert-trust-safety-enforcement/index.ts` — restore `moderation_state`, resume billing, event, re-notify.
- [ ] `_shared/trustSafetyEnforcement.ts` — implement per-action side effects; `listing_edit_required` → `superAdminListingVerifications` `changes` path.
- [ ] Public exclusion of suspended targets:
  - `get-public-property` (+ `get-public-showcase`, landing) → "unavailable" when `moderation_state='suspended'`.
  - Search / public listing endpoints → exclude suspended `property_id`/`organization_id`.
  - Active bookings on a suspended listing → ops notification + booking-detail flag (no auto-cancel).
- [ ] Host suspension UX: org/property dashboard gate (reuse `RequirePropertySubscriptionAccess` shape); a **Policy & Safety** section in org + property settings showing active notices.
- [ ] Appeals:
  - `supabase/functions/submit-trust-safety-appeal/index.ts` (org-access-gated) — creates `trust_safety_appeals`, `report.status → under_review`.
  - `supabase/functions/get-trust-safety-appeal/index.ts` (host) · `list-trust-safety-appeals-admin` + `resolve-trust-safety-appeal` (`serveSuperAdmin`) → `upheld | reversed | partially_reversed`; `reversed`/`partially_reversed` call `revertEnforcement` / apply the lighter action.
  - `ui/src/features/dashboard/.../PolicyNoticeCard.tsx` + `AppealDialog.tsx` (host side); appeal tab in the super-admin console.
  - `sendTrustSafetyAppealOutcome` + `trust_safety_appeal_resolved` notification.
- [ ] Enforcement-notice + appeal-outcome email templates.
- [ ] `security-auditor` review: RLS, IDOR on report/message/appeal ids, storage signed-URL scoping, enforcement authorization, PII in emails/logs, ban-confirmation bypass.
- [ ] Route guides: org/property settings guides (Policy & Safety section), `docs/guides/routes/admin/trust-safety.md` (appeals).

### Phase 6 — Anti-abuse, SLA, auto-flag, hardening

- [ ] `supabase/functions/trust-safety-sla-cron/index.ts` (`serveCronPost`) — escalate reports past `sla_due_at` with no `first_response_at`: bump `internal_priority`, team email, `sla_breached` event. Schedule via hosted `pg_cron` + `pg_net` migration (`scheduled-jobs-and-testing.md`).
- [ ] Auto-flag (same cron or `trust-safety-autoflag-cron`) — target crosses N distinct valid reports in W: severity bump on open reports, `auto_flagged` event, team email; if `auto_hide_enabled`, `moderation_state → changes_requested` + soft-hide pending review.
- [ ] `trust-safety-retention-cron` — hard-delete reports + evidence past the retention window; keep enforcement/event rows per the audit window.
- [ ] `trustSafetyRateLimit.ts` — finalize per-user daily cap + dedupe window from `trust_safety_settings`.
- [ ] Reporter reputation: rolling validity rate (valid-outcome / total) in the admin context panel; low-rep reporters' new reports open one severity step lower (never auto-dismissed).
- [ ] Metrics: reports by category/status/severity/target, median time-to-first-response, action rate, dismissal rate, appeal reversal rate — `SuperAdminOverviewPage` tiles + console summary.
- [ ] Abuse test: burst submit, dedupe correctness, cap enforcement.

### Phase 7 — Docs, tests, launch

- [ ] `documentation-maintenance` sweep — every touched surface.
- [ ] `docs/PROJECT.md` — new "Guest Trust & Safety Reporting" section; add rows to `docs/architecture/data-model.md`, `edge-functions.md`, `routing.md`, `roadmap.md`, `validation-and-env.md` (new env vars), `docs/archive/operations/scheduled-jobs-and-testing.md` (3 crons), `migration-runbook.md`.
- [ ] Route guides (`route-guides` skill): **new** `docs/guides/routes/admin/trust-safety.md`, `docs/guides/routes/account/reports.md`; **update** `properties.md`, host public page guide, chat/messages guide, org + property settings guides (Policy & Safety), account index, `sd-form.md`/`guest-review.md` if touched.
- [ ] `.cursor/rules/admin-auth.mdc` — final endpoint list.
- [ ] `ui/src/features/guest/marketing/pages/ReportPage.tsx` + `/report` route — target search → `ReportDialog`; link from footer, `/support`, `/terms`, `/privacy`.
- [ ] Terms & Privacy copy — reporting policy, reporter-identity handling, retention, enforcement basis, appeal rights (`TermsPage.tsx` / `PrivacyPage.tsx` content).
- [ ] Playwright (`ui/e2e/features/trust-safety/`): submit from listing (signed-in + auth-gate-then-submit), submit from chat, reporter tracker reply, admin triage + status transition, enforcement suspend + public exclusion, host appeal + reversal.
- [ ] Deno tests: gating matrix, rate-limit/dedupe, status + appeal machines, enforcement side effects, billing pause/resume.
- [ ] `docs/guides/testing/trust-safety-manual.md` — manual QA script.
- [ ] `plans-and-permissions` checklist — expected **N/A** (platform trust feature, not a paid entitlement, not team-RBAC-gated); record rationale + the future "Trust & Safety agent" role seam.
- [ ] Feature-flag rollout: staff/allowlist → all signed-in guests (`core` channels) → `post_stay` links. Watch submission volume + dismissal rate at each step.
- [ ] `verify` skill run (type-check/lint/build + local edge exercise + Playwright MCP walk-through).

---

## Docs to update

| File                                                                              | Change                                                                                                  |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `docs/PROJECT.md`                                                                 | New "Guest Trust & Safety Reporting" section; env vars; routes                                          |
| `docs/architecture/data-model.md`                                                 | 5 report tables + `moderation_state` columns + `trust_safety_settings` + notification-type additions    |
| `docs/architecture/edge-functions.md`                                             | ~18 new edge functions (guest / reporter / super-admin / appeals / cron)                                |
| `docs/architecture/routing.md`                                                    | `/report`, `/account/reports`, `/admin/trust-safety[/:reportId]`, host Policy & Safety settings section |
| `docs/architecture/validation-and-env.md`                                         | `TRUST_SAFETY_TEAM_EMAIL`, feature-flag vars                                                            |
| `docs/architecture/roadmap.md`                                                    | Move from gap → in-progress/shipped                                                                     |
| `docs/archive/operations/scheduled-jobs-and-testing.md`                           | `trust-safety-sla-cron`, autoflag, retention cron                                                       |
| `docs/archive/operations/migration-runbook.md`                                    | Migration order for report tables + `moderation_state` backfill                                         |
| `docs/archive/operations/trust-safety-policy.md`                                  | **New** — retention, redaction, legal notes                                                             |
| `docs/guides/routes/admin/trust-safety.md`                                        | **New** operator + appeals guide                                                                        |
| `docs/guides/routes/account/reports.md`                                           | **New** reporter tracker guide                                                                          |
| `docs/guides/routes/properties.md` · host public page guide · chat/messages guide | "Report …" entry points                                                                                 |
| Org + property settings route guides                                              | Policy & Safety section, appeal flow                                                                    |
| `docs/guides/routes/sd-form.md` · `guest-review.md`                               | Post-stay report link (if built)                                                                        |
| `.cursor/rules/admin-auth.mdc`                                                    | New `serveSuperAdmin` endpoints                                                                         |
| `docs/guides/testing/trust-safety-manual.md`                                      | **New** manual QA script                                                                                |
| `TermsPage.tsx` / `PrivacyPage.tsx` content                                       | Reporting + enforcement + retention + appeal policy                                                     |

## Remaining open questions

1. **Retention numbers** (Decision 10) need explicit legal sign-off before Phase 1 migrations ship — the plan assumes 24 months (reports/evidence) / 5 years (audit).
2. **"Block this host"** semantics — confirm whether it also blocks the host from appearing in that guest's search results, or only blocks messaging/inquiries (plan assumes messaging/inquiries only).
