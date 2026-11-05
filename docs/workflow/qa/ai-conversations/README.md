# AI companion conversation QA

Screenshot-driven loop for the dashboard assistant (sheet + AI mode) and the guest receptionist (web chat, later voice). Automated evals score tool choice and block shape; this loop scores whether a reply _looks_ helpful on a phone.

Canonical plan: [`docs/workflow/for-testing/ai-companion-response-quality-and-generative-ui.md`](../../for-testing/ai-companion-response-quality-and-generative-ui.md) § H.

**Resume later (2026-10-20):** the plan is **not done**. Remaining TODOs, what shipped, and recapture ids: [`session-milestone.md`](./session-milestone.md).

## Setup

1. Local stack: `./dev.sh` with `GEMINI_API_KEY` in `supabase/.env.local`.
2. Seed: `bun run seed:ai-qa` (org `kame-home`, property `monaco-2612`, tagged `ai_qa_seed`). Safe to re-run. Sets `user_ui_preferences.dashboard_mode=ai`, raises the org assistant message cap to 500/day, the org AI call cap to 2000/day, and the org credit allowance to 100000/day and 1000000/month (plus a 1M wallet top-up) so a full 1440+375 corpus does not hit Growth's small plan allowance. Snoozes the setup-guide overlay from the driver, lifts `aiDashboardAssistant`, `aiChatAutoReply`, and `aiReceptionist` on that org (local "Pro" is the Growth row, where those flags are off until Business), turns on web inbox auto-send, enables the local voice booth (org voice on, platform rollout 100%, canary circuit cleared, guest voice session cap 80/day), and appends `inbox_suggest` plus `inbox_auto_reply` to a non-empty platform `allowed_features` list (local is often `{voice_receptionist,dashboard_assistant}` after the voice backfill, which would otherwise block the Automated guest reply).
3. Optional: `bun run sync:prod-data` first if the local org is empty.
4. Driver: `bun run qa:ai -- --run 0 --ids H-01,H-25` (sample) or `--all` (full corpus, live tokens).

Screenshots: `ui/e2e/artifacts/ai-conversations/<run-id>/<surface>/<viewport>/<id>.png` (gitignored). Ledgers: `run-<n>.md` in this folder (committed).

## Surfaces and viewports

