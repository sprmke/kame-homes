---
stage: done
title: 'AI Receptionist Experience Pass'
status: done
tags: [ai, voice, guest-chat, performance, animation, ux]
updated: 2026-10-04
---

# AI Receptionist Experience Pass

Follow-up to [`ai-receptionist-production-readiness.md`](./ai-receptionist-production-readiness.md).
That plan closed the trust boundary, lifecycle, guardrails, and telemetry. This pass rechecks the
module end to end for audio quality, startup latency, animation smoothness, transcript assembly,
and asset weight.

## Verdict

No ground-up redesign. Direct browser-to-Gemini Live with a server-locked ephemeral token is still
the best latency, cost, and serverless fit. The defects are in the client audio pipeline, phase
stability, avatar media, and serial start-up work.

### Transcription options reviewed

| Option                                  | Cost                    | Verdict                                                                                                    |
| --------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| Gemini Live input/output transcription  | Included in the session | **Keep.** Output text is the model's own words; input shares the session's audio, so no extra upload       |
| Browser Web Speech API                  | Free to us              | Reject. Sends audio to Google anyway, missing in Firefox, unreliable on iOS, competes with our mic capture |
| In-browser Whisper / Moonshine (WebGPU) | Free to us              | Reject. 40-150 MB model download and heavy CPU on guest phones                                             |
| Separate STT API (Deepgram, AssemblyAI) | Per-minute bill         | Reject. Duplicates audio upload and cost for a feature Gemini already returns                              |
| Post-call LLM transcript polish         | Per-call bill           | Already removed. Keep it removed; deterministic client merge only                                          |

Transcript quality work is deterministic: ordered frame handling, stable caption identity, and
the existing delta/cumulative merge.

## Findings

| #   | Area          | Finding                                                                                                                   | Fix                                                                                         |
| --- | ------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Render perf   | `amplitude` is React state set up to 60 times a second; every frame re-renders the panel                                  | Amplitude lives in a ref-backed store; visuals write CSS variables from one rAF loop        |
| 2   | Phase flicker | Playback reports idle between network chunks, flipping speaking → listening → speaking                                    | Idle grace period in the playback queue; displayed status has a minimum dwell               |
| 3   | Avatar        | Talk loop starts arm-up/mouth-open while the poster is arm-down; loop wraps 8.1 s → 0.6 s; keyframes at 0 s and 10 s only | Re-encoded boomerang loop that starts and ends on the poster frame; native `loop`; no seeks |
| 4   | Asset weight  | 2 MB 720×1280 MP4 and 400 KB PNG rendered at 138 px                                                                       | 320 px square MP4 + WebP poster                                                             |
| 5   | Captions      | React key includes the caption text prefix, so streaming bubbles remount                                                  | Stable per-turn ids                                                                         |
| 6   | Motion        | Waveform mounts/unmounts, ring swaps animation classes, panel has no enter/exit                                           | Always-mounted layers with opacity crossfades; panel enter/exit transitions                 |
| 7   | Protocol      | Blob frames decoded with `await blob.text()` can reorder audio and transcript chunks                                      | `binaryType = 'arraybuffer'` + synchronous `TextDecoder`                                    |
| 8   | iOS audio     | Barge-in closes the playback `AudioContext`; the replacement is created outside a user gesture                            | Keep one context; stop scheduled sources only. Create and unlock contexts in the start tap  |
| 9   | Firefox       | Mic `AudioContext` forced to 16 kHz breaks `MediaStreamSource` at the device rate                                         | Device-rate context; the worklet already resamples to 16 kHz                                |
| 10  | Playback      | No jitter buffer; late chunks play back-to-back with gaps                                                                 | Small lead-in buffer when the queue restarts                                                |
| 11  | Startup       | Setup ack request and worklet module load run serially before listening                                                   | Preload worklet during token mint; ack in the background                                    |
| 12  | Startup       | `voice-receptionist-start` runs about ten DB round-trips serially                                                         | Run independent gate reads and thread setup concurrently; keep gate order for denial codes  |
| 13  | Page close    | `pagehide` sends a keepalive end and a second full end with a different transcript                                        | One keepalive end; local teardown only                                                      |
| 14  | Reconnect     | A dropped socket ends the call even with a resumption handle                                                              | Unexpected close resumes once when a handle exists                                          |

