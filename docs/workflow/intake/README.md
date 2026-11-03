---
title: 'Intake'
status: active
tags: [workflow, intake]
updated: 2026-11-01
stage: intake
kind: reference
---

# Intake

Active design specs (`<slug>-design.md`) and the two permanent scratchpads:

| Doc                                | Purpose                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------- |
| [`_to-prompt.md`](./_to-prompt.md) | Prompt-ready backlog with status emojis. Moves to `done/` when shipped. |
| [`_to-plan.md`](./_to-plan.md)     | Items that need a written plan before implementation.                   |
| [`_to-dos.md`](./_to-dos.md)       | Small follow-ups that do not need a plan doc.                           |

Design specs move with their plan when it starts, ships or is cancelled. Do not leave `stage: done` files here.

**Scratchpad emojis:** ❌ cancelled · ✅ done · 🧪 for testing · 📋 planned · 🚧 in progress · 🔵 open. Run `bun run sync:workflow-scratchpads` after moving a workflow doc.

Back to [workflow index](../README.md).
