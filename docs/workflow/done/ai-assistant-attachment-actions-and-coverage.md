---
title: 'AI Assistant — Full Dashboard Parity + Attachment Actions'
status: for testing
tags: [workflow, planned, ai, safety]
updated: 2026-09-03
stage: done
kind: plan
---

# AI Assistant — Full Dashboard Parity + Attachment Actions

## Goal

Make the **AI Dashboard Assistant** a complete operational front door for hosts: anything they can do manually in the host dashboard (org / property / parking), they can instruct via chat — with the existing safety model (RBAC, Tier 0/1/2, external-send, grounding, never-build list) as the ceiling.

**North star (host-approved 2026-09-02):** hosts should not need to do routine manual dashboard work. Chat asks clarifying questions when ambiguous, then proposes confirmed actions that run the **same** backend paths as the UI.

This is a **phased backlog**, not one PR. Ship behind the existing kill switch + plan gate. Every phase updates `docs/architecture/ai-dashboard-assistant.md` in the same change.

Authoritative catalog today: [`docs/architecture/ai-dashboard-assistant.md`](../../architecture/ai-dashboard-assistant.md) (~99 tools). Prior coverage ship: [`../done/ai-dashboard-assistant-v2-full-coverage.md`](../done/ai-dashboard-assistant-v2-full-coverage.md).

---

## Host decisions (locked 2026-09-02)

| #   | Question                                  | Decision                                                                                                                                                                                                                                                   |
| --- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Which file/image actions?                 | **Everything** host-dashboard upload surfaces support — not only GAF/IDs/receipts. Full inventory in Part D.                                                                                                                                               |
| 2   | Re-attach vs later apply by path?         | **Recommended:** allow apply from a prior message in the **same conversation** by stored `attachmentPath` (path must still exist + belong to this user/org/conversation). Gemini vision stays same-turn only; apply does not need re-vision.               |
| 3   | Overwrite existing booking/settings docs? | **Warn + confirm** (show current file label if present; Confirm replaces).                                                                                                                                                                                 |
| 4   | Apply + mark GAF/pet complete?            | **Smart compound actions** when intent is clear (one Tier-2 confirm describing both steps). If ambiguous, ask then propose. Still run real upload + orchestrator rules — never skip URL requirements.                                                      |
| 5   | Workflow emails?                          | **All** `send-booking-workflow-email` kinds: `booking_acknowledgement`, `gaf_request`, `pet_request`, `ready_for_checkin`, `sd_refund_form_request`. All **external_send** + Tier 2. Respect Free cooldown / plan / prerequisites already on the endpoint. |

---

## Scope

### In

1. Full **file/image upload inventory** across host dashboard edge functions.
2. Design for **chat attachment → apply to any supported host asset slot**.
3. **Dashboard ↔ assistant parity matrix** for all host modules (reads + writes).
4. Phased delivery toward full parity with safety-first compound flows.
5. Process so **new** dashboard features ship with assistant coverage or an explicit exclusion.

### Out

- Super-admin `/admin/*` (assistant is host-facing).
- Guest portal / guest-authenticated identity.
- Replacing visual canvases (Polotno, Remotion, full page-editor section editing) with free-text chat — chat may **draft / publish / upload assets / open deep links**, not paint pixels.
- Irreversible destroyers on the never-build list unless a **separate** multi-step design is approved later.

---

## Part A — Current attachment support (verified)

| Layer                                            | Today         | Detail                                                                 |
| ------------------------------------------------ | ------------- | ---------------------------------------------------------------------- |
| Composer Photo / File                            | ✅            | JPEG/PNG/WebP/PDF, max 3 × 4 MB                                        |
| Persist + Gemini vision                          | ✅            | `ai-assistant-attachments`; **vision same-turn only**                  |
| Pin booking / modules                            | ✅            | `attachedContext[]`                                                    |
| Read booking documents                           | ✅            | `get_booking` / `get_booking_documents`                                |
| **Apply chat file → booking / settings / media** | ✅ Phases 1–3 | Booking assets, media/branding, verification/listing auth, GCash stage |
| **Mark GAF/pet complete after chat upload**      | ✅ Phase 1    | Compound `alsoMarkComplete` on approved GAF/pet                        |
| **Send workflow emails from chat**               | ✅ Phase 1    | `propose_send_workflow_email` (external_send)                          |
| **Inbox reply attachments**                      | ✅ Phase 4    | Optional `attachmentPaths` on web inbox send                           |

