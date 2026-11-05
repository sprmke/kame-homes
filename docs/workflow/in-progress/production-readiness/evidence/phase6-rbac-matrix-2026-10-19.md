# Property team role matrix — hosted dev — 2026-10-19

Setup: `node scripts/dev/seed-readiness-qa-dev.mjs --plan growth` (QA org put on Growth by mirroring `createOrgSubscription`; billing not exercised, product decision 2026-10-19). Free allows 1 seat, so invites are correctly refused on Free.

`node scripts/dev/probe-readiness-rbac-dev.mjs` invited one member per seeded template through the real `property-team-invitations` API (invite emails went to the `+qa` aliases), accepted each via `accept-property-invite`, then probed.

## Server (API)

| Call                           | Full Access | Operations | Read Only |
| ------------------------------ | ----------- | ---------- | --------- |
| GET list-bookings              | 200         | 200        | 200       |
| GET maintenance-summary        | 200         | 200        | 200       |
| GET finance-summary            | 200         | 403        | 403       |
| GET app-settings               | 200         | 403        | 403       |
| GET property-team-members      | 200         | 403        | 200       |
| PATCH update-property          | 200         | 403        | 403       |
| POST property-team-invitations | skip        | 403        | 403       |

**All roles match `SEEDED_TEMPLATE_PERMISSIONS`.** Invite validation: phone number required (400 without).

## UI (`qa-walk-hosted-dev.mjs --as <member> --viewport 1280`)

| Route                      | Operations                                          | Read Only            |
| -------------------------- | --------------------------------------------------- | -------------------- |
| every `/org/:slug/*` page  | → their property (property-only member, documented) | same                 |
| property Bookings, Pricing | open                                                | open                 |
| property Finance           | → property dashboard                                | → property dashboard |
| property Settings          | → property dashboard                                | → property dashboard |
| property Team              | → property dashboard                                | open                 |
| property Marketing         | open                                                | → property dashboard |

UI gates agree with the server.

Not covered: org-level admin members, parking members, custom roles.
