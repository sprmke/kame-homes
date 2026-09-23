---
stage: in-progress
title: 'AI Receptionist Production Readiness'
status: in-progress
tags: [planning, ai, voice, guest-chat, security, reliability, performance]
updated: 2026-09-24
---

# AI Receptionist Production Readiness

## Goal

Make the guest AI receptionist fast, conversational, useful, secure, observable, and safe for a production rollout. Preserve the low-latency direct browser-to-provider audio path, but replace the weak trust boundaries and incomplete session lifecycle before expanding capability.

This document now tracks implementation and verification. Repository hardening is implemented
through the checked items below; hosted provider, real-device, and staged-rollout evidence remains
open and keeps the feature fail-closed.

## Implementation status

- Core provider protocol, transcript trust boundary, session lifecycle, scoped tools, guest
  recovery UX, privacy controls, telemetry, health circuit breaker, and operator controls are in
  the working tree.
- Automated protocol, state, transcript, edge-contract, and 375/768/desktop voice-journey checks
  pass, including permission denial, captions, interruption, safe actions, reconnect, provider
  fallback, handoff, maximum duration, and idle timeout.
- Local migration execution and concurrent RPC tests are blocked until the Docker Desktop daemon is
  running.
- Read-only hosted migration/settings verification is blocked until the Supabase MCP connection is
  authenticated.
- Provider canary, seven-day health evidence, provider-console/legal checks, Safari/physical-device
  baselines, and staged rollout require hosted development access and remain unchecked.
- Live API and ephemeral tokens remain provider Preview features. The approved model registry has a
  `2026-10-15` review gate.

## Executive assessment

The module has a sound v1 direction and several strong foundations:

- Direct browser-to-Gemini Live audio avoids a slow audio proxy.
- Guests authenticate before starting a billed session.
- Ephemeral provider credentials keep the long-lived API key on the server.
- The property, plan, global AI switch, per-property switch, quota, and rate-limit gates are checked before a token is returned.
- Property data is built on the existing guest-safe context layer.
- Dynamic lookups are restricted to an allowlisted property-fact tool.
- The UI supports live captions, barge-in, mute, a countdown, a visible thinking state, mobile touch targets, and transcript return to the existing chat.
- Hosts can configure voice, persona, limits, and view basic usage.

At intake, the implementation was not production-ready. The highest-risk findings were:

| Priority | Finding                                                                                                                                                                                                     | Impact                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| P0       | Gemini Live uses the old `v1alpha` constrained WebSocket/token contract and a hardcoded preview model while current provider guidance uses `v1beta`, `liveConnectConstraints`, and newer Live models        | The feature can break when the preview model or old protocol is removed                 |
| P0       | `voice-receptionist-end` trusts a guest-supplied transcript and writes guest-supplied assistant turns as outbound AI messages                                                                               | A guest can forge assistant/host-looking messages in the canonical inbox thread         |
| P0       | Spoken replies have no independent post-generation safety guard before the guest hears them                                                                                                                 | Prompt and tool restrictions reduce data access but do not guarantee safe spoken output |
| P0       | Session caps use count-then-insert queries rather than one atomic reservation                                                                                                                               | Concurrent starts can exceed daily and concurrent limits                                |
| P0       | A WebSocket/open/setup failure after session creation leaves an open session and consumes a daily slot                                                                                                      | Guests can be locked out and concurrency can be distorted                               |
| P0       | Configured sessions can be 3,600 seconds, but provider audio sessions and individual connections have lower limits unless compression and resumption are enabled                                            | Long sessions can terminate abruptly                                                    |
| P1       | No session resumption, `GoAway` handling, reconnect state, startup timeout, or bounded retry policy                                                                                                         | Routine provider/network resets end calls instead of recovering                         |
| P1       | Static grounding loads and injects more data than voice needs, including payment account numbers, up to 40 blocked ranges, quick replies, and an other-guest-name guard query whose result voice never uses | Higher latency, larger prompts, broader disclosure, and unnecessary PII reads           |
| P1       | Every signed-in guest gets essentially the same property context; there is no public/inquiry/verified-stay data tier                                                                                        | The assistant cannot safely answer booking-specific or mid-stay questions               |
| P1       | Host-controlled persona, quick-reply, property, and development text is placed inside the privileged system instruction                                                                                     | Stored prompt injection can weaken behavior even though the provider setup is locked    |
| P1       | End-session retries can repeat transcript-polish model calls after the session is already ended                                                                                                             | Avoidable cost and abuse path                                                           |
| P1       | Audio is sent in roughly 8 ms worklet frames rather than the provider-recommended 20-40 ms chunks                                                                                                           | Unnecessary WebSocket and main-thread overhead                                          |
| P1       | There are no unit or handler tests for session reservation, lifecycle, tool authorization, prompt assembly, transcript trust, protocol events, or adversarial inputs                                        | Regressions will reach manual/live testing                                              |
| P1       | There is no voice-specific product telemetry for startup, turn, tool, reconnect, failure, or handoff latency                                                                                                | Performance and reliability cannot be managed from evidence                             |
| P1       | Starting voice immediately requests the microphone, but there is no first-use disclosure that Google processes audio and a transcript may be retained in chat                                               | Consent and trust are weaker than the privacy-sensitive interaction requires            |
| P2       | The call replaces the text thread and has no in-call typed fallback, contextual action cards, or direct human handoff                                                                                       | It is less useful than current ChatGPT/Airbnb assistant patterns                        |
| P2       | Transcript retention/deletion and voice-session data retention are not explicitly defined                                                                                                                   | Privacy policy and operational behavior can diverge                                     |
| P2       | Legacy voice settings tables and an unused global-setting mutator remain after consolidation into AI platform settings                                                                                      | Unclear source of truth and migration debt                                              |

