---
name: karpathy-guidelines
description: >-
  Always-on agent behavior — think before coding, simplicity first, surgical diffs,
  goal-driven verification. Vendored from multica-ai/andrej-karpathy-skills. Use on
  every implementation, review, or refactor task.
disable-model-invocation: false
---

# Karpathy guidelines

Canonical always-on rule: **`.cursor/rules/karpathy-guidelines.mdc`**.

Upstream: [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) (MIT). Derived from [Andrej Karpathy's observations](https://x.com/karpathy/status/2015883857489522876) on LLM coding pitfalls.

**Tradeoff:** Bias toward caution over speed. For trivial one-liners, use judgment.

## 1. Think before coding

Do not assume. Do not hide confusion. Surface tradeoffs.

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them. Do not pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop, name it, and ask.

## 2. Simplicity first

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No flexibility or configurability that was not requested.
- No error handling for impossible scenarios.
- If 200 lines could be 50, rewrite.

## 3. Surgical changes

Touch only what you must. Clean up only your own mess.

- Do not improve adjacent code, comments, or formatting.
- Do not refactor what is not broken.
- Match existing style even if you would do it differently.
- Unrelated dead code: mention it; do not delete unless asked.
- Remove orphans only from **your** changes (unused imports, vars, functions).

Every changed line should trace to the user's request.

## 4. Goal-driven execution

Define success criteria. Loop until verified.

| Instead of…    | Use…                                          |
| -------------- | --------------------------------------------- |
| Add validation | Tests for invalid inputs, then make them pass |
| Fix the bug    | Test that reproduces it, then make it pass    |
| Refactor X     | Tests pass before and after                   |

Multi-step work: brief plan with verify steps per step.

## Claude Code / OpenCode

Cursor loads the `.mdc` automatically. In Claude Code and OpenCode, follow this skill on every agent task (same content as the rule).
