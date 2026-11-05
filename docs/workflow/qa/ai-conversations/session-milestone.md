---
title: 'AI companion session milestone'
status: active
tags: [qa, ai, milestone, resume]
updated: 2026-10-20
stage: for-testing
kind: reference
---

# AI companion session milestone (not done)

**Plan stays in `docs/workflow/for-testing/`.** Do not run `/workflow-done`. Phase 7 screenshot exit is still open.

Canonical plan: [`../../for-testing/ai-companion-response-quality-and-generative-ui.md`](../../for-testing/ai-companion-response-quality-and-generative-ui.md).
Method: [`README.md`](./README.md). Run 8 ledger: [`run-8.md`](./run-8.md).

Pause reason: AI usage limit reset. Resume from **Remaining TODOs** below. Copy that list into the next session.

## Verdict

Phases 0–6 of the companion plan are implemented. Automated Phase 7 suites were green on 2026-10-19. Live eval stretch `quality` 41/43 (95%) is met. Screenshot-driven QA (plan section H) is **not** done:

- Run 8 is the first consecutive full-corpus pass and is only partly captured.
- Run 9 (second consecutive pass) has not started.
- Owner screenshot review and the 375 / 768 / 1024 manual pass are still required.
- Phase 1 ≥35% p50 vs run-0 (~4.2 s) is **not met**. Healthy run-7 handler p50 is 4.25 s (`synth_ms` 0). Median `model_ms` is 3.69 s, so 2.73 s total is not reachable without a faster Gemini round.

Never deploy production Supabase. Local stack only. Never `git stash pop` the mixed 2026-10-20 stash (see **Working-tree incident**).

## Summary of this ~6 hour pass

Work covered host Confirm / mark-done, skip leftover synth, guest relative pricing + date-guard, voice token mint, QA driver retries, and live screenshot recapture on run 8.

What landed in product:

1. Host Confirm no longer shows "Malformed proposal payload". Nested `data.payload` unwraps; the Done card stays on the assistant turn with follow-through chips.
2. Skip leftover structured synth when the model already returned blocks, tool JSON, or a draft. Empty seed no longer inserts "I couldn't generate a response." `synth_ms` is 0 on healthy turns.
3. Guest "N nights starting Friday" prices before the model. Stay dates render as `23 to 26 Oct 2026`. Flattened ISO dates are not treated as account numbers. Flagged drafts are never auto-sent.
4. Voice mint uses REST `bidiGenerateContentSetup` with nested `generationConfig`.
5. Hydrators: booking card for "show me … booking", inbox entity cards for "need a reply", attention checklist, holiday blocked-night copy, PII refuse line, last-quarter `month` stamp, calendar demotes sibling tables, occupancy skips all-zero series.
6. QA driver: host Confirm clicks, 120 s guest wait, rate-limit DELETE before turns, scroll last assistant message before screenshot, 503 / DNS / expired-session retries, `appendLedger` mkdir.

What did **not** finish: run 8 AI @ 768 last three ids, sheet @ 768, guest, voice, scoring, run 9, owner review, final `ci:quality`.

## What shipped this pass (code)

### Host dashboard assistant

- Skip leftover structured synth (`canSkipStructuredSynth`) when `respond_with_blocks`, tool JSON, or a model draft exists. Hydrators + `shouldRunLlmGuard` still run. Shared hydrate / guard / deferred-write path on skip-synth. Empty seed:

```ts
const seed: unknown[] =
  input.modelBlocks.length > 0 ? input.modelBlocks : draft ? [{ type: 'text', text: draft }] : [];
```

