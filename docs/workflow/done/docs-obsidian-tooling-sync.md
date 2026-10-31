---
stage: done
title: 'Docs cleanup, Obsidian optimization, and Cursor/Claude Code tooling sync'
status: done
tags: [superpowers]
updated: 2026-08-01
---

# Docs cleanup, Obsidian optimization, and Cursor/Claude Code tooling sync

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `docs/` into a clear tiered vault, optimize it for Obsidian + low-token AI reads, and make `.cursor/` / `.claude/` skills a single symlink-backed source of truth under `.agent/skills/`.

**Architecture:** Mechanical docs moves/archives first; split `docs/PROJECT.md` into `docs/architecture/*` with a thin index; one-shot Obsidian frontmatter/wikilink conversion; migrate shared skills to `.agent/skills/` with relative symlinks from both tool folders; add a sync check script wired to pre-commit and session-start hooks.

**Tech Stack:** Markdown, Obsidian Bases (core plugin), bun/Node one-shot scripts, bash sync checks, git symlinks, husky.

## Global Constraints

- Do **not** change content of `docs/planning/planned_modules/*.md` except the one rename in Task 1 and additive index rows for this plan.
- Do **not** change content of `docs/planning/CLAUDE_TO_PLAN.md` or `docs/planning/TASKS_TO_PROMPT.md` (filenames stay as-is).
- Archive `TODOS.md` unshipped content into `docs/todos/BACKLOG_DRAFT.md` — do **not** auto-create GitHub Issues.
- For skills with content drift (`slides`, `ui-styling`, `ui-ux-pro-max`) and untracked `design/` extras: use currently-tracked **`.claude/skills/`** as source of truth.
- `.claude/skills/verify/` stays a real directory (Claude-only exception) — never symlink it away.
- No community Obsidian plugins; enable Bases core plugin only.
- No production Supabase/DB deploys.
- Commits: conventional messages, no Cursor/AI attribution, no `Co-authored-by` Cursor trailers.
- Verification for doc/tooling tasks = greps, script exits, symlink resolution — not Vitest/Deno unit tests unless the task adds a script with a clear assertable contract.
- Work only inside the isolated worktree for this branch; do not touch unrelated WIP on the primary checkout.

---

### Task 1: Persist plan index + rename FOR_HOSTS plan

**Files:**

- Create: `docs/planning/planned_modules/docs-obsidian-tooling-sync.md` (short pointer to this Superpowers plan)
- Modify: `docs/planning/planned_modules/README.md`
- Rename: `docs/planning/planned_modules/FOR_HOSTS_LANDING_PAGE_PLAN.md` → `docs/planning/planned_modules/for-hosts-landing-page.md`

- [ ] **Step 1:** `git mv` the FOR_HOSTS file to the dated kebab name.
- [ ] **Step 2:** Update the README row that pointed at `FOR_HOSTS_LANDING_PAGE_PLAN.md` to the new path; add a row for `docs-obsidian-tooling-sync.md`.
- [ ] **Step 3:** Write the planned_modules pointer file (Goal / Scope / Approach / link to `docs/superpowers/plans/docs-obsidian-tooling-sync.md`).
- [ ] **Step 4:** Grep for `FOR_HOSTS_LANDING_PAGE_PLAN` — fix any remaining refs.
- [ ] **Step 5:** Commit:

```bash
git add docs/planning/planned_modules/ docs/superpowers/plans/docs-obsidian-tooling-sync.md
git commit -m "$(cat <<'EOF'
docs: rename for-hosts plan and index docs/tooling sync plan

EOF
)"
```

---

### Task 2: Archive `docs/TODOS.md` into backlog draft

**Files:**

- Create: `docs/todos/BACKLOG_DRAFT.md`
- Modify: `docs/todos/README.md`, `docs/README.md` (index only if Task 7 not yet done — at minimum todos README)
- Delete: `docs/TODOS.md`

- [ ] **Step 1:** Diff-confirm lines 1–43 of `docs/TODOS.md` duplicate `docs/todos/shipped/booking-flow-phases.md`; do not copy that section into the draft.
- [ ] **Step 2:** Move remaining unshipped sections into `docs/todos/BACKLOG_DRAFT.md` with a header: unfiled draft backlog, not GitHub Issues; filing is a separate future action.
- [ ] **Step 3:** Delete `docs/TODOS.md`. Update `docs/todos/README.md` index to include `BACKLOG_DRAFT.md`.
- [ ] **Step 4:** Grep for `docs/TODOS.md` / `TODOS.md` repo-wide; fix dangling refs.
- [ ] **Step 5:** Commit:

