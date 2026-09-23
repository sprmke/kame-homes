---
stage: done
title: 'AI Voice Receptionist — Implementation Plan'
status: done
tags: [planning, planned-modules]
updated: 2026-08-01
---

# AI Voice Receptionist — Implementation Plan

**Status:** v1 shipped (Phases 1–5). **Phase 6 complete** (6.1–6.4, 2026-07-31).

**6.1–6.4 shipped.** Avatar is an original photorealistic concierge portrait with a 2D face-plate image fallback.

> Historical v1 record. Production hardening and current architecture are tracked in
> [`AI Receptionist Production Readiness`](../in-progress/ai-receptionist-production-readiness.md).
> In particular, client-reported voice captions no longer become canonical `social_messages`.

## Context

Guests currently get AI help two ways: an async AI-drafted reply inside the existing Guest Inbox web chat (`social-inbox-ai-suggest` / `webInboxAutoReply.ts`), and nothing real-time or voice-based. The ask is to extend that same guest chat experience with an opt-in **live voice conversation** — guest clicks "Talk to our receptionist," an animated cute turtle appears, and they have a spoken back-and-forth (Siri/Alexa-style) about the property/their booking. It must reuse the property/booking "guest-safe" data boundary the text AI already enforces, be configurable per property from the admin dashboard (voice, limits, on/off), and — because this is a new real-time, mic-access, per-minute-billed surface — ship with hard cost/abuse guardrails and an instant kill switch, not just a happy path.

This plan was produced by research + brainstorming. It covers architecture, data model, safety boundary, avatar approach, admin configuration, and a phased build order. **v1 avatar (procedural turtle) is superseded for the next polish pass** — see Phase 6.4.

## Decisions made during brainstorming (do not re-litigate during implementation)

1. **Voice/AI provider: Google Gemini Live API** (native speech-to-speech), not OpenAI Realtime or ElevenLabs. Same vendor already used for text AI (`_shared/socialInboxAiService.ts`); research found it roughly 15–50x cheaper per minute than OpenAI Realtime and far cheaper than ElevenLabs, with an official ephemeral-token browser pattern (google-gemini/gemini-live-api-examples) that fits our serverless Deno edge functions (no persistent proxy server needed). **Verify exact current pricing/model names at ai.google.dev/pricing before launch** — third-party SEO pricing pages disagreed with each other during research and should not be trusted for budget decisions.
2. **Fish Audio TTS was considered and deferred, not adopted for v1.** It's a legitimate, ~11x-cheaper-than-ElevenLabs option for custom/cloned voices, but it's TTS-only — using it would mean abandoning Gemini Live's native audio-to-audio model for a cascaded STT→LLM→TTS pipeline requiring our own orchestration server (e.g. Pipecat), which contradicts the serverless v1 goal. Documented as a Phase-2+ option if the business wants a fully custom/branded turtle voice later (see Non-goals).
3. **Avatar: premium human concierge portrait.** The procedural turtle shipped in v1. A TalkingHead + Ready Player Me GLB was implemented for Phase 6.4, then rejected in visual QA because the anime styling and amplitude-driven mouth produced an uncanny, unappealing assistant. The shipped replacement is an original photorealistic portrait with restrained breathing/speaking motion; the brass state ring carries activity feedback without fake lip deformation.
4. **Rollout gating: two-tier — a super-admin global kill switch (org/property toggles all become inert if this is off) plus a per-property opt-in.** This is a new real-time/cost-bearing surface, so it ships defaulted OFF everywhere, pilot-enabled per property, and can be cut instantly org-wide without a deploy.
5. **The feature extends the existing guest web chat, it is not a separate product.** Voice sessions attach to the guest's existing `social_conversations` thread for that property (same one used by `PropertyChatPage.tsx`), and the transcript is written into `social_messages` alongside normal text messages so admins see one unified history in the existing Inbox UI.
6. Requires existing **guest authentication** (`RequireGuestSession` / `GuestAuthContext`) — same as the rest of the chat feature — both because a session/identity is needed for rate-limiting and because mic access + a billed AI session shouldn't be anonymous.

## Current state (verified this session)