- Prompt `dashboard_assistant_turn` **2026-10-19.12**.
- Confirm unwraps nested propose `data.payload` (`unwrapConfirmPayload` in `dashboardAssistantFinanceMaintenanceTools.ts`) so execute sees top-level `id` + `propertyId` + `patch`.
- Same-turn mark-done propose (`dashboardAssistantMarkDone.ts`) when the host already asked to mark an item done.
- Confirm patches the **assistant** message that holds `action_confirmation`, not the user row (`loadActionMessage`, `dashboardAssistantConfirmBlocks.ts`). After insert, `pending_actions.message_id` is retargeted to the assistant row.
- Client applies returned `blocks` after Confirm (`useAiAssistantChat.ts`) so Done + follow-through chips stay on screen.
- Hydrators (`dashboardAssistantBlocks.ts`, `dashboardAssistantVisuals.ts`): PII refuse line; holiday rates/blocks prose; `wantsBookingCard` for "show me … booking" / owe / balance / check-in; `bookingDetail` fallback from `listedBookings[]`; inbox entity cards for "waiting for a reply" / "need a reply"; attention checklist `checklistFromAttention`; last-quarter comparison uses `month` stamp (`2026-05`) not human `label` (`May`); calendar hydrators demote sibling `data_table`; occupancy hydrator skips all-zero series.
- `appendLeadChips` fills calendar / KPI / `open_page` when fewer than two chips exist. `open_page` is not in `KNOWN_BLOCK_TYPES`.
- Catalog after `get_finance_trend`: 76 read / 65 write / 141 total.

### Guest receptionist

- Prompt **2026-10-19.2**. Shared tools: relative stay parse (`parseGuestRelativePriceAsk`), weekday + nights in `parseVoiceStayRange`, compact Dates column (`formatGuestStayRangeLabel`).
- Relative "N nights starting Friday" runs `get_inquiry_price` **before** the model when the parse hits.
- Guard strips `\b\d{4}-\d{2}-\d{2}\b` before `ACCOUNT_NUMBER_PATTERN` so flattened price tables (`2026-10-26 3 9397`) are not flagged as account numbers. Flagged drafts are never auto-sent (`isSendableAutoReply`).
- `assertSafeGuestReply` still blocks other-guest names, owner topics, ungrounded amounts.
- Voice: REST `POST /v1beta/auth_tokens` with `bidiGenerateContentSetup` (not SDK `liveConnectConstraints`). Nested `generationConfig.{responseModalities,speechConfig}`. No `safetySettings` on that request. DEV hook `window.__aiQaVoiceSend`. Default session 300 s (budget cap 540 s); local seed raises guest voice to 80/day.
- Guest auto-reply inlined locally (`EDGE_INLINE_BACKGROUND_TASKS` / localhost `API_URL`).
- Rate limits: `consumeAutoReplyBudget` / `consumeBudgetExhaustedNotice` via `bump_rate_limit` scopes `inbox-auto-reply` / `inbox-auto-reply-budget-notice`. Guest write `guest-web-chat-messages` 40/300s. Authenticated wrapper ~300/60s. `guest-web-chat-start` durable **10/hour**. Host `dashboard-assistant-chat` **30/10 min**.

### QA driver and seed

`bun run qa:ai` (`scripts/dev/ai-qa-run.mjs` + `.sh`) and `bun run seed:ai-qa` (`scripts/dev/seed-ai-qa.ts` + `.sql`). Intended driver behavior:

- `--surface voice`; host Confirm clicks; guest wait cap 120 s.
- DELETE `inbox-auto-reply` + `inbox-auto-reply-budget-notice` + `dashboard-assistant-chat` rate-limit rows before turns.
- Scroll last `[data-testid="assistant-message"]` then 400 ms before screenshot.
- Stop the surface on `/browser has been closed/i` instead of looping FAIL rows.
- Gemini 429 / high-demand **and Gemini DNS / hostname failure**: wait 90 s, retry once.
- Crashed / shell-missing / expired-session: reload with `recoverHostPage({ force: true })` in try/catch. Wait for `[data-dashboard-mode]` 60 s after goto.
- 503 / no-blocks / destroyed context: retry once.
- `dumpAiModeFail` must not abort the corpus (crashed-path try/catch). That was the sheet-375 H-91 abort.
- `appendLedger` now `mkdirSync(LEDGER_DIR, { recursive: true })` before write (ENOENT after the 2026-10-20 dir delete).