```bash
git commit -m "$(cat <<'EOF'
docs: archive TODOS.md into todos/BACKLOG_DRAFT

EOF
)"
```

---

### Task 3: Resolve `docs/temp/` into route guides

**Files:**

- Read: `docs/temp/guest-contact-host-flow.md`, `ui/src/features/guest/**` (ContactHostSheet usage), relevant `docs/guides/routes/**`
- Modify: the matching route guide(s) only if still-accurate details are missing
- Delete: `docs/temp/guest-contact-host-flow.md` and empty `docs/temp/`

- [ ] **Step 1:** Verify `ContactHostSheet` is shipped and wired (e.g. `PropertyDetailPage.tsx`).
- [ ] **Step 2:** Fold any missing accurate behavior into the property detail / properties route guide; skip if already covered.
- [ ] **Step 3:** Delete temp file + folder. Grep for `docs/temp` — fix refs.
- [ ] **Step 4:** Commit:

```bash
git commit -m "$(cat <<'EOF'
docs: fold contact-host temp notes into route guides

EOF
)"
```

---

### Task 4: Tier `docs/superpowers/` by status

**Files:**

- Create: `docs/superpowers/README.md`, `docs/superpowers/archive/`
- Move completed: `plans/services-coming-soon.md`, `specs/services-coming-soon-design.md`, `specs/marketing-video-quiet-coast-motion-design.md` → under `archive/` (preserve relative plans/specs structure or flat with clear names — prefer `archive/plans/` and `archive/specs/`)
- Keep active: `plans/property-calendar-page.md` (and this plan) at top level under `plans/`

- [ ] **Step 1:** Create archive folders; `git mv` completed plans/specs.
- [ ] **Step 2:** Write `docs/superpowers/README.md` status index (Completed / Active).
- [ ] **Step 3:** Grep for old paths; update refs (CLAUDE.md, rules, etc.) if needed.
- [ ] **Step 4:** Commit:

```bash
git commit -m "$(cat <<'EOF'
docs: archive completed superpowers plans and add status index

EOF
)"
```

---

### Task 5: Archive naming-audit reference

**Files:**

- Create: `docs/archive/reference/` (includes naming-audit + live reference docs)
- Rename/move: `docs/archive/reference/naming-audit.md` (already under archive)
- Update any refs in naming-conventions rules/docs

- [ ] **Step 1:** `git mv` into archive.
- [ ] **Step 2:** Fix references.
- [ ] **Step 3:** Commit:

```bash
git commit -m "$(cat <<'EOF'
docs: archive completed naming-audit reference

EOF
)"
```

---

### Task 6: Split `docs/PROJECT.md` into `docs/architecture/`

**Files:**

- Create:
  - `docs/architecture/overview.md` — purpose, stack, top-level architecture (§1–3 + known notes / key files as appropriate)
  - `docs/architecture/routing.md` — routes, path aliases, layout (§4–5)
  - `docs/architecture/data-model.md` — Postgres schema summary (§6)
  - `docs/architecture/storage.md` — Storage buckets (§7)
  - `docs/architecture/edge-functions.md` — function inventory + `_shared/` (§8)
  - `docs/architecture/integrations.md` — Google/Resend/Meta/Telegram (§9); cross-link existing reference docs, don't duplicate
  - `docs/architecture/validation-and-env.md` — validation + env vars (§10–11)
  - `docs/architecture/deployment.md` — deploy summary (§12); cross-link `docs/archive/operations/production-deployment.md`
  - `docs/architecture/roadmap.md` — roadmap/gaps (§13); cross-link `NEW_FLOW_PLAN.md` / todos, don't duplicate
- Replace: `docs/PROJECT.md` with a thin index (front-matter + table linking each topic file). Preserve §14–15 content either in overview or as short sections on the index — prefer overview for known notes + key files quick reference.

- [ ] **Step 1:** Create `docs/architecture/` and split content by the section map above. Move prose; do not invent new architecture facts.
- [ ] **Step 2:** Rewrite `docs/PROJECT.md` as thin index linking to each file.
- [ ] **Step 3:** Spot-check that no large body content remains only in PROJECT.md.
- [ ] **Step 4:** Commit:

