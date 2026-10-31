## What changed

<!-- One or two sentences: what changed and why. -->

## Docs / Plans / activity-log (mandatory per CLAUDE.md — check before requesting review)

- [ ] `documentation-maintenance` — updated the matching docs in this PR (or the change is docs-exempt: typo/rename only).
- [ ] `route-guides` — updated `docs/guides/routes/*.md` if any page/section behavior, save flow, or validation changed.
- [ ] `mobile-responsive` — reviewed native mobile UI (bottom sheets/nav, density, touch targets) if `ui/src/**` changed.
- [ ] `audit-logging` — emitted an `activity_log` event for any org/property/parking mutation, or the PR states `activity-log: N/A — <why>`.
- [ ] `plans-and-permissions` — considered Plans entitlements / Team RBAC for any new dashboard feature, or marked N/A.
- [ ] New analytics events added for any new user-facing feature (doc 28), or N/A.

## Test evidence

- [ ] `bun run ci:quality` passes locally (lint, type-check, unit, edge, smoke E2E, build).
- [ ] Manually verified in the browser for UI changes (golden path + edge cases).

<!-- Paste relevant command output, screenshots, or a short description of manual verification. -->
