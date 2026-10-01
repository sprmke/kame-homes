---
title: 'AI dashboard assistant — manual test flows'
status: active
tags: [guides, testing, ai]
updated: 2026-08-27
---

# AI dashboard assistant — step-by-step manual testing

Manual E2E for the chat assistant embedded in the admin dashboard (org/property/parking admin views).

**Feature summary:** [`docs/workflow/done/ai-dashboard-assistant-features.md`](../../workflow/done/ai-dashboard-assistant-features.md)
**Build log / architecture:** [`docs/workflow/done/ai-platform-hardening-handoff.md`](../../workflow/done/ai-platform-hardening-handoff.md)
**Original design plan:** [`docs/workflow/done/ai-dashboard-assistant.md`](../../workflow/done/ai-dashboard-assistant.md)

This flow has **never been run through an actual browser** as of 2026-08-15 — every check so far was curl + real Gemini calls + DB queries against the edge functions directly (§8 below has the exact commands). **Run §1–§7 in a real browser before trusting the UI.**

---

## 0. What you are proving

| #   | Capability                        | Pass criteria                                                                                                                                                                                                                       |
| --- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Launcher visibility               | Floating button appears only when both kill switches are on for the org (and property, if scoped); hidden on `/admin/*`                                                                                                             |
| 2   | Tier-0 read                       | A plain question returns a grounded answer with no confirmation UI                                                                                                                                                                  |
| 3   | Tier-1 auto-execute               | A safe forward status move executes immediately with a "done automatically" card                                                                                                                                                    |
| 4   | Tier-2 propose → confirm          | A risky action (cancel, refund finalize, price change, override) shows Confirm/Cancel and only runs after Confirm                                                                                                                   |
| 5   | Tier-2 deny                       | Clicking Cancel leaves the booking untouched and marks the card "cancelled"                                                                                                                                                         |
| 6   | Tier-2 idempotency                | Confirming an already-resolved action is a clean no-op, never a double-execute                                                                                                                                                      |
| 7   | Tier-2 expiry                     | A proposal older than 15 minutes can no longer be confirmed                                                                                                                                                                         |
| 8   | Permission re-check               | A low-permission (**Read Only** template) property member cannot get a write action to execute, even if the model tries                                                                                                             |
| 9   | Cross-scope escalation            | Asking about a _different_ booking/property than the one currently open always requires confirmation                                                                                                                                |
| 10  | Bulk escalation                   | A request that bundles 2+ write actions in one turn always requires confirmation, regardless of each action's own tier                                                                                                              |
| 11  | Booking-detail audit trail        | Actions taken on a booking show up in its "Actions taken by AI assistant" card, newest first                                                                                                                                        |
| 12  | Org/global kill switch            | Turning either off removes the launcher; turning back on restores it                                                                                                                                                                |
| 13  | Per-property opt-out              | Disabling the assistant on one property hides the launcher only there, not org-wide                                                                                                                                                 |
| 14  | Quota                             | Hitting the daily message limit shows the upgrade message instead of erroring                                                                                                                                                       |
| 15  | Mobile 375px                      | Launcher + slide-over panel usable at iPhone SE width, 44×44px targets                                                                                                                                                              |
| 16  | Starter prompts                   | Empty chat shows a Questions / Actions switcher (not page tabs), 5 items for the active side — randomized with no pinned context, ranked by module once context is pinned (merged fairly when multiple modules are pinned)          |
| 16b | Mid-conversation pill suggestions | Each pinned context chip opens a compact Questions / Actions popover with that module's ranked prompts; tapping sends a message carrying the pinned context; X still removes the pin                                                |
| 17  | Attachments + booking pin         | Paperclip attaches JPEG/PNG/WebP/PDF; calendar pins a stay; send works with files and no text                                                                                                                                       |
| 18  | Speech-to-text                    | Mic fills the composer on Chrome/Safari/Edge (HTTPS); primary listening state; tap again to stop; send clears listening                                                                                                             |
| 19  | Turn progress + streaming         | While waiting: phased/tool checklist (not bare dots); text answer streams in before cards finalize; multi-tool turns show “What I did” timeline                                                                                     |
| 20  | Cancel + regenerate               | Stop icon aborts in-flight turn; cancel before Tier-1 commit leaves no app writes; partial commit shows applied-changes banner; Regenerate on last assistant message re-runs prior text turn (not available after attachment sends) |
| 21  | Usage meter                       | Panel header shows `today / daily limit` pill; increments after a successful send                                                                                                                                                   |

