---
stage: wont-do
title: 'Listing-scoped authorization — superseded'
status: superseded
updated: 2026-08-10
tags: [verification, listing-authorization, superseded]
superseded_by: docs/workflow/planned/verification-scope-split.md
---

# Listing-scoped authorization — superseded

Cancelled **2026-08-10**. No implementation was started — every phase was still unchecked, the doc was never added to the in-progress index, and its companion spec (`intake/listing-authorization-design.md`) no longer exists.

**Superseded by:** [`../done/verification-scope-split.md`](../done/verification-scope-split.md)

## Why

The original plan treated Host verification as identity-only and pushed all remaining trust documents onto the listing. The revised requirements keep a real **two-tier Host scope** (Valid ID + Facebook page; then selfie, other-platform admin proof, optional legitimacy proof, optional Business Permit / BIR) alongside a **two-tier Listing scope**, adds a read-only listing rollup inside the org modal, and makes listing approval fully independent of host approval.

## What carried over

- Per-listing `listingAuthorization` JSON on `properties` / `parkings`
- `_shared/listingAuthorization.ts` + private `listing-authorization-assets` bucket
- Rights, contract end, and contract-expiry lifecycle moving from the two org legs onto listing rows
- Migration backfill from the existing org legs

Back to [won't-do index](./README.md).
