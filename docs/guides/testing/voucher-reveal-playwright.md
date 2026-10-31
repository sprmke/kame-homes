---
title: 'Voucher reveal Playwright'
status: active
tags: [guides, testing, vouchers, playwright, sd-form]
updated: 2026-08-31
---

# Voucher reveal Playwright

Feature-scoped Playwright coverage for **host reveal-style settings** and **guest claim flows** (`/sd-form` + `/guest-review`). Three **worlds** — `reel`, `wheel`, `flip` — share fixtures but boot with different `voucher_reveal_style` values so specs assert style-specific copy and animation labels.

## Scope

| Spec                                       | What it covers                                                                                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `host/voucherRevealStyleSettings.spec.ts`  | Property **Settings → Reviews & vouchers → Manage** — pick Reel / Wheel / Flip (animated preview cards), Save Changes, PATCH `voucherRevealStyle`, Reset defaults |
| `guest/voucherRevealClaim.spec.ts`         | Guest claim per world (reduced motion), returning guest skip, guest-review **Done** CTA                                                                           |
| `flows/voucherRevealStylesDemo.spec.ts`    | Full-length animations (`@demo`) — run headed to watch reel / wheel / flip                                                                                        |
| `shared/voucherRevealHarness.ts`           | Mocked edge functions + host session + world constants                                                                                                            |
| **Redemption (next-stay reuse)**           |                                                                                                                                                                   |
| `guest/voucherWallet.spec.ts`              | `/account/vouchers` — Ready / Used sections, **Book again** link                                                                                                  |
| `guest/voucherFormApply.spec.ts`           | Booking form voucher picker, discount estimate, `appliedVoucherSourceBookingId` on submit                                                                         |
| `host/voucherBookingDetailPricing.spec.ts` | Host workflow pricing review + **Guest voucher** card on Pricing tab                                                                                              |
| `flows/voucherRedemptionMocked.spec.ts`    | Wallet → form → host journey; documents messages insert gap (no voucher share)                                                                                    |
| `shared/voucherRedemptionHarness.ts`       | Guest wallet/form mocks + host booking row with `applied_voucher_*`                                                                                               |

## Redemption flow (what product supports today)

Guests **cannot** attach vouchers from property messages yet — chat **Insert** only offers dates / listing URLs. The supported rebooking path is:

1. **`/account/vouchers`** — see earned voucher → **Book again**
2. **`/properties/:slug/form`** — pick voucher on the Stay step (optional); estimate updates; submit sends `appliedVoucherSourceBookingId`
3. **Host booking detail** — `PENDING_REVIEW` workflow shows net rate with voucher lines; Pricing tab shows **Guest voucher** after review

Run redemption-only specs: `bun run test:e2e:vouchers:redemption` (included in `bun run test:e2e:vouchers`).

## Worlds (reel / wheel / flip)

Each world is a row in `VOUCHER_REVEAL_WORLDS` inside the harness:

| World     | Guest headline (intro)                   | Animation `aria-label` |
| --------- | ---------------------------------------- | ---------------------- |
| **reel**  | Spin for your next-stay reward           | Spinning voucher reel  |
| **wheel** | Spin the wheel for your next-stay reward | Spinning prize wheel   |
| **flip**  | Flip for your next-stay reward           | Flipping voucher card  |

CI guest specs use `prefers-reduced-motion: reduce` so animations finish in milliseconds. The **demo** spec disables that and waits for the full spin/flip (up to ~30s per style).

## Runner setup

- Config: `playwright.config.ts` (Vite preview on `http://127.0.0.1:4173`)
- Scripts:
  - `bun run test:e2e:vouchers` — fast mocked suite (excludes `@demo`)
  - `bun run test:e2e:vouchers:redemption` — wallet → form apply → host pricing only (headless)
  - `bun run test:e2e:vouchers:redemption:headed` — same suite with a visible browser
  - `bun run test:e2e:vouchers:redemption:headed:slow` — headed + `PLAYWRIGHT_SLOW_MO=1200` + `PLAYWRIGHT_DEMO_PAUSE_MS=3000` (holds ~3s between major steps)
  - `bun run test:e2e:vouchers:headed`
  - `bun run test:e2e:vouchers:demo` — watch full animations (headed)
  - `bun run test:e2e:vouchers:demo:slow` — same pacing as redemption slow
  - `bun run test:e2e:vouchers:demo:video` — retain video artifacts
- **Why `:slow` uses two knobs:** `PLAYWRIGHT_SLOW_MO` only delays Playwright actions (click/fill). Navigations and `expect` still finish immediately — so demos also set `PLAYWRIGHT_DEMO_PAUSE_MS` and call `demoPause()` between steps. Override if needed: `PLAYWRIGHT_SLOW_MO=2000 PLAYWRIGHT_DEMO_PAUSE_MS=5000 bun run test:e2e:vouchers:redemption:headed:slow`
- Browser: `npx playwright install chromium`

Manual QA checklist (local Supabase): [`../../workflow/qa/guest-flows/voucher-reveal-styles.md`](../../workflow/qa/guest-flows/voucher-reveal-styles.md).

## Mocked auth (host)

Reuses `propertyTeamRbacHarness` (full-access session) plus route overrides for `property-access` (`settings.socials:edit`), mutable `app-settings`, and `property-pricing`. Navigate to **Reviews & vouchers** via section nav (`#section-guest-rewards`), then **Manage** on the Next-stay vouchers row.

## Intentional gaps

- Real `claim-sd-voucher` roll against local Postgres (use manual QA + SQL reset)
- Live PayMongo / refund step after voucher on SD form
- Page Editor embed previews (static review mock only in product)
- **In-chat voucher share** — messages Insert menu has dates/URLs only; use wallet or form picker (see redemption specs)