- **Text AI chain**: `webInboxAutoReply.ts` → `_shared/socialInboxAiService.ts` (`suggestInboxReply`, Gemini 2.5-flash via raw `fetch`, `GEMINI_API_KEYS` round-robin, Groq fallback) → `_shared/inboxAiGuestContext.ts` (`buildAiGroundingFacts`/`loadGuestSafePropertyContext`, explicitly documented as "never exposes finance, maintenance, or guest PII") → `_shared/inboxAiSafetyGuard.ts` (`assertSafeGuestReply`, deterministic post-generation check for leaked names/amounts/sensitive intent). **This two-layer pattern (server-built guest-safe facts + independent safety guard) is the convention this feature must follow.**
- **Guest chat UI**: `ui/src/features/guest/chat/pages/PropertyChatPage.tsx`, `components/GuestChatThread.tsx`, `GuestChatHeaderBar.tsx`, hook `hooks/useGuestChat.ts`. Realtime via Supabase Realtime `postgres_changes` (`useGuestChatRealtime`) and a separate broadcast-channel pattern for ephemeral signals (`ui/src/lib/chat/useChatReadReceiptSync.ts:97-120`, `useChatTyping.ts:34` — `supabase.channel('chat-sync:...', { config: { broadcast: { self: false } } })`) — this broadcast pattern is the template for streaming live transcript/avatar-state events to the UI.
- **Guest auth**: `ui/src/features/guest/auth/context/GuestAuthContext.tsx`, `components/RequireGuestSession.tsx`. Edge functions for guest chat use `serveAuthenticated`, not `serveAdmin`.
- **`social_messages` table** (`supabase/migrations/20260910120000_social_inbox.sql:78`): `direction`, `body_text`, `attachments JSONB`, `is_ai_generated BOOLEAN`, no field today to mark a message as voice-originated — needs one additive column.
- **Settings pattern for a new module**: dedicated table + edge function + UI is the precedent for a feature this rich (see `property_pricing_date_overrides` / `supabase/functions/property-pricing` / `ui/src/features/dashboard/pricing/`), vs. cramming into the generic `app_settings` JSONB blob (`automation_toggles`) used for simpler on/off automations. Settings-page UI convention is a manual draft-state hook (`useAppSettings.ts`), **not** react-hook-form/zod (RHF/zod is reserved for record-editing forms like `BookingEditForm.tsx`).
- **No existing rate-limit/quota/usage-tracking pattern anywhere in the codebase** (confirmed by grep) — the still-unbuilt `smart-search-bar.md` plan calls per-IP throttling "first of its kind." A session-cap/cost-tracking mechanism for this feature will be new infrastructure, not a reuse.
- **No existing super-admin global settings/feature-flag table.** Super-admin UI lives at `ui/src/features/dashboard/super-admin/` (`SuperAdminOverviewPage.tsx`, `RequireSuperAdmin.tsx`) but nothing there today is a runtime-toggleable platform flag — this will be the first one.
- Edge function config precedent for a new guest-facing realtime function: `guest-web-chat-start`/`guest-messages` in `supabase/config.toml` (`verify_jwt = false`, no `static_files`, auth enforced in-handler via guest JWT).

## Architecture

### 1. Connection model — direct browser-to-Gemini, edge function only mints tokens

The browser connects **directly** to the Gemini Live API over WebSocket; our edge functions never proxy audio. This avoids needing a persistent relay server (Supabase Edge Functions are not meant for long-lived multi-minute stateful connections) and matches Google's documented ephemeral-token pattern:

- New edge function `voice-receptionist-start` (`serveAuthenticated`, guest JWT required): validates the global kill switch + property `voice_receptionist_settings.enabled`, enforces session caps (below), creates a `voice_receptionist_sessions` row, builds the guest-safe grounding facts (reusing `loadGuestSafePropertyContext`/`buildAiGroundingFacts` from `_shared/inboxAiGuestContext.ts`), and calls Gemini's ephemeral-token endpoint server-side with `GEMINI_API_KEY` to mint a short-lived, single-use token scoped to that session. Returns `{ ephemeralToken, sessionId, model, voiceId, maxSessionSeconds }` to the client — the real API key never reaches the browser.
- The browser opens the Gemini Live WebSocket itself using that token, sends the `setup` message (system instructions + a single **tool declaration**, e.g. `getPropertyFact(topic)`), and streams mic audio (PCM16 via an `AudioWorklet`) in; it receives audio + incremental text transcript out.
- **Known risk, explicitly accepted for v1**: because the client sends its own `setup` message, a technical guest could tamper with the system-instructions text via devtools. **The real security boundary is not the prompt — it's the tool.** The `getPropertyFact` tool call is served by a small edge function (`voice-receptionist-tool`) that re-runs the same guest-safe field allowlist as `inboxAiGuestContext.ts`, so even a jailbroken prompt cannot make the model return data it was never given access to. This mirrors the existing text-AI defense-in-depth (guard is independent of the prompt). **Implementation-time TODO: check whether Gemini's ephemeral-token API supports server-side "locked" session config (system instructions/tools the client cannot override)** — if it does, use it to close this gap entirely; if not, ship with the tool-boundary + full transcript logging (below) as the mitigation.

