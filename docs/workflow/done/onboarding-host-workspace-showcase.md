---
title: 'Onboarding & host auth — workspace showcase sidebar'
status: active
tags: [workflow, done, onboarding, auth, marketing]
updated: 2026-08-27
stage: done
kind: reference
---

# Onboarding & host auth — workspace showcase sidebar (shipped)

Shared left panel on **`/onboarding`** and host auth (**`/for-hosts/login`**, **`/for-hosts/register`**) with the compact Remotion dashboard tour, expand modal, and brand-aligned shell.

## Shipped (2026-08-27)

| Area             | Change                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Shared panel** | `HostWorkspaceSidePanel` — `auth` and `onboarding` variants; solid `bg-primary`, `MarketingBrandLogo`, headline + description, compact tour |
| **Tour player**  | `HostDashboardTourPlayer` — `compact` + `minimal` chapter nav; expand modal with title, balanced padding, playback sync; autoplay fix       |
| **Onboarding**   | 50/50 layout; `OnboardingFeatureShowcase` thin wrapper                                                                                      |
| **Host auth**    | Replaced legacy gradient + feature cards with same panel; removed Privacy/Terms/copyright footer on host panel                              |
| **Copy**         | Auth: “Property management made simple” + short description; onboarding: setup-focused headline                                             |

## Implementation map

| Piece              | Path                                                                                |
| ------------------ | ----------------------------------------------------------------------------------- |
| Shared sidebar     | `ui/src/features/guest/marketing/shared/components/HostWorkspaceSidePanel.tsx`      |
| Brand logo         | `ui/src/features/guest/marketing/shared/components/MarketingBrandLogo.tsx`          |
| Tour player        | `ui/src/features/guest/marketing/for-hosts/components/HostDashboardTourPlayer.tsx`  |
| Onboarding wrapper | `ui/src/features/dashboard/org/components/onboarding/OnboardingFeatureShowcase.tsx` |
| Auth layout        | `ui/src/features/guest/auth/components/AuthLayout.tsx`                              |
| Route guides       | `docs/guides/routes/onboarding.md`, `docs/guides/routes/auth.md`                    |

## Out of scope (still open in intake)

- **For-hosts landing** animation section refresh — `_to-prompt.md` 🔵 item remains open
- Guest auth left panel still uses legacy gradient + feature cards
