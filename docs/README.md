---
title: 'Documentation index'
status: active
tags: [docs]
updated: 2026-08-18
---

# Documentation index

Navigation for **guest-form-management**.

**AI agents:** **[`.cursor/rules/README.md`](../.cursor/rules/README.md)** → **[`architecture/overview.md`](./architecture/overview.md)** (full-app picture, then topic files)

## Workflow (active feature work)

| Doc                                                | Purpose                                                                                                                                                                                                        |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`workflow/README.md`](./workflow/README.md)       | Lifecycle: intake → planned → in-progress → done · wont-do                                                                                                                                                     |
| [`workflow/planned/`](./workflow/planned/)         | Plans not yet shipped                                                                                                                                                                                          |
| [`workflow/in-progress/`](./workflow/in-progress/) | Active implementation. Shipped audits: [`tier-feature-alignment-audit.md`](./workflow/done/tier-feature-alignment-audit.md), [`pricing-portfolio-bundling.md`](./workflow/done/pricing-portfolio-bundling.md). |
| [`workflow/done/`](./workflow/done/)               | Verified shipped plans                                                                                                                                                                                         |

## Product backlog (GitHub Issues)

**Source of truth:** [GitHub Issues](https://github.com/sprmke/kame-homes/issues)  
**Shipped archive:** [`archive/todos/shipped/`](./archive/todos/shipped/)

See epics #101–#119 in historical [`archive/todos/BACKLOG_DRAFT.md`](./archive/todos/BACKLOG_DRAFT.md) or GitHub. Agent CLI: **`.cursor/skills/github-issues/SKILL.md`**.

## Architecture (live)

| Doc                                                                                  | Purpose                                                                    |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| [`PROJECT.md`](./PROJECT.md)                                                         | Thin index into `architecture/`                                            |
| [`architecture/overview.md`](./architecture/overview.md)                             | **Start here** — full-app diagrams, stack, surfaces, auth, booking, deploy |
| [`architecture/routing.md`](./architecture/routing.md)                               | Routes and user flows                                                      |
| [`architecture/data-model.md`](./architecture/data-model.md)                         | Postgres schema                                                            |
| [`architecture/edge-functions.md`](./architecture/edge-functions.md)                 | Edge function inventory                                                    |
| [`architecture/integrations.md`](./architecture/integrations.md)                     | Resend, Google, PDF                                                        |
| [`architecture/validation-and-env.md`](./architecture/validation-and-env.md)         | Validation + env vars                                                      |
| [`architecture/deployment.md`](./architecture/deployment.md)                         | Deployment summary (links runbooks in archive)                             |
| [`architecture/roadmap.md`](./architecture/roadmap.md)                               | Roadmap / gaps                                                             |
| [`architecture/ai-dashboard-assistant.md`](./architecture/ai-dashboard-assistant.md) | AI dashboard assistant — full tool catalog, tiers, RBAC, exclusions        |
| [`architecture/plans-feature-matrix.md`](./architecture/plans-feature-matrix.md)     | Plan/tier feature × entitlement matrix, client/server gate inventory       |
| [`architecture/pwa.md`](./architecture/pwa.md)                                       | PWA — service worker, Web Push, offline read + outbox, kill-switch         |

## Guides (live — per-route behavior)

| Doc                                                                                                          | Purpose                                                                      |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| [`guides/README.md`](./guides/README.md)                                                                     | Route guides overview                                                        |
| [`guides/routes/README.md`](./guides/routes/README.md)                                                       | Route → file index                                                           |
| [`guides/testing/contract-expiry-lifecycle-manual.md`](./guides/testing/contract-expiry-lifecycle-manual.md) | Sublessee / Auth Rep contract-expiry manual E2E                              |
| [`guides/testing/smart-search-intents-manual.md`](./guides/testing/smart-search-intents-manual.md)           | Nearby / concept / literal search manual E2E                                 |
| [`guides/testing/custom-pages-module-manual.md`](./guides/testing/custom-pages-module-manual.md)             | Public Pages module + stay-guide redesign manual E2E                         |
| [`guides/testing/ai-dashboard-assistant-manual.md`](./guides/testing/ai-dashboard-assistant-manual.md)       | AI dashboard assistant manual E2E — read/actions/guardrails                  |
| [`guides/testing/parking-playwright.md`](./guides/testing/parking-playwright.md)                             | Parking Playwright harness — mocked guest/host E2E + side-by-side demo       |
| [`guides/testing/voucher-reveal-playwright.md`](./guides/testing/voucher-reveal-playwright.md)               | Voucher reveal styles — host settings + guest claim worlds (reel/wheel/flip) |
| [`guides/testing/property-team-rbac-playwright.md`](./guides/testing/property-team-rbac-playwright.md)       | Property team RBAC Playwright smoke — seeded template nav + redirects        |
| [`guides/testing/image-upload-optimization-manual.md`](./guides/testing/image-upload-optimization-manual.md) | Image/video upload optimization — functional + quality/OCR/perf gates        |

## Archive

| Folder                                         | Purpose                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| [`archive/README.md`](./archive/README.md)     | Archive index                                                                      |
| [`archive/reference/`](./archive/reference/)   | Project structure, admin walkthrough, receipt AI, Telegram, property catalog       |
| [`archive/operations/`](./archive/operations/) | Migration runbook, prod deploy, **dev/staging**, scheduled jobs, Meta inbox/review |
| [`archive/planning/`](./archive/planning/)     | Booking redesign history (`NEW_FLOW*`)                                             |
| [`archive/todos/`](./archive/todos/)           | Legacy backlog draft + shipped issue archive                                       |

## Agent tooling

| Resource                                                                      | Purpose              |
| ----------------------------------------------------------------------------- | -------------------- |
| [`.cursor/rules/README.md`](../.cursor/rules/README.md)                       | Rules + skills index |
| [`.cursor/skills/docs-first/SKILL.md`](../.cursor/skills/docs-first/SKILL.md) | Docs-first workflow  |