### 2. Data model (new migration)

- `voice_receptionist_global_settings` — singleton row, super-admin controlled: `enabled BOOLEAN DEFAULT FALSE`, `updated_by`, `updated_at`. This is the kill switch checked first, before any property-level check.
- `voice_receptionist_settings` — one row per property (FK `property_id`, unique): `enabled BOOLEAN DEFAULT FALSE`, `voice_id TEXT` (Gemini prebuilt voice name), `persona_prompt TEXT NULL` (optional additive system-prompt override, layered like `social_inbox_settings.ai_system_prompt` — never replaces the base safety policy), `max_session_seconds INT DEFAULT 300`, `max_sessions_per_guest_per_day INT DEFAULT 3`, `max_concurrent_sessions INT DEFAULT 3`.
- `voice_receptionist_sessions` — audit/usage/cost log: `id`, `property_id`, `guest_user_id`, `conversation_id` (FK `social_conversations`), `started_at`, `ended_at`, `duration_seconds`, `end_reason` (`guest_ended` / `timeout` / `cap_reached` / `error`), `estimated_cost_usd`. Used to enforce the caps above (query recent rows) and to give admins real cost visibility (nothing like this exists today for any AI usage in the codebase).
- `social_messages` — additive column `source_mode TEXT NOT NULL DEFAULT 'text' CHECK (source_mode IN ('text','voice'))`, set on both the guest's spoken turns and the AI's spoken replies once each session ends (batch-written from the session transcript), so the admin Inbox thread shows a unified history with a mic badge on voice turns.

### 3. Safety / data-scoping (extends the existing two-layer pattern)

- **Grounding**: reuse `loadGuestSafePropertyContext` / `buildAiGroundingFacts` — same guest-safe fields already used for text AI (property facts, amenities, policies, pricing facts, blocked-date availability; explicitly never finance/maintenance/other-guest PII).
- **Tool boundary**: the model can only fetch facts through the `getPropertyFact` tool call (server-enforced allowlist), never raw DB access — this is the hard boundary described in Architecture §1.
- **Transcript audit**: full session transcript (both sides) is persisted to `social_messages` for every session regardless of outcome, giving admins the same post-hoc reviewability text-chat already has, and a way to detect jailbreak attempts or misbehavior after the fact even though (unlike text) we can't block a bad utterance before the guest hears it in v1.
- **Sensitive-topic refusal**: system instructions carry the same refusal policy as `socialInboxAiService.ts`'s `safetyPolicy` string for out-of-scope/sensitive questions (finance, other guests, staff info, etc.).

### 4. Avatar & guest UI

- New components under `ui/src/features/guest/chat/components/voice/`: `ReceptionistAvatar.tsx` (procedural CSS/SVG turtle; props drive idle/listening/thinking/speaking states from a live amplitude value), `VoiceSessionOverlay.tsx` (full-screen/modal takeover from the chat — big avatar, live captions of both sides, mic mute + end-session buttons, session countdown timer), hook `useVoiceSession.ts` (mic capture via `getUserMedia` + `AudioWorklet`, opens the Gemini Live WebSocket with the minted token, computes live amplitude via `AnalyserNode` for the avatar, emits transcript chunks).
- Entry point: a "Talk to our receptionist" button in `GuestChatHeaderBar.tsx` / `PropertyChatPage.tsx`, rendered only when the property's `voice_receptionist_settings.enabled` (and global switch) is true — fetched alongside existing chat data.
- Mobile: overlay must work at 375px+ with 44×44px touch targets per the mobile-responsive convention already enforced elsewhere in this app.

### 5. Admin configuration UI

- **Property level**: new section (`PropertyVoiceReceptionistSection.tsx` / `PropertyVoiceReceptionistPanel.tsx`) added into the existing property settings composition (`PropertyOperationalSettingsSections.tsx`, same family as `PropertyEmailAutomationsSection.tsx`) — enable toggle, voice picker (dropdown of Gemini prebuilt voices), optional persona prompt textarea, and numeric inputs for the three caps. Backed by a new `useVoiceReceptionistSettings.ts` hook (TanStack Query) hitting a new `voice-receptionist-settings` edge function (GET/PATCH), following the manual draft-state pattern from `useAppSettings.ts`, not RHF/zod.
- **Super-admin level**: a small new card/page in `ui/src/features/dashboard/super-admin/` (e.g. on `SuperAdminOverviewPage.tsx` or a new settings page) for the global kill switch — this is the first platform-wide runtime flag in the app, so keep it intentionally minimal (one boolean, one edge function) rather than building a generic feature-flag system.

