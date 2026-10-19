# Phase 6 live probes — hosted-dev `fwor…` — 2026-10-19

Correct `BASE_URL=https://fworvijbrwpyngycotbz.supabase.co/functions/v1` (first run was a doubled path and is discarded).

| Probe                                                       | Result                                                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET get-form/<random-uuid>` ×25                            | **401** `Access token required` every time. `GUEST_BOOKING_ACCESS_ENFORCE` is on. No 429 in 25. |
| `GET search-listings?q=test` ×15                            | **200** (empty/zero listings). No 429 in 15.                                                    |
| `POST paymongo-webhook` bad `Paymongo-Signature` ×12        | **401**. No 429 in 12.                                                                          |
| `POST sd-refund-cron` `{}`                                  | **401** Unauthorized                                                                            |
| `GET list-bookings` no JWT                                  | **401** Missing or invalid Authorization header                                                 |
| `GET super-admin-orgs` no JWT                               | **404** function not deployed yet at capture                                                    |
| `verify:deployed-preview` on `dev.kamehomes.space` + health | **OK**                                                                                          |
| A11 anon `payment-receipts/...` public URL                  | **400** (not 200)                                                                               |

Auth gates work. Rate-limit 429 not proven at these burst sizes (public RL is higher or keyed differently). Re-run a longer burst after full function deploy.

## Guest-link tokens after the grace window (PR-008), hosted dev 2026-10-19

`scripts/dev/probe-readiness-guest-token-dev.mjs` backdated one QA booking past `GUEST_BOOKING_ACCESS_LEGACY_GRACE_DAYS`, probed, then restored `created_at`.

| Case                              | `get-form`                           | `get-sd-form` | `get-guest-review` |
| --------------------------------- | ------------------------------------ | ------------- | ------------------ |
| Past grace, no token              | 401 `Access token required`          | 401           | 401                |
| Past grace, forged token          | 401 `Invalid or expired access link` | 401           | 401                |
| Inside grace (restored), no token | 200                                  | —             | —                  |

Write paths (`submit-form` edit, `submit-sd-form`, `submit-guest-review`, `claim-sd-voucher`) run captcha first, then the same `authorizeGuestBookingAccess` with the row's `created_at`, and return 401 before any write (code read). Helper cases (missing token past grace, inside grace, mismatched write token) are covered by `guestBookingAccessToken_test.ts`.