Paperclip today = **see and discuss**. Goal = **see, confirm, and execute** the same uploads/actions as the dashboard.

---

## Part B — Safety doctrine (non-negotiable)

Carry forward from v1/v2; extend for parity:

1. **Same backend, same RBAC** — tools call shared services / existing edge logic; never a weaker chat-only path.
2. **Independent JWT RBAC** on every tool — never trust model args for permission.
3. **Tier 0 / 1 / 2 + external_send** — file applies, email sends, payment-adjacent assets, verification proofs = Tier 2 (or external_send when guest/PMO/public facing).
4. **Confirm freezes payload** — prompt injection cannot change `assetType` / `bookingId` after Confirm.
5. **Attachment path prefix check** — `{orgId}/{userId}/{conversationId}/…` only. No free-form `https://` “attachments”.
6. **Warn + confirm on overwrite**.
7. **Grounded refusals** — wrong status, missing prerequisite, no permission, never-build → explain + suggest valid next step or deep link. Never invent success.
8. **Never-build list stays catalog-enforced** (tool not registered). Soften only with an explicit new design review (e.g. multi-step typed confirm for delete property).
9. **Validators before settings writes** — payment methods, email automations, doc requirements: build/share validators first, then tools (same rule as v2 Phase 4).
10. **OTP-sensitive settings** — if the UI requires email OTP, chat must require the same OTP flow (or deep-link to UI). Do not bypass.

---

## Part C — Parity principle

| Host can… in UI                                  | Assistant must…                                                                                                                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read data                                        | Read tool or knowledge-base grounded answer                                                                                                                                 |
| Write / upload / send                            | Propose tool → Confirm (or Tier-1 only when already classified safe)                                                                                                        |
| Multi-step wizard (import CSV, full canvas edit) | Either **guided chat + confirm per step** that calls the same APIs, or **deep-link + pin context** with an honest “finish in UI” for pixel-level work — never silent “done” |
| Destructive / irreversible                       | Never-build **or** bespoke multi-confirm (not generic Tier 2 alone)                                                                                                         |

**“Smart” means:** resolve booking from pins/search; infer `assetType` when unambiguous (“this is the approved GAF”); ask when multiple slots fit; compound “upload + mark complete + send acknowledgement” only when prerequisites will pass; otherwise stop and explain the blocker.

---

## Part D — Complete host file / image inventory

Every host-facing upload edge function. Guest-only uploads (`upload-guest-*`) stay out of the host assistant.

### D.1 Booking documents — `upload-booking-asset`

| `assetType`                     | Typical use             | Assistant apply                        |
| ------------------------------- | ----------------------- | -------------------------------------- |
| `approved_gaf`                  | Manual approved GAF PDF | Phase 1 + compound mark-complete       |
| `approved_pet`                  | Approved pet PDF        | Phase 1 + compound mark-complete       |
| `valid_id` … `guest5_valid_id`  | Guest IDs               | Phase 1                                |
| `payment_receipt`               | Downpayment receipt     | Phase 1                                |
| `guest_balance_payment_receipt` | Balance settlement      | Phase 1                                |
| `parking_endorsement`           | Parking endorsement     | Phase 1                                |
| `parking_payment_receipt`       | Parking payment         | Phase 1                                |
| `sd_refund_receipt`             | SD refund proof         | Phase 1                                |
| `pet_vaccination` / `pet_image` | Pet docs                | Phase 1 (may revert to PENDING_REVIEW) |

Must reuse shared upload helper (AI validation, revert rules, storage keys) — no duplicate logic.

### D.2 Property app settings — `upload-app-settings-asset`

| `assetType`                                            | Notes                                                  | Assistant                                                    |
| ------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------ |
| `gcash_qr`                                             | Stages URL; commit via OTP-gated payment methods PATCH | Apply → stage; commit only with OTP-parity tool or deep-link |
| `gaf_unit_owner_signature`                             | Persists signature URL                                 | Tier 2 apply                                                 |
| `external_review_image` / `external_review_stay_photo` | Needs reviewId (+ index)                               | Tier 2 apply with review context                             |