## Phase breakdown

1. **Spike**: prove the Gemini Live ephemeral-token + direct-browser-WebSocket + tool-calling flow end-to-end with a throwaway page (confirm token minting, audio in/out, and whether locked session config is available — resolves the Architecture §1 TODO).
2. **Backend foundation**: migration (4 items in Data model), `voice-receptionist-start`, `voice-receptionist-tool`, `voice-receptionist-settings` (property CRUD), `voice-receptionist-global-settings` (super-admin) edge functions; cap enforcement logic against `voice_receptionist_sessions`.
3. **Guest frontend**: `useVoiceSession`, `ReceptionistAvatar` (procedural turtle, amplitude-reactive states), `VoiceSessionOverlay`, entry button wiring, transcript batch-write into `social_messages` on session end.
4. **Admin frontend**: property settings section + super-admin kill switch card, both wired to their edge functions.
5. **Hardening/polish**: idle/silence auto-timeout, network-drop/reconnect handling, mic-permission-denied UX, cost dashboard read (session table), mobile pass, accessibility pass (captions already double as a screen-reader-friendly transcript).

## Explicit non-goals (for this plan / v1)

- No telephony/PSTN integration (browser-only, matches the Siri/Alexa-in-app framing, not a phone line).
- No **paid** photoreal talking-head SaaS (HeyGen, D-ID, Simli, etc.) and no **self-hosted GPU** talking-head servers (Linly-Talker, SadTalker) — conflicts with free + serverless constraints.
- No Rive marketplace / Mascotbot commercial avatar SDK in Phase 6 (licensing / cost) — still deferred unless product later budgets for it.
- No Fish Audio / custom voice cloning — future option if a fully custom/branded voice is wanted later, requires a cascaded STT→LLM→TTS architecture (bigger change, own plan).
- No generic platform feature-flag system — the global kill switch is a single-purpose boolean for this feature only.
- No mid-session server-side content blocking of AI speech (accepted risk, mitigated by the tool boundary + post-hoc transcript audit — see Architecture §1).

---

## Post-v1 feedback → Phase 6 (latency, rich messages, UX & avatar)

**Source:** live testing of the shipped overlay + guest chat thread (2026-07-31). Guests perceive long silence after speaking, slow AI replies, weak “something is happening” feedback, dislike the procedural turtle, and see **raw Google Maps URLs / unformatted lists** in the chat transcript (broken-looking AI replies).

**Execution rule:** address **one feedback item per change set**, in order **6.1 → 6.1b → 6.2 → 6.3 → 6.4**. Do not start the avatar swap until latency + state UX are in place (avatar lip-sync depends on clear audio/state signals). Rich message rendering (6.1b) ships **before** AI latency work so map/list replies are readable while we tune speed.

### Symptom → likely cause (current code)

| #   | Guest feedback                                                      | Likely cause in v1                                                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Long delay / words not detected in realtime                         | Gemini server VAD waits for silence before `turnComplete`; UI stays on **LISTENING** with no partial captions; tool round-trips (`getPropertyFact`) start only after the model finishes the user turn — feels like “it didn’t hear me.” Mic worklet already posts ~128-frame chunks at 16 kHz (~8 ms) — **chunk size is not the primary bottleneck**. |
| 1b  | AI / voice transcript replies look broken (raw Maps URLs, no lists) | `ChatMessageBubble` renders `body_text` as plain `whitespace-pre-wrap` — no linkify, no map card, no markdown. Voice + text AI both land as plain `social_messages` rows.                                                                                                                                                                             |
| 2   | AI reply feels very slow                                            | Same turn boundary + **tool call RTT** (browser → `voice-receptionist-tool` → Gemini) before native audio; large locked system/grounding prompt; possible model/voice config. True model generation time cannot go to zero — we can cut **avoidable** latency and **mask** the rest.                                                                  |
| 3   | No sense of thinking / progress during delays                       | Overlay states are coarse (`connecting` / `listening` / `speaking` / …); little motion beyond a static turtle + status label; captions often empty until a full turn lands.                                                                                                                                                                           |
| 4   | Turtle looks ugly; want human talking/thinking avatar               | Procedural SVG was a v1 ship choice; free browser tech now chosen (below).                                                                                                                                                                                                                                                                            |