## Scope

### In scope

- Guest AI receptionist under `/properties/:propertySlug/messages`
- Direct Gemini Live connection and ephemeral-token minting
- Session state, caps, quota reservation, usage, and cost attribution
- Guest-safe property, inquiry, booking, and active-stay context
- Tool calls, prompt assembly, safety policy, escalation, and handoff
- Live captions, interruption, audio capture/playback, reconnect, and fallback UX
- Transcript integrity and persistence
- Property settings, plan gate, team permission, platform kill switch, and usage visibility
- Privacy disclosure, retention, abuse controls, observability, testing, rollout, and runbooks

### Out of scope

- PSTN or phone-number calling
- A general-purpose web-search assistant
- Booking mutations, payments, refunds, door unlocking, or other autonomous actions
- Replacing Gemini with another provider during this project
- A persistent audio proxy unless the product later requires server-authoritative audio/transcripts or pre-speech moderation
- Voice cloning, biometric identification, emotion detection, or speaker profiling
- Parking voice-receptionist support
- A visual avatar redesign unrelated to responsiveness, accessibility, or performance

## Current implementation map

| Area                     | Current files                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest session hook       | `ui/src/features/guest/chat/hooks/useVoiceSession.ts`                                                                                       |
| Guest API client         | `ui/src/features/guest/chat/lib/voiceReceptionistApi.ts`                                                                                    |
| Audio conversion         | `ui/src/features/guest/chat/lib/voiceAudioCodec.ts`, `ui/public/worklets/voice-pcm-recorder.js`                                             |
| Call UI                  | `ui/src/features/guest/chat/components/voice/VoiceSessionPanel.tsx`, `ReceptionistAvatar.tsx`, `VoiceBoothRing.tsx`, `VoiceMicWaveform.tsx` |
| Chat entry               | `ContactHostSheet.tsx`, `PropertyChatPage.tsx`, `GuestChatHeaderBar.tsx`                                                                    |
| Session endpoints        | `supabase/functions/voice-receptionist-start/`, `voice-receptionist-tool/`, `voice-receptionist-end/`                                       |
| Provider adapter         | `supabase/functions/_shared/geminiLiveEphemeral.ts`                                                                                         |
| Session/settings service | `supabase/functions/_shared/voiceReceptionistService.ts`                                                                                    |
| Tool allowlist           | `supabase/functions/_shared/voiceReceptionistTool.ts`                                                                                       |
| Grounding                | `supabase/functions/_shared/inboxAiGuestContext.ts`, `developmentGuestInfo.ts`                                                              |
| Text safety precedent    | `supabase/functions/_shared/inboxAiSafetyGuard.ts`                                                                                          |
| Transcript polish        | `supabase/functions/_shared/polishVoiceUtterance.ts`                                                                                        |
| Host settings            | `PropertyVoiceReceptionistSection.tsx`, `useVoiceReceptionistSettings.ts`                                                                   |
| Data                     | `voice_receptionist_sessions`, `ai_platform_property_settings.feature_configs.voice_receptionist`, `social_messages.source_mode`            |

## Competitive UX brief

**Job:** Get a trustworthy answer or reach a human quickly without leaving the property conversation.

**Role:** Signed-in guest.

**Surface:** Operational guest messaging.

**Commit point:** Microphone access starts a billed third-party AI session and the conversation may be retained.