Seed: org `kame-home`, property `monaco-2612`. Lifts `aiDashboardAssistant`, `aiChatAutoReply`, `aiReceptionist`; org voice on; platform rollout 100%; health circuit cleared; guest voice 80/day. Local `INBOX_AUTO_REPLY_PER_CONVERSATION_PER_HOUR=80` in `scripts/dev/build-local-functions-env.sh`.

`package.json` scripts that must exist after restore: `qa:ai`, `seed:ai-qa`, `check:ai-knowledge-coverage`.

### Docs updated in the same change

- `docs/architecture/ai-dashboard-assistant.md` (skip-synth, confirm unwrap, assistant-message retarget).
- `docs/architecture/ai-platform.md` §9 skip leftover synth.
- `docs/guides/routes/org/assistant.md` (Confirm stays with Done).
- `docs/guides/testing/ai-dashboard-assistant-manual.md` (2.4b).
- `docs/guides/testing/guest-chat-ai-manual.md` (relative price, date guard, compact Dates).
- This folder's README (inbox-auto-reply reset, host rate-limit clear, screenshot scroll, DNS retry).
- Plan Phase 1/5/6/7 notes + ledger runs 5–8.
- `docs/workflow/for-testing/README.md` row + `docs/workflow/intake/_to-plan.md` 🧪 item.

## Tests run this pass

| Suite                                           | Result         | Notes                                                                                             |
| ----------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------- |
| Deno mark-done                                  | 3/3            | `dashboardAssistantMarkDone_test.ts`                                                              |
| Deno confirm-blocks                             | 1/1            | `dashboardAssistantConfirmBlocks_test.ts`                                                         |
| Deno guest tools                                | 9/9            | stay-range label included                                                                         |
| Deno `inboxAiSafetyGuard`                       | 16/16          | flattened price-table dates                                                                       |
| Deno `canSkipStructuredSynth`                   | 2/2            | plus `shapeCandidateBlocks` generate-failure 1/1                                                  |
| Deno guard policy                               | 4/4            |                                                                                                   |
| Deno TurnTimer                                  | 6/6            |                                                                                                   |
| Deno hydrator blocks                            | 15/15          |                                                                                                   |
| Deno visuals                                    | 63/63          |                                                                                                   |
| Live `eval:ai --suite quality`                  | 41/43 (95%)    | stretch gate 90% met. Report `tmp/ai-evals/report-2026-10-19T13-09-59-914Z.json`                  |
| Live `blocks`                                   | 46/51 (90%)    |                                                                                                   |
| Live `guest`                                    | 39/39          |                                                                                                   |
| Earlier Phase 7 automated                       | green          | `test:edge` 762, handlers 216, smoke 129, `test:e2e:ci` 285, `test:e2e:assistant` 8, `ci:quality` |
| QA run 5 / 6 / 7 latency                        | captured       | ≥35% p50 **not met**. See `run-5.md`…`run-7.md`                                                   |
| `ci:quality` after latest hydrator/driver edits | **not re-run** | do at end of the goal                                                                             |

Screenshots (gitignored): `ui/e2e/artifacts/ai-conversations/run-8/` plus run-0…run-7.

## QA captured so far (run 8, first consecutive pass)

Counts are files on disk at pause, 2026-10-20.