### 6.1 — Faster / more responsive speech detection (do first)

**Goal:** Guest sees and hears that their words are landing within ~300–500 ms of speaking; silence → “processing” within ~500–800 ms of stopping.

**Approach (implementation checklist):**

1. **Expose Gemini Live input transcription + activity** — ensure session setup requests input audio transcription / activity events (per current Gemini Live docs). Stream **partial user captions** into the overlay as soon as tokens arrive (not only on turn end).
2. **Tune server VAD / end-of-speech** in the locked setup (or client `realtimeInput` config if still the path): shorten `silenceDurationMs` / raise end-of-speech sensitivity so turns close sooner after natural pauses. Document chosen values in code comments + this plan once measured.
3. **Local RMS / VAD for UI only** — in `useVoiceSession`, classify mic energy into `userSpeaking` vs `userSilent` with hysteresis; drive status copy + avatar “listening pulse” **before** Gemini emits `turnComplete`. Does not replace server VAD for the model.
4. **Keep AudioWorklet** (already correct). Optionally coalesce tiny chunks to ~20–40 ms for WS efficiency only if profiling shows main-thread/`postMessage` pressure — do not enlarge buffers in a way that adds perceptible lag.
5. **Verification:** speak a short sentence → partial caption appears while still talking; pause → status leaves LISTENING within ~1 s without waiting for AI audio.

**Primary files:** `ui/src/features/guest/chat/hooks/useVoiceSession.ts`, `VoiceSessionOverlay.tsx`, `supabase/functions/_shared/geminiLiveEphemeral.ts` (setup / transcription / VAD fields).

### 6.1b — Rich chat message rendering (maps, lists, link cards)

**Inserted ahead of 6.2** (feedback 2026-07-31): after voice/text AI replies land in the guest thread, long raw Google Maps URLs wrap awkwardly and are hard to tap; bullet/amenity lists stay flat plain text.

**Job:** Guest (and host in Inbox) can scan and act on AI/host replies — open a map, skim a list — without reading a broken URL string.  
**Role:** Guest (operational chat) + operator (Guest Inbox).  
**Surface:** Shared bubble renderer — not voice-overlay-only.  
**Commit point:** Opening an external map/link (new tab); no payment.

#### Competitive UX brief

| Benchmark               | Pattern                                                                                             | Notes for Kame                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **WhatsApp / iMessage** | Link unfurl: thumbnail + title + domain; Maps links become a map preview card, tap opens Maps       | Adopt card shape; we control rendering client-side (no Meta crawler)                                                                             |
| **Airbnb Messages**     | Channel often blocks or plain-texts external links; guidebook/recommendations are first-class cards | Our **web** chat can exceed Airbnb channel limits — rich cards are a direct-booking advantage                                                    |
| **Guesty Inbox**        | Hyperlinks in email; Airbnb channel still strips clickable links                                    | Rich UI applies to **platform=web** bubbles in our SPA; Meta-synced plain text still benefits from client-side parse when displayed in our Inbox |

**Adopt:** WhatsApp-style **map card** + clickable short label; light markdown lists.  
**Adapt:** No server-side Open Graph scrape for arbitrary URLs in v1 (SSRF, latency, CORS). Allowlist detectors + free static map tile.  
**Skip:** Full HTML email rendering, arbitrary iframe embeds, paid Google Static Maps billing unless product enables it later.

#### Architecture (client parse — no schema change in 6.1b)

Keep storing plain `social_messages.body_text`. At render time, a shared **`ChatRichBody`** parses text into blocks and renders inside `ChatMessageBubble` (guest thread + host Inbox use the same path).

```
body_text (plain)
  → parseChatRichBlocks(text)
  → [ text | mapLink | link | list | … ]
  → ChatRichBody → ChatMapLinkCard | <ul> | linkify …
```

**Optional later (not 6.1b):** `attachments` / `body_blocks` JSON from the AI tool when it intentionally emits a location — still render via the same components.

#### Detectors / components (v1 scope)

