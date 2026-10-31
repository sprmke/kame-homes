---
title: 'Docs workflow vault'
stage: done
status: done
updated: 2026-08-01
---

# Docs workflow vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate docs to `workflow/` lifecycle folders + unified `archive/`, update refs and Obsidian tooling, add workflow automation for AI sessions.

**Architecture:** Phased git mv with no planned-file body edits; thin hub READMEs; frontmatter `stage`/`status` for Obsidian Bases; hybrid hooks + slash commands for in-progress tracking.

**Tech Stack:** Git, Obsidian Bases, Node `convert-to-obsidian.mjs`, bash hooks, Cursor/Claude commands.

## Global Constraints

- Do **not** edit markdown bodies in files moved from `planning/planned_modules/` to `workflow/planned/`.
- GitHub Issues remain source of truth for shipped backlog; `docs/todos/README.md` stays thin.
- Run `bun run check:ai-tooling-sync` after hook/skill changes.
- Obsidian workspace/graph JSON gitignored under `docs/.obsidian/`.

---

### Task 1: Create workflow + archive skeleton

**Files:**

- Create: `docs/workflow/README.md`, `docs/workflow/intake/.gitkeep`, `docs/workflow/in-progress/.gitkeep`, `docs/workflow/done/.gitkeep`
- Create: `docs/archive/README.md`

- [ ] **Step 1:** `mkdir -p docs/workflow/{intake,planned,in-progress,done} docs/archive/{planning,todos,reference,superpowers}`
- [ ] **Step 2:** Write hub READMEs with wikilinks

### Task 2: Move planned modules

- [ ] **Step 1:** `git mv docs/planning/planned_modules/* docs/workflow/planned/`
- [ ] **Step 2:** Move `Planned Modules.base` → `docs/workflow/Workflow.base` (update filter paths)
- [ ] **Step 3:** Remove empty `planned_modules/` + update `planning/README.md` stub

### Task 3: Archive legacy planning + todos

- [ ] **Step 1:** `git mv` NEW_FLOW*, CLAUDE_TO_PLAN, PENDING_BACKLOG, TASKS_TO_PROMPT → `docs/archive/planning/`
- [ ] **Step 2:** `git mv` BACKLOG_DRAFT, shipped/* → `docs/archive/todos/`
- [ ] **Step 3:** `git mv` reference/archive/* → `docs/archive/reference/`
- [ ] **Step 4:** `git mv` superpowers/archive/* → `docs/archive/superpowers/`

### Task 4: Frontmatter + docs index

- [ ] **Step 1:** Set `status: archived` + `stage: archive` on archived files (frontmatter only)
- [ ] **Step 2:** Set `stage: planned` on `workflow/planned/*.md` frontmatter where missing
- [ ] **Step 3:** Rewrite `docs/README.md`, slim `docs/planning/README.md`, `docs/todos/README.md`

### Task 5: Update refs (rules, skills, CLAUDE)

- [ ] **Step 1:** Grep `planned_modules`, `planning/planned`, old archive paths
- [ ] **Step 2:** Update `.cursor/rules/plan-mode.mdc`, `documentation-maintenance.mdc`, `project-context.mdc`, `CLAUDE.md`
- [ ] **Step 3:** Update `.agent/skills` route-guides, docs-first, plan-mode references

### Task 6: Obsidian

- [ ] **Step 1:** Create/update `Workflow.base` with stage filters
- [ ] **Step 2:** Extend `convert-to-obsidian.mjs` for workflow paths
- [ ] **Step 3:** Add `docs/.obsidian/workspace.json` + `graph.json` to `.gitignore`

### Task 7: Automation

- [ ] **Step 1:** `scripts/dev/workflow-move.sh` (start/done)
- [ ] **Step 2:** `.cursor/commands/workflow-start.md`, `workflow-done.md` + Claude mirrors
- [ ] **Step 3:** SessionStart hook listing `in-progress/*.md`
- [ ] **Step 4:** Pre-commit touch `updated:` on staged in-progress docs
- [ ] **Step 5:** `.agent/skills/workflow/SKILL.md` + `.cursor/rules/workflow-docs.mdc`

### Task 8: Verify

- [ ] **Step 1:** `bun run check:ai-tooling-sync`
- [ ] **Step 2:** `rg planned_modules docs/` — zero hits except archive/history
- [ ] **Step 3:** Commit in logical chunks