| Surface                    | Viewport   | Disk pngs | Status                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Host AI                    | 1440       | 98        | **98/98**, exit 0. Recapture H-07…H-13: H-07 `booking_card`, H-08 stepper, H-10 Confirm. Ledger rows H-01…H-13 may still show pre-scroll tables; prefer the recapture pngs.                                                                                                                                                                                                                |
| Host AI                    | 375        | 98        | **98/98**, exit 0. H-07 `booking_card`. H-10 Confirm cancelled Maria (re-seed after).                                                                                                                                                                                                                                                                                                      |
| Host sheet                 | 1440       | 98        | First pass aborted at H-72 (functions 503). Recapture H-26, H-65, H-66, H-69–H-98 **33/33**, exit 0.                                                                                                                                                                                                                                                                                       |
| Host sheet                 | 375        | 99        | First pass aborted at H-91 (`dumpAiModeFail` uncaught). Recapture 19 FAILs **19/19**, exit 0 (H-42, H-44, H-56, H-61, H-62, H-64, H-72, H-82, H-87, H-89–H-98). Extra png is `_auth-fail` or similar.                                                                                                                                                                                      |
| Host AI                    | 768        | 99        | First pass: H-01…H-38 and H-70…H-80 ok. H-39…H-69 Gemini DNS. H-81…H-98 expired session. Recapture H-39…H-95 ran after DNS recovered, then died at H-96 (`run-8.md` ENOENT during stash). H-96…H-98 still **Invalid or expired session** in the ledger. Last recapture of those three failed: composer not found (page was briefing home, not AI composer). Extra png is `_auth-fail.png`. |
| Host sheet                 | 768        | ~57       | H-01…H-57 captured except H-09 (context destroyed). Stopped at H-58 on Gemini **daily quota 500** (~11h). Recapture H-09 + H-58…H-98 after reset. Driver now aborts the surface on daily quota instead of FAIL-spamming.                                                                                                                                                                   |
| Guest web chat             | 1440 / 375 | 0         | **Not started** for run 8 (run 3 captured earlier; must re-run as consecutive pass).                                                                                                                                                                                                                                                                                                       |
| Voice                      | 375        | 0         | **Not started** for run 8 (run 3 captured; skip UX G-44…G-48).                                                                                                                                                                                                                                                                                                                             |
| Run 9 (second consecutive) | all        | 0         | **Not started.**                                                                                                                                                                                                                                                                                                                                                                           |

### Known scoring issues on captured shots (fix in owning phase, not Phase 7)

- H-01 AI 1440: bookings **table** vs run-0 Needs attention checklist (possible skip-synth tool-choice regression).
- H-03 AI 1440: empty weekend text.
- H-07 AI 1440 ledger still shows a one-row table on the first capture; 375 and the recapture png are `booking_card`. Re-score from recapture files.
- H-09 / H-10 first 1440 capture: no Confirm card (table instead). Recapture should have Confirm / chips.
- H-26: flat chart (seed months).
- Fast outliers H-36…H-40 / H-65: Gemini demand, not hydrator.
- Phone AI briefing home shows 4 of 6 cards below `sm` (by design, chips stay on screen).

## Working-tree incident (2026-10-20). Read before resuming

Around 03:09, a `git stash` plus `origin/develop` fast-forward deleted uncommitted companion files. The working tree looked clean except `?? ui/e2e/artifacts/`. Implementation was restored **surgically**:

- 77 untracked files from `stash@{0}^3` (plan, QA driver/seed/ledgers, ConfirmBlocks / MarkDone / ResponseShape, Visuals, guestReceptionistTools / Turn, new block UI, evals, migration `20261316127700_assistant_latency_breakdown.sql`, …).
- 48 tracked files from `stash@{0}` (dashboard-assistant-chat/confirm, Blocks, FinanceMaintenanceTools, geminiLiveEphemeral, inboxAiSafetyGuard, ChatBlockRenderer, BriefingHome, useAiAssistantChat, architecture + route docs, `build-local-functions-env.sh`, for-testing README, …).
- Re-added `qa:ai` / `seed:ai-qa` / `check:ai-knowledge-coverage` to `package.json`.

**Do not `git stash pop` the whole stash.** `stash@{0}` still holds a larger mixed WIP (~492 files, date-split work). Popping it will contaminate this tree.

Functions serve after restore can fail until matching **stashed service** files are present:

