---
title: 'QA — Voucher reveal styles'
status: done
tags: [qa, vouchers, sd-form, guest-review]
updated: 2026-08-31
stage: done
kind: qa
---

# QA — Voucher reveal styles

Manual checklist for [`../done/voucher-reveal-styles.md`](../done/voucher-reveal-styles.md). Automated mocked coverage: [`../../guides/testing/voucher-reveal-playwright.md`](../../guides/testing/voucher-reveal-playwright.md). Use local `./dev.sh` + a booking in `READY_FOR_CHECKOUT` with SD form available.

**Reset voucher for QA** (local only): SQL in `docs/architecture/edge-functions.md` § Reset next-stay voucher.

| #   | Case                                 | Expected                                 | Result |
| --- | ------------------------------------ | ---------------------------------------- | ------ |
| 1   | Default property, claim voucher      | Reel animation                           |        |
| 2   | Set style **Wheel**, save, new claim | Wheel lands on same code as API response |        |
| 3   | Set style **Flip**, save, new claim  | Flip then won card                       |        |
| 4   | Returning guest with existing code   | Instant won card, no animation           |        |
| 5   | `vouchers_enabled=false`             | No voucher step                          |        |
| 6   | OS “Reduce motion” on                | Fast path to won card                    |        |
| 7   | Guest-review Airbnb path             | Same style as property setting           |        |
| 8   | Only 2 prizes enabled in catalog     | Wheel shows 2 segments                   |        |
| 9   | Style picker dirty → Save Changes    | `voucherRevealStyle` persists on reload  |        |
| 10  | Invalid defaults                     | Prizes + style `reel` restored           |        |