| Scenario                            | Detect                                                                                                       | UI                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Google Maps                         | `google.com/maps`, `maps.google.`, `maps.app.goo.gl`, `goo.gl/maps`, query=`lat,lng` / `@lat,lng` / `query=` | **`ChatMapLinkCard`**: static map thumbnail + “Open in Maps” (opens original URL, `target=_blank`, `rel=noopener`) |
| Generic https URL                   | Single URL or URL in sentence                                                                                | Inline linkify (truncate display host/path); optional compact link chip — **no** OG scrape                         |
| Bullet / numbered list              | Lines starting with `- `, `* `, `• `, or `1. ` / `2. `                                                       | Proper `<ul>` / `<ol>` with spacing; rest of message stays paragraphs                                              |
| Wi‑Fi / code-like lines _(stretch)_ | Optional: `SSID:` / `Password:` patterns                                                                     | Monospace key–value row — only if it appears often in grounding; else defer                                        |
| Phone numbers _(stretch)_           | E.164 / PH local                                                                                             | `tel:` link — defer if noisy                                                                                       |

#### Map thumbnail — free approach (chosen)

| Option                                                                                                                                                    | Cost                | Verdict                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------ |
| **Google Maps embed** via existing `resolvePropertyMapEmbedSrc` (Embed API if `VITE_GOOGLE_MAPS_API_KEY`, else legacy `maps.google.com?...&output=embed`) | Free / existing key | **Adopt** — real Google map in `ChatMapLinkCard` |
| OSM embed fallback                                                                                                                                        | Free                | Used when Google embed unavailable               |
| OSM staticmap.openstreetmap.de `<img>`                                                                                                                    | Free                | Unreliable (blank tiles) — **not used**          |
| CSS pin-only card                                                                                                                                         | Free                | Last-resort if no coords/embed                   |
| Google Maps Static API                                                                                                                                    | Static Maps billing | Defer                                            |
| Server OG scrape                                                                                                                                          | SSRF risk           | Skip                                             |

Parse lat/lng from the URL when present; iframe is `pointer-events-none` with a full-card link so chat scroll stays usable.

#### Prompt nudge (small, same change set if cheap)

In voice/text AI system instructions: prefer short map links and markdown lists (`- item`) when listing amenities — **UI must still work if the model dumps a raw URL** (detector is the source of truth).

#### Design constraints

- Mobile 375px: card full width of bubble; tap target ≥ 44px on CTA.
- Outbound (guest) vs inbound (AI/host) bubble colors: map card uses neutral surface so imagery stays readable on primary-colored outbound bubbles too.
- `minimal-ui-copy`: CTA = “Open in Maps” / host label only — no essay.
- Security: only `https:` links; no `javascript:`; never `dangerouslySetInnerHTML` for full HTML.
- Accessibility: card is a link (or button+link); alt text on thumbnail; lists use real list semantics.

#### Primary files

- `ui/src/components/chat/ChatMessageBubble.tsx` — swap plain `<p>` for `ChatRichBody` when not searching/highlighting (keep highlight path plain or rich-aware).
- New: `ui/src/components/chat/ChatRichBody.tsx`, `parseChatRichBlocks.ts`, `ChatMapLinkCard.tsx`.
- Call sites already using the bubble: `GuestChatThread.tsx`, `InboxConversationView.tsx` (verify both pick up the change).
- Voice live captions in the overlay use the same **`ChatRichBody`** (map cards during the call).
  Persisted voice turns in the thread get rich rendering automatically.

#### Non-goals for 6.1b

- Structured DB column for message blocks.
- Arbitrary website OG previews.
- Changing Meta/Facebook delivery format.
- Replacing voice overlay captions with cards during the live call.

#### Verification

1. Paste / AI-send a Google Maps URL with lat,lng → thumbnail card + tap opens Maps.
2. Amenity list with `- ` lines → bullets, not one wrapped paragraph.
3. Mixed message (prose + URL + list) → all three block types.
4. Guest + host Inbox both show the card.
5. Highlight/search path still works (no crash).
6. `type-check` / `lint` / `build`.

### 6.2 — Faster AI responses (after 6.1b)

**Goal:** Cut avoidable post-turn latency; first audio packet sooner for typical property FAQs.

**Approach:**

1. **Prefetch grounding into locked instructions** — expand what `voice-receptionist-start` already embeds from `buildAiGroundingFacts` so common topics (amenities, check-in/out, parking, pet policy, pricing facts already guest-safe) answer **without** a tool call. Reserve `getPropertyFact` for sparse / dynamic topics only.
2. **Tool UX + parallelization** — when a tool call is unavoidable, fire `voice-receptionist-tool` immediately and surface Phase 6.3 “Looking that up…”; keep the tool handler lean (no extra DB round trips beyond the allowlist path).
3. **Prompt budget** — shorten persona + safety boilerplate where redundant with locked policy; measure whether smaller setup reduces time-to-first-audio.
4. **Model / voice check** — re-verify the ephemeral mint uses the current **native-audio / Live** flash model recommended for low latency (confirm against ai.google.dev at implement time); keep voice picker but default to a snappy prebuilt voice.
5. **Do not** introduce a second STT→LLM→TTS cascade or a persistent proxy in this phase (still serverless + Gemini Live).

