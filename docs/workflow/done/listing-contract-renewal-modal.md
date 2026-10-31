---
stage: done
title: 'Listing contract renewal modal'
status: in progress — implementation landed; manual QA open
updated: 2026-08-19
tags: [verification, listing-authorization, contract-lifecycle, ux]
related:
  - docs/workflow/intake/listing-contract-renewal-modal-design.md
  - docs/workflow/in-progress/verification-scope-split.md
---

# Listing contract renewal modal — implementation plan

> **For agentic workers:** Design: [`../intake/listing-contract-renewal-modal-design.md`](../intake/listing-contract-renewal-modal-design.md).

**Goal:** Replace the non-dismissible listing contract strip/lock UI with a **listing-scoped** renewal reminder modal, with distinct pre-expiry vs grace/locked copy, daily dismiss until lock, and a working renew → Listing Verification submit path.

**Architecture:** Keep cron + `listingAuthorization.lifecycle` as source of truth. `ListingContractRenewalProvider` in `AdminLayoutOutlet` scans all org listings and shows **one** renewal reminder per auth login (Manila day), including on org-level routes. Never stacks with `ListingVerificationModal`. Daily snooze via `localStorage` (per listing) for **pre-expiry** and **granted**; **grace** uses the in-memory login gate only (re-opens on refresh). Login gate cleared on sign-out.

## Decisions locked

| Topic              | Decision                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Who gets reminders | Any listing with contract-end lifecycle (incl. residual after rights changes)                                |
| Strip / lock UI    | **Removed** — modal only                                                                                     |
| Dismiss vs lock    | Daily snooze T−15 + granted; **grace re-opens on refresh**; **non-dismissible** when locked on listing shell |
| Scope              | Org-wide scan; one modal at a time (highest urgency listing)                                                 |
| First show         | **T−15**; auto on admin login once per auth session/day                                                      |
| Consideration      | Secondary action in grace (override when locked)                                                             |

## Implementation tasks

### Task 1 — Shared renew eligibility + Deno/UI helpers

- [x] `isInPreExpiryWindow`, `resolveListingContractRenewalPhase`, `listingHasContractRenewalLifecycle`
- [x] `isListingRenewEligible`, `canSubmitListingRenewal` (server + UI)
- [x] Deno tests in `listingAuthorization_test.ts`

### Task 2 — Fix `submit-listing-authorization` renew path

- [x] Allow approved → pending when renew eligible
- [x] Reset lifecycle on new contract end; require end after previous on renew

### Task 3 — Dismiss helper + copy module

- [x] `listingContractRenewalDismiss.ts`, `listingContractRenewalCopy.ts`

### Task 4 — Renewal modal + gate rewrite

- [x] `ListingContractRenewalModal`, `ListingContractConsiderationForm`
- [x] `ListingContractRenewalProvider` — org-wide scan on login; mutual exclusion with Listing Verification

### Task 4b — Org-level login orchestration (2026-08-11)

- [x] Move renewal from listing shell gate → `AdminLayoutOutlet` provider
- [x] Once per Manila day per auth login (in-memory; cleared on sign-out) + per-listing dismiss (`localStorage`) for pre-expiry/granted; grace does not persist daily snooze
- [x] Never show alongside `ListingVerificationModal` (sidebar or renew CTA)
- [x] Show on org dashboard as well as property/parking routes

### Task 5 — ListingVerificationModal renewMode from T−15

- [x] `isListingRenewEligible` drives renewMode; pre-expiry copy in form

### Task 6 — Docs + quality

- [x] Workflow indexes; testing guide pointer
- [x] `bun run ci:quality`

## Verification checklist

- [ ] Highest-urgency listing shows once per login; pre-expiry/granted dismiss snoozes that listing until next Manila day
- [ ] Pre-expiry: dismiss hides until next Manila day; refresh same day stays hidden
- [ ] Grace: dismiss hides until full page refresh; refresh same day **shows again**; consideration still works
- [ ] Locked: non-dismissible **only** on that listing’s property/parking shell; closeable on org dashboard and sibling listings
- [ ] Renew submit succeeds while previously approved; SA sees pending listing verification
- [ ] Org dashboard **does** show modal when any org listing needs renewal (once per session/day)

## Key files

| Area               | Path                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Phase helpers      | `supabase/functions/_shared/contractLifecycle.ts`, `ui/.../lib/contractLifecycle.ts`       |
| Renew gates        | `supabase/functions/_shared/listingAuthorization.ts`, `ui/.../lib/listingAuthorization.ts` |
| Submit             | `supabase/functions/submit-listing-authorization/index.ts`                                 |
| Modal              | `ui/.../listing-authorization/ListingContractRenewalModal.tsx`                             |
| Orchestrator       | `ui/.../listing-authorization/ListingContractRenewalProvider.tsx`                          |
| Verification renew | `ui/.../listing-authorization/ListingVerificationModal.tsx`                                |