| Missing export / file                            | Restore from  |
| ------------------------------------------------ | ------------- |
| `_shared/propertyReviewList.ts`                  | `stash@{0}^3` |
| `getMaintenanceItem` in `maintenanceService.ts`  | `stash@{0}`   |
| `lastNFinanceMonthRanges` in `financeService.ts` | `stash@{0}`   |
| `_shared/guestTrip.ts`                           | `stash@{0}`   |

Healthy probe: `curl` of `dashboard-assistant-chat` without JWT must be **401**. 503 with `InvalidWorkerCreation` means another import is missing. Kong-only restart never recovers this. Use `bun run dev:api`. Never two `functions serve` in parallel.

If `docs/workflow/qa/ai-conversations/` vanishes again, restore from `stash@{0}^3` and rely on `appendLedger` mkdir.

## Remaining TODOs (resume after quota reset)

Copy this list into the next session. Do not mark the plan complete until every box is checked and two consecutive corpora pass the README exit criteria.

### 0. Local stack

- [ ] UI via `./dev.sh`. Functions via `bun run dev:api`. `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:54321/functions/v1/dashboard-assistant-chat` must be **401**, not 503. If boot error names a missing export, restore that file from `stash@{0}` / `^3` (table above). If 503 with no container: `bun run dev:api`, not Kong-only restart.
- [ ] Vite at `http://localhost:5173`. Host composer is `[data-dashboard-mode="ai"]` plus the chat input. If the driver says `composer not found` and the snippet is briefing home ("Good morning"), the UI is not in AI mode or the seed overlay is up. Re-seed, hard-reload, retry.
- [ ] `bun run seed:ai-qa` **before every surface**. Confirms (H-10, H-74, H-76, H-90, H-96, …) cancel Maria and mutate maintenance.
- [ ] Gemini Flash-Lite free-tier is 500/day. 429s are quota, not product bugs.
- [ ] Do **not** pop `stash@{0}` whole. Surgical checkout only.

### 1. Finish run 8 host AI @ 768

- [ ] Recapture `H-96,H-97,H-98` after seed, with `fn:401` and a live AI composer.
- [ ] Spot-check recapture pngs for H-39…H-95 (DNS-era shots vs later recapture). Prefer the later files on disk.
- [ ] Command: `bun run seed:ai-qa && bun run qa:ai -- --run 8 --surface ai --viewport 768 --ids H-96,H-97,H-98`

### 2. Finish run 8 remaining surfaces

- [ ] Host sheet @ 768 remainder (Gemini daily quota): `bun run seed:ai-qa && bun run qa:ai -- --run 8 --surface sheet --viewport 768 --ids H-09,H-58,H-59,H-60,H-61,H-62,H-63,H-64,H-65,H-66,H-67,H-68,H-69,H-70,H-71,H-72,H-73,H-74,H-75,H-76,H-77,H-78,H-79,H-80,H-81,H-82,H-83,H-84,H-85,H-86,H-87,H-88,H-89,H-90,H-91,H-92,H-93,H-94,H-95,H-96,H-97,H-98`
- [ ] Guest web chat @ 1440 then @ 375, G-01…G-78: `--surface guest --all`. Driver already clears `guest-web-chat-start` and `inbox-auto-reply` rows.
- [ ] Voice @ 375, G-01…G-78 (skip UX G-44…G-48): `--surface voice --viewport 375 --all`

### 3. Score run 8 vs rubric

- [ ] Every captured screenshot ≥4 on Accurate, Answer-first, Visual fit, Elegant, Leads forward, Fast, Safe.
- [ ] Axis <4 loops back to the **owning phase** (hydrator, prompt, guard, driver), not a Phase 7 patch.
- [ ] Zero dead-end strings, zero visible grounding rejects, zero guest-guard flags on normal questions.
- [ ] Fast: Tier-0 ≤4 s p50 / ≤9 s p95. Phase 1 ≥35% p50 vs run-0 ~4.2 s remains **open** unless product accepts synth skip as the cut.
- [ ] Re-score H-01 (checklist vs table), H-03 (empty weekend), H-07/H-09/H-10 from recapture pngs, Fast outliers.