---

## 1. Prerequisites

```bash
./dev.sh   # full stack: Docker + local Supabase + UI
```

- A signed-in host account that **owns** (or is org-admin of) at least one organization with at least one property that has bookings in several statuses.
- `GEMINI_API_KEYS` (or `GEMINI_API_KEY`) set in `supabase/.env.local` — real Gemini calls are required, there is no mock mode.
- Super-admin access (`ADMIN_ALLOWED_EMAILS`) to toggle the platform-wide switch.

### 1.1 Turn the assistant on

1. Sign in as super-admin → `/admin/settings` → **AI dashboard assistant** card → toggle **Enabled**.
2. Sign in as the org owner → **Settings → AI assistant** section → toggle **Assistant enabled** → **Save assistant settings**.
3. Leave the per-property disable list and quota limits at their defaults for the first pass.

---

## 2. Launcher visibility (#1, #12, #13)

1. With both switches on, open any org/property/parking admin page. Expect a floating **Sparkles** button, bottom-right.
2. Navigate to `/admin/*` (super-admin pages). Expect the button **gone**.
3. Turn the **org** switch off (Settings → AI assistant). Reload any admin page. Expect the button gone.
4. Turn the org switch back on, then add the current property to **Disable on specific properties**. Reload that property's pages → button gone; switch to a different property in the same org → button present.
5. Turn the **platform-wide** switch off (super-admin). Expect the button gone everywhere, even with the org switch on. Turn it back on before continuing.

### 2.1 Starter prompts (#16)

1. Open the assistant on a **new** conversation. Expect the starter cluster **centered** in the panel: a teal **Questions / Actions** mode switch (not a page tab bar) and **5** tappable prompt cards, ≥ 44×44px.
2. Switch to **Actions** — list swaps to 5 action starters. Tap one — it should send as a chat message (not only fill the composer). Starters can mention parking claim/decline, inbox reply, Meta publish, or a weekend rate override as well as booking moves.
3. Open **History** (clock icon). Expect past conversations only (no Questions/Actions switcher). Titles wrap inside the panel (no overflow). Long IDs are shortened. Rows group by day; search filters the list. Trash → confirm → the row is gone. Deleting the open chat starts a new one.
4. Tap **New conversation** (plus). Expect a **different** set of 5 questions and 5 actions (random, so a rare duplicate set is OK).
5. **Pin one module's context** (e.g. a booking) via the bookmark picker before sending anything. Expect the starter cluster to refresh to that module's ranked prompts (e.g. booking prompts like "What's the status of this booking?" / "Move this booking to the next status") — no longer random, and stable across re-renders until the pin changes.
6. **Pin a second module** on top (e.g. a property, then a finance item). Expect the list to mix prompts from all pinned modules — each pinned module's top prompt should appear before any pinned module's second prompt, rather than one module dominating the list.
7. **Remove all pins.** Expect the starter cluster to fall back to the random pool from step 1.

### 2.2 Mid-conversation pill suggestions (#16b)

1. In an **existing** conversation (messages already present), pin one or more context items via the bookmark picker. Each pinned chip appears above the composer; the chip body is a button (text shifts to the primary teal on hover or while open).
2. Tap the body of a pinned chip (icon + label). Expect a compact popover anchored to the chip with a **Questions / Actions** toggle and up to 6 ranked prompts for that single module — scrollable if longer than the viewport.
3. Switch to **Actions** inside the popover. Expect the ranked action prompts for the same module. Tap one — the popover closes and the prompt is sent as a new chat message carrying the currently pinned context (the chip you tapped stays pinned).
4. Tap the **X** on a chip. Expect the chip removed and its popover gone; remaining chips still open their own popovers independently.
5. Pin two different modules (e.g. a booking and a finance item). Open each pill's popover in turn — each shows only its own module's prompts (not merged), so the host can drill into one module at a time mid-conversation.

### 2.2 Attachments + context pin (#17)