**Primary files:** `voice-receptionist-start`, `geminiLiveEphemeral.ts`, `voiceReceptionistTool.ts` / `voice-receptionist-tool`, system-instruction builders.

**Verification:** FAQ that fits grounding → AI audio starts without a tool RTT; tool-required question still works but shows 6.3 feedback during the wait.

### 6.3 — Thinking / processing UX (after 6.2)

**Subject:** Guest voice call overlay — audience is booking guests; single job is “make wait time feel intentional, not broken.”

**Design direction (frontend-design — not a generic purple/cream AI look):**

| Token          | Value                        | Role                                                 |
| -------------- | ---------------------------- | ---------------------------------------------------- |
| Stage wash     | `#0F1410` → deep green-black | Call “booth” — night lobby, not white modal void     |
| Accent         | `#C4A35A` (warm brass)       | Brand-adjacent hospitality, status underline / pulse |
| Soft fill      | `#1A221C`                    | Control bar / caption plate                          |
| Live green     | `#3D9B6A`                    | Listening / mic hot                                  |
| Thinking amber | `#D4A017`                    | Processing / tool                                    |
| Speaking white | `#F5F2EA`                    | Caption text / lip-sync highlight                    |

- **Type:** status label = small caps tracking utility (system UI); captions = readable sans already used in guest chat — no display serif hero.
- **Signature:** a **brass ring around the avatar** that morphs by phase (soft breathe = listening, segmented chase = thinking, solid glow synced to playback RMS = speaking). One memorable motion system; keep chrome quiet.
- **Respect `prefers-reduced-motion`:** static ring + text status only.

**State machine (UI):**

| State           | When                                                  | Visual                                                               |
| --------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| Connecting      | Token + WS setup                                      | Subtle ring chase + “Connecting”                                     |
| Listening       | Mic open, not userSpeaking / not model audio          | Soft pulse ring + live mic level (thin waveform under avatar)        |
| You’re speaking | Local VAD / input transcription active                | Stronger green pulse + **streaming user caption**                    |
| Thinking        | User turn ended (local or server) and no AI audio yet | Brass segmented ring + optional “Looking that up…” if tool in flight |
| Speaking        | AI PCM playing                                        | Ring tied to playback amplitude + **streaming AI caption**           |
| Error / ended   | Existing paths                                        | Keep sparse errors (minimal-ui-copy)                                 |

**Primary files:** `VoiceSessionOverlay.tsx`, avatar shell (still turtle until 6.4), small waveform/ring components under `components/voice/`.

**Verification:** After guest stops talking, UI leaves LISTENING within ~500 ms even if AI audio takes longer; tool calls never look like a frozen white screen.

### 6.4 — Human-like talking avatar (do last)

#### Avatar technology research (2026-07-31)