### D.3 Property / parking media

| Endpoint                   | What                   | Assistant                             |
| -------------------------- | ---------------------- | ------------------------------------- |
| `upload-property-media`    | Gallery images/videos  | Tier 2 apply (+ optional set primary) |
| `upload-parking-media`     | Parking gallery        | Tier 2 apply                          |
| `upload-development-media` | Super-admin / platform | **Out** (not host assistant)          |

### D.4 Templates — `upload-property-template-asset`

| `assetType`                      | Assistant                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `section_image` / `inline_image` | Tier 2 apply with `templateKey` when standard templates support it; long-form HTML body edit stays excluded |

### D.5 Org branding / verification / listing auth

| Endpoint                             | Types                                                                   | Assistant                                                         |
| ------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `upload-org-settings-asset`          | `team_logo`                                                             | Tier 2 apply (+ profile update if needed)                         |
| `upload-org-verification-asset`      | `valid_id`, `social_proof`, `selfie_with_id`, `platform_admin_proof`, … | Tier 2 apply; **submit** verification is a separate compound tool |
| `upload-listing-authorization-asset` | `proof`, `additional_proof`, `azure_pmo_confirmation`                   | Tier 2 apply per listing                                          |

### D.6 Parking settings — `upload-parking-settings-asset`

| `assetType` | Notes                                                |
| ----------- | ---------------------------------------------------- |
| `gcash_qr`  | Same OTP / payment-method commit pattern as property |

### D.7 Inbox & support

| Endpoint                           | Assistant                                                                   |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `upload-inbox-chat-asset`          | Extend send-reply to optional attachment(s) from chat files (external_send) |
| `upload-support-ticket-attachment` | Attach evidence when creating/updating tickets                              |

### D.8 Marketing media

| Surface                                | Assistant                                                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Marketing image/video upload + publish | Apply media to a template **or** publish with attached image URL via existing publish path; music **import from arbitrary URL** stays excluded (prompt-injection); Jamendo search already exists |
| CSV `import-parse-file`                | **Wizard via chat is high blast radius** — Phase late: parse → preview confirm → commit, or deep-link to Import UI with file pre-staged if feasible                                              |

### D.9 Composer limits vs product limits

- Composer remains ≤4 MB × 3 for chat UX.
- Apply re-validates with `assertWithinUploadLimit` for the target kind.
- If file too large for a slot, refuse with clear message (upload in UI or compress).

---

## Part E — Dashboard module parity matrix (host)

Legend: **R** read · **W** write · **U** upload/apply · **S** send/external · **P** partial today · **→** planned in this backlog · **X** never / deep-link only

| Module                                     | Today         | Target                                                                                           |
| ------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------ |
| Bookings list/detail/status/journey/cancel | R+W           | + **U** all booking assets + **S** all workflow emails + compound mark-complete                  |
| Admin create / edit booking fields         | —             | → create + allowlisted field patches (overlap checks); sensitive guest edits follow revert rules |
| Finance                                    | R + create    | → update/void/complete if UI supports                                                            |
| Maintenance                                | R + create    | → update status/complete/delete if UI supports                                                   |
| Org profile / team                         | R+W           | + **U** logo; verification **U** + submit compound                                               |
| Property settings allowlisted              | R+W           | keep; expand after validators                                                                    |
| Property payment methods / GCash QR        | —             | → **U** stage + OTP commit parity                                                                |
| Property media / reviews images            | —             | → **U**                                                                                          |
| Email automations / doc requirements       | —             | → after validators                                                                               |
| Templates (images)                         | —             | → **U**; HTML body = X or deep-link                                                              |
| Public pages / Showcase / Stay guide       | pin only      | → R publish state; **W** publish/unpublish; section edits = deep-link                            |
| Parking bookings                           | R+W           | keep; broadcast fan-out = X until dedicated design                                               |
| Parking settings / media / QR              | —             | → **U** + settings with validators/OTP                                                           |
| Pricing                                    | R+W single    | keep; bulk = dedicated diff preview phase                                                        |
| Inbox                                      | R + text send | → **S** + attachments; auto-reply mode = X                                                       |
| Marketing                                  | R + publish   | → **U** media into publish flow; canvas edit = deep-link                                         |
| Notifications prefs / push                 | pin           | → R + W prefs                                                                                    |
| Announcements                              | —             | → R                                                                                              |
| Help & Support tickets                     | pin           | → R + create + **U** attachments                                                                 |
| Plans / billing                            | —             | → R plan/entitlements; checkout/payment-method change = X or OTP deep-link                       |
| Channel / iCal sync                        | —             | → R status + safe sync trigger                                                                   |
| Import CSV                                 | —             | → late guided wizard or deep-link                                                                |
| Telegram bots/settings                     | —             | → R; writes with OTP/sensitive parity or deep-link                                               |