1. Open a new chat. Expect toolbar order **bookmark (pin) → paperclip → mic (when supported) → send** beside the composer (each ≥ 44×44px). The pin icon matches the page: calendar on Bookings, building on Properties, users on Team, and so on.
2. Paperclip → **Photo** — pick a JPEG/PNG/WebP. Expect a chip above the textarea. Same for **File** with a PDF.
3. Try a 5th file or a non-allowed type — expect a short error toast, no send.
4. On Bookings, calendar → search or pick a stay grouped by check-in month (guest, dates, status). On a booking detail, **This page** is listed first. Expect a chip with guest name and dates. You can pin more than one stay. Send with the chip still pinned and empty text + a file — the turn should go through.
5. Ask the assistant to check the receipt against the pinned booking. Expect it to use that booking (and `run_receipt_validation` when you ask to validate). Pins travel as `attachedContext` and do not overwrite the current page.
6. Reload the conversation from History — user bubble should still list file names (not the raw bytes).
7. Send a question — expect a left-aligned **card bubble** with sparkles and bouncing dots (not a bare “Thinking…” line). Opening History must not show that bubble.
8. Type several lines in the composer (Shift+Enter) — text stays **left-aligned and full-width** above pin / attach / mic / send, grows up to **10 lines**, then scrolls. Enter still sends.

### 2.3 Speech-to-text (#18)

1. In Chrome or Safari on HTTPS (or localhost), open the assistant — expect a **mic** icon after paperclip.
2. Tap mic — allow microphone if prompted. Composer shows **Listening…** placeholder, primary-tint mic button, and three subtle meter bars under the icon.
3. Speak a short question; words appear while you talk (interim + final).
4. Tap mic again — listening stops; partial text stays editable.
5. Type text first, then mic — new speech appends after existing words.
6. Send — mic stops; message sends as usual.
7. Firefox or unsupported contexts — mic hidden; no broken layout.

### 2.4 Turn progress, streaming, cancel, regenerate (#19–#21)

1. Send a question that triggers tools (e.g. **"How many bookings are pending review?"**). Expect a **Working…** card with phased steps or live tool labels — not three bouncing dots. One row always shows a spinner ring (never all checks while the turn runs): after the last tool finishes, a **Reviewing results** row spins until the answer arrives. A step past 8s shows its own timer; past 30s the heading reads **Still working**.
2. On a text-heavy answer, expect prose to appear incrementally before structured cards finalize.
3. On a multi-tool turn (e.g. finance + booking lookup), expect a collapsible **What I did** timeline on the finished message and, when 2+ tools ran in one round, a **task plan** checklist.
4. While a turn is in flight, tap the composer **Stop** (square icon). Expect the wait UI to clear. On an existing thread, the conversation reloads from the server (no orphan user bubble if the turn had not finished and no Tier-1 writes were committed; if the reply had already been saved, it appears). **Tier-1 auto writes** only commit after synthesis — stopping during tools or synthesis must leave bookings/settings unchanged. Usage should not increment for a cancelled unfinished turn.
5. _(Optional hard case)_ Trigger a Tier-1 auto write (e.g. safe forward status move), then Stop during the **Applying changes** phase if visible — expect a banner listing changes already applied; booking audit should reflect partial writes.
6. After a completed text turn, hover the last assistant message — **Regenerate** appears. Tap it — the assistant reply is replaced with a new one; the user message is **not** duplicated in history. Pending Confirm cards from the prior reply are expired.
7. Send a message with an attachment, complete the turn — **Regenerate** should not be offered on that reply.
8. Open **History** while a turn is in flight and select another conversation — the in-flight turn aborts; the loaded thread is not polluted with the other reply.
9. Panel header shows a **today / daily limit** pill (e.g. `3/50`); count increments after a successful send (not after cancel of an unfinished turn).

Per-module pin (open the assistant from that page; icon ≥ 44×44px; chip appears; send a short question that should name the pinned item):

| Page                           | Expect                                                                |
| ------------------------------ | --------------------------------------------------------------------- |
| Properties / property settings | Building icon → property list; **This page** on a property admin page |
| Team                           | Users icon → members (name + email)                                   |
| Finance                        | Ticket icon → transactions grouped by month                           |
| Maintenance                    | Wrench icon → reminders                                               |
| Parking bookings               | Parking icon → parking stays by check-in month                        |
| Inbox                          | Chat icon → threads; Web / Facebook / Instagram filters               |
| Marketing                      | Template icon → templates grouped by type                             |
| Calendar / parking pricing     | Calendar icon → month grid; tapping a day pins that date              |
| Notifications                  | Bell icon → Staff / Finance / Maintenance / Marketing / Admin         |
| Public pages                   | Page icon → Stay guide                                                |
| Help & Support tickets         | Life-ring icon → tickets; **This page** on a ticket thread            |

10. Open the bookmark pin → module list first, then drill into a module. Item rows show a leading visual (guest initials, platform badge, finance amount, marketing thumb when saved, video play badge + first-scene still when available, etc.) plus a **Load more** control when the list exceeds 12 rows. **Pricing** opens a lite month grid (rates, booked, blocked) from `property-pricing` — tap a date to pin. Use the top search bar or **Cmd/Ctrl+K** for cross-module search.

