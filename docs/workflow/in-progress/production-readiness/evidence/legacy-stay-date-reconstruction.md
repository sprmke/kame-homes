---
title: 'Legacy stay-date reconstruction (Mar–May 2025 cohort)'
status: active
stage: in-progress
kind: evidence
readiness: partial
launch_gate: F
launch_blocker: false
last_verified: '2026-11-03'
---

# Legacy stay-date reconstruction

The 41 bookings whose `check_out_date` sits before `check_in_date` are not 41 separate data-entry
mistakes. They are the negative-span subset of **65 bookings from the same era** whose stored
`check_in_date` disagrees with `check_out_date` and `number_of_nights`. Their real stay dates are
recoverable from the uploads.

## Where the evidence comes from

The guest form names every upload with the submitted stay dates:

```
${prefix}_${checkInDate}_${checkOutDate}_${guestName}_${originalFile}
```

`ui/src/utils/text/helpers.ts#generateFileName`, unchanged since the March-2025 version that
produced these files. For **all 65 rows** the payment receipt and the valid ID carry the **same
date pair**, and that pair satisfies three checks the stored row fails:

| Check                                             | Stored row                     | File pair                                                  |
| ------------------------------------------------- | ------------------------------ | ---------------------------------------------------------- |
| `end - start == number_of_nights`                 | fails (span −12 … +44)         | passes, all 65                                             |
| `check_out` unchanged from the guest's submission | —                              | passes (the file's end always equals the stored check-out) |
| `start < end`                                     | fails for the 41 reversed rows | passes, all 65                                             |

So the checkout and the nights are original, and **only `check_in_date` was rewritten later**.

## Root cause

The stored check-in dates are sequential, roughly one per day across bookings created days earlier
(bookings created 03-05…03-09 have stored check-ins 03-10, 03-11, 03-12, 03-13, 03-14). That is the
signature of the edit form defaulting the check-in picker to **the day of the edit** while check-out
and nights kept their original values: when the edit happened before the original departure the stay
inflated, when it happened after, the stay went negative.

That is a 2025 UI bug, not guest behaviour. It no longer reproduces (the edit flow hydrates the
stored dates) and the new `valid_dates` constraint now guards the table.

## The 65 rows (proposed repair)

Each row would get `check_in_date = check_out_date − number_of_nights`, which equals the file's
start date in every case. `check_out_date`, `number_of_nights`, `booking_rate`, payments and status
are untouched. All 65 are `COMPLETED`.