### ChatGPT Voice

- Keeps voice inside the same conversation and shows text while the answer is spoken.
- Supports natural interruption and simultaneous listening/speaking.
- Preserves conversation history and lets the user return to text without starting over.
- Makes captions and explicit call controls available.

### Siri

- Uses short, context-aware responses and clear follow-up questions.
- Carries conversational context forward instead of repeating known details.
- Treats privacy and data handling as part of the feature contract.
- Uses concise error and clarification language.

### Airbnb AI Assistant

- Handles routine questions from help, account, listing, and reservation context.
- Uses action cards to move the guest to the next safe step.
- States that AI can make mistakes.
- Lets the guest request a human at any time and keeps escalation in the same conversation.

### Adopt

- Keep voice in the existing property thread.
- Preserve interruption, streaming captions, mute, timer, and explicit end controls.
- Add a short first-use disclosure and a clear AI identity.
- Add safe action cards from server-authored tool results.
- Add one-tap `Message host` handoff during and after a call.
- Ask one specific clarification when required instead of guessing.
- Keep spoken answers to one or two short sentences by default.

### Adapt

- Use property and verified-stay context rather than broad personal memory.
- Restrict knowledge to host-configured and platform-owned data.
- Do not add web search in this hospitality assistant.
- Keep text chat as the reliable fallback when voice or the provider is unavailable.

## Target architecture

```text
Guest taps Talk to receptionist
  -> first-use disclosure / remembered consent
  -> microphone permission from the user gesture
  -> POST voice-receptionist-start
       auth + active property + plan + platform/property flags
       atomic session reservation
       context tier resolution: public | inquiry | verified_stay
       compact server-owned prompt and fixed tool declarations
       current v1beta constrained ephemeral token
  -> browser opens Gemini Live WebSocket
       20-40 ms PCM chunks
       setup timeout
       live transcription + interruption
       session resumption + GoAway handling
  -> allowlisted tool endpoint
       session ownership + active-state + expiry
       topic enum, not free-form regex authorization
       fresh availability/pricing/stay-safe reads
       server-authored UI actions
  -> heartbeat / active acknowledgement
  -> end session
       idempotent state transition and usage write
       client transcript stored only as untrusted session evidence
       no guest-supplied assistant turn becomes a canonical outbound message
       canonical chat receives a neutral voice-session event or trusted summary only
  -> return to text thread with Message host fallback
```

## Architecture decisions

1. **Retain direct browser-to-Gemini Live.** It is still the best latency and serverless fit. Use current constrained ephemeral tokens and keep all sensitive configuration server-owned.
2. **Introduce a provider adapter contract.** UI code must not hardcode a provider protocol URL or model. The start response should return a short-lived connection descriptor produced by the server adapter.
3. **Do not trust client transcript roles.** Browser transcript events are useful UX evidence, not authority for creating outbound host/assistant messages.
4. **Separate context by disclosure tier.**
   - `public`: listing facts safe for any visitor
   - `inquiry`: selected dates, current availability, estimated public price
   - `verified_stay`: only the signed-in guest's matched booking and stay guide facts
5. **Keep secrets out of static grounding.** Do not inject payment account numbers, access instructions, lock codes, WiFi secrets, or exact stay-only details into a general pre-booking session.
6. **Use tools for volatile or sensitive-by-phase data.** Availability, date-specific price, booking status, stay guide, and escalation should be fetched just in time.
7. **No guest-side mutations.** The voice assistant can explain and deep-link. It cannot book, cancel, change dates, take payment, issue refunds, or alter a stay.
8. **Human handoff is a core tool, not an error fallback.** The guest can switch to text and message the host at any time.
9. **Use one explicit session state machine.** `reserved -> connecting -> active -> ending -> ended`, with terminal `failed`, `abandoned`, and `expired`.
10. **Do not add a proxy solely for transcript trust.** If canonical assistant turns are a hard product requirement, create a separate future plan for a stateful relay. Supabase Edge Functions are not the right long-lived socket host.
11. **Accept the direct-audio safety boundary explicitly.** A direct browser-to-provider stream cannot run an independent server post-generation classifier before speech reaches the guest. The production boundary is the locked system policy, provider safety settings, minimum-data grounding, closed tools, short answers, and human handoff. If independent pre-speech filtering becomes mandatory, voice must move to a separate stateful relay architecture before rollout.

## Implementation plan

### Phase 0 - Freeze, measure, and define launch gates

