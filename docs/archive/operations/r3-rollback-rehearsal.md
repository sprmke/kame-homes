---
title: R3 hosted smoke and rollback rehearsal (Plan 02 §4.3–4.4)
status: active
updated: 2026-11-01
---

# R3 smoke and rollback rehearsal

## fwor-as-prod path (2026-10-27)

Legacy data already lives on `fworvijbrwpyngycotbz`. R3 here means **hosted structural verify + HTTP smoke**, not a second full dump into a throwaway project. A fresh dump + `compareCounts` pair runs at **T0 freeze** only.

### Automated (agent-safe)

```bash
bun scripts/migrate/legacy-to-mt-prod/hosted-prod-verify.ts
bun scripts/migrate/legacy-to-mt-prod/hosted-r3-smoke.ts
bun scripts/migrate/legacy-to-mt-prod/verify-phase1-wiring.ts
```

**2026-11-02 re-run:** all three green. `get-booked-dates?property=monaco-2604` returns every future stay (Nov 2–4, Nov 7–9, Nov 22–23, Dec 12–13, Dec 31–Jan 1, Mar 13–15 2027), so calendar blocking is confirmed on migrated data. The Resend inbound webhook was exercised with a correctly signed `email.received` event: `200 {"success":true,"action":"skipped","reason":"subject_no_match"}`, proving signature verification and parsing on `fwor`. A real forwarded PMO reply still needs a human inbox.

At T0 freeze (legacy stopped taking bookings):

```bash
CUTOVER_FREEZE_PAIR=1 LEGACY_INVENTORY=backups/migration/inventory-<freeze>.json \
  bun scripts/migrate/legacy-to-mt-prod/hosted-prod-verify.ts
```

### Host walkthrough (§5.7)

- Sign in on `dev.kamehomes.space` (or Preview pointed at fwor) with owner Google account.
- Open Monaco 2604 bookings list; open one future booking; calendar shows blocked dates.
- Guest link: `/sd-form?bookingId=<uuid>` resolves without `?property=`.
- Optional: forward one PMO test mail to Resend inbound with Documents Approver `From` on the allow list.

### Outbound disabled for rehearsal

- Set Telegram bot tokens to empty in `telegram_*_settings` on a **scratch** DB only, or use sandbox Resend.
- Do not run destructive tests on live legacy.

## Rollback rehearsal (§4.4)

Dry run on paper; execute only if T0 fails before DNS cutover.

1. **Legacy:** re-enable guest `/form` (remove Vercel freeze redirect). Do not run `05-legacy-freeze.sql` unschedule until cutover is committed.
2. **DNS:** keep `kamehomes.space` on legacy Vercel project; do not attach apex to `kame-homes` until go call.
3. **App:** Production `kame-homes` stays on Preview branch until T0; revert env to fwor if a bad deploy shipped.
4. **Data:** forward-fix on fwor preferred; reverse migration is out of scope (Plan 02 §8).

Sign-off row: date, operator, which steps were walked, blockers.

| Date       | Operator | Notes                                                                                                                                      |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-01 | Host     | Admin walkthrough on dev (bookings/calendar) completed; no blockers reported. PMO forward proof optional / not required for this sign-off. |

Related: [`legacy-cutover-phase-status.md`](./legacy-cutover-phase-status.md), [`legacy-to-mt-prod-migration.md`](./legacy-to-mt-prod-migration.md).