| #   | id         | booked     | DB check-in | real check-in  | check-out  | nights |
| --- | ---------- | ---------- | ----------- | -------------- | ---------- | ------ |
| 1   | `82218a27` | 2025-03-05 | 2025-03-10  | **2025-03-13** | 2025-03-14 | 1      |
| 2   | `1da75597` | 2025-03-06 | 2025-03-11  | **2025-03-24** | 2025-03-25 | 1      |
| 3   | `7368963e` | 2025-03-08 | 2025-03-12  | **2025-04-10** | 2025-04-11 | 1      |
| 4   | `06c15e9b` | 2025-03-09 | 2025-03-13  | **2025-03-20** | 2025-03-21 | 1      |
| 5   | `9f6dbfe1` | 2025-03-09 | 2025-03-14  | **2025-04-19** | 2025-04-20 | 1      |
| 6   | `1e8274ee` | 2025-03-10 | 2025-03-17  | **2025-03-12** | 2025-03-13 | 1      |
| 7   | `b33ced61` | 2025-03-10 | 2025-03-19  | **2025-03-17** | 2025-03-18 | 1      |
| 8   | `ff2a40fd` | 2025-03-10 | 2025-03-18  | **2025-03-10** | 2025-03-11 | 1      |
| 9   | `1e58ed9c` | 2025-03-11 | 2025-03-20  | **2025-03-14** | 2025-03-15 | 1      |
| 10  | `26631ddb` | 2025-03-11 | 2025-03-24  | **2025-03-11** | 2025-03-12 | 1      |
| 11  | `be4378ec` | 2025-03-11 | 2025-03-28  | **2025-03-30** | 2025-03-31 | 1      |
| 12  | `c69c7b2c` | 2025-03-13 | 2025-03-29  | **2025-04-19** | 2025-04-20 | 1      |
| 13  | `c52a5653` | 2025-03-17 | 2025-04-01  | **2025-03-18** | 2025-03-19 | 1      |
| 14  | `0bc944d2` | 2025-03-18 | 2025-04-05  | **2025-04-13** | 2025-04-14 | 1      |
| 15  | `344cf36f` | 2025-03-18 | 2025-04-06  | **2025-03-19** | 2025-03-20 | 1      |
| 16  | `9c347d03` | 2025-03-18 | 2025-04-04  | **2025-05-16** | 2025-05-18 | 2      |
| 17  | `e7318493` | 2025-03-19 | 2025-04-07  | **2025-04-23** | 2025-04-25 | 2      |
| 18  | `15b184d1` | 2025-03-25 | 2025-04-08  | **2025-03-31** | 2025-04-01 | 1      |
| 19  | `0a1a36f6` | 2025-03-26 | 2025-04-09  | **2025-04-05** | 2025-04-06 | 1      |
| 20  | `86771cf3` | 2025-03-27 | 2025-04-12  | **2025-04-01** | 2025-04-03 | 2      |
| 21  | `993526ea` | 2025-03-27 | 2025-04-11  | **2025-03-28** | 2025-03-29 | 1      |
| 22  | `a6026f97` | 2025-03-27 | 2025-04-10  | **2025-03-29** | 2025-03-30 | 1      |
| 23  | `af46d9db` | 2025-03-28 | 2025-04-13  | **2025-05-03** | 2025-05-04 | 1      |
| 24  | `01a03084` | 2025-04-01 | 2025-04-16  | **2025-05-24** | 2025-05-25 | 1      |
| 25  | `3faa0582` | 2025-04-01 | 2025-04-16  | **2025-04-06** | 2025-04-07 | 1      |
| 26  | `61f78c32` | 2025-04-01 | 2025-04-15  | **2025-04-04** | 2025-04-05 | 1      |
| 27  | `d6f26a8b` | 2025-04-02 | 2025-04-18  | **2025-04-12** | 2025-04-13 | 1      |
| 28  | `a89b6b9f` | 2025-04-07 | 2025-04-19  | **2025-05-29** | 2025-05-30 | 1      |
| 29  | `bfdf68b7` | 2025-04-07 | 2025-04-19  | **2025-04-07** | 2025-04-08 | 1      |
| 30  | `2d262d04` | 2025-04-08 | 2025-04-20  | **2025-05-01** | 2025-05-02 | 1      |
| 31  | `3c9ca693` | 2025-04-08 | 2025-04-22  | **2025-04-08** | 2025-04-09 | 1      |
| 32  | `ae7ca3b7` | 2025-04-08 | 2025-04-23  | **2025-04-09** | 2025-04-10 | 1      |
| 33  | `4afe5c66` | 2025-04-11 | 2025-04-23  | **2025-04-11** | 2025-04-12 | 1      |
| 34  | `5623d2bc` | 2025-04-13 | 2025-04-25  | **2025-04-15** | 2025-04-16 | 1      |
| 35  | `f2043fc6` | 2025-04-14 | 2025-04-26  | **2025-04-18** | 2025-04-19 | 1      |
| 36  | `68a45984` | 2025-04-15 | 2025-04-27  | **2025-04-16** | 2025-04-17 | 1      |
| 37  | `33fbc584` | 2025-04-16 | 2025-04-28  | **2025-04-27** | 2025-04-28 | 1      |
| 38  | `8b0ce195` | 2025-04-16 | 2025-04-29  | **2025-04-16** | 2025-04-17 | 1      |
| 39  | `9536b8cf` | 2025-04-16 | 2025-04-30  | **2025-04-25** | 2025-04-26 | 1      |
| 40  | `d6a09d45` | 2025-04-16 | 2025-04-30  | **2025-05-04** | 2025-05-05 | 1      |
| 41  | `5f0917ac` | 2025-04-17 | 2025-05-01  | **2025-04-22** | 2025-04-23 | 1      |
| 42  | `afc493b9` | 2025-04-17 | 2025-05-02  | **2025-04-26** | 2025-04-27 | 1      |
| 43  | `3b4554df` | 2025-04-18 | 2025-05-03  | **2025-04-20** | 2025-04-22 | 2      |
| 44  | `b2d5fdd7` | 2025-04-19 | 2025-05-04  | **2025-05-05** | 2025-05-06 | 1      |
| 45  | `cad0b91e` | 2025-04-21 | 2025-05-05  | **2025-05-13** | 2025-05-14 | 1      |
| 46  | `0fe3787a` | 2025-04-22 | 2025-05-06  | **2025-04-23** | 2025-04-25 | 2      |
| 47  | `507af557` | 2025-04-22 | 2025-05-05  | **2025-04-28** | 2025-04-29 | 1      |
| 48  | `b3cd2f22` | 2025-04-22 | 2025-05-07  | **2025-05-02** | 2025-05-03 | 1      |
| 49  | `ccc5e4ee` | 2025-04-25 | 2025-05-08  | **2025-05-10** | 2025-05-11 | 1      |
| 50  | `83e5b290` | 2025-04-26 | 2025-05-09  | **2025-05-07** | 2025-05-08 | 1      |
| 51  | `60c2b1e3` | 2025-04-29 | 2025-05-16  | **2025-04-30** | 2025-05-01 | 1      |
| 52  | `6b7dc66d` | 2025-04-29 | 2025-05-10  | **2025-04-30** | 2025-05-01 | 1      |
| 53  | `8bd71af5` | 2025-04-29 | 2025-05-13  | **2025-05-09** | 2025-05-10 | 1      |
| 54  | `bd7ee5b8` | 2025-04-29 | 2025-05-11  | **2025-04-29** | 2025-04-30 | 1      |
| 55  | `23daf8c4` | 2025-05-01 | 2025-05-19  | **2025-05-08** | 2025-05-09 | 1      |
| 56  | `313ba67c` | 2025-05-02 | 2025-05-19  | **2025-05-05** | 2025-05-06 | 1      |
| 57  | `c865c4b9` | 2025-05-04 | 2025-05-21  | **2025-05-06** | 2025-05-07 | 1      |
| 58  | `62d98f4a` | 2025-05-07 | 2025-05-24  | **2025-06-13** | 2025-06-15 | 2      |
| 59  | `386a2931` | 2025-05-08 | 2025-05-26  | **2025-06-05** | 2025-06-07 | 2      |
| 60  | `9a6b1ba3` | 2025-05-10 | 2025-05-29  | **2025-05-30** | 2025-06-01 | 2      |
| 61  | `5618965c` | 2025-05-11 | 2025-06-05  | **2025-06-10** | 2025-06-11 | 1      |
| 62  | `72f8812a` | 2025-05-11 | 2025-06-10  | **2025-05-21** | 2025-05-22 | 1      |
| 63  | `bb558552` | 2025-05-11 | 2025-05-30  | **2025-05-11** | 2025-05-12 | 1      |
| 64  | `e86713c0` | 2025-05-12 | 2025-06-13  | **2025-05-26** | 2025-05-28 | 2      |
| 65  | `7c6bbc48` | 2026-07-15 | 2026-10-19  | **2026-10-18** | 2026-10-23 | 5      |