---

## Part F — Attachment apply architecture

### F.1 Generic pattern

One family of propose tools (or one tool with a `target` discriminator), all Tier 2:

```
propose_apply_host_attachment
  attachmentPath: string   # from this conversation’s stored attachments
  target:
    | { kind: 'booking_asset', bookingId, assetType }
    | { kind: 'app_settings_asset', propertyId, assetType, reviewId?, photoIndex? }
    | { kind: 'property_media', propertyId }
    | { kind: 'parking_media', parkingId }
    | { kind: 'parking_settings_asset', parkingId, assetType }
    | { kind: 'org_logo', orgId }
    | { kind: 'org_verification', orgId, assetType }
    | { kind: 'listing_authorization', listingKind, listingId, assetType }
    | { kind: 'template_asset', propertyId, assetType, templateKey? }
    | { kind: 'inbox_outbound', threadId }      # used with send
    | { kind: 'support_ticket', ticketId? }     # create or attach
```

v1 implementation may ship as **several tools** (`propose_apply_booking_attachment`, …) sharing one `_shared/assistantAttachmentApply.ts` — clearer risk copy; merge later if needed.

### F.2 Recommended apply-from-history

- Persist `path` on user message `attachments` (already).
- Tool resolves path → download from `ai-assistant-attachments` → run shared upload.
- If object missing, ask host to re-attach.
- Vision for “what is this file?” still needs same-turn attach **or** a small “describe attachment” read that loads bytes server-side (optional Phase 1.5).

### F.3 Compound actions (smart)

Examples when intent + prerequisites clear:

| Compound                                  | Steps                                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| Apply approved GAF + mark complete        | upload `approved_gaf` → `propose_transition_booking` with `document_completion_target` |
| Apply balance receipt + proceed RFCI→RFCO | upload receipt → transition with settlement payload fields if provided                 |
| Apply verification ID + submit base tier  | upload assets → `propose_submit_org_verification` when all required paths present      |

Confirm card must list **every** step. Executor runs ordered; on mid-failure, report appliedEffects (same pattern as Tier-1 abort disclosure).

### F.4 Workflow emails

`propose_send_workflow_email({ bookingId, kind })`:

- All five kinds.
- `EXTERNAL_SEND_TOOL_NAMES` + destructive Send UI.
- Call shared send helper used by `send-booking-workflow-email` (extract if needed).
- Surface prerequisite failures (missing GAF PDF, Free cooldown, etc.) as grounded errors before/at confirm.

---

## Part G — Phased delivery

### Phase 0 — Plan accepted (this revision)

- [x] Decisions 1–5 locked.
- [x] Move to `in-progress/` via `/workflow-start` when coding starts.

### Phase 1 — Booking asset apply + compounds + workflow emails (P0)

Highest host value; closes the GAF story end-to-end.

- [x] Extract `_shared/bookingAssetUpload.ts` from `upload-booking-asset`; refactor endpoint.
- [x] `propose_apply_booking_attachment` — **all** D.1 `assetType`s; warn+confirm overwrite; path allowlist.
- [x] Compound: apply GAF/pet + mark complete when asked.
- [x] `propose_send_workflow_email` — all kinds, external_send.
- [x] Prompt + tool labels + manual tests + architecture doc.
- [x] Optional: server-side path notes in conversation summary for follow-up turns.

