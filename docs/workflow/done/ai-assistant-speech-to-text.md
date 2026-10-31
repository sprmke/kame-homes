---
title: 'AI dashboard assistant — speech-to-text'
status: active
tags: [workflow, done, ai, dashboard]
updated: 2026-08-27
stage: done
kind: reference
---

# AI dashboard assistant — speech-to-text (shipped)

Browser **Web Speech API** dictation in the dashboard AI assistant composer.

## Shipped (2026-08-27)

| Area            | Change                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hook**        | `useSpeechToText` — continuous + interim results, appends to existing composer text, auto-restarts session until user stops                                 |
| **Composer**    | Mic in toolbar (after paperclip); hidden when unsupported; stops on send/disabled/unmount                                                                   |
| **Permissions** | Mic preflight via `getUserMedia` before starting recognition; HTTPS/localhost required                                                                      |
| **Errors**      | User-facing toasts for blocked mic, no device, network, unsupported browser                                                                                 |
| **UI**          | `ChatComposerVoiceButton` — primary tint when listening, subtle bottom meter bars (`animate-voice-meter`), no ping/pulse; respects `prefers-reduced-motion` |

## Implementation map

| Piece           | Path                                                                            |
| --------------- | ------------------------------------------------------------------------------- |
| Hook            | `ui/src/features/dashboard/ai-assistant/hooks/useSpeechToText.ts`               |
| Helpers         | `ui/src/features/dashboard/ai-assistant/lib/speechRecognition.ts`               |
| Button          | `ui/src/features/dashboard/ai-assistant/components/ChatComposerVoiceButton.tsx` |
| Composer wiring | `ui/src/features/dashboard/ai-assistant/components/ChatComposer.tsx`            |
| Types           | `ui/src/types/speech-recognition.d.ts`                                          |
| Manual QA       | `docs/guides/testing/ai-dashboard-assistant-manual.md` §2.3                     |

## Behavior notes

- **Supported:** Chrome, Safari, Edge on secure context (`window.isSecureContext`). Firefox — mic hidden.
- **Language:** `document.documentElement.lang` or `navigator.language`; bare `en` → `en-US` for WebKit reliability.
- **No server cost:** Recognition runs in the browser; only typed/sent text hits Gemini.
- **Cleanup:** `releaseRecognition({ abort: true })` on unmount; `disabled` prop stops an active session.

## Related (same session)

Guest profile **location search** (`LocationSearchInput`): Popover suggestions (fixes Vite 404), lazy Places-only Maps load, debounced autocomplete with stale-response guard — see [`guest-auth-and-profile.md`](./guest-auth-and-profile.md).
