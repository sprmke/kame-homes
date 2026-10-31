---
stage: done
title: 'Guest auth + dashboard profile — shipped'
status: done
tags: [workflow, done, auth, account]
updated: 2026-08-26
---

# Guest auth + dashboard profile

**Status (2026-08-26):** **Shipped.** Scratchpad-only (no prior `in-progress/` plan). Passwordless auth + account hub + dashboard Profile modal.

## Shipped

- Guest / host login & register (email OTP + Google); no passwords; no forgot-password (OTP already proves email ownership)
- Auth modal / page section order aligned for guest + host
- Guest account hub `/account/*` (profile, stays, favorites)
- Dashboard sidebar **Profile** modal — standard split dialog, shared identity with explore (Google / saved avatar parity), PH mobile validation, deferred Maps location search (custom suggestions list above input)
- Explore avatar **Dashboard** → mode-switch curtain then org dashboard; host-mode **Dashboard** navigates with no curtain
- `guest_profiles` **`service_role`** grant for edge `guest-profile` / upload paths

## Intake

- [`docs/workflow/intake/_to-prompt.md`](../intake/_to-prompt.md) — ✅ auth pages + auth modal consistency
- [`docs/workflow/intake/_to-plan.md`](../intake/_to-plan.md) — ✅ Guest / host passwordless auth + account profile

## Docs

- [`docs/guides/routes/auth.md`](../../guides/routes/auth.md)
- [`docs/guides/routes/account/profile.md`](../../guides/routes/account/profile.md)
- [`docs/guides/routes/for-hosts.md`](../../guides/routes/for-hosts.md)
