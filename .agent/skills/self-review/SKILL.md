---
name: self-review
description: >-
  Deep production-readiness code review of a module or change set: completeness,
  edge cases, regressions, security/RBAC/plans, docs parity, performance, and
  a ship verdict. Use when the user runs /self-review, asks for a deep review,
  production-ready check, or "did we miss anything" before PR/merge.
disable-model-invocation: true
---

# Self-review (production readiness)

Act as a **skeptical senior reviewer** of _our_ implementation — not a cheerleader.
Goal: catch gaps, edge cases, regressions, and ship blockers **before** merge.

**Default:** review only. Do **not** edit code unless the user asks to fix findings.

Announce: `Using self-review to audit <scope>`.

## 0. Resolve scope (smart default)

1. **Named** — user named a module, path, plan slug, or feature → that is the scope.
2. Else **in-progress** — if exactly one relevant doc under `docs/workflow/in-progress/` matches the session, use it (+ linked implementation paths).
3. Else **git** — uncommitted + `origin/develop...HEAD` (or `develop...HEAD`) for this branch.
4. If still ambiguous → ask once: module path / plan slug / “whole branch diff?”

State the resolved scope in one line before reviewing.

### Map the surface

Build a file inventory (UI, edge functions, `_shared/`, migrations, docs, tests):

```bash
git status -sb
git diff --stat origin/develop...HEAD 2>/dev/null || git diff --stat develop...HEAD
# Plus any untracked paths the feature added
```

Read the plan/spec if present (`docs/workflow/in-progress/`, `planned/`, `for-testing/`).
Read matching **route guides** and `docs/PROJECT.md` / architecture docs for that domain.

## 1. Review posture

| Do                                                             | Don't                                      |
| -------------------------------------------------------------- | ------------------------------------------ |
| Trace golden path **and** failure/empty/denied paths           | Rubber-stamp “looks good”                  |
| Prefer evidence (code + local checks) over vibes               | Claim UI verified without running anything |
| Flag missing Plans/RBAC/docs as **P0/P1** when they apply      | Scope-creep into unrelated refactors       |
| Call out “works on happy path only”                            | Fix silently while reviewing               |
| Compare against repo invariants (booking, auth, multi-tenancy) | Invent product requirements                |

Load domain rules/skills **when the surface touches them** (do not skip):

| Surface                       | Read / invoke                                            |
| ----------------------------- | -------------------------------------------------------- |
| Booking status / emails / cal | `.cursor/rules/booking-workflow.mdc`                     |
| Admin / org / property auth   | `admin-auth.mdc`, `security.mdc`, `supabase-auth`        |
| New host capability           | `plans-and-permissions` skill                            |
| Host dashboard writes         | `ai-assistant-parity.mdc`                                |
| Page / section UX             | `route-guides` + matching `docs/guides/routes/*`         |
| Edge handlers                 | `supabase-edge-functions.mdc`                            |
| Multi-tenant scoping          | `multi-tenancy` skill                                    |
| Mobile UI                     | `mobile-responsive` (+ always-on `mobile-native-ui.mdc`) |
| Docs / API / env              | `documentation-maintenance`                              |

## 2. Checklist (work top → bottom)

Copy and tick mentally; report failures with file:line evidence.

### A. Completeness vs intent

- [ ] Plan/spec acceptance criteria are met (or explicitly deferred with reason)
- [ ] No TODO / FIXME / stub / dead `console.log` left in the ship path
- [ ] UI ↔ edge ↔ DB columns aligned (names, types, nullability)
- [ ] Client/server mirrors stay in sync (`planFeatures`, permission ids, status machine, etc.)
- [ ] Cron / webhook / config.toml / grants / RLS companions exist when schema needs them
- [ ] Feature flags / plan seeds / notification types registered if introduced

### B. Correctness & edge cases

- [ ] Empty, loading, error, and partial-data UI states
- [ ] Null / missing optional fields; timezone (`Asia/Manila`); date format MM-DD-YYYY vs YYYY-MM-DD
- [ ] Idempotent writes where retries happen (cron, double-click, webhook replay)
- [ ] Concurrent edits / stale cache (TanStack Query invalidation keys)
- [ ] Pagination / large lists / 0-row and max-row behavior
- [ ] Money / percentages: rounding, currency, clamp min/max
- [ ] Booking workflow: no bypass of `workflowOrchestrator`; side-effect matrix intact
- [ ] Soft-delete / cancelled / archived entities excluded where required