## Left alone deliberately

**Legitimate reschedules (11).** Newer rows where the file pair and the stored pair are both
self-consistent (`span == nights`) but differ: the guest moved the stay and the upload is stale. No
change.

**Resolved (4).** Four newer bookings had a 2-night span with `number_of_nights = 1`. The dates are
right and the nights count was stale: each settles on or after the stored check-out (`2e5b0760`
settles 06:44 on its checkout day, `4c7a578a` the morning after, `549f0223` the day after), and the
rate confirms two nights (`8b89a145` is exactly **5598.00** = 2 × the 2799 weekday rate,
`549f0223` is 5570.76). `number_of_nights` set to 2 for all four; no date changed.

| id         | stay                    | nights before | nights after |
| ---------- | ----------------------- | ------------- | ------------ |
| `8b89a145` | 2026-10-13 → 2026-10-15 | 1             | **2**        |
| `4c7a578a` | 2026-07-28 → 2026-07-30 | 1             | **2**        |
| `2e5b0760` | 2026-08-23 → 2026-08-25 | 1             | **2**        |
| `549f0223` | 2026-10-01 → 2026-10-03 | 1             | **2**        |

**No dated files (2).** `a64c3b48` (01-12-2026 → 01-14-2026, 2 nights) and `b7790cbb`
(12-26-2025 → 12-27-2025, 1 night) are self-consistent, so nothing to repair.

**Format (fixed).** `df39895b` stored `2026-01-15 → 2026-01-17` (ISO); rewritten to
`01-15-2026 → 01-17-2026`. All 450 rows are now canonical `MM-DD-YYYY`.

## Applied 2026-11-03

- Backup first: `backups/dev/20261103T000157Z_{schema,data,roles}.sql`.
- `node scripts/dev/repair-legacy-stay-dates.mjs --apply` → **updated 65/65 rows** in one guarded
  `UPDATE ... FROM (VALUES …)` (each row matched on its exact current check-in and check-out).
- Verified after the write:
  - inconsistent rows **69 → 4** (the four resolved below)
  - reversed rows **0**, same-day rows **0**
  - `check_out_date`, `number_of_nights`, `status`, `booking_rate` and `down_payment` unchanged
    for all 65 (compared against the pre-repair backup)
  - every corrected check-in equals the filename start
- The constraint is tightened in `20261318120000_strict_valid_dates.sql`: same-day stays remain
  valid, the 2025-06-01 grandfather clause is gone, and `VALIDATE CONSTRAINT` passes.
- Final cleanup: the four residual rows had `number_of_nights` set to 2 and the ISO row was
  normalised. **0 inconsistent, 0 reversed, 0 non-canonical across 450.**
