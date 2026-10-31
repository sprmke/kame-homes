---
title: 'QA — Phase 4 Business + live Telegram/Meta'
status: active
updated: 2026-08-30
---

# 19 — Phase 4 (Business tier + live integrations)

Property: `kame-home` / `monaco-2612`. Auth: magic-link inject `sprmke.dev@gmail.com`.

**Plan:** temporarily set `org_subscriptions.plan_id` → Business (`pricing_plans.code = pro`), then **restored to Pro (`growth`)** after this pass.

**Helpers:** `scripts/dev/qa-phase4-auth-inject.mjs`, `qa-phase4-probe.mjs`, `qa-phase4-telegram-meta.mjs`, `qa-phase4-api-verify*.mjs` (local only; do not commit secrets).

## Evidence matrix

| Surface                               | Result                 | Notes                                                                                                                                                                                         |
| ------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Plans UI on Business**              | **Pass**               | “Business plan Current ₱1,439/month”.                                                                                                                                                         |
| **Telegram Chat — already connected** | **Pass**               | Module shows **Connected**; bot token + chat ID fields populated (lengths only audited; values not logged).                                                                                   |
| **Telegram — Send preview**           | **Pass (live)**        | Manage → **Send preview** → toast **Preview sent** (real Bot API send via saved credentials).                                                                                                 |
| **Telegram — shared Save and test**   | **Pass (live)**        | Global token empty by default (`Save and test` disabled). Copied module token via React input → toast **Saved — @kamehome_maintenance_bot**.                                                  |
| **Telegram — API verify**             | **Pass / flaky**       | `verify_chat_telegram_env` returned `200` + `success/verify` when edge healthy; intermittent **503 name resolution failed** right after edge-runtime container restart.                       |
| **Meta Connect on Business**          | **Pass (OAuth start)** | Channels → **Connect Meta** (no Upgrade modal). Browser navigated to `facebook.com/login.php`…`app_id=1322356823214127`. API `meta-inbox-oauth-start` returned Facebook URL with same app id. |
| **Meta OAuth complete + page picker** | **Blocked (human)**    | Requires interactive Facebook login + Page grant; not completed in automated QA (correct — avoid sharing FB session in agent).                                                                |
| **Marketing → Publish on Business**   | **Pass (pre-Meta)**    | Dialog: “Connect Facebook or Instagram in **Inbox**” with property Inbox link. Confirm **Publish** correctly **disabled** until a channel exists.                                             |

## Issues found

| Sev | Issue                                                                                                                             | Notes / action                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| P2  | Shared bot token card stays empty while modules already have tokens; **Save and test** stays disabled until the host pastes again | Improvement: prefill shared field from first connected module (or “Use Chat module token”) so the recommended default is one click |
| P2  | Live Meta publish + Inbox DM sync still need a human Facebook OAuth once                                                          | Product OK; document as operator step. After connect, re-run Publish channel select → post                                         |
| P3  | Local edge-runtime **503 / name resolution failed** after Docker restart                                                          | Ops: wait ~5–15s or restart `./dev.sh`; not a product bug                                                                          |
| P3  | Chat module verified as `@kamehome_maintenance_bot`                                                                               | One shared bot for all modules is supported; naming may confuse hosts who expect a “chat” bot identity                             |

No **P0/P1** product bugs in this phase.

## Improvements (backlog-worthy)

1. **Notifications:** When any module has a saved bot token and shared token is empty, offer one-click “Use as shared token” (or auto-prefill read-only until edited).
2. **Marketing Publish:** Empty-state copy is good; consider primary CTA **Go to Inbox** instead of a disabled Publish (clearer next step).
3. **QA skill:** Phase 4 checklist — Business bump → Telegram Send preview + shared Save and test → Meta OAuth start URL → Publish disabled-until-connected → restore plan.
4. **Meta:** Optional staging Page + test user documented in ops runbook for one-time connect (do not store Page tokens in git).

## Still not E2E (needs human / staging Page)

- Facebook login → page selection → `meta-inbox-oauth-complete`
- Marketing Publish posting to a live Page/IG
- Inbound Messenger/IG webhook → Inbox thread (needs Meta webhook pointed at local/dev tunnel)

## Restore

`kame-home` subscription returned to **Pro (`growth`)** after this pass.
