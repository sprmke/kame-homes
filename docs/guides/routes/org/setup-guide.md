---
title: 'Setup Guide — operator guide'
status: active
tags: [guides, routes, org, onboarding]
updated: 2026-09-25
---

# Setup Guide — operator guide

Route: overlay on `/org/:orgSlug/...` (not a standalone URL)

> **Status:** Documented — post-onboarding Setup Guide overlay + Recommended reward step.

## Progress overview

| Section                        | E2E save | Validation                        | Docs | Notes                                                                       |
| ------------------------------ | -------- | --------------------------------- | ---- | --------------------------------------------------------------------------- |
| Overlay / stepper              | Done     | Same as home settings             | Done | Listing rows + shared `ParkingFlowStepper`; **Skip** on optional steps only |
| Org / property / parking steps | Done     | Home-page validators              | Done | Controllers embedded via hosts                                              |
| Recommended reward step        | Done     | Existing verification + offer API | Done | Optional; gate bypass when eligible                                         |
| Persistence                    | Done     | RPC patch keys                    | Done | `settings.setupGuide` meta only                                             |

---

## Overview

After `/onboarding`, owners land on the listing dashboard with a **Setup Guide** overlay. It walks through the same settings they would edit under Org / Property / Parking settings — same save paths and validation. Progress is derived from live settings completion, not a separate checklist store. Meta only (`dismissedAt`, `completedAt`, `lastStepId`, skipped/reviewed steps, version) is stored on the org.

**Step order:** Organization (Welcome, brand) → each property/parking block → Verification (go-live + Get Recommended) → Finish (team, done).

**UI:** Wider desktop modal (`~76rem`). No top-left “Setup guide” title. Desktop split rail lists org steps (Welcome hidden from rail), then one row per listing with property/parking icon and `done/total`. Optional steps show an “Optional” sublabel; skipped optional steps show “Skipped”. A rail step stays disabled until every earlier step is complete or skipped. Back still opens earlier steps. Save & continue and Skip move forward one step. Section headers show group progress. The content pane has no title bar or close control; listing steps pin only the sub-step stepper above the body. Footer stays pinned. Only the step body scrolls. While a step loads, the body shows a skeleton of that step's form (no settings-page sidebar). Listing sub-steps use the shared **ParkingFlowStepper** with **active label only** (`n/total` + segmented bar). Verification and Get Recommended render inline (host ID / listing proof / Recommended docs, no nested dialog). Property/parking **pricing** embeds the same rates/fees cards as the Pricing page (no “Open pricing” link). **Team** embeds the invite form inline. Welcome and finish are cinematic moments with jump shortcuts. **You're all set** only checks when all required steps are complete. Footer **Skip** appears only on Verification, Get Recommended, and Team (advances to the next step; does not close the overlay). Close via **Finish** on the last step (or dismiss from outside the overlay). Reopen from Finish setup. Mobile uses a short horizontal rail (no header title).

**Plans / Team RBAC:** N/A for new keys — the guide only embeds existing settings surfaces. The Recommended reward is configured by super admin; grants are org subscriptions (`source=reward`).

**activity-log:** N/A. UI-only overlay. Writes go through existing settings and verification endpoints.

---

## Host-facing knowledge

The Setup Guide walks you through brand, each listing, and payments so guests see accurate info at booking. Close it with **Finish**; reopen from **Finish setup**. Each listing is one row in the rail; its steps sit in the page as a stepper. Verification, Get Recommended, and team invites are optional. Everything else (including pricing and parking email) is required before **You're all set** shows complete. When a reward campaign is on, completing Recommended verification can unlock a free Pro period.

**Common host questions**

- Q: Do I have to finish every step?
  A: Brand, listing basics, pricing, payments, guest form, and email steps are required. Verification, Get Recommended, and team invites are optional.
- Q: What does Skip do?
  A: On Verification, Get Recommended, or Team, Skip moves to the next step without finishing that step. It does not close the guide.
- Q: If I close the guide, do I lose progress?
  A: No. Saved settings stay saved. The guide remembers where you left off.
- Q: Why can’t I open a later step?
  A: Finish or skip the step you’re on first. You can still go back to earlier steps.
- Q: Why is each listing only one row on the left?
  A: Open the listing. Its steps are the stepper on the page.
- Q: When do I get the free Pro month?
  A: Only when the platform has the reward campaign on, and only after the trigger (submit or approval) the campaign uses.

---

## Persistence

### Save path

1. UI → **setup-guide-state** (GET/PATCH)
2. RPC `set_org_setup_guide_state` patches only `organizations.settings.setupGuide`

### Behavior

- Any active org member may update guide meta (no org.settings.basic:edit required).
- Auto-open once for the org owner after onboarding; afterward reopen from the sidebar **Finish setup** entry (no dashboard banner).

---

## Recommended reward step

### Behavior

- Embeds the same Recommended verification upload/submit flow as Get Verified.
- When `get-host-reward-offer` says eligible, Free hosts bypass the Pro `recommendedBadgeEligible` gate (server + client).
- Grant runs from `submit-org-verification` and/or `approve-org-verification` depending on `host_reward_trigger`.
- Expiry: billing cron sweeps `status=trialing` + `source=reward` past `current_period_end`.

### API reference

| Action              | Endpoint                                       |
| ------------------- | ---------------------------------------------- |
| Guide meta          | GET/PATCH `setup-guide-state`                  |
| Reward offer        | GET/POST `get-host-reward-offer`               |
| Submit Recommended  | POST `submit-org-verification` `tier:enhanced` |
| Approve Recommended | POST `approve-org-verification`                |

---

## Implementation map

| Concern                 | Path                                                                           |
| ----------------------- | ------------------------------------------------------------------------------ |
| Module                  | `ui/src/features/dashboard/setup-guide/`                                       |
| Overlay / sidebar entry | `SetupGuideOverlay.tsx`, `SetupGuideSidebarEntry.tsx`, `SetupGuideMoments.tsx` |
| Listing stepper         | `ParkingFlowStepper` (`ui/src/components/parking/ParkingFlowStepper.tsx`)      |
| Step bodies             | `SetupGuideStepBody.tsx`, `SetupGuideSettingsHost.tsx`                         |
| Offer hook              | `hooks/useHostRewardOffer.ts`                                                  |
| Edge                    | `setup-guide-state`, `get-host-reward-offer`, `hostVerificationReward.ts`      |
| Migration               | `20261306140000_host_verification_reward.sql`                                  |

---

---

## Testing

| Layer | Path / spec                                | Manual            |
| ----- | ------------------------------------------ | ----------------- |
| Unit  | `setupGuideProgress` / step assembly tests | —                 |
| N/A   | Setup Guide overlay auto-open              | Manual onboarding |