## Implementation checklist

- [x] Audio: one playback context, source tracking, idle grace, jitter lead-in, gesture unlock
- [x] Audio: device-rate mic context, worklet preload during mint
- [x] Protocol: ordered `arraybuffer` decoding; resume on unexpected close with a handle
- [x] Hook: ref-backed amplitude store; stable caption ids; single page-close end; background ack
- [x] UI: panel enter/exit, always-mounted waveform/ring layers, status dwell, caption keys
- [x] Avatar: re-encoded boomerang loop + WebP poster; crossfade without seeks; CSS-variable motion
- [x] Edge: concurrent reads in `voice-receptionist-start`
- [x] Tests: playback queue, status dwell, protocol decoding, existing voice suites
- [x] Docs: route guide, testing guide, architecture notes

## Follow-up: weak network, silence, background (2026-10-04)

| Gap found on re-check                                                                                | Fix                                                                         |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Edge requests had no timeout; a slow network could leave **Connecting…** or **Ending call…** forever | Per-call `AbortSignal.timeout` budgets with plain error copy                |
| Raw "Failed to fetch" / JSON parse errors could reach the guest                                      | Mapped to friendly network/unavailable messages                             |
| Idle counted raw mic level, so room noise (boosted by auto gain) held silent calls open              | Activity = recognized speech, replies, tools, unmute                        |
| Idle ended the call without warning                                                                  | **Still there?** at 30 s, end at 45 s                                       |
| Countdown and idle checks ran on rAF, which pauses in background tabs                                | 250 ms session clock on `setInterval`                                       |
| No offline handling; a dead socket could take minutes to close on mobile                             | `offline` → notice, end with text fallback after 10 s                       |
| Unbounded socket send buffer on a slow uplink                                                        | Drop mic packets above 64 KB `bufferedAmount`                               |
| iOS suspends audio on background/lock/phone call; mic stayed dead after return                       | Resume both contexts on `visibilitychange` (including Safari `interrupted`) |

## Verification (2026-10-04)

- `vitest` guest chat suites: 53 passed (new: playback queue, view mapping, frame decoding,
  PCM round trip). The playback test caught and fixed a missing lead-in on the first chunk.
- `test:edge` 584 passed; `test:edge:handlers` 114 passed; `deno check` on the start function.
- `voiceReceptionistConsent.spec.ts` 21 passed across chromium-ci, mobile, and tablet smoke,
  including the idle warning and offline fallback.
- Remaining: physical-device pass in `docs/guides/testing/voice-receptionist-manual.md`
  (Motion and audio smoothness) and the hosted items in the production-readiness plan.

## Plans, permissions, audit

- **Plans:** N/A. No entitlement change; `aiReceptionist` unchanged.
- **Team permissions:** N/A. Guest-facing behavior only.
- **activity-log:** N/A. No new mutating capability; existing session/usage telemetry unchanged.
- **Unsaved changes:** N/A. No editable fields added.

## Closure (2026-10-04)

Closed by owner decision. Repository work is complete and verified (unit, edge, handler, and
mocked E2E suites green). The following remain as accepted residual operational checks, not open
plan scope:

- Physical-device pass in `docs/guides/testing/voice-receptionist-manual.md` (iOS/Android Safari
  and Chrome, Bluetooth, background/lock, motion and audio smoothness).
- Hosted items: seven-day provider canary, provider console/legal and billing confirmation, local
  concurrent RPC tests, legacy table removal after hosted verification, and the staged pilot.
- Gemini Live Preview model review on 2026-10-15.