- [x] Keep the property opt-in and platform kill switch default-off until P0 phases pass.
- [x] Add a staging-only provider canary that mints a token, opens a short session, receives setup completion, and closes without recording audio.
- [ ] Capture current baseline on Chrome, Safari, and mobile Safari:
  - microphone prompt to WebSocket open
  - WebSocket open to setup complete
  - speech start to first input caption
  - speech end to first audio
  - tool request to tool response
  - clean-end success rate
- [ ] Confirm the paid Gemini project, data-processing terms, retention/training settings, regional requirements, billing alerts, and key restrictions.
- [x] Define rollout gates:
  - no P0 security findings
  - provider canary green for seven days
  - p95 startup under 3 seconds after permission
  - p95 first audio under 3 seconds for static FAQs and under 5 seconds for tool-backed questions
  - clean or recovered completion for at least 99 percent of staging sessions
  - zero forged canonical outbound transcript paths
- [x] Add the feature to the incident runbook with kill-switch ownership and a provider-outage fallback to text chat.

**Files/docs:** `docs/archive/operations/incident-response.md`, `docs/archive/operations/ai-platform-billing.md`, provider canary under `supabase/functions/` only when implementation starts.

**Exit gate:** Baseline and measurable acceptance criteria exist before refactoring.

### Phase 1 - Provider protocol and model lifecycle (P0)

- [x] Replace the `v1alpha` auth-token request and `BidiGenerateContentConstrained` URL with the current documented `v1beta` ephemeral-token and Live WebSocket contract.
- [x] Replace `bidiGenerateContentSetup` token constraints with current `liveConnectConstraints`.
- [x] Move WebSocket endpoint ownership out of the UI and return a provider connection descriptor from the server.
- [x] Stop treating a dated preview model as permanent. Put the approved Live model in one server-side model registry with:
  - current model id
  - rollout status
  - retirement date/review date
  - supported voices and capabilities
- [x] Add startup health handling that fails closed with `Voice is unavailable` when the configured model cannot mint or connect.
- [x] Enable `contextWindowCompression` and `sessionResumption` in the locked setup.
- [x] Enforce a maximum session length compatible with provider limits until resumption is verified. Do not allow the current 3,600-second setting against an unresumable connection.
- [x] Handle `GoAway`, `sessionResumptionUpdate`, close code, close reason, provider error payloads, and `generationComplete`.
- [x] Attach WebSocket handlers before sending setup so `setupComplete` cannot race past `onmessage`.
- [x] Add a bounded setup timeout and one reconnect attempt with jitter. Do not loop indefinitely.
- [x] Version the client/server voice protocol so stale deployed clients fail with a controlled message.
- [x] Add fixture-based protocol contract tests for setup, audio, transcription, interruption, tool call, `GoAway`, resumption, normal close, and provider error.

**Primary files:** `geminiLiveEphemeral.ts`, `voice-receptionist-start/index.ts`, `voiceReceptionistApi.ts`, new `liveVoiceProtocol.ts`, `useVoiceSession.ts`.

**Exit gate:** Current official provider contract passes canary and fixture tests. No provider endpoint or model id remains duplicated in UI code.

### Phase 2 - Transcript integrity and session lifecycle (P0)

- [x] Add a new migration for explicit session state and lifecycle fields:
  - `status`
  - `reserved_at`
  - `connected_at`
  - `last_activity_at`
  - `ended_at`
  - `failure_code`
  - `provider_model`
  - `protocol_version`
  - `transcript_status`
  - `client_report_hash`
- [x] Add a dedicated `voice_receptionist_transcript_turns` table if transcripts remain available to hosts:
  - references session
  - role
  - text
  - sequence
  - source=`client_reported`
  - trust=`unverified`
  - no representation as a host/outbound social message
- [x] Replace count-then-insert with a transactional `reserve_voice_receptionist_session(...)` RPC.
- [x] Serialize reservation by property and guest inside the RPC, then count and insert in one transaction.
- [x] Count successful/active sessions for the guest daily allowance. Track failed provisioning attempts separately under the durable start rate limit.
- [x] Add a short `connecting` lease. If the client never acknowledges `setupComplete`, expire it without consuming the guest's completed-session allowance.
- [x] Add an authenticated active/heartbeat acknowledgement with bounded frequency.
- [x] Add a stale-session reaper using the existing cron pattern. Mark stale `connecting` sessions `failed` and stale `active` sessions `abandoned`.
- [x] Make end-session one atomic, idempotent transition that returns the stored terminal result on retry.
- [x] Add a unique processed marker/hash so transcript storage runs at most once per client report.
- [x] Bound transcript turns, per-turn characters, total characters, timestamps, and accepted roles before storage.
- [x] Remove the current path that inserts guest-supplied `assistant` turns as outbound `social_messages`.
- [x] Decide canonical chat representation:
  - recommended: one neutral `Voice conversation ended` system event plus the unverified transcript in the session detail
  - acceptable alternative: guest turns may be copied as inbound messages because the same guest can already send arbitrary inbound text; assistant turns remain outside canonical outbound messages
