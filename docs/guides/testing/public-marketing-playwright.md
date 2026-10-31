---
title: 'Public marketing Playwright'
status: active
tags: [guides, testing, playwright, marketing]
updated: 2026-09-11
---

# Public marketing Playwright

Mocked E2E for guest explore, search, listings, for-hosts, and static legal pages.

## Specs

| Spec                                              | Tags           | Covers                                                                           |
| ------------------------------------------------- | -------------- | -------------------------------------------------------------------------------- |
| `ui/e2e/features/public/publicPagesSmoke.spec.ts` | `@smoke` `@ci` | Landing, properties list/detail, for-hosts, pricing, search, terms, developments |

## Shared fixtures

- `ui/e2e/shared/mockFixtures.ts` — `mockPublicPropertyBody`, `mockPublicPropertiesListBody`, `mockSearchListingsBody`, `mockSearchSuggestionsBody`, `mockPublicPricingPlansBody`, `mockPublicDevelopmentsListBody`
- `ui/e2e/shared/interceptEdge.ts` — `mockEdgeFunctions`

## Run

```bash
bun run test:e2e:smoke   # includes public specs
bun x playwright test ui/e2e/features/public --project=chromium-ci
```

## Manual gaps

Showcase animations, smart-search deep intents, and live listing API parity: see manual guides under [`README.md`](./README.md).
