---
title: 'QA — Phase 3 deep interactions'
status: active
updated: 2026-08-30
---

# 18 — Phase 3 deep interactions

Owner on **Pro (`growth`)** unless noted. Auth: magic-link inject `sprmke.dev@gmail.com`. Property: `kame-home` / `monaco-2612`.

## Evidence matrix

| Surface                                 | Result                | Notes                                                                                                                                                                                                                                                                                     |
| --------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Settings → Email Automations**        | **Pass**              | Toggled GAF request off → **Settings saved** toast → restored on.                                                                                                                                                                                                                         |
| **Settings → Payments dirty**           | **Expected gate**     | Incomplete GCash seed (empty account name/number) blocked clean Save; filling fields + dirtying payment opens **Verify payment changes** OTP modal (by design).                                                                                                                           |
| **Marketing Design → Download PNG**     | **Pass**              | Toast **Design downloaded**.                                                                                                                                                                                                                                                              |
| **Marketing → Publish**                 | **Pass (gate)**       | On Pro: **Upgrade to Business** modal (unlimited Meta publish / Business unlocks).                                                                                                                                                                                                        |
| **Bookings GAF upload → Mark complete** | **Pass**              | Jane …017: uploaded `ui/public/templates/guest-form-template.pdf` → Mark as complete → toast **Marked GAF Approval as complete**; DB `approved_gaf_pdf_url` set; status stayed `PENDING_DOCUMENTS` (other nested docs still open — expected).                                             |
| **Notifications Telegram Chat**         | **Pass (validation)** | Enable chat notifications toggles without token; **Save and test** enables after bot token; fake token → toast **Invalid bot token. Please double-check your token and try again.** UI shows Connected state for prior config; no live BotFather token in local seed — real send not E2E. |
| **Inbox → Channels → Connect Meta**     | **Pass (gate)**       | Dialog: “Using org Meta” + **Connect Meta** with Business badge; click → **Upgrade to Business** (₱1,439) listing Meta chat channel unlocks. OAuth not started (correct on Pro).                                                                                                          |

## Issues found this phase

| Sev | Issue                                                                                                                                                      | Action                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| P2  | Incomplete payment seed (empty GCash account fields) makes first Settings Save confusing until fields are filled or another non-payment section is dirtied | Seed hygiene / onboarding; not a product P0   |
| P3  | Meta OAuth + Telegram real BotFather connect still need hosted/test credentials for full E2E                                                               | Deferred; UI + validation + plan gates proven |

No new **P0/P1** product bugs in this phase. Prior P1 guest-balance toast fix remains shipped (`0cc59fcc`).

## Remaining out of scope (optional Phase 4)

- ~~Real Meta OAuth with `META_APP_*` against a test Page~~ → **Phase 4:** OAuth **start** proven; Page grant still human.
- ~~Real Telegram BotFather token + Chat ID round-trip message~~ → **Phase 4:** Preview sent + Save and test OK.
- ~~Business tier live publish + Meta channel connect~~ → Publish empty-state OK; live post needs Meta connected.
- Full RFCI→checkout with production-shaped receipt file (Phase 2 used receipt path for Iris …018).

See [19-phase4-business-integrations.md](./19-phase4-business-integrations.md).