- [x] Make page close best-effort with `fetch(..., { keepalive: true })` or an equivalent small authenticated end signal. Keep the reaper as the source of truth.
- [x] Record one usage row exactly once, including failed/abandoned sessions with zero or measured billable duration as appropriate.
- [ ] Remove or migrate the legacy `voice_receptionist_global_settings` and `voice_receptionist_settings` tables after confirming hosted data was copied. The backfill/drop migration is staged but not hosted-verified.
- [x] Delete the unused `setGlobalVoiceReceptionistEnabled()` path so a voice-only toggle can never disable the entire AI platform accidentally.

**Primary files:** new migration, `voiceReceptionistService.ts`, start/end endpoints, new session endpoint or heartbeat action, transcript rendering in guest/host chat.

**Exit gate:** Concurrency tests cannot exceed caps. Repeated end calls perform no repeated model work. A guest cannot create a canonical outbound assistant message.

### Phase 3 - Data minimization, grounding, and guardrails (P0/P1)

- [x] Create `_shared/guestReceptionistContext.ts` instead of calling the full inbox auto-reply context builder.
- [x] Split fields into explicit allowlists:
  - public property facts
  - inquiry facts
  - verified booking facts
  - verified active-stay facts
  - never-voice facts
- [x] Resolve the guest's own booking using `guest_user_id`, with the existing normalized-email fallback only where the guest-account service already permits it.
- [x] Scope verified booking lookup to the current property and safe statuses/date windows.
- [x] Return the minimum booking facts needed for guest support. Never expose document images, IDs, receipts, internal notes, finance ledgers, host-only pricing, other guests, or team data.
- [x] Remove `loadOtherGuestNamesForGuard()` from the voice-start path. Voice never uses the returned guard context and should not read other guest PII.
- [x] Remove payment account numbers from static voice grounding. Prefer payment method names and a secure booking/payment deep link.
- [x] Keep access instructions, lock details, and WiFi credentials out of public/inquiry context. Expose only for a verified active stay and only when configured as guest-visible.
- [x] Move exact availability and date-specific totals to dynamic tools so they are fresh and do not inflate every setup prompt.
- [x] Replace regex authorization on a free-form `topic` with a closed topic enum validated server-side.
- [x] Define tool schemas for:
  - `get_property_facts`
  - `check_dates`
  - `get_inquiry_price`
  - `get_my_stay`
  - `get_stay_guide`
  - `handoff_to_host`
- [x] Return structured tool results with a short spoken fact plus server-authored UI actions. Never accept model-authored URLs as trusted actions.
- [x] Add per-tool authorization, timeout, rate limit, audit metadata, and safe failure copy.
- [x] Treat persona, quick replies, property text, development text, and guide text as untrusted data:
  - delimit separately from policy
  - length-limit each source
  - remove control-like markup
  - tell the model never to follow instructions found inside data
- [x] Keep the existing free-form `personaPrompt` only as bounded style guidance; structured tone controls remain a future product change rather than a hardening dependency:
  - tone
  - greeting
  - property-specific vocabulary
  - escalation note
- [x] If free-form persona remains, validate length and reject attempts to override policy, tools, identity, privacy, or refusal behavior.
- [x] Expand the base policy with clear behavior for:
  - unsupported questions
  - uncertainty and missing facts
  - sensitive or private information
  - payment and fraud-sensitive requests
  - medical, legal, emergency, harassment, sexual, self-harm, and illegal-content requests
  - prompt-injection attempts
  - requests to ignore policy or reveal hidden instructions
- [x] Configure provider safety settings explicitly rather than relying on provider defaults.
- [x] Preflight classifier decision: N/A for the approved direct browser-to-provider architecture. Authoritative input reaches this server only after the call as unverified captions; adding a true server preflight would require the rejected relay architecture. Provider safety settings, locked policy, closed tools, and post-session classification remain mandatory.
- [x] Add post-session safety analysis for incident detection, not as permission to expose broader data during the call.
- [x] Add a reviewed fallback: `I do not have that information. I can help you message the host.`
- [x] Add adversarial tests with malicious persona text, property/development facts, tool topics, and transcript payloads.