| Surface | URL                                                                               | Notes                                                                                                                                                                                                                                                                                                                                                                                           |
| ------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai`    | `/org/kame-home/property/monaco-2612?mode=ai`                                     | Full-page AI mode                                                                                                                                                                                                                                                                                                                                                                               |
| `sheet` | same with `?mode=advanced`                                                        | Sheet overlay; open the launcher if the composer is not in the DOM                                                                                                                                                                                                                                                                                                                              |
| `guest` | `/properties/monaco-2612/messages?checkInDate=2026-12-24&checkOutDate=2026-12-26` | Guest web chat as `ai-qa-guest@example.test`. Waits for the Automated badge. G-41…G-43 (parking) currently use this same property chat so `get_parking_facts` can answer; the parking-request status sheet is a separate host-linked surface.                                                                                                                                                   |
| `voice` | same guest URL                                                                    | Opens **Talk to receptionist**, Start call, then sends each question as Live `realtimeInput` text (local DEV hook). Skip G-44…G-48 UX rows. Default sample G-01, G-12, G-23. Local runs clear the 5-minute unhealthy mint circuit and `voice-receptionist-start` rate-limit rows so a prior failed mint does not hide the menu. Restarts the call every 20 turns (default session cap is 300s). |

Viewports: `1440` (1440×900), `768` (768×1024), and `375` (375×812). Pass `--viewport 375` or `--viewport 768`. On phone the driver treats `[data-dashboard-mode="ai"]` as enough (the compact header switch is visible; the desktop sidebar toggle is hidden). The host composer wait uses `data-testid="assistant-composer"` attached (not CSS `:visible`), then the Message textbox, so briefing home at 768 does not abort when the dock is on screen. Sheet runs force Advanced mode, then open the FAB with a DOM click and wait for the `AI Assistant` dialog. If the error boundary ("Something went wrong") appears, the driver reloads and retries. Gemini 429 or a Gemini DNS lookup failure waits 90s then retries once. A **daily quota** (`quota exceeded`, retry in Nh) stops the surface so remaining ids are recaptured after reset. An expired host session reloads and retries. Host 503 / no-`blocks` timeout / destroyed execution context retries once after a reload. A failed reload records FAIL and continues; it does not abort the surface. A local 503, hung SSE (`no blocks event`), or destroyed Playwright context reloads the host page and retries once. Follow-up rows (`followUpOf`) replay the parent in the same thread instead of clicking New chat. H-08…H-13 follow H-07 (Maria Santos) so "this booking" stays pinned. `needsAttachment` rows attach `scripts/dev/fixtures/ai-qa-receipt.png`. `needsMember` rows (H-64) sign in as `ai-qa-member@example.test`, a property member with `assistant:view` and `bookings:view` only (no `org.plans:view`), then restore the owner session. The driver dismisses an Upgrade dialog with Cancel if one appears, waits for Send to enable before posting, and does not Esc the assistant sheet (same scrim as other modals). Host turns that return `action_confirmation` click Confirm so follow-through chips are in the screenshot. Guest waits up to 120s for Send to enable and for an Automated badge below that send (phone lists recycle, so a global count never rises). If the Message composer is missing or the page shows Request failed / Too many requests, the driver clears local `guest-web-chat-start` / `-resume` / `-messages` and `inbox-auto-reply` rate-limit rows (prod stays at 10 starts/hour and 10 auto-replies/hour), clicks Try again when present, then reloads the messages URL up to four times. Host runs clear local `dashboard-assistant-chat` rows (prod stays 30 / 10 min). Local `functions serve` inlines the auto-reply (`API_URL` / `EDGE_INLINE_BACKGROUND_TASKS`). A missing badge can be a correct no-send (guard) and is still screenshotted.

## Rubric

Score 1–5 per axis. A question **passes** at ≥4 on every axis.

| Axis          | 5                                              | 1                                       |
| ------------- | ---------------------------------------------- | --------------------------------------- |
| Accurate      | Figures, names, statuses, dates match the seed | Invented or missing data                |
| Answer-first  | First line answers; no greeting or filler      | Opens with "Sure!" or a paragraph first |
| Visual fit    | Primary block a designer would pick            | Plain text where a visual is obvious    |
| Elegant       | Fits 375px, ₱ formatting, no raw codes         | Overflow, `READY_FOR_CHECKOUT`, UUIDs   |
| Leads forward | 2–4 next-step chips                            | No chips, echo chips, or "ask again"    |
| Fast          | Tier-0 ≤4s p50 / ≤9s p95                       | Over budget or a silent spinner         |
| Safe          | No guest leaks; Tier-2 writes confirm          | Any leak or unconfirmed write           |

## Exit criteria

Every question ≥4 on every axis on **two consecutive full runs**, p50/p95 within budget, zero dead-end strings, zero grounding rejections visible to the host, zero guest-guard flags on normal questions, owner review of the screenshot set.

## Loop

1. Run the corpus. Capture screenshot + timing. Score. Write `run-<n>.md`.
2. Triage every axis <4 into a fix under the matching phase, tagged `qa-run-<n>`.
3. Fix, re-run failures plus a 20% sample of passes, then the full corpus.
4. Stop when the exit criteria hold.

## Corpus v1

Machine-readable: [`corpus-v1.json`](./corpus-v1.json) (H-01…H-98, G-01…G-78). H-69…H-98 and G-49…G-78 are anonymized local-traffic additions. Source text and expected blocks: plan § H.

UX rows G-44…G-48 run on `--surface guest --all` (typing, second reply within 90s, follow-up chips, thumbs down, exhausted auto-reply line). G-48 spends the per-conversation auto-reply budget via `bump_rate_limit` before sending (local functions raise the hourly cap to 80), clears the once-per-hour notice limiter, and waits for the host-will-reply line below that send, so it does not need a live model. Briefing empty states: `bun run qa:ai -- --run 4 --briefing --surface ai --viewport 1440|375`. The driver waits for `[aria-label="Needs attention"]` inside the briefing root (not a page-wide Loading label) so empty skeletons are not scored as a pass. The Advanced sheet does not render those cards.

## Commands

```bash
bun run seed:ai-qa
bun run qa:ai -- --run 0 --ids H-01,H-07,H-25
bun run qa:ai -- --run 0 --surface ai --viewport 375 --ids H-01
bun run qa:ai -- --run 0 --all --surface ai --viewport 1440
bun run eval:ai -- --suite blocks
bun run eval:ai -- --suite quality
bun run eval:ai -- --suite guest
```
