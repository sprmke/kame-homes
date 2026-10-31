---
title: 'Docs workflow vault redesign'
status: done
tags: [superpowers, spec, docs, workflow]
updated: 2026-08-01
stage: done
---

# Docs workflow vault redesign

**Approved:** 2026-08-02

## Goal

Reorganize `docs/` into a lifecycle-driven `workflow/` tree plus a single `archive/` for legacy material, optimize Obsidian filters and AI token usage, and add explicit automation for work-item status (no silent auto-moves).

## Decisions

| Topic                       | Choice                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| In-progress source of truth | Markdown `docs/workflow/in-progress/` (for AI sessions)                                                                                                            |
| Lifecycle stages            | `intake` → `planned` → `in-progress` → `done`                                                                                                                      |
| Rename                      | `planning/planned_modules/` → `workflow/planned/` (body content untouched)                                                                                         |
| Top-level folders           | `docs/workflow/`, `docs/archive/`                                                                                                                                  |
| Automation                  | Hybrid C: session hook lists in-progress; `/workflow-start` / `/workflow-done` commands move files; pre-commit bumps `updated:`; afterFileEdit never moves folders |
| Migration approach          | Phased: A moves + refs, B Obsidian, C automation                                                                                                                   |

## Target shape

See implementation plan `docs/workflow/planned/docs-workflow-vault.md`.

## Out of scope

- Editing bodies of files under `workflow/planned/` (formerly `planned_modules/`)
- GitHub Issues workflow changes ( `todos/README.md` stays GitHub-only )
- Content rewrites of `operations/` or live `reference/` docs