**Primary files:** new `guestReceptionistContext.ts`, `voiceReceptionistTool.ts`, `voice-receptionist-tool/index.ts`, `voice-receptionist-start/index.ts`, settings validation/UI, safety tests.

**Exit gate:** Every fact maps to an explicit disclosure tier. Untrusted host content cannot change the fixed policy or tool set. Verified-stay facts are inaccessible to a different guest.

### Phase 4 - Fast and natural conversation

- [x] Split `useVoiceSession.ts` into protocol, phase reduction, transcript assembly, audio codec, microphone capture, playback queue, tool dispatch, and timing modules. The hook retains top-level WebSocket and React orchestration:
  - connection lifecycle
  - microphone capture
  - playback queue
  - transcript assembly
  - tool dispatch
  - timers and metrics
- [x] Keep one legal transition table so `connecting`, `listening`, `thinking`, `speaking`, `reconnecting`, `ending`, `ended`, and `error` cannot race.
- [x] Coalesce worklet frames into 20-40 ms PCM packets before base64/WebSocket send.
- [x] Move PCM conversion and packet assembly into the AudioWorklet and keep base64 work outside React rendering.
- [ ] Replace one-`AudioBufferSourceNode`-per-packet playback with an AudioWorklet/ring buffer if profiling shows gaps or high scheduling overhead.
- [x] Keep immediate buffer cancellation on interruption.
- [x] Add echo/feedback guidance when the device repeatedly triggers false interruptions.
- [x] Send `audioStreamEnd` when capture pauses long enough for provider flushing, while allowing capture to resume.
- [x] Start with one brief greeting that identifies the AI and invites a property/stay question.
- [x] Keep spoken answers concise and use one clear clarification question when dates, property, or stay context is ambiguous.
- [x] Preserve conversation context across follow-ups within the session.
- [x] Show streaming guest and assistant captions without discarding non-Latin speech. Replace the current Latin-majority filter with supported-language handling or a documented English-only gate.
- [x] Defer a host-configurable supported-language policy until accuracy is tested; multilingual transcript chunks are retained.
- [x] Make `Message host` available throughout the call.
- [x] Let the guest return to text through an explicit host-handoff action that ends voice cleanly.
- [x] Render server-authored action cards for calendar, booking form, stay guide, property page, and host handoff.
- [x] Add an accessible status announcement strategy that does not read every partial caption repeatedly.
- [x] Verify reduced motion, keyboard operation, screen-reader labels, color contrast, and 44 px controls.
- [ ] Test 375 px, 768 px, desktop, safe-area insets, virtual keyboard, rotation, background/foreground, and screen lock. Automated 375/768/desktop, safe-area CSS, no-overflow, and portrait/landscape checks pass; physical mobile Safari virtual-keyboard, background/foreground, and screen-lock checks remain.
- [x] Keep UI copy short and use one active-call end control.

**Primary files:** `useVoiceSession.ts`, new voice lib modules, worklet, `VoiceSessionPanel.tsx`, `VoiceMicWaveform.tsx`, guest chat components.

**Exit gate:** Measured latency meets Phase 0 budgets on supported devices. Interruption, captions, fallback, and handoff work without losing the thread.

### Phase 5 - Privacy, consent, and retention

- [x] Add a first-use pre-call disclosure inside the existing in-thread voice panel (no additional modal layer):
  - identifies the AI receptionist
  - says microphone audio is processed by Google Gemini
  - says audio is not stored unless that changes
  - says a transcript/session record may be saved
  - links to Privacy
  - provides `Continue` and `Cancel`
- [x] Remember disclosure acknowledgement by version, not forever. Show it again when terms materially change.
- [x] Keep the browser microphone indicator and in-product listening state visible for the entire session.
- [x] Stop capture immediately on end, route change, sign-out, permission revocation, or fatal error.
- [x] Define retention for:
  - session metadata
  - client-reported transcript
  - canonical chat event
  - safety flags
  - provider identifiers
- [x] Add deletion behavior for guest account/property cascade and authenticated guest privacy requests.
- [x] Document a dedicated 1-90 day transcript window, defaulting to 30 days.
- [x] Never store raw audio in this project.
- [x] Never log transcript text, tokens, account numbers, booking identifiers, or ephemeral credentials to console, PostHog, or provider-health logs.
- [x] Update the privacy page, data-model docs, and route guide with the exact implemented behavior.

**Primary files:** guest voice entry components, `PrivacyPage.tsx`, new migration/retention cron if required, route guide, data-model docs.

