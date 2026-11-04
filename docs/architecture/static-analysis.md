# Static analysis (fallow) — unused code, cycles, duplication

`fallow` is the codebase analyzer for unused files, exports and types, dependency hygiene,
import cycles, duplicate exports and copy-paste. Config lives in `.fallowrc.json` at the repo root.

## Commands

```bash
fallow dead-code            # unused files, exports, types, dependencies, cycles
fallow dead-code -f json    # machine-readable report
fallow dupes                # clone groups (copy-paste)
fallow health --hotspots    # complexity and churn hotspots
fallow fix --dry-run        # preview safe auto-fixes
```

Run `dead-code` before claiming a cleanup pass is done. The 2026-11-01 pass took the report
from 1,970 findings to 0.

## What the config declares, and why

| Setting                                  | Why                                                                                                                                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `workspaces.packages`                    | `ui`, `marketing/social` (Remotion studio) and `supabase/functions` (Deno) are separate projects. Without this, every file in them reads as unreachable.                                                                       |
| `entry`                                  | Deno `*_test.ts` files, `scripts/**` entry scripts, `ui/src/pwa/sw.ts`, `ui/middleware.ts` and `ui/public/*.js` are real roots that no manifest declares.                                                                      |
| `ignoreExports` (named lists)            | Parity tests read edge modules as **source text**, so constants such as `POSTER_ARCHETYPES` or `AI_FEATURES` must stay exported even when nothing imports them.                                                                |
| `ignoreExports` (telemetry twins)        | `ui/src/lib/telemetry/scrub.ts` and `supabase/functions/_shared/telemetryScrub.ts` are deliberate duplicates; edge isolates cannot import from `ui/`.                                                                          |
| `ignoreDependencies`                     | `dayjs`, `papaparse` and `zod` resolve through `supabase/functions/deno.json` (Deno import map). `chrome-launcher`, `lighthouse` and `pg` are local scripts only. `@types/google.maps` supplies ambient `google.maps` globals. |
| `circularDependencies.ignoreLazyImports` | Cycles that close through an `await import()` inside a function cannot run at module init, so they are not reported.                                                                                                           |

## Module cycles

Three edges are lazily imported on purpose, to keep module graphs acyclic:

- `planEntitlements.ts` → `subscriptionBillingEmail.ts` (downgrade email)
- `planEntitlements.ts` → `aiUsageService.ts` (plan credit sync)
- `dashboardAssistantDeferredWrites.ts` → `dashboardAssistantTools.ts` (deferred tool execution)
- `orgPaymentReconcile.ts` → `subscriptionOrchestrator.ts` (payment fulfilment)

Each call site has a comment. Turning any of them back into a static import re-opens the cycle.

## Suppression markers

Prefer fixing the finding. When duplication or a cross-package import is intentional, use the
tool's marker on the line or above it, and put the reason on its own comment line above, because
the parser reads every `//` token that follows the marker.

```ts
// Browser and edge runtimes keep intentional twins of this helper.
// fallow-ignore-next-line duplicate-export
export function scrubRecord(...)
```

`fallow suppressions` lists active markers. `fallow dead-code` reports `stale_suppressions` when a
marker no longer suppresses anything, so delete markers whose finding is gone.

## Duplication

`fallow dupes` reports clone groups, not defects. `duplication_percentage` is dominated by SQL
migrations, seed data and test fixtures, which are expected to repeat. Refactor only clone groups
that are real logic, and verify with `bun run test` plus the Playwright smoke suite.