### Phase 2 — Media & branding uploads (P0/P1)

- [x] Property + parking media apply.
- [x] Org logo apply.
- [x] GAF unit owner signature apply.
- [x] External review image/stay photo apply.
- [x] Template section/inline image apply.

### Phase 3 — Verification, listing auth, payment QR (P1)

- [x] Org verification asset apply + submit compound (`propose_apply_org_verification_attachment`, `propose_submit_org_verification`).
- [x] Listing authorization asset apply + submit (`propose_apply_listing_authorization_attachment`, `propose_submit_listing_authorization`).
- [x] GCash QR stage (`propose_stage_gcash_qr`) — OTP-parity commit still required in Payment settings (no assistant bypass).

### Phase 4 — Inbox attachments + support tickets + announcements + plans read (P1)

- [x] Inbox send with optional chat attachments (web; Meta refuses attachments clearly).
- [x] Ticket list/get/create + attachments.
- [x] Announcements read.
- [x] Plan/entitlement snapshot read.

### Phase 5 — Remaining dashboard writes (P1/P2)

- [x] Admin create booking + allowlisted edits — **deep-link only** (`guide_create_booking`); field edits excluded (no safe shared write path).
- [x] Finance/maintenance update + delete parity (`propose_update_*` / `propose_delete_*`).
- [ ] Property/parking settings fields currently blocked — **deferred** → [`../planned/ai-assistant-settings-validators.md`](../planned/ai-assistant-settings-validators.md)
- [ ] Email automation toggles / doc requirements — **deferred** → [`../planned/ai-assistant-settings-validators.md`](../planned/ai-assistant-settings-validators.md)
- [x] Public pages template status + template key update (section edits remain deep-link).
- [x] Notifications prefs — `get_notification_preferences` + `guide_notification_settings` (read + deep-link; no per-event API).
- [x] Channel sync status + safe sync now.
- [x] Telegram read + OTP-safe deep-link (`get_telegram_notification_settings` / `guide_telegram_settings`; no credential writes).

### Phase 6 — Hard wizards (P2)

- [x] Import CSV — `guide_import_bookings` deep-link; parse/preview/commit stay in Import UI (no chat auto-commit).
- [ ] Bulk pricing with explicit diff preview — **deferred** → [`../planned/ai-assistant-bulk-pricing-chat.md`](../planned/ai-assistant-bulk-pricing-chat.md)
- [ ] Parking broadcast fan-out — **deferred** → [`../planned/ai-assistant-parking-broadcast-chat.md`](../planned/ai-assistant-parking-broadcast-chat.md)
- [x] Marketing: `propose_publish_to_meta` optional `attachmentPath`; canvas edit stays deep-link.

### Phase 7 — Continuous parity process

- [x] Rule/checklist: new host dashboard write → assistant tool **or** documented exclusion + KB how-to in the same PR (`.cursor/rules/ai-assistant-parity.mdc` + rules README).
- [x] Keep architecture doc + knowledge-base sync current (called out in the rule; re-run `bun run sync:ai-knowledge-base` when Host-facing knowledge changes).

---

## Explicit exclusions (remain unless redesign approved)

| Action                                                   | Why                            |
| -------------------------------------------------------- | ------------------------------ |
| Delete org / property / ownership transfer               | Irreversible cascade           |
| Super-admin verification approve/reject                  | Not host-facing                |
| Payment provider secrets / raw PayMongo credential edits | Needs dedicated OTP/confirm UX |
| Inbox `auto_reply_mode = send`                           | Standing autonomous send       |
| Marketing music import from arbitrary URL                | Prompt-injection fetch risk    |
| Guest portal actions                                     | Wrong identity                 |
| Pixel-level Polotno/Remotion/page-section editing        | Wrong medium — deep-link       |
| `upload-development-media`                               | Platform/super-admin           |

---

## Docs to update (per phase)

| Doc                                           | When                  |
| --------------------------------------------- | --------------------- |
| `docs/architecture/ai-dashboard-assistant.md` | Every new tool / tier |