**Exit gate:** Consent, data flow, retention, deletion, and provider terms match the product and documentation.

### Phase 6 - Observability, cost, and operator controls

- [x] Add voice event names to the PostHog catalog without transcript or PII:
  - entry shown
  - disclosure accepted/cancelled
  - start requested
  - setup completed
  - first caption
  - first audio
  - interruption
  - tool started/completed/failed
  - reconnect started/succeeded/failed
  - handoff selected
  - ended with reason
- [x] Add server metrics for start rejection by gate, reservation conflict, mint latency, tool latency/error, end idempotency, transcript processing, and stale-session cleanup.
- [x] Store structured failure codes rather than only free-form messages.
- [x] Add p50/p95 views for startup, first audio, tool latency, session length, reconnects, and completion.
- [x] Add alert thresholds for provider failures, mint failures, reconnect spikes, session abandonment, quota pressure, and estimated/actual cost drift. The seven-day operational rollup flags provider failures at 5%, reconnects at 10%, abandonment at 5%, and cap denials at 5%; quarterly invoice reconciliation pauses rollout at 20% estimated/actual drift.
- [x] Reconcile voice cost with the shared AI quota and cost model. Do not create a second quota model here.
- [x] Reuse the existing super-admin service-cost controls for platform spend alerts and degradation.
- [x] Keep property usage lightweight, but add failure and handoff rates so hosts can see whether the feature helps.
- [x] Add global model/protocol health to the super-admin AI surface.
- [x] Define outage behavior:
  - hide or disable voice entry after the cached health signal expires
  - explain briefly
  - keep text chat and host messaging available
- [x] Confirm session-start and settings activity decisions:
  - settings changes continue using `integrations.config_changed`
  - session telemetry remains in session/usage tables
  - `activity-log: N/A` for each high-volume guest voice turn because it is usage telemetry, not an operator mutation

**Exit gate:** Operators can detect a slow, broken, unsafe, or expensive rollout before guest reports accumulate.

### Phase 7 - Automated verification

- [x] UI unit tests:
  - reducer transition table
  - transcript delta/cumulative merge
  - multilingual handling
  - packet coalescing and PCM conversion
  - reconnect/backoff
  - interruption buffer clear
  - countdown/idle behavior
  - action-card allowlist
- [ ] Edge unit tests (settings, closed tools, date bounds, rollout/circuit behavior, untrusted-data formatting, safety flags, and transcript bounds are covered; database-backed ownership/tier cases remain):
  - settings validation
  - closed topic enum
  - context-tier resolution
  - booking ownership
  - prompt-data delimiters
  - safety/refusal policy
  - transcript bounds
  - idempotent end processing
- [ ] Database/RPC tests (static locking/idempotency contracts exist; executable concurrent RPC tests require the local database):
  - simultaneous reservation at daily cap
  - simultaneous reservation at property cap
  - failed connection lease expiry
  - one usage row per session
  - transcript row uniqueness
- [ ] Handler tests with mocked provider (auth/ownership/terminal-state source contracts exist; full mocked request/provider cases remain):
  - start gate matrix
  - token mint failure
  - tool ownership and ended-session rejection
  - forged assistant transcript rejection
  - repeated end request
  - quota and rate-limit response shape
- [x] Mocked Playwright:
  - first-use disclosure
  - mic denied
  - successful setup/captions
  - interruption
  - tool/action card
  - reconnect
  - provider unavailable to text fallback
  - handoff to host
  - mobile layout
- [x] Manual/live guide:
  - Chrome desktop
  - Android Chrome
  - iOS Safari
  - macOS Safari
  - noisy room/headphones/Bluetooth
  - slow network, offline transition, background/foreground
  - long pause, long answer, repeated barge-in
  - English and each explicitly supported language
- [x] Add an opt-in provider integration test that is excluded from PR CI and refuses production.
- [x] Run `bun run test`, `bun run test:edge`, `bun run test:edge:handlers`, `bun run test:e2e:smoke`, and `bun run ci:quality` before moving to for-testing.

**Exit gate:** P0/P1 behavior is covered below the UI, and real-device/provider verification has a repeatable checklist.

### Phase 8 - Staged rollout

- [ ] Deploy disabled globally.
- [ ] Run internal dogfood with synthetic property facts and no real guest stay secrets.
- [ ] Enable one test property with staff accounts.
- [ ] Enable a small host pilot with transcript review and explicit feedback.
- [x] Use percentage/property allowlisting rather than enabling every eligible property at once.
- [ ] Review daily for the first week:
  - unsafe or irrelevant answers
  - startup/turn latency
  - errors/reconnects
  - handoff rate
  - session abandonment
  - cost per completed session
