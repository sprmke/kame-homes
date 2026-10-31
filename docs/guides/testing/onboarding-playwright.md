---
title: 'Onboarding Playwright'
status: active
tags: [guides, testing, playwright, onboarding]
updated: 2026-09-11
---

# Onboarding Playwright

Mocked E2E for the host onboarding wizard. **No verification file uploads or `create-organization` finish in CI.**

## Specs

| Spec                                                 | Tags  | Covers                                                                  |
| ---------------------------------------------------- | ----- | ----------------------------------------------------------------------- |
| `ui/e2e/features/onboarding/onboardingSmoke.spec.ts` | `@ci` | Step 1 org fields; step 2 property type + listing fields → verify intro |

## Harness

| File                                                     | Role                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| `ui/e2e/features/onboarding/shared/onboardingHarness.ts` | Empty `list-organizations`; availability mocks for name/unit checks |

## Run

```bash
bun x playwright test ui/e2e/features/onboarding --project=chromium-ci
```

## Manual gaps

Valid ID / Facebook screenshot upload, `create-organization`, and platform review stay manual.