### 4. Second consecutive full corpus (run 9)

- [ ] After run 8 scores pass, `bun run seed:ai-qa` then repeat **every** surface and viewport as run 9.
- [ ] Host + guest, AI + sheet + guest + voice, 1440 and 375, plus 768 for sheet and AI.
- [ ] Two consecutive full corpora must both meet README exit criteria.

### 5. Owner review + manual

- [ ] Owner screenshot review: 10 before/after pairs. Run-0 vs run-8 files already on disk under `ui/e2e/artifacts/ai-conversations/run-0/` and `run-8/`. Embed in a short review report; record paths in the plan ledger.
- [ ] Manual two-surface checklist at 375 / 768 / 1024 (`docs/guides/testing/ai-dashboard-assistant-manual.md`).
- [ ] Guest chat + voice booth on a phone (`docs/guides/testing/guest-chat-ai-manual.md`, `voice-receptionist-manual.md`).

### 6. Close the goal

- [ ] `bun run ci:quality`, `bun run test:edge`, `bun run test:edge:handlers` after the last code fix.
- [ ] Then `/workflow-done ai-companion-response-quality-and-generative-ui` only if exit criteria hold.

### Modules still to check visually (host + guest)

Use this as the resume checklist of product surfaces, not extra scope.

| Module                     | Host ids (typical) | Guest ids (typical) | What to verify                                         |
| -------------------------- | ------------------ | ------------------- | ------------------------------------------------------ |
| Attention / today          | H-01…H-06          |                     | Checklist, not a bookings table                        |
| One booking + follow-ups   | H-07…H-13          |                     | `booking_card`, stepper, Confirm, timeline             |
| Calendar / rates / blocks  | H-14…H-20          | G-12…G-20           | `calendar` primary; no sibling table                   |
| Finance / KPIs / charts    | H-25…H-37          |                     | `chart` / `kpi` / comparison; last-quarter month stamp |
| Inbox                      | H-38…H-42          | G-21…G-30           | entity cards; Automated reply                          |
| Maintenance Confirm        | H-45, H-74, H-76   |                     | Done card + chips after Confirm                        |
| Marketing / Setup / Team   | H-47…H-60          |                     | Phase 4 tools                                          |
| Member billing refuse      | H-64               |                     | callout, not a plan page                               |
| Traffic-derived extra      | H-69…H-98          | G-49…G-78           | no dead-ends                                           |
| Guest price / stay / voice |                    | G-13, G-01…G-78     | compact dates, Automated, voice skip UX                |

## Out of this plan

- Marketing poster/video, Smart Pricing, Analytics Ask, receipts/import, paid Gemini quotas, deferred bulk pricing/parking broadcast.
- A deeper "go further" companion plan in `docs/workflow/planned/` was requested earlier and **not written**. Do not start it until this plan is done or explicitly split.

## Resume commands

```bash
# health (must be 401)
curl -s -o /dev/null -w "fn:%{http_code}\n" http://127.0.0.1:54321/functions/v1/dashboard-assistant-chat

# if 503 / InvalidWorkerCreation: bun run dev:api (not Kong-only)
# if missing getMaintenanceItem / lastNFinanceMonthRanges / propertyReviewList:
#   git checkout 'stash@{0}' -- supabase/functions/_shared/maintenanceService.ts supabase/functions/_shared/financeService.ts
#   git checkout 'stash@{0}^3' -- supabase/functions/_shared/propertyReviewList.ts

bun run seed:ai-qa
bun run qa:ai -- --run 8 --surface ai --viewport 768 --ids H-96,H-97,H-98
bun run seed:ai-qa && bun run qa:ai -- --run 8 --surface sheet --viewport 768 --all
# then guest 1440, guest 375, voice 375; bump --run 9 after run 8 scores pass
```