- [`docs/workflow/done/ai-dashboard-assistant-features.md`](../done/ai-dashboard-assistant-features.md) — Host-facing list (updated 2026-09-02)
  | `docs/guides/testing/ai-dashboard-assistant-manual.md` | Per phase flows |
  | Route guides (bookings-detail, settings, inbox, …) | Host-facing knowledge when behavior changes |
  | `docs/architecture/edge-functions.md` / `PROJECT.md` | Shared helpers / new tools |
  | This plan → `for-testing/` | Manual QA §11–13 |

---

## Implementation kickoff order (Phase 1 files)

1. `supabase/functions/_shared/bookingAssetUpload.ts` (+ refactor `upload-booking-asset/index.ts`)
2. `supabase/functions/_shared/assistantAttachmentApply.ts` (path verify + download)
3. `dashboardAssistantTools.ts` — apply + workflow email tools
4. `dashboardAssistantRiskClassifier.ts` — Tier 2 + EXTERNAL_SEND
5. Confirm executor + `ActionConfirmationBlock` copy for overwrite / compounds / email Send
6. System prompt policy for attachments + workflow emails
7. `ui/.../assistantToolLabels.ts` + manual test guide + architecture doc

---

## Related

- [`docs/architecture/ai-dashboard-assistant.md`](../../architecture/ai-dashboard-assistant.md)
- [`../done/ai-dashboard-assistant-v2-full-coverage.md`](../done/ai-dashboard-assistant-v2-full-coverage.md)
- `.cursor/rules/booking-workflow.mdc`
- `.cursor/rules/ai-assistant-parity.mdc`
- All `supabase/functions/upload-*/index.ts` host endpoints listed in Part D

---

## Completion audit (2026-09-02)

**Code scope: closed** — moved to [`../for-testing/`](../for-testing/) for manual QA (manual guide §11–13).

| Requirement (Parts D–G)                                     | Evidence                                                                                                                                                                    | Status                                                                                                                                                              |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D.1 all booking `assetType`s + shared helper                | `bookingAssetUpload.ts`, `dashboardAssistantBookingAssetTools.ts`                                                                                                           | ✅                                                                                                                                                                  |
| D.2–D.5 app settings / media / templates / org verification | `dashboardAssistantHostMediaTools.ts`, `VerificationTools.ts`                                                                                                               | ✅                                                                                                                                                                  |
| D.6 parking GCash QR stage                                  | `gcashQrStageUpload.ts` scope `parking`                                                                                                                                     | ✅                                                                                                                                                                  |
| D.7 inbox + support attachments                             | `inboxSendReplyAction.ts`, `supportTicketCreate.ts`                                                                                                                         | ✅ (create only; ticket reply excluded)                                                                                                                             |
| D.8 marketing publish + import                              | `attachmentPath` on `propose_publish_to_meta`; `guide_import_bookings`                                                                                                      | ✅                                                                                                                                                                  |
| F.3 compound GAF/pet mark-complete                          | `alsoMarkComplete` in booking asset tools                                                                                                                                   | ✅                                                                                                                                                                  |
| F.4 all five workflow email kinds                           | `propose_send_workflow_email` + `EXTERNAL_SEND_TOOL_NAMES`                                                                                                                  | ✅                                                                                                                                                                  |
| Part B path allowlist + overwrite warn                      | `assistantAttachmentApply.test.ts` (4 pass); propose summaries                                                                                                              | ✅                                                                                                                                                                  |
| Phase 5/6 shippable items                                   | guidance tools, finance/maintenance, channel sync, public templates                                                                                                         | ✅                                                                                                                                                                  |
| Phase 7 parity rule                                         | `.cursor/rules/ai-assistant-parity.mdc`                                                                                                                                     | ✅                                                                                                                                                                  |
| **Deferred (formal backlog)**                               | [`../planned/`](../planned/) — settings validators, bulk pricing diff, parking broadcast                                                                                    | 📋 tracked; out of attachment-parity code scope                                                                                                                     |
| **Automated catalog + integration**                         | 37 tests (`bun run test:assistant-parity`) — D.2–D.5 media/settings/verification execute + compound GAF, inbox, support, Meta publish                                       | ✅ local Supabase 2026-09-02                                                                                                                                        |
| **Playwright confirm-card UI (§11–13 subset)**              | 8 tests (`bun run test:e2e:assistant`) — Send/Confirm, overwrite, inbox, Meta publish                                                                                       | ✅ mocked 2026-09-02                                                                                                                                                |
| **Live Gemini browser smoke (optional)**                    | 11 tests (`bun run test:e2e:assistant:live`) — §12.3, §13.2, §13.1, §11.3, §11.4, §11.2, §11.1, §12.1 Meta refuse, §12.1 web Send, §13.3 Meta publish, §12.2 support ticket | ✅ 10/10 live flows green 2026-09-03 (local override `GEMINI_MODEL_OVERRIDE_DASHBOARD_ASSISTANT=gemini-3.5-flash-lite` when `gemini-2.5-flash` free-tier exhausted) |
| **Manual QA (live Gemini + attachment execute in browser)** | `ai-dashboard-assistant-manual.md` §11–13 full flows — **10/10 Live pass**                                                                                                  | ✅ signed off via live Playwright §11–13                                                                                                                            |

