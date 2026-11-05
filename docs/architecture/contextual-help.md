---
title: 'Contextual help — hints, how-it-works panels, intro cards'
status: active
tags: [architecture, help, dashboard, ux]
updated: 2026-11-05
---

# Contextual help

Host dashboard help lives **behind small affordances**, not in paragraphs on every screen.
This doc is the contract for the three patterns, where copy lives, and how they behave on
mouse, touch, keyboard, and inside modals.

Scope: `/org/:orgSlug/...` (org, property, parking dashboard). Super-admin is out of scope.
Public and guest pages are tracked in [GitHub #296](https://github.com/sprmke/kame-space/issues/296).

## The three patterns

| Pattern                            | Use for                                | Max copy               | Component                              |
| ---------------------------------- | -------------------------------------- | ---------------------- | -------------------------------------- |
| **`InfoHint`**                     | One field, stat card, or section title | 2 sentences, 200 chars | `components/help/InfoHint.tsx`         |
| **`HowItWorksDialog` / `…Button`** | One advanced feature or module         | 3 to 4 steps + 1 tip   | `components/help/HowItWorksDialog.tsx` |
| **`IntroCard`**                    | First visit to a complex module        | One sentence           | `components/help/IntroCard.tsx`        |

Plus **`NoticeCallout`** (static, non-dismissible) only where the context changes the decision
the host is about to make: Support "Broken" thank-you, Smart Pricing autopilot warning, a paused
Channel sync. `components/help/NoticeCallout.tsx`.

`SectionTitle` wraps a section heading with an optional hint and keeps the hint from being pushed
off-screen by a long title.

Do **not** add helper paragraphs, `CardDescription` essays, or always-visible tips. The sanctioned
exception in `.cursor/rules/ui-minimal-copy.mdc` covers only the components above.

## Picking a pattern

1. Are they about to make a decision this moment, and missing context would cause the wrong
   choice? → `NoticeCallout`.
2. Is the confusion about **one label, field, number, or section**? → `InfoHint`.
3. Is it their **first time in a whole feature**? → `IntroCard`, with a How it works action.
4. Do they need the **mental model of the feature**? → `HowItWorksButton` in the page header.

At most one `IntroCard` per page. Blocking banners (plan limit, announcement) win the space.

## Behavior contract

`InfoHint` is the only help control. `FieldHelpTooltip` and `MetricInfoDot` are thin wrappers.

- **Mouse / trackpad:** hover opens after 120ms; pointer leaving both trigger and panel closes it.
- **Click / tap:** opens and pins. A second click closes. This is why the hint works on phones
  even if pointer detection is wrong.
- **Keyboard:** real `<button>`, Tab reaches it, Enter/Space toggles, Esc closes, focus returns to
  the trigger.
- **Never** submits a form (`type="button"`), toggles a parent label, navigates a card link, or
  starts a bottom-sheet drag (`stopPropagation` on click and pointerdown).
- **Inside a modal:** the panel portals into the active `[role="dialog"]` container so the modal's
  inert background and pointer-events lock do not swallow it, and uses that container as its
  collision boundary so the dialog/sheet overflow does not clip it.
- **Layout:** the trigger is `h-4 w-6` (16px tall) with a 44px hit area from a pseudo-element, so
  it centers against a text line and never grows the row. Wrap it in a `flex` span in card titles.
- **Long copy:** max width `min(100vw - 2rem, 18rem)`, scrolls vertically, collision-aware side
  selection (RTL aware).
- **Screen readers:** trigger is `About <label>`; pass `describedById` to render the same copy in
  an `sr-only` span and set `aria-describedby` on the input.

`HowItWorksDialog` is a `ResponsiveModal`: dialog at `lg+`, bottom sheet below. Steps render as an
`<ol>`, so the count and order are announced. Use `hero` on `HowItWorksButton` inside the mobile
brand hero row; use the default variant in `AdminPageHeader` actions.

## Stat cards

`StatCard` never wraps its content in a `<Link>` or `<button>`. When `to` or `onClick` is set, it
renders the card as a `relative` div plus an absolutely positioned overlay control
(`aria-label="{title}: {value}"`). The title hint sits at `relative z-20`, so it is never a nested
interactive element. `focus-within` draws the card ring, and `aria-current` stays on the overlay.

Rules:

- Pass `to` / `onClick` to `StatCard` or `DashboardTrendStatCard`. Do not wrap the card in your own
  `<Link>`; that puts the hint back inside the link.
- `titleAdornment` is for the metric hint. Keep the wrapper a `flex` span so the 16px trigger
  centers against the text line; do not wrap it in a line-height span or add `-my-1`.
- `StatCardSkeleton` accepts the same `titleAdornment` slot. Render an empty `h-4 w-6` span to
  reserve the hint space while data loads.
- Shared formulas live in `ui/src/lib/help/metricDefinitions.ts` as `{ text, source }`. The
  `metricDefinitions.test.ts` guard fails when the cited file or symbol disappears.

## Copy

Every help string lives in a feature module's `*HelpCopy.ts` file, typed by
`ui/src/lib/help/types.ts`. Set `contentKey` when the same entry is exported to the Help Center,
so the UI and the support answer share one source:

```ts
// ui/src/features/dashboard/pricing/lib/pricingHelpCopy.ts
import { ... } from 'lucide-react';
import type { HelpCopyModule } from '@/lib/help/types';

export const PRICING_HELP_COPY = {
  smartStrength: {
    hint: 'How far Smart Pricing can move a night. Balanced moves a ₱3,000 night by about ₱360.',
  },
  smartPricing: {
    howItWorks: {
      title: 'How Smart Pricing works',
      steps: [
        { icon: Gauge, title: 'Start with your rates', body: 'Your saved base and weekend rates.' },
        // 2 more
      ],
      tip: 'Booked nights are never changed.',
    },
  },
} satisfies HelpCopyModule;
```

Rules, enforced by `ui/src/lib/help/helpCopy.test.ts`:

- No em dash or en dash. No banned `human-copy` phrases (seamless, robust, leverage, simply, ...).
- No empty strings, no leading/trailing whitespace, max 200 characters per string.
- Every `howItWorks` has 3 or 4 steps, each with a Lucide icon, title, and body.
- `learnMoreHref` is an internal Help Center path, or omitted.

Stat card definitions must match the server formula. Note the source next to the copy
(e.g. `_shared/dashboardService.ts#computePeriodKpiSnapshot`). Shared formulas
(occupancy, average nightly rate) belong in `ui/src/lib/help/metricDefinitions.ts`.

## Dismissal storage (IntroCard)

`ui/src/lib/help/introDismissal.ts` stores `kh.help.intro.<userId>.<featureKey>.v<version>` in
`localStorage`. Per viewer and device, no server write, no migration. Bump `version` when the
feature changes meaningfully and the card should show again.

Reads and writes are guarded. If storage throws (private mode, Safari ITP, quota), a module-level
Set keeps the dismissal for the session, so a dismissed card never reappears. The component reads
dismissal synchronously before painting, so there is no flash.

## Adding help to a feature

1. Add `features/dashboard/<module>/lib/<module>HelpCopy.ts`.
2. Wire `FieldLabel help={...}` for existing field labels, or `SectionTitle hint={...}` for section
   cards, or `titleAdornment={<InfoHint ... />}` on `StatCard`.
3. Add a `HowItWorksButton` to the page header with 3 to 4 steps.
4. Add an `IntroCard` only for a complex module, with a stable `featureKey` and the current
   `userId`.
5. Run `bun run test` (copy guard), `bun run ci:quality`, and the contextual-help Playwright spec.
6. Update the route guide under `docs/guides/routes/`, then run the support-content checks.

## Testing

| Layer            | File                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Copy rules       | `ui/src/lib/help/helpCopy.test.ts`                                                         |
| Metric formulas  | `ui/src/lib/help/metricDefinitions.test.ts`                                                |
| Dismissal state  | `ui/src/lib/help/introDismissal.test.ts`                                                   |
| Booking stages   | `ui/src/features/dashboard/bookings/lib/bookingStages.test.ts`                             |
| Analytics parity | `ui/src/features/dashboard/analytics/lib/metricGlossary.test.ts`                           |
| UI behavior      | `ui/e2e/features/dashboard/contextualHelp.spec.ts` (hover, tap, Esc, no submit)            |
| Stat card links  | `ui/e2e/features/dashboard/statCardHelp.spec.ts` (no nested control, card still navigates) |
| Accessibility    | `ui/e2e/features/a11y/axeSweep.spec.ts` covers the dashboard routes                        |

## Known limits

- No guided tours or step overlays.
- Intro card dismissal does not follow the host across devices (decision D3).
- `NotificationsHubShell` and `DashboardOccupancyRingCard` have hints but no mounted route today.
  Add E2E when they are mounted.
- Editing a `helpCopy` string does not automatically update the Help Center. The support-content
  export is a separate step (plan P10.11).

## Related

- Plan: `docs/workflow/in-progress/dashboard-contextual-help.md`
- Copy tone: `.cursor/rules/human-copy.mdc`, `human-copy` skill
- Minimal copy: `.cursor/rules/ui-minimal-copy.mdc`, `minimal-ui-copy` skill
- Mobile: `.cursor/rules/mobile-native-ui.mdc`, `mobile-responsive` skill
