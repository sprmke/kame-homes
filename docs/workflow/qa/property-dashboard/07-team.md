---
title: 'QA — Property Team'
status: active
updated: 2026-08-29
---

# 07 — Team

Route: `/org/:orgSlug/property/:propertySlug/team`

## Looks good

- Seeded roles Full Access / Operations / Read Only are understandable for hosts.
- Free: seat cap 1 (owner only) — invite hits upgrade; matches guide.
- Custom roles gated `customRoles` (Starter+).
- Virtual org owner/admin rows explained in host Q&A.

## Issues

| Sev | Issue                                                                                                                                                                               | Evidence                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| P2  | Operations lacks finance + settings + team manage — good for least privilege, but many PH hosts want a “cleaner/admin assistant” who can mark finance dues paid without full access | Template design               |
| P2  | Read Only has `team:view` but Operations does not — inconsistent for “see who is on the team”                                                                                       | `SEEDED_TEMPLATE_PERMISSIONS` |
| P1  | Live multi-role login not fully exercised this pass (no second Google account in session)                                                                                           | QA gap                        |

## Improvements

- Add a fourth seeded “Finance helper” template (view/edit transactions only).
- Give Operations `team:view` so staff know who to escalate to.

## Doc gaps

- Guide excellent (2026-08-28). Align if templates change.

## Evidence

Live Team page load; `propertyTeamTemplates.ts`; guide `team.md`.