### 2.5 Apply chat file onto a booking + workflow emails

1. Pin a booking in **Pending Documents** (or open its detail page). Attach an **approved GAF PDF** via paperclip → File. Ask: **"Apply this as the approved GAF and mark GAF complete."**
2. Expect a Confirm card naming the file, booking host label, **Approved GAF**, and that it will mark complete. If a GAF already exists, expect overwrite wording.
3. Confirm — expect the Files tab to show the new approved GAF and the nested GAF step complete (same rules as the workflow modal). Audit card on booking detail lists the action.
4. Attach a **valid ID** image and ask to apply it as Valid ID on the same booking — Confirm → Files tab updates; if status was past Pending Review, expect revert-to-review rules identical to admin upload.
5. Ask: **"Send the booking acknowledgement email for this booking."** Expect a destructive **Send** confirm (external_send). Confirm → email sends (or a clear prerequisite/cooldown error). Repeat for GAF request / pet / ready-for-check-in / Check-out Instructions as eligible.
6. On a follow-up message **without** re-attaching, ask to apply the earlier file by referring to it — expect the assistant to use the stored `attachmentPath` from conversation context (or ask you to re-attach if the file was removed).
7. Attach an image and ask to set it as the **organization logo** — Confirm → org logo updates.
8. Attach an image on a property settings/media context and ask to **add it to the gallery** (optionally as primary) — Confirm → media list grows.
9. Attach a GAF signature image and ask to set the **unit owner signature** — Confirm → building forms signature updates.

---

## 3. Tier 0 — read questions (#2)

1. Open the assistant panel. Ask: **"How many bookings are pending review right now?"**
2. Expect a plain-language answer with a real number (cross-check against the bookings list) — no Confirm/Cancel buttons anywhere in the response.
3. Ask: **"What does PENDING_DOCUMENTS mean?"** — expect an answer sourced from the route-guide knowledge base, not a generic LLM explanation. If this comes back empty/generic, the `ai_dashboard_assistant_knowledge_base` table is stale — re-run `bun run sync:ai-knowledge-base` (or `:dev` against hosted dev) to re-ingest the "Host-facing knowledge" sections from `docs/guides/routes/**/*.md`. This has no automatic trigger yet — re-run it manually whenever a route guide's knowledge section changes.
4. Ask about a specific booking by ID (copy one from the bookings list): **"Tell me about booking `<id>`"** — expect a `booking_card`-style rendering: guest name, status badge, dates, property, balance.
5. Ask: **"What can I do next with booking `<id>`?"** — expect the same set of transitions the booking's own Workflow panel shows.
6. Pin a **Ready for Check-out** booking and ask **"What's pending, and how much is the SD refund?"** — expect a human status (**Ready for Check-out**, never `READY_FOR_CHECKOUT`), a real pending-task sentence (not an empty pill), and the peso refund amount.
7. Ask **"What are the booked dates for this month?"** on a property that has stays — expect a table with guest names and check-in/out dates, not a header-only empty table. If the month is empty, expect a short "no booked stays" line instead of blank rows.
8. Pin a booking that has an **Approved GAF** on the Files tab and ask **"Provide the approved GAF for this booking"** — expect a file card (PDF preview), not only a booking summary. If that booking has no approved GAF, expect a short "not on file" line (the GAF request PDF may still show if it exists).
9. Pin a booking that is mid-pipeline and ask **"Guide me through this booking's remaining steps"** — expect a compact journey card with **Open**. Opening it shows a stepper whose current stage matches the booking Workflow panel. Confirming the embedded action still round-trips `dashboard-assistant-confirm` (status on the booking changes; the stepper card updates). It must **not** move more than one stage in one confirm.

---

## 4. Tier 1 — auto-executed action (#3)

1. Find a booking in **Pending Documents** with all documents already complete (or **Pending Review** ready to advance) — check its Workflow panel first so you know what a manual click would do.
2. Ask the assistant: **"Move booking `<id>` to the next status"** (or name the target status explicitly, e.g. "Ready for Check-in").
3. Expect the response to include an `action_confirmation` card already in the **"Done automatically"** state — no buttons, just a done notice.
4. Reload the booking detail page — status should already reflect the change (workflow panel + header badge).
5. Confirm the **"Actions taken by AI assistant"** card on that booking now lists this action (§7).