| Technology                                                                     | Cost / license           | Runtime            | Talking / thinking                                              | Verdict                                  |
| ------------------------------------------------------------------------------ | ------------------------ | ------------------ | --------------------------------------------------------------- | ---------------------------------------- |
| **[TalkingHead](https://github.com/met4citizen/TalkingHead)** (Three.js + VRM) | **MIT — free**           | Browser only       | Audio-driven lips, blinks, head motion                          | Rejected after visual QA — uncanny model |
| Original concierge portrait                                                    | Original project asset   | Browser image      | Restrained scale/light response; booth ring carries voice state | **Adopted**                              |
| Mascotbot / Rive marketplace                                                   | Commercial / paid assets | Browser            | Good 2D lip sync                                                | Skip for now (not free)                  |
| Linly-Talker-Stream / SadTalker / MuseTalk                                     | Open source              | **GPU server**     | Photoreal                                                       | Skip — breaks serverless + ops cost      |
| HeyGen / D-ID / Simli / similar                                                | Paid SaaS                | Cloud video/stream | Photoreal                                                       | Skip — not free; API + latency + privacy |

**Chosen stack:** original concierge portrait under `ui/public/avatars/` + restrained amplitude-driven scale/light response. Thinking and speaking remain explicit through the Phase 6.3 brass ring and waveform. Do not warp the mouth: low-quality pseudo-lip-sync was less trustworthy than a calm portrait.

**Fallback:** if WebGL / load fails on a device, fall back to a refined 2D face plate (still not the turtle) driven by the same state props — never block the call.

**Out of scope for 6.4:** custom branded 3D sculpt, paid Ready Player Me enterprise, video deepfake pipelines.

**Primary files:** `ReceptionistAvatar.tsx`, `ReceptionistFacePlate.tsx`, `VoiceSessionOverlay.tsx`; state/amplitude from `useVoiceSession`.

**Verification:** on mid-tier phone (375–390 px), avatar loads &lt; ~3 s, lips track AI speech, thinking pose during 6.3, End call cleans up WebGL context (no leak on reopen).

### Phase 6 verification (shared)

1. `bun run type-check` / `lint` / `build` after each sub-phase.
2. Manual mic E2E on `/properties/:slug/messages?checkInDate=&checkOutDate=` with voice enabled.
3. Update route guide + this plan checkboxes when each sub-phase ships.
4. Competitive UX: keep overlay **one composition** (avatar + status + captions + two controls) — no dashboard chrome.

### Phase 6 task order (for implementers)

- [x] **6.1** Speech detection / partial captions / VAD tune / local speaking UI
- [x] **6.1b** Rich chat message rendering — map cards, lists, linkify (shared `ChatRichBody`)
- [x] **6.2** Grounding prefetch + tool/prompt latency
- [x] **6.3** Booth UX — brass ring phases, waveform, thinking copy, reduced motion
- [x] **6.4** Human concierge portrait; restrained state motion; 2D face-plate fallback

**6.4 notes (2026-07-31):** Ready Player Me’s CDN is offline (shutdown Jan 2026). The available TalkingHead example was CC BY-NC and failed visual QA. It and the Three.js dependency were removed. The shipped original portrait avoids third-party model licensing and the 865 kB TalkingHead runtime; `ReceptionistFacePlate` remains the image-load fallback.

---

## Verification plan (no automated test suite exists in this repo)

1. `bun run type-check`, `bun run lint`, `bun run build` after each phase.
2. Local Supabase: apply new migration, run `mcp__supabase__get_advisors` to check RLS/security posture on the three new tables before considering the backend phase done.
3. `bun run dev:api` + curl-test `voice-receptionist-start`/`voice-receptionist-tool` directly, including deliberately calling `getPropertyFact` for an out-of-scope topic to confirm the allowlist rejects it.
4. Manual end-to-end pass via Playwright MCP (or by hand, since mic access + real audio can't be fully driven headlessly): guest logs in, opens property chat, enables mic, has a short voice exchange, confirms avatar state changes, confirms transcript appears in the same thread with a voice badge, confirms admin Inbox shows it too.
5. Manually verify the cap logic: hit `max_sessions_per_guest_per_day` and `max_concurrent_sessions` and confirm graceful, clear guest-facing errors (not a crash).
6. Manually verify the global kill switch instantly disables the "Talk to our receptionist" button/blocks `voice-receptionist-start` even when a property has it enabled.

## Critical files

- `supabase/functions/_shared/inboxAiGuestContext.ts` — reuse `buildAiGroundingFacts`/`loadGuestSafePropertyContext` for the voice tool's data boundary.
- `supabase/functions/_shared/inboxAiSafetyGuard.ts` — model for the refusal-policy/safety approach to mirror in system instructions.
- `supabase/functions/_shared/socialInboxAiService.ts` — existing Gemini key-rotation (`GEMINI_API_KEYS`) and prompt-layering pattern to reuse for the ephemeral-token request.
- `supabase/migrations/20260910120000_social_inbox.sql` — `social_messages`/`social_conversations` schema the voice transcript attaches to.
- `ui/src/features/guest/chat/pages/PropertyChatPage.tsx`, `hooks/useGuestChat.ts` — integration point for the new "Talk to our receptionist" entry and shared thread.
- `ui/src/lib/chat/useChatReadReceiptSync.ts` — broadcast-channel pattern to reuse for streaming live avatar-state/transcript events.
- `ui/src/features/dashboard/bookings/hooks/useAppSettings.ts`, `.../org/components/property-settings/PropertyEmailAutomationTogglePanel.tsx`, `.../PropertyOperationalSettingsSections.tsx` — settings-page and draft-state hook pattern to mirror for the new property panel.
- `ui/src/features/dashboard/super-admin/` (`RequireSuperAdmin.tsx`, `SuperAdminOverviewPage.tsx`) — where the global kill switch card lives.
- `supabase/config.toml` — add `[functions.voice-receptionist-start]` etc. entries mirroring `guest-web-chat-start`.
