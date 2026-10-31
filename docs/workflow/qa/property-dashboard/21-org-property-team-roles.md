---
title: 'Org + property team roles — deep QA'
status: active
updated: 2026-08-31
tags: [qa, team, org, property, rbac]
---

# Org + property team roles — deep QA

Scope: role templates (Full Access / Operations / Read Only), listing access, invite/manage/permissions controls at **org** and **property** team pages.

## Verdict

**Production-ready for this module** after P0/P1 auth fixes and remaining open-item closure. Automated local verification: `bun scripts/dev/qa-org-property-team-roles.mjs` → **18 passed, 0 failed** (2026-08-31).

## What was verified (automated)

| Check                                                   | Result |
| ------------------------------------------------------- | ------ |
| Org seeded roles (Full Access / Operations / Read Only) | Pass   |
| Seeded org role DELETE blocked                          | Pass   |
| Invite Operations + single property listing             | Pass   |
| Accept invite (test user magic-link JWT)                | Pass   |
| Invitee org hub + assigned property access              | Pass   |
| Property team `fromOrg` for `assigned_via_org`          | Pass   |
| Property API blocks edit of org-assigned member         | Pass   |
| Deactivate → property + org hub denied                  | Pass   |
| Full Access + all listings property access              | Pass   |
| Template permission edit preserves member overrides     | Pass   |
| Property seeded roles + DELETE blocked                  | Pass   |

## Fixes closed this session

| Item                                            | Status                               |
| ----------------------------------------------- | ------------------------------------ |
| UUID org members vs `role_id === 'ADMIN'` auth  | Fixed                                |
| Deactivate leaves listing access                | Fixed                                |
| Seat count undercount                           | Fixed                                |
| `assigned_via_org` editable at property/parking | Fixed                                |
| Seeded role API delete                          | Fixed (org + property)               |
| Template edit overwrites customized permissions | Fixed (match previous defaults only) |
| Template listing scope not fanned out           | Fixed (matching members + sync)      |
| Manage dialog sensitive-permission confirm      | Fixed                                |
| Operations `bookings.create:add` vs docs        | Docs aligned (create yes, import no) |
| Live invite/accept/deactivate proof             | Automated with test users            |

## Re-run

```bash
# Local Supabase + functions serve required
bun scripts/dev/qa-org-property-team-roles.mjs
```

Creates disposable `*.gmail.com` auth users, invites/accepts against `kame-home`, then removes those members.
