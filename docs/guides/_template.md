---
title: '[Page title] — operator guide'
status: active
tags: [guides, templates]
updated: 2026-08-02
---

# [Page title] — operator guide

Route: `/path/to/page`

> **Status:** Pending — replace with **Documented** when this guide describes shipped behavior.

## Progress overview

| Section        | E2E save | Validation | Docs    | Notes |
| -------------- | -------- | ---------- | ------- | ----- |
| _Section name_ | —        | —          | Pending |       |

---

## Overview

_(Who uses this page and what it accomplishes.)_

---

## Host-facing knowledge

_(One short paragraph: what this page/feature does, in plain language.)_

**Common host questions**

- Q: _question a host might ask_
  A: _plain-English answer, no jargon, no internal file paths_
- Q: …
  A: …

This section is written for an AI assistant to quote directly to hosts — no code, no DB column names, no internal endpoint names.

---

## [Section name]

### Fields

| Field   | Storage               | Validation |
| ------- | --------------------- | ---------- |
| _Label_ | _column or JSON path_ | _rule_     |

### Save path

1. UI action → **endpoint** (method)
2. DB / storage side effects

### Behavior / edge cases

_(Non-obvious logic, gating, permissions.)_

---

## API reference

| Action   | Endpoint               |
| -------- | ---------------------- |
| _Action_ | _METHOD function-name_ |

---

## Implementation map

| Concern           | Path                                                |
| ----------------- | --------------------------------------------------- |
| Page              | `ui/src/features/.../pages/...`                     |
| Components        | `ui/src/features/.../components/...`                |
| Hooks             | `ui/src/features/.../hooks/...`                     |
| Edge functions    | `supabase/functions/...`                            |
| Shared validation | `ui/src/lib/...` · `supabase/functions/_shared/...` |

---

## Testing

| Layer | Path / spec                                                          | Manual                                             |
| ----- | -------------------------------------------------------------------- | -------------------------------------------------- |
| Unit  | `ui/src/.../lib/*.test.ts` or `supabase/functions/_shared/*_test.ts` | —                                                  |
| E2E   | `ui/e2e/features/<domain>/*.spec.ts` (`@smoke` / `@ci`)              | `docs/guides/testing/*-manual.md` when third-party |
| N/A   | —                                                                    | Document why if no automated coverage              |

---

## Related docs

- [Route index](./routes/README.md)
- [`docs/PROJECT.md`](../PROJECT.md)
- _(Link `.cursor/rules/` files when behavior is canonical elsewhere.)_

---

## Pending / follow-ups

- [ ] _(Known gap)_
