---
stage: done
title: 'Voice transcript grammar polish (LLM)'
status: done
tags: [planning, planned-modules]
updated: 2026-08-01
---

# Voice transcript grammar polish (LLM)

**Status:** Revised 2026-07-31 — **batch-at-end only** (no per-turn Flash)

## Goal

Readable Inbox transcripts without burning tokens / adding latency on every spoken phrase.

## Approach

| Surface          | Behavior                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Booth captions   | Live Gemini STT only (simple cumulative merge). Link cards for https. No Flash mid-call. |
| Inbox transcript | **One** Gemini Flash call inside `voice-receptionist-end` rewrites every turn            |
| Spoken money     | System prompt + grounding say **pesos**, never “PHP”                                     |

## Why not per-turn polish

Calling Flash on every turn added latency, cancelled mid-sentence captions, and cost tokens while the booth still looked broken when polish failed or raced.

## Gotchas found in testing

- `gemini-2.5-flash` reasons by default; thinking tokens consumed `maxOutputTokens`, the request
  ran past the 8 s abort, and every transcript silently fell back to raw STT
  (`[polishVoiceTranscriptTurns] fallback to raw: The signal has been aborted`). Fix:
  `thinkingConfig: { thinkingBudget: 0 }`, `responseSchema`, 20 s budget — ~2.3 s per call.
- The thread relied only on a realtime INSERT to show voice turns. `useVoiceSession.end` now
  invalidates the guest chat message queries once `voice-receptionist-end` resolves (the
  transcript write completes before the response), so no manual refresh is needed.
- Polish + transcript write now run **after** session validation / `ended_at`, so an invalid
  session no longer spends a Flash call.

## Implementation map

| Piece          | Path                                                                                |
| -------------- | ----------------------------------------------------------------------------------- |
| Batch polish   | `supabase/functions/_shared/polishVoiceUtterance.ts` → `polishVoiceTranscriptTurns` |
| Applied on end | `supabase/functions/voice-receptionist-end/index.ts`                                |
| Link cards     | `ChatUrlLinkCard.tsx` + `parseChatRichBlocks` `urlLink`                             |
| Pesos          | `voice-receptionist-start` `VOICE_SYSTEM_CORE` + `factsTextForVoice`                |
| Session UI     | `ui/src/features/guest/chat/hooks/useVoiceSession.ts`                               |

## Open questions

None.