- [x] Define rollback triggers and the global feature kill-switch procedure before pilot. Hosted switch testing remains part of the pilot.
- [ ] Expand only after the Phase 0 launch gates hold for seven consecutive days.

**Exit gate:** Rollout is reversible, measured, and limited by property.

### Phase 9 - Cleanup after acceptance

- [x] Remove deprecated `VoiceSessionOverlay` alias when no imports remain.
- [ ] Remove legacy tables and stale documentation only after hosted migration verification.
- [x] Remove outdated comments that describe accepted v1 risks as current architecture.
- [x] Consolidate duplicate provider URL/model/voice constants.
- [x] Update the done v1 document with a pointer to this production-readiness successor rather than rewriting its historical record.
- [ ] Move this plan through `in-progress -> for-testing -> done` using the workflow commands, never by copying it.

## Testing and acceptance matrix

| Area              | Required evidence                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Auth              | Another guest cannot start, use tools for, end, or read a session they do not own         |
| Tenant scope      | Property and organization context cannot cross scopes                                     |
| Data tiers        | Public guest cannot receive verified-stay data; verified guest can receive only their own |
| Prompt injection  | Host content cannot change policy, tools, identity, or disclosure rules                   |
| Transcript trust  | Client cannot create an outbound AI/host message                                          |
| Caps              | Parallel starts never exceed guest/property limits                                        |
| Idempotency       | Repeated end/heartbeat/tool requests do not duplicate usage, transcript, or side effects  |
| Provider recovery | One connection reset recovers without losing context; exhausted retries fall back to text |
| Interruption      | Assistant audio stops promptly and does not resume stale buffered speech                  |
| Latency           | Startup, caption, tool, and first-audio p95 meet launch budgets                           |
| Accessibility     | Keyboard, screen reader, reduced motion, contrast, captions, and touch targets pass       |
| Privacy           | Disclosure, no raw audio storage, retention, and deletion match docs                      |
| Cost              | Estimated cost is reconciled to provider billing and bounded by shared AI quotas          |

## Documentation to update during implementation

- `docs/guides/routes/properties/chat.md`
- `docs/guides/routes/org/property/settings.md`
- `docs/guides/testing/voice-receptionist-manual.md`
- `docs/PROJECT.md`
- `docs/architecture/edge-functions.md`
- `docs/architecture/data-model.md`
- `docs/architecture/validation-and-env.md` if configuration changes
- `docs/architecture/plans-feature-matrix.md` only if the existing `aiReceptionist` entitlement changes
- `docs/archive/operations/ai-platform-billing.md`
- `docs/archive/operations/incident-response.md`
- `ui/src/features/guest/marketing/pages/PrivacyPage.tsx`

## Plans, permissions, and audit decisions

- **Plans:** keep the existing `aiReceptionist` feature key. No new plan key is needed for hardening.
- **Team permissions:** keep `settings.voiceReceptionist:edit` for mutation and `settings:view` for read/usage. No guest role change is needed.
- **Activity log:** keep settings changes as `integrations.config_changed`. Voice turns and session heartbeats are high-volume usage telemetry, not org-state mutations, so they should not create activity-log rows.
- **PostHog:** add lifecycle/performance events without transcript text or identifiers.

## Dependencies and overlap

- `ai-paid-provider-and-production-quotas.md` owns paid provider keys, production quota defaults, guest/staff budget separation, and voice cost calibration.
- `super-admin-service-cost-monitoring.md` owns cross-service spend alerts and degradation controls.
- `cost-abuse-security-production-readiness.md` already owns the broad authenticated rate-limit and platform cost guard work.
- This plan owns the receptionist-specific protocol, session, trust, context, UX, safety, test, and rollout work.

## Recommended execution order

1. Phase 0 baseline and gates
2. Phase 1 provider protocol
3. Phase 2 transcript/session trust
4. Phase 3 context and guardrails
5. Phase 7 backend/protocol tests for Phases 1-3
6. Phase 4 conversation UX and latency
7. Phase 5 privacy and retention
8. Phase 6 observability and cost integration
9. Phase 7 full UI/live verification
10. Phase 8 rollout
11. Phase 9 cleanup

Do not start guest-facing polish before the P0 provider and trust-boundary phases are complete.

## Open questions

None required to begin Phase 0. The transcript retention duration and whether hosts need access to unverified client-reported transcripts must be approved before Phase 5 exits.