```bash
git commit -m "$(cat <<'EOF'
docs: split PROJECT.md into architecture topic docs

EOF
)"
```

---

### Task 7: Retarget PROJECT.md anchors + rewrite `docs/README.md`

**Files:**

- Modify: every file grepping `PROJECT.md` / `docs/PROJECT.md#` (CLAUDE.md, `.cursor/rules/*.mdc`, skills under `.claude/skills` and `.cursor/skills` until Task 10, `docs/README.md`, etc.)
- Rewrite: `docs/README.md` as vault top-level index including `architecture/`, `todos/BACKLOG_DRAFT.md`, `superpowers/README.md`

- [ ] **Step 1:** `rg -n 'PROJECT\\.md' -g '!node_modules' -g '!.git'` and retarget `#section` links to the correct `docs/architecture/*.md` files.
- [ ] **Step 2:** Rewrite `docs/README.md` index per Part 1.8 / 1.9 folder shape.
- [ ] **Step 3:** Confirm no dangling `docs/temp` / `docs/TODOS.md` refs remain.
- [ ] **Step 4:** Commit:

```bash
git commit -m "$(cat <<'EOF'
docs: retarget PROJECT.md links and refresh docs index

EOF
)"
```

---

### Task 8: Obsidian bulk conversion script + run

**Files:**

- Create: `scripts/docs/convert-to-obsidian.mjs` (one-off migration; may remain archived under `scripts/docs/` after run)
- Modify: every `docs/**/*.md` (frontmatter + wikilink pass)

**Frontmatter schema (exact):**

```yaml
---
title: <human title>
status: active | legacy | archived | draft
tags: [architecture, booking-workflow, ...]
updated: YYYY-MM-DD
---
```

Rules: `status: archived` for anything under an `archive/` folder; otherwise default `status: active` unless already flagged legacy/draft in this plan. Insert frontmatter only if missing. Wikilinks: replace plain-text/code-span docs path refs with `[[wikilink]]` using a filename→note-name map. Leave prose otherwise untouched.

- [ ] **Step 1:** Implement the script.
- [ ] **Step 2:** Dry-run or run once on `docs/`.
- [ ] **Step 3:** Spot-check guides/routes, architecture/, planning/.
- [ ] **Step 4:** Commit:

```bash
git commit -m "$(cat <<'EOF'
docs: add Obsidian frontmatter and wikilinks via conversion script

EOF
)"
```

---

### Task 9: Obsidian vault config + Bases dashboards

**Files:**

- Modify: `docs/.obsidian/core-plugins.json` (enable Bases)
- Create: at least one Route Guides `.base` over `docs/guides/routes/` and one Planned Modules `.base` over `docs/planning/planned_modules/`
- Do **not** hand-author `workspace.json` / `graph.json`

- [ ] **Step 1:** Enable Bases in core-plugins.
- [ ] **Step 2:** Author the two `.base` files (YAML per obsidian-bases conventions).
- [ ] **Step 3:** Commit vault config + bases (exclude noisy workspace churn if possible).

```bash
git commit -m "$(cat <<'EOF'
docs: enable Obsidian Bases and add vault dashboards

EOF
)"
```

---

### Task 10: Single-source skills under `.agent/skills/`

**Files:**

- Create: `.agent/skills/<name>/` for all currently shared skills (~33)
- Replace: `.cursor/skills/<name>` and `.claude/skills/<name>` with relative symlinks to `../../.agent/skills/<name>`
- Exception: `.claude/skills/verify/` remains a real directory
- Source of truth for drifted skills: `.claude/skills/` content

- [ ] **Step 1:** Inventory skill folders on both sides; prefer `.claude/skills/` bodies.
- [ ] **Step 2:** Move into `.agent/skills/`; create symlinks on both tool sides.
- [ ] **Step 3:** Manually diff-check `slides`, `ui-styling`, `ui-ux-pro-max` resolve identically via both symlink paths.
- [ ] **Step 4:** Commit (git stores symlinks):

```bash
git commit -m "$(cat <<'EOF'
chore: centralize AI skills under .agent/skills with symlinks

EOF
)"
```

---

### Task 11: Drift-prevention sync script + hooks