### C. Security & tenancy

- [ ] Every mutating edge path: JWT + `verifyOrgAccess` / `verifyPropertyAccess` / parking scope as appropriate
- [ ] Queries filtered by `organization_id` / `property_id` — no client UUID trust
- [ ] Team permission leaves enforced **on server** (not UI-only)
- [ ] No secrets/PII in logs, URLs, or client error payloads
- [ ] Public/anon endpoints validate input tightly; no privilege escalation
- [ ] Storage paths scoped; no path traversal

### D. Plans & RBAC

- [ ] Plans decision made (gated or N/A documented)
- [ ] Team RBAC decision made (leaves or N/A documented)
- [ ] `require*Feature` on writes; preview-open reads only when intentional
- [ ] Matrix + route-guide permission tables updated

### E. Regressions & blast radius

- [ ] Shared helpers (`_shared/*`, pricing, orgAuth) — callers outside the module still safe
- [ ] Migrations additive; **no edits** to shipped migration files
- [ ] No prod deploy / remote `db push` suggested without `kamewave`
- [ ] Backward compatible with existing rows / missing JSON keys

### F. Performance & solidity

- [ ] No N+1 obvious query loops; batch where lists grow
- [ ] Avoid duplicate network calls on mount; sensible query keys
- [ ] Heavy work off the request path when possible (or bounded)
- [ ] UI: no unnecessary giant lists without virtualization when already the pattern nearby

### G. UX / a11y / mobile (if UI)

- [ ] `usePageTitle` / favicon conventions
- [ ] Minimal copy (no noisy helper essays unless required)
- [ ] 375px usable; 44px targets for primary actions
- [ ] Labels / `aria-label` on icon-only controls

### H. Docs & assistant parity

- [ ] `docs/guides/routes/*` updated for behavior changes
- [ ] `docs/PROJECT.md` / architecture docs for API, env, schema
- [ ] `plans-feature-matrix.md` when entitlements change
- [ ] Host-dashboard writes: assistant tool **or** documented exclusion (`ai-assistant-parity`)

### I. Verification evidence

Prefer running (local only):

```bash
bun run ci:quality
# If edge logic: deno tests next to the module, or curl local functions
# If UI critical path: playwright-cli or note “UI not exercised”
```

Do **not** claim production-ready if static checks fail or UI was not exercised when UX is material.

## 3. Findings format

Lead with a **verdict**, then findings sorted by severity.

```markdown
## Self-review: <scope>

**Verdict:** Ship | Ship with fixes | Not ready
**Scope:** <paths / plan>
**Evidence:** <ci:quality / deno tests / curl / UI / docs-only>

### P0 — Must fix before merge

- [ ] …

### P1 — Should fix before merge

- [ ] …

### P2 — Should fix soon

- [ ] …

### P3 — Nice to have

- [ ] …

### Looks solid

- …
```

Severity:

| Level  | Meaning                                                                |
| ------ | ---------------------------------------------------------------------- |
| **P0** | Data loss, security/tenancy hole, broken core path, wrong money/status |
| **P1** | Missing Plans/RBAC/docs gate, likely bug, broken edge case hosts hit   |
| **P2** | Maintainability, incomplete coverage, weak a11y/mobile                 |
| **P3** | Polish, optional optimization                                          |

Each finding: **what** · **where** (`path:line` or symbol) · **why it matters** · **fix direction** (one sentence). No drive-by rewrite plans.

## 4. Related

| Need                       | Use instead / after                  |
| -------------------------- | ------------------------------------ |
| Prove a change works in UI | `verify` skill (Claude) / Playwright |
| Property dashboard host QA | `property-dashboard-qa`              |
| CI gate only               | `/kh-check-before-pr`                |
| Open PR                    | `/kh-submit-for-review`              |
| Auth/PII deep audit        | `security-auditor` agent             |

## Don'ts

- Do not mark **Ship** if P0 remains, or if Plans/RBAC were required and skipped.
- Do not run or recommend prod Supabase deploys without **`kamewave`**.
- Do not spawn review subagent swarms by default (`ai-usage.mdc`) — stay single-threaded unless the user asks.
- Do not expand into implementing fixes mid-review unless asked.