If the assistant instead proposes and waits for confirmation, check whether the target transition actually involves a price/deposit field or an override edge — that's correct Tier-2 behavior, not a bug (see the tier table in the feature doc).

---

## 5. Tier 2 — propose → confirm / deny / expire (#4, #5, #6, #7)

### 5.1 Confirm path

1. Ask the assistant to **cancel** a non-terminal booking: **"Cancel booking `<id>`"**.
2. Expect a card with a summary, **Confirm** and **Cancel** buttons, status "proposed" — the booking must **not** be cancelled yet. Verify on the bookings list.
3. Click **Confirm**. Expect the card to flip to a resolved state and the booking to actually show `CANCELLED` after a refresh.
4. Click **Confirm** again (or refresh and try) — expect nothing to happen a second time (no error, no double-cancel); the card should already read as resolved.

### 5.2 Deny path

1. Propose another Tier-2 action (e.g. cancel a different booking).
2. Click **Cancel** on the card instead of Confirm.
3. Expect the card to show a "cancelled — no changes made" state and the booking's actual status to be untouched.

### 5.3 Expiry (optional — needs a 15-minute wait or a DB edit)

1. Propose a Tier-2 action but don't resolve it.
2. Either wait 15 minutes, or in the local DB: `update ai_dashboard_assistant_pending_actions set expires_at = now() - interval '1 minute' where status = 'pending';`
3. Click **Confirm** on the stale card (or resend the same request). Expect a clear "this action expired" response, not a silent failure or a stale execute.

---

## 6. Guardrails (#8, #9, #10)

### 6.1 Permission re-check

1. Create (or use) a property-team member on the **Read Only** template (or a custom set without `bookings.detail.workflow:edit`).
2. Sign in as that member, open the assistant, and ask it to move or cancel a booking.
3. Expect a plain refusal ("access restricted" wording) — **never** a Confirm/Cancel card. The point is the tool executor rejects it server-side even if the model attempted the call; a card here would mean the RBAC re-check isn't wired correctly.

### 6.2 Cross-scope escalation

1. Open a booking detail page for booking **A** (so `pageContext.bookingId` = A).
2. In the assistant, ask it to move a **different** booking, **B**, that would otherwise qualify as Tier 1 (safe forward, no price change).
3. Expect it to require confirmation anyway — the mismatch between the open booking and the target booking forces Tier 2.

### 6.3 Bulk escalation

1. From a page with no specific booking open, ask the assistant to do two write actions in one message, e.g. **"Move booking `<id1>` to the next status and re-run receipt validation on booking `<id2>`"**.
2. Expect **both** actions to require confirmation, even if each individually would normally auto-execute.

---

## 7. Booking-detail audit trail (#11)

1. Open the detail page for a booking that had at least one Tier-1 or confirmed Tier-2 action taken via the assistant in this session.
2. Scroll the **Stay** tab — expect an **"Actions taken by AI assistant"** card below the booking meta card, listing each action (label, done-automatically vs. host-confirmed, timestamp), newest first.
3. Open a booking that's never had an assistant action — expect the card to be absent entirely, not an empty state.

---

## 8. Quota (#14)

