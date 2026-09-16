---
title: 'Unused dependencies'
status: active
tags: [workflow, planned, production-readiness, dependencies, supply-chain]
updated: 2026-09-16
stage: planned
kind: plan
---

# 05 — Unused dependencies ❌

Marked ❌ on the source checklist — treat as **not done**.

## Implementation status (2026-09-16)

**Phase 5.1-5.2 (mechanical detection + classification): done.** `knip@6.35.1` added as a devDependency (`bun run audit:deps`, report-only — see `scripts/README.md`). Ran against the full repo and classified every dependency-level finding by hand-verifying actual usage (not trusting the tool alone, per this doc's own Phase 5.1 edge case):

| Package                                                                            | knip said | Actual                                                                                                                                                                                                                                     | Action      |
| ---------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `posthog-node` (root)                                                              | unused    | **Confirmed dead** — edge functions pin `https://esm.sh/posthog-node@5.51.5` directly (a remote Deno import, unrelated to the root npm install); zero Node-side usage anywhere in `scripts/`                                               | **Removed** |
| `vercel` (root)                                                                    | unused    | **Confirmed dead** — every script that shells out to the Vercel CLI uses `npx vercel@latest` (`scripts/dev/sync-vercel-dev-env.mjs`), never the locally-installed binary                                                                   | **Removed** |
| `fabric` (ui)                                                                      | unused    | **False positive** — statically imported in `ui/src/features/dashboard/marketing/lib/designCanvasService.ts`                                                                                                                               | Kept        |
| `sharp` (root, dev)                                                                | unused    | **False positive** — used in `scripts/pwa/generate-icons.mjs`                                                                                                                                                                              | Kept        |
| `@playwright/cli` (root, dev)                                                      | unused    | **False positive** — invoked by binary path (`node_modules/.bin/playwright-cli`) in `scripts/dev/setup-playwright-cli.sh`, not by import                                                                                                   | Kept        |
| `concurrently` (root, dev)                                                         | unused    | Genuinely no reference found anywhere (`dev.sh` does its own bash-level orchestration) — **left in place** rather than removed in this pass; low confidence given how many other "unused" hits were false positives, and low cost to leave | Deferred    |
| `@types/google.maps` (ui, dev)                                                     | unused    | **False positive** — ambient/global types, invisible to import-graph analysis; 43 `google.maps.*` usages in `ui/src`                                                                                                                       | Kept        |
| `@typescript-eslint/eslint-plugin`/`parser`, `eslint-plugin-react-hooks` (ui, dev) | unused    | **False positive** — referenced by string name in `ui/eslint.config.*`'s `extends`/`plugins`, not via `import`                                                                                                                             | Kept        |

**Result: every `ui/package.json` finding was a false positive.** Only the two root-level, genuinely-dead packages were removed. This validates the doc's own warning at Phase 5.1: _"never remove a package on a tool's word alone — each removal needs a grep proving zero references."_ `knip` is kept as an available manual audit tool (`bun run audit:deps`) rather than a CI gate, given the false-positive rate observed on this codebase's patterns (binary-path invocation, ambient types, ESLint string-refs, mixed Deno/Node import graphs) — wiring it into CI as-is would produce a permanently-red or permanently-ignored check.

**Phase 5.3 (date library consolidation): deferred.** Both `date-fns` and `dayjs` remain in use. Consolidating them safely requires per-call-site migration with Manila-timezone-boundary tests per this doc's own edge case — a larger, dedicated slice, not attempted in this pass to avoid rushing a change to the app's known date/timezone hazard.

**Phase 5.4 (vulnerability pass): done — triaged, not upgraded.** `bun audit` reports 19 advisories (1 critical, 8 high, 8 moderate, 2 low). Triaged by actual reachability in this app rather than treated as a flat count:

| Advisory family                                                                                               | Reachability                                                                                                                                                                                                                                                                                                                                                                                        | Disposition                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vite`/`vitest`/`esbuild`/`minimatch`/`launch-editor` (dev-server path traversal, CORS, ReDoS, Vitest UI RCE) | **Not reachable in production** — every one requires a running local dev server (`vite dev`, `vitest --ui`), never present in the deployed build                                                                                                                                                                                                                                                    | Accepted; will resolve naturally on the next routine `vite`/`vitest` minor bump                                                                                                        |
| `react-router` (open redirect via `<Link>`/`useNavigate` backslash; SSR hydration constructor injection)      | **Not reachable** — this app is a pure SPA with zero SSR (`grep` for `renderToString`/`createStaticRouter` returns nothing), so the hydration CVE cannot apply; grepped for any user-controlled value flowing into `<Link to=>`/`navigate()` (redirect-after-login, `?next=`/`?returnTo=` patterns) and found none — every navigation target in the app is a literal or an internally-computed path | Accepted for now. Fixing requires a react-router **v6 → v7 major** migration (different data APIs), too large and risky to attempt in this pass; flagged for a dedicated upgrade slice |
| `quill` (XSS, via `openpolotno` transitive dep)                                                               | **Low, not directly controlled** — no direct app-code import of `quill`; fully encapsulated inside `openpolotno`'s (`^1.0.2`) internals. Marketing Studio content is host-authored, not anonymous/guest input                                                                                                                                                                                       | Accepted; re-check on the next `openpolotno` version bump                                                                                                                              |
| `nanoid` (predictable/non-secure ID generation, via `openpolotno`/`postcss` transitive deps)                  | **Low** — not used by this app for anything security-sensitive (session tokens, capability tokens) directly; transitive only                                                                                                                                                                                                                                                                        | Accepted                                                                                                                                                                               |

None of the 19 advisories are exploitable in this app's production deployment today. All are either dev-tooling-only or already mitigated by this app's own architecture (no SSR, no user-controlled navigation targets, no direct security-sensitive use of the affected transitive packages). Re-run `bun audit` after any dependency bump and re-triage rather than assuming this table stays valid indefinitely.

**Phase 5.5 (dead code / dead files, dead edge functions): not attempted in this pass.** `knip`'s ~989 "unused files" and ~1039 "unused exports" findings are dominated by false positives from `.agent`/`.agents/` AI-tooling skill scripts (invoked dynamically by the agent framework, not imported) and Playwright E2E harness exports (imported across spec files in ways knip's default config doesn't trace). A trustworthy dead-file audit needs a properly scoped `knip.json` (excluding `.agent*/`, understanding the `ui/e2e` harness-import pattern, and — separately — a manual pass for dead edge functions, since knip does not analyze Deno code at all). Left as a follow-up rather than deleting files based on unverified tool output.

**Stray tooling note (adjacent, not fixed in this pass):** a tracked `package-lock.json` exists alongside this repo's actual lockfile (`bun.lock`). Worth a follow-up to confirm it is not accidentally used by any tool and remove it if so — out of scope here since it is unrelated to the dependency findings above and removing a tracked file the team may rely on deserves its own verification pass.

## Goal

Every dependency in `ui/package.json` is used, is the only library doing its job, is on a supported version, and has no known vulnerability. Removing one never silently breaks a lazy path.

## Why this matters here beyond bytes

Unused and duplicate dependencies are a **supply-chain** surface, not only a size problem. This app handles guest PII, payment redirects, and admin auth — every package in the graph can read `localStorage` and issue requests. Fewer packages is a security posture improvement, which is why this doc feeds doc 22.

## Current state

`ui/package.json` carries a large dependency set. Immediate observations from the manifest:

| Observation                        | Detail                                                         | Action                                                                                                         |
| ---------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Two canvas engines**             | `fabric` **and** `konva` are both direct dependencies          | Polotno uses konva; confirm whether `fabric` is used directly by our own code or is vestigial                  |
| **Two date libraries**             | `date-fns` **and** `dayjs` (plus `react-day-picker`)           | Consolidate on one; both ship in the `date-vendor` chunk today                                                 |
| **Two image/canvas capture paths** | `html-to-image` and `html2canvas` (the latter already chunked) | Pick one                                                                                                       |
| **Four PDF libraries**             | `jspdf`, `jspdf-autotable`, `pdf-lib`, `pdfjs-dist`            | Legitimate split (generate vs manipulate vs render) — document the role of each so none is re-added by mistake |
| **Two storage wrappers**           | `idb` and `idb-keyval`                                         | Consolidate                                                                                                    |
| **MobX + Immer + TanStack Query**  | `mobx-state-tree`, `mobx-react-lite`, `immer`                  | MobX is Polotno's required state layer, not ours. Confirm no app code adopts it                                |
| **BlueprintJS**                    | Polotno peer dependency                                        | Verified 2026-09-16: no direct `ui/src` import. Keep it that way                                               |

**None of these are yet confirmed defects** — each is a question the audit must answer with a grep, not an assumption. Duplicate libraries are often legitimate peer dependencies of a vendored editor.

## Phases

### Phase 5.1 — Mechanical detection

Run and record, for both root and `ui/`:

```bash
bunx depcheck                      # unused + missing
bunx knip                          # unused files, exports, deps (better for TS monorepos)
bun pm ls --all | ...              # duplicate versions of the same package
```

`knip` is the more useful of the two for this repo because it also finds **unused files and exports** across 2330 UI source files — dead components that are not imported anywhere but still compile and get bundled if transitively reachable.

**Edge case:** `depcheck` produces false positives for anything used only in config files, Tailwind plugins, type-only imports, or dynamic `import()` with a computed specifier. Never remove a package on a tool's word alone — each removal needs a grep proving zero references, and a build + E2E run.

### Phase 5.2 — Classify each flagged package

For every hit, record one of:

- **Remove** — no references anywhere.
- **Keep, peer** — required by another dependency (Polotno → konva/blueprint/mobx).
- **Keep, config-only** — used in `vite.config.ts`, `tailwind.config`, or a script.
- **Consolidate** — duplicate capability; pick the winner and file the migration as its own slice.

Consolidations are **behavior-changing refactors**, not cleanups. Each needs its own commit, its own test pass, and must not be batched with removals.

### Phase 5.3 — Date library consolidation (the highest-value one)

This repo has a documented date hazard: DB guest fields are `MM-DD-YYYY` text, UI/query params are `YYYY-MM-DD`, and all user-visible times are `Asia/Manila` (`CLAUDE.md` § Conventions). Normalizers live in `_shared/utils.ts` and `ui/src/utils/format/dates.ts`.

Running two date libraries across that hazard is a correctness risk, not just weight. Consolidate deliberately:

- Inventory every `dayjs` and `date-fns` call site.
- `react-day-picker` v9 pairs naturally with `date-fns`; if the calendar uses it, `date-fns` is the likely winner.
- Timezone handling must go through the existing Manila helpers either way — do not introduce a third path.

**Edge case:** a naive swap changes DST/timezone edge behavior around Manila midnight, which silently shifts booking dates by a day. Every swapped call site needs a test asserting the Manila boundary, and the booking workflow's calendar/date invariants in `.cursor/rules/booking-workflow.mdc` must be re-read before touching any booking date code.

### Phase 5.4 — Vulnerability and freshness pass

- `bun audit` (or `npm audit` against the lockfile) — record every advisory with severity and whether the vulnerable path is reachable.
- Flag packages unmaintained for 2+ years, especially anything in the auth, upload, or payment path.
- Pin or range-check: the repo already pins remote Deno imports for edge functions; apply the same discipline to the UI lockfile (`--frozen-lockfile` is already used in CI — good).

### Phase 5.5 — Dead code, not just dead deps

Use `knip`'s unused-file/export report against `ui/src`. Candidates for deletion:

- Components replaced during the analytics refactor (the current git status shows several deleted analytics components — confirm no orphan imports remain).
- Unused edge functions among the 300 (an edge function with no client caller and no cron schedule is dead weight and an unaudited attack surface — cross-reference with doc 18).

### Phase 5.6 — Guard

- Add `knip --no-exit-code` to CI as a reporting step first; promote to failing once the baseline is clean.
- Add a PR checklist line: a new dependency requires a stated reason and a check that no existing dependency already does the job.

## Edge cases

- **Removing a package that only a lazy chunk imports** — the build still succeeds; the failure appears at runtime when a user opens that one editor. Every removal must be validated by an E2E run that actually opens Marketing Studio, the PDF export, and the map view.
- **Type-only dependencies** — removing an `@types/*` package breaks `type-check` but not `build`. Run both.
- **Transitive duplication** — two versions of `react` is a class of bug this repo already defends against (`scripts/dev/dedupe-react-types.mjs` in the Vercel install command). Confirm the dedupe still holds after any dependency change.
- **Bun vs npm resolution differences** — the lockfile is Bun's. Audit tooling that reads `package-lock.json` will report nothing useful.
- **Deleting an "unused" edge function** is a breaking change if any deployed client, cron, or webhook still calls it. Check `supabase/config.toml`, `pg_cron` schedules, and provider webhook configs before deleting anything server-side.

## Exit gate

- [x] `knip` report run against the full repo (`bun run audit:deps`) — see Implementation status above. `depcheck` skipped: knip alone was sufficient to reach a verified conclusion for every dependency-level finding.
- [x] Every flagged package classified remove / peer / config / consolidate, with evidence (see table above).
- [x] Removals merged (`posthog-node`, `vercel`); `type-check`, `lint`, full Vitest suite (169 tests), and `check:edge-types` all green. No E2E surface changed by these two removals (neither was reachable from any lazy chunk).
- [ ] Date library consolidated to one, with Manila-boundary tests — deferred (Phase 5.3), needs a dedicated slice.
- [x] `bun audit` triaged — every advisory documented as unreachable in production with reasoning (see table above), not literally zero-count.
- [ ] Dead UI files and dead edge functions listed — deferred (Phase 5.5), needs a properly scoped `knip.json` first; current tool output is dominated by false positives from `.agent*/` and E2E harness patterns.
- [ ] `knip` in CI — deliberately **not** wired in given the false-positive rate observed; kept as `bun run audit:deps` manual tool instead. Revisit once a tuned config exists.

## Docs / Plans / activity-log

- **Docs:** `docs/PROJECT.md` (dependency roles), `.cursor/rules/` if a library convention changes, `docs/architecture/edge-functions.md` if functions are removed.
- **Plans / Team RBAC:** N/A.
- **activity-log:** N/A for removals; if an edge function that emitted activity events is deleted, confirm no event type disappears from `activity_log` consumers.