**Files:**

- Create: `scripts/dev/check-ai-tooling-sync.sh`, `scripts/dev/ai-tooling-sync-exceptions.txt`
- Modify: `package.json` (`check:ai-tooling-sync`), `.husky/pre-commit`, `.cursor/hooks.json` (sessionStart), `.claude/settings.json` (SessionStart)

Checks:

1. Every `.agent/skills/<name>` has valid symlinks at both tool paths (`verify/` allow-listed).
2. Commands/agents existence parity (not content equality).
3. Hook script name parity except exceptions file.
4. `.cursor/mcp.json` is symlink to `../.mcp.json`.

- [ ] **Step 1:** Write script + exceptions file.
- [ ] **Step 2:** Wire package.json + husky blocking + session-start warn-only.
- [ ] **Step 3:** Run `bun run check:ai-tooling-sync` — must pass (or fix until it does).
- [ ] **Step 4:** Commit.

```bash
git commit -m "$(cat <<'EOF'
chore: add AI tooling sync check to pre-commit and session start

EOF
)"
```

---

### Task 12: Close hook gaps + reconcile drifted commands/agents

**Files:**

- Port: `guard-shipped-migrations` into Cursor hooks (prefer pre-edit block; else best-effort `afterFileEdit` detect-and-warn/revert)
- Port: `session-superpowers-opt-in` into Claude `SessionStart`, **or** document intentional asymmetry in exceptions file
- Reconcile content drift: `.cursor/commands` vs `.claude/commands` for `fix-merge-conflicts.md` and `github-issue.md`; agents `debugger.md`

- [ ] **Step 1:** Inspect Cursor hook event catalog; wire migration guard.
- [ ] **Step 2:** Port or exception-document Superpowers session reminder for Claude.
- [ ] **Step 3:** Reconcile the three drifted command/agent files (same conceptual change both sides).
- [ ] **Step 4:** Re-run `bun run check:ai-tooling-sync`. Commit.

```bash
git commit -m "$(cat <<'EOF'
chore: close Cursor/Claude hook gaps and reconcile drifted agents

EOF
)"
```

---

### Task 13: Fix tooling docs + minimal global CLAUDE.md

**Files:**

- Rewrite: `.claude/skills/README.md` (via `.agent/skills/` if README lives with skills — if README is Claude-only index at `.claude/skills/README.md`, edit that real file: canonical source is `.agent/skills/`, both tool folders are symlinks; remove false "canonical = .cursor/skills" + manual cp loop)
- Update: `.claude/README.md` Updating section
- Create: `~/.claude/CLAUDE.md` — minimal cross-project prefs only (include Superpowers opt-in-only if desired globally); nothing project-specific
- Document intentional global MCP asymmetry in one line in the sync/skills README

- [ ] **Step 1:** Rewrite skills README + `.claude/README.md`.
- [ ] **Step 2:** Create `~/.claude/CLAUDE.md` (outside repo; do not commit).
- [ ] **Step 3:** Commit repo doc changes only.

```bash
git commit -m "$(cat <<'EOF'
docs: document .agent/skills as canonical AI skill source

EOF
)"
```

---

### Task 14: Final verification

**Files:** none new — verification only

- [ ] **Step 1:** `bun run lint && bun run type-check && bun run build` (expect no-op / pass).
- [ ] **Step 2:** `bun run check:filenames` and `bun run check:ai-tooling-sync` pass.
- [ ] **Step 3:** Grep for `docs/temp`, `docs/TODOS.md`, stale `FOR_HOSTS_LANDING_PAGE_PLAN`, broken `PROJECT.md#` anchors.
- [ ] **Step 4:** Confirm skill symlinks resolve for one skill from both `.cursor/skills` and `.claude/skills`.
- [ ] **Step 5:** Commit any leftover fixes; if clean, no commit — report DONE.

---

## Net folder shape (docs)

```
docs/
├── README.md
├── architecture/
├── guides/
├── operations/
├── reference/archive/
├── planning/planned_modules/   # untouched content except FOR_HOSTS rename
├── superpowers/{README.md,archive/,plans/}
└── todos/{README.md,BACKLOG_DRAFT.md,shipped/}
```

## Spec source

Approved design plan: `~/.claude/plans/before-we-continue-working-dreamy-shannon.md` (Parts 1–3).