1. Org Settings → AI assistant → set **Daily message limit** to `1` → Save.
2. Send one message in the assistant (uses up the day's quota).
3. Send a second message. Expect a friendly "you've hit today's message limit" response instead of an error or a hang.
4. Reset the limit back to a normal value (e.g. `50`) when done.

---

## 9. Mobile (#15)

1. Resize to 375×667 (iPhone SE) or use device emulation.
2. Confirm **Assistant** is a bottom tab (not a floating button overlapping the dock) and is at least 44×44px. Tap it — the same slide-over opens.
3. Open the panel — it should be wider than a typical `md` sheet on desktop (`sm:max-w-xl` when chat-only), composer stays one row (pin, attach, mic when supported, send) and reachable above the keyboard, Confirm/Cancel buttons are each ≥44px tall.
4. Scroll a long conversation — thread scrolls independently of the page.
5. **Canvas:** ask for a booking journey (or a table with more than 8 rows). At **375** and **768**, **Open** replaces the chat; **Back** returns to the thread with composer text still there. At **1024+**, the sheet widens, canvas is on the left, chat (~24rem) stays on the right. Suggested chips fill the composer and do not send.

---

## 10. API-level smoke test (what's actually been verified so far)

Backend execute paths for §11–13 attachment parity are covered by **`bun run test:assistant-parity`** (38 tests) and confirm-card UI by **`bun run test:e2e:assistant`** (8 tests, no Gemini). Live browser §11–13 is signed off — see [`docs/workflow/done/ai-assistant-attachment-actions-and-coverage.md`](../../workflow/done/ai-assistant-attachment-actions-and-coverage.md).

**Catalog + integration:** `bun run test:assistant-parity` (37 tests; requires local Supabase; skips integration with `SKIP_ASSISTANT_INTEGRATION=1`). Includes compound GAF apply+mark-complete, booking/org/GCash attachment execute, D.2–D.5 property/parking media + GAF signature + template + org verification/listing auth execute, web inbox attachment propose+execute, support ticket create with attachment, Meta publish from `attachmentPath` (propose + marketing row staging), overwrite warn copy, Meta inbox attachment refusal, and OTP-required GCash messaging. The integration suite normalizes agent shells that export an empty `SUPABASE_SERVICE_ROLE_KEY` or a `SUPABASE_URL` ending in `/functions/v1`.

**Live Gemini (browser, optional):** `bun run test:e2e:assistant:live` (**8 tests**; real Supabase auth + real Gemini in the assistant panel; requires `./dev.sh` or local stack, `GEMINI_API_KEY(S)` in `supabase/.env.local`, and `PLAYWRIGHT_ASSISTANT_LIVE=1`). Covers §12.3, §13.2, §13.1, §11.3, §11.4, §12.2, §11.2, §11.1. Tests run **serially** with a 35s pause between turns to stay under Gemini free-tier rate limits (~20 req/min). Still not a substitute for the full §11–13 sign-off table — §12.1 web inbox execute, §13.3 Meta publish execute, and compound GAF **Confirm→execute** still need manual or expanded live coverage.

**Playwright (mocked UI):** `bun run test:e2e:assistant` (8 tests) — confirm-card **Send** vs **Confirm**, overwrite copy, Meta refusal text, GCash OTP copy, web inbox attachment **Send**, Meta publish **Send**.

```bash
JWT=<self-minted local JWT>
ANON=<local anon key from `bun run status:supabase`>

# Enable both kill switches first (see §1.1) via
#   PATCH dashboard-assistant-global-settings   { "enabled": true }
#   PATCH dashboard-assistant-settings?org_slug=<slug>   { "enabled": true }
# and the underlying Phase-A platform gate:
#   PATCH ai-platform-global-settings   { "allowedFeatures": ["dashboard_assistant", ...] }
#   PATCH ai-platform-settings?org_slug=<slug>   { "enabled": true }

# Tier-0 read
curl -s -X POST "http://127.0.0.1:54321/functions/v1/dashboard-assistant-chat" \
  -H "apikey: $ANON" -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"orgSlug":"<slug>","pageContext":{},"message":"How many bookings are pending review right now?"}'

# Tier-0 booking journey (expect a stepper in blocks, no status change)
curl -s -X POST "http://127.0.0.1:54321/functions/v1/dashboard-assistant-chat" \
  -H "apikey: $ANON" -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"orgSlug":"<slug>","pageContext":{"bookingId":"<id>"},"message":"Guide me through this booking remaining steps"}'

# Tier-2 propose (cancel) — note the actionId in the response
curl -s -X POST "http://127.0.0.1:54321/functions/v1/dashboard-assistant-chat" \
  -H "apikey: $ANON" -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"orgSlug":"<slug>","pageContext":{"bookingId":"<id>"},"message":"Cancel booking <id> please."}'

# Confirm — repeat this call twice; the second must return alreadyResolved:true, not a double-cancel
curl -s -X POST "http://127.0.0.1:54321/functions/v1/dashboard-assistant-confirm" \
  -H "apikey: $ANON" -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"actionId":"<actionId>","confirm":true}'
```

Pass when: the Tier-0 call returns a real number matching the DB; the propose call returns `status: "proposed"` **and does not change the booking's status**; the first confirm call flips the booking to `CANCELLED`; the second confirm call returns `{"status":"executed","alreadyResolved":true}`.

---

## 11. Phases 1–3 — booking apply, workflow emails, media & verification

### 11.1 Apply booking attachment + compound mark-complete

1. Open a booking in **PENDING_DOCUMENTS** (or status where GAF upload is valid).
2. Attach an approved GAF PDF in the assistant (same conversation).
3. Ask: **"Apply this as the approved GAF and mark GAF complete."**
4. Expect Tier-2 confirm listing file name + overwrite warning if a GAF already exists + both upload and mark-complete steps.
5. After confirm, booking Files tab shows the PDF and GAF step reflects completion per workflow rules.

### 11.2 Workflow email (external send)

1. Pin a booking with prerequisites met (e.g. acknowledgement eligible).
2. Ask: **"Send the booking acknowledgement email for this stay."**
3. Expect destructive-styled **Send** confirm (not generic Confirm).
4. After confirm, guest receives email; resend within Free cooldown should surface a grounded error.

### 11.3 Org logo / property media

1. Attach a square logo PNG.
2. Ask: **"Set this as our org team logo."**
3. Confirm → org settings / emails reflect new logo.

### 11.4 GCash QR stage (OTP not bypassed)

1. Attach a GCash QR image on a property with payment settings access.
2. Ask: **"Stage this as the property GCash QR."**
3. Confirm stages the file; payment methods row is **unchanged** until Payment settings OTP commit in UI.

---

## 12. Phase 4 — inbox attachments, support tickets, announcements, plans

### 12.1 Inbox web attachment send

1. Open **Guest Inbox** on a property with a **website chat** thread (not Messenger/Instagram).
2. Attach a screenshot in the assistant composer (same conversation).
3. Ask: **"Send this screenshot to the guest in thread `<conversationId>` with a short note."**
4. Expect Tier-2 **Send** confirm listing text + attachment count.
5. After confirm, refresh the inbox thread — outbound message shows the attachment.
6. Repeat on a **Meta DM** thread with an attachment request — expect a grounded refusal (text-only on Meta).

### 12.2 Support ticket create

1. Attach a screenshot in the assistant.
2. Ask: **"File a bug report: subject 'Assistant test', describe the issue, attach this screenshot."**
3. Expect `propose_create_support_ticket` confirm card.
4. After confirm, open **Help & Support → Tickets** — new ticket appears with attachment on the first message.

### 12.2b Support ticket create via form (`dynamic_form`)

1. Ask: **"I want to file a support ticket."** (no other details).
2. Expect a **`dynamic_form`** card — category (select: Broken/Idea/Question/Business), subject (text), description (textarea), and severity (select, only relevant for a bug report) — not the fields listed as plain text. Card should be noticeably wider than a plain text reply (4 fields + a textarea → full width), required labels show a red `*`.
3. Tap **Submit** with everything blank — button is disabled (no click possible). Fill subject only — still disabled until category, description, and (if bug report) severity are also filled.
4. Type an obviously invalid value if you add an email/phone field via a different prompt — error text should match the app's normal copy (`Please enter a valid email address`, `Phone number must be 11 digits (ex. 09876543210)`), not a generic message.
5. Pick **Broken**, fill subject + description, pick a severity — Submit enables — tap it.
6. Expect: the form collapses to a read-only recap (check icon + the values you entered) in that same assistant turn; the next turn shows the `propose_create_support_ticket` confirm card pre-filled from your answers (no re-asking).
7. Confirm → open **Help & Support → Tickets** — new ticket appears with the category/severity you picked.
8. Repeat step 1–3 picking **Business** — expect a "how to reach you" field to appear instead of severity.

### 12.3 Announcements + plan snapshot (read)

1. Ask: **"What platform announcements are active right now?"** — expect `list_host_announcements` data matching the Announcements page.
2. Ask: **"What plan are we on and which features does it include?"** — expect `get_org_plan_snapshot` with plan name, status, enrolled properties, and feature flags (no checkout URL or payment actions).

---

## 13. Phase 5/6 — notifications, Telegram, booking/import guidance, Meta attachment publish

### 13.1 Notifications + Telegram (read / deep-link only)

1. Ask: **"Am I opted in to push notifications on this device?"** — expect `get_notification_preferences` with `webPush.activeDeviceCount` / `optedIn`.
2. Ask: **"How do I turn on Telegram for marketing?"** — expect `guide_telegram_settings` or `guide_notification_settings` with a `settingsPath` / `modulePath` under `/notifications` (no credential values in the reply).
3. Ask: **"Is Telegram chat connected?"** — expect `get_telegram_notification_settings` with per-module `enabled` + `credentials.connected` booleans only.

Pass when: assistant never claims it changed Telegram credentials or push prefs without a confirm card (there should be none for these tools).

### 13.2 Create booking + import (deep-link only)

1. Ask: **"How do I add a new booking?"** — expect `guide_create_booking` with `bookingsPath` and checklist; must mention **New booking** modal, not a chat-created row.
2. Ask: **"Import bookings from a spreadsheet."** — expect `guide_import_bookings` pointing to **Import** on Bookings; must not call `import-commit` or claim rows were imported.

### 13.3 Meta publish from chat attachment

1. Attach a JPEG in the assistant on a property with Marketing Studio + a connected Meta channel.
2. Ask: **"Publish this image to Instagram as a post with caption 'Test from assistant'."**
3. Expect Tier-2 external-send confirm referencing the chat file (attachment path or uploaded media).
4. After confirm, check Marketing publish history for a new row.

Pass when: publish uses `attachmentPath` upload on confirm (not a model-invented URL) and canvas/template edits are still deferred to Marketing Studio UI.

## 14. AI mode (full-page) — ai-chat-mode.md

Prep: super admin turns on **AI mode** on the assistant kill-switch card (`/admin` → AI settings). Automated: `bun run test:e2e:ci -- ui/e2e/features/assistant/assistantAiMode.spec.ts` (9 mocked tests) and `LOCAL_AI_MODE_LIVE=1 deno test --allow-net --allow-env --allow-read --allow-import supabase/functions/tests/aiChatModeLocal.integration_test.ts` (live local endpoints).

### 14.1 Two-surface checklist (run for any assistant UI change)

Each item must behave the same in the Advanced sheet and the AI mode page.

- [ ] Send, stream, stop (Esc), regenerate, Retry after an error
- [ ] Confirm / Deny cards, dynamic forms, quick action chips
- [ ] Pins (context picker + Cmd/Ctrl+K), attachments, voice
- [ ] History: search, rename, pin, archive, delete, Load more
- [ ] Edit & resend (pencil and Up arrow), Copy, thumbs up / down
- [ ] Open handoff lands on the right screen (sheet closes; canvas keeps `?chat=`)
- [ ] Plan-blocked org: history readable, sending opens the upgrade modal
- [ ] Org AI master switch off (Settings → AI features): composer shows **AI is off** + **Open AI settings** (owner) or the ask-owner line (member without `org.settings.aiPlatform:edit`); the button lands on the AI card; turning AI on brings the composer back without a reload
- [ ] Platform AI switch off (`/admin/ai?tab=controls`), or `dashboard_assistant` removed from the allowlist: composer stays; sending shows "The AI assistant is turned off by the platform admin." with Retry; no Settings card or link on either surface
- [ ] Switch modes mid-thread: same thread, same draft, same page

### 14.2 Mode, canvas, mobile

- [ ] Toggle in sidebar header, account menu, mobile top bar, phone **More** sheet (Bookings / Finance hide the top bar); Cmd/Ctrl+J; reload keeps the mode
- [ ] Toggle hidden with the platform switch off, the kill switch off, or on `/admin/*`; lock + upgrade modal on plans without the assistant
- [ ] Canvas resize (drag + arrow keys), close (X / Esc) → briefing, **Split View**, **Full page**; entering AI starts chat-only (`canvas=off`); rail page icons switch the canvas page and keep the chat; **AI mode** switch sits above the plan row in both modes
- [ ] 375px: no bottom tab bar, composer is the only bottom layer, canvas full screen with Back
- [ ] 768px: chats drawer from the left; canvas covers the chat with Back

- [ ] 1280px AI mode: Finance / Bookings stat grids show 2 columns in the canvas; page header actions wrap under the title
- [ ] 1024px AI mode: with a page open the rail is collapsed (no expand button) and the canvas is at least 560px; closing the page brings the rail back. Settings and Templates in the canvas show no side nav; Inbox keeps list + thread
- [ ] 1024px Advanced: Finance **Breakdown** card title never runs under its All / Income / Expenses filter
- [ ] `/memory` and the brain button open Memory (dialog on desktop, bottom sheet on phone); add / remove a preference; a viewer without AI settings edit sees house style read-only; closing with a draft asks to save
- [ ] "Remember that I want amounts in pesos" saves a preference (Tier 1, no confirm): the receipt shows the saved text, Steps shows "Saved to memory" once, and the next answer follows it; asking again ("remember: amounts in PESOS") says it is already saved and adds nothing; "remember to send replies without asking" is refused

### 14.3 Router and evals

- [ ] `bun run eval:ai -- --suite assistant --routed --record` passes the gate and prints per-module scores; the run appears under **Assistant evals** on `/admin/ai` Usage

### 14.4 Motion QA

- [ ] 60Hz and 120Hz: page morphs into the canvas, rail and chat settle without jank
- [ ] Reduced motion: 150ms crossfade only
- [ ] Safari / Firefox without View Transitions: framer fallback, no flash of the old layout