**Goal `/goal`:** do **not** mark complete until §11–13 manual QA passes. Deferred items are formally tracked in `planned/` — not blockers for `/workflow-done` once QA passes.

### Manual QA sign-off (§11–13) — human browser + Gemini

Prerequisites: `./dev.sh`, `GEMINI_API_KEY` in `supabase/.env.local`, assistant enabled (platform + org), signed-in org owner on `kame-home`. Full steps: [`ai-dashboard-assistant-manual.md`](../../guides/testing/ai-dashboard-assistant-manual.md) §11–13.

| Manual § | Flow                                    | Automated backstop                                                           | Live pass                  |
| -------- | --------------------------------------- | ---------------------------------------------------------------------------- | -------------------------- |
| 11.1     | Apply GAF + compound mark-complete      | `§11.1 compound` integration test; live browser §11.1                        | ✅ live browser 2026-09-02 |
| 11.2     | Workflow email external **Send**        | Playwright §11.2; kind catalog test; live browser §11.2                      | ✅ live browser 2026-09-02 |
| 11.3     | Org logo apply                          | `executeApplyOrgLogo` integration; live Gemini §11.3 API; live browser §11.3 | ✅ live browser 2026-09-02 |
| 11.4     | GCash QR stage (OTP not bypassed)       | GCash stage + OTP propose tests; Playwright §11.4; live browser §11.4        | ✅ live browser 2026-09-02 |
| 12.1     | Web inbox attachment send; Meta refusal | inbox propose+execute; Meta refuse; Playwright §12.1                         | ✅ live browser 2026-09-03 |
| 12.2     | Support ticket + attachment             | execute create integration; Playwright §12.2                                 | ✅ live browser 2026-09-03 |
| 12.3     | Announcements + plan read               | integration read smoke; live Gemini §12.3 API; live browser §12.3            | ✅ live browser 2026-09-02 |
| 13.1     | Notifications + Telegram deep-link      | telegram/notification guidance test; live browser §13.1                      | ✅ live browser 2026-09-02 |
| 13.2     | Create booking + import deep-link       | `guide_import_bookings` integration; live Gemini §13.2; live browser §13.2   | ✅ live browser 2026-09-02 |
| 13.3     | Meta publish from chat attachment       | Meta propose+execute staging; Playwright §13.3                               | ✅ live browser 2026-09-03 |

**Live browser progress (2026-09-03):** **10 / 10** §11–13 flows passed with real Gemini in-panel. Remaining free-tier `gemini-2.5-flash` quota was bypassed locally via `GEMINI_MODEL_OVERRIDE_DASHBOARD_ASSISTANT=gemini-3.5-flash-lite` (rebuild `functions-serve.env` + restart `functions serve`). Product fixes landed with that run: omit `thinkingBudget: 0`, echo Gemini `thoughtSignature` on multi-round tool calls, Meta attachment refuse when the host attached files this turn even if the model omitted `attachmentPath`.

When every **Live pass** box is checked, run `/workflow-done ai-assistant-attachment-actions-and-coverage` and mark the `/goal` complete.
