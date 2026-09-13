---
title: 'Services (guest marketing) — operator guide'
status: active
tags: [guides, routes]
updated: 2026-08-17
---

# Services (guest marketing) — operator guide

Route: `/services`

> **Status:** Documented — UI-only coming-soon page.

## Overview

Public preview for future guest services. Uses `MarketingLayoutShell` and the same listing search and scroll morph as `/properties` and `/developments`. Mobile shell: `MarketingLayoutShell` bottom tabs — see [index-landing.md](./index-landing.md) § Mobile shell.

---

## Host-facing knowledge

This page previews add-on services (cleaning, maintenance, supplies, and similar) that may be offered to guests later. Nothing on it is bookable yet.

**Common host questions**

- Q: Can guests order services from this page today?
  A: No, it's a coming-soon preview only. The service chips aren't clickable yet.
- Q: Will these services connect to my dashboard later?
  A: That's the plan, but there's no live integration yet. Hosts manage operations through existing Finance and Maintenance modules instead.
- Q: Why is Services in the main navigation if it's empty?
  A: It sets expectations for guests and reserves space in the layout until the catalog ships.

---

## Behavior

- Search bar shows **What** and **When** only (no **Who** segment). **Where/What** starts empty on `/services` (no category-label prefill). Submits to unified `/search` with page focus omitted.
- No filters, inventory, booking actions, API calls, or persistence.
- Service chips are decorative previews (property manager, agent, marketing, maintenance, food & essentials, supplies, transportation) and are not interactive.
- Motion respects the user's reduced-motion preference.

## Implementation map

| Concern        | Path                                                                         |
| -------------- | ---------------------------------------------------------------------------- |
| Page           | `ui/src/features/guest/marketing/pages/ServicesPage.tsx`                     |
| Route          | `ui/src/features/guest/marketing/routes/index.tsx`                           |
| Search default | `ui/src/features/guest/marketing/shared/lib/listingSearchDefaultLocation.ts` |
| Search fields  | `ui/src/features/guest/marketing/shared/lib/listingSearchFields.ts`          |
| Search morph   | `ui/src/features/guest/marketing/shared/lib/listingScrollSearchPaths.ts`     |

---

## Testing

| Layer | Path / spec           | Manual |
| ----- | --------------------- | ------ |
| E2E   | N/A                   | —      |
| N/A   | Static marketing copy | —      |

## Related docs

- [Properties](./properties.md)
- [Developments](./developments.md)
- [Route index](./README.md)
