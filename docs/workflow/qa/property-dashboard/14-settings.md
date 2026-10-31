---
title: 'QA — Property Settings'
status: active
updated: 2026-08-30
---

# 14 — Settings

Route: `/org/:orgSlug/property/:propertySlug/settings`

## Looks good

- Section completeness dots + partial save is host-friendly.
- Granular `settings.*:edit` leaves; payment OTP still required.
- Voice Receptionist / AI Overrides hide without plan features.
- **Phase 3:** Email Automations (GAF request) toggle → **Settings saved** toast (round-trip proven).

## Issues

| Sev | Issue                                                                                                           | Evidence   |
| --- | --------------------------------------------------------------------------------------------------------------- | ---------- |
| P2  | Long form — first-time setup still heavy despite section saves                                                  | Host lens  |
| P2  | Document requirements owned at development (super-admin) — property hosts can’t fix “wrong GAF list” themselves | Guide Q&A  |
| P2  | Incomplete GCash seed (empty account name/number) blocks Save until filled; dirtying payment opens OTP modal    | Phase 3    |
| P3  | Guide `updated: 2026-08-21` older than other modules; still largely accurate                                    | Drift risk |

## Improvements

- Setup wizard from Dashboard when completeness < 100%.
- Link Channel Sync from Integrations section.

## Doc gaps

- Consider mentioning calendar sync lives on Pricing, not Settings.

## Evidence

Live Settings load; Phase 3 Email Automations save; guide `settings.md`.
