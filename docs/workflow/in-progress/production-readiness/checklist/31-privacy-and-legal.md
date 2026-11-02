---
title: 'Privacy and legal'
status: active
tags: [workflow, in-progress, production-readiness]
updated: 2026-11-02
stage: in-progress
kind: plan
origin_stage: untracked
readiness: unverified
launch_gate: B
launch_blocker: tbd
last_verified: none
---

# 31 — Privacy and legal

**🆕** No prior checklist. Philippine Data Privacy Act (RA 10173). Ledger PR-100.

## Remaining work

| #   | Work                                                                                 | Owner    |
| --- | ------------------------------------------------------------------------------------ | -------- |
| 1   | Data inventory: guest IDs, receipts, voice transcripts, inbox, analytics, AI prompts | agent    |
| 2   | Privacy policy + terms match shipped features (AI, voice, PostHog, push)             | product  |
| 3   | Guest and host export/delete path (data subject request)                             | agent    |
| 4   | Retention for guest IDs/receipts; purge cron + audit trail (cross-check doc 19)      | agent    |
| 5   | Cookie / analytics consent if PostHog replay is on                                   | operator |

## Exit gate

- [ ] Legal copy reviewed against live features — product review of `privacy`/`terms` vs shipped AI, voice, PostHog and push (not started)
- [ ] Export/delete path exists and is documented — **not implemented** (no guest/host data-subject export or account deletion edge function exists). Tracked as PR-145; needs a product + legal decision because bookings are financial records with a lawful retention basis.
- [ ] Retention written and jobs exist or N/A documented — partial: `activity-log-retention-cron` and `property-page-views-prune-cron` exist; guest ID/receipt/transcript retention windows are not documented.

### Notes (2026-11-02)

- Guest PII storage is private-bucket only (`payment-receipts`, `valid-ids`, `pet-*`, `sd-refund-receipts`); stored public-style URLs return 400 anonymously (probe re-run 2026-11-01).
- Analytics: PostHog keys are optional per environment; consent banner is only required if replay/cookies are enabled on production (operator decision).
