---
title: 'QA — Property Templates'
status: active
updated: 2026-09-21
---

# 11 — Templates

Route: `/org/:orgSlug/property/:propertySlug/templates`

## Looks good

- Standard stay-guide templates free; email save Starter+; custom create Starter+.
- Preview uses same send renderer — trustable.

## Issues

| Sev | Issue                                                                                                                                                                                         | Evidence                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| P2  | ~~Custom templates stored but **not wired to any send**~~ — **Fixed**: manual **Send to guest** picker + `send-property-custom-template-email`                                                | Guide "Custom templates → Send to guest"                                 |
| P3  | ~~TipTap duplicate `link`/`underline` warnings~~ — **Fixed**: `StarterKit.configure({ link: {...} })` instead of a separate `Link`/`Underline` extension (StarterKit v3 bundles both already) | `RichTextEditor.tsx`; regression test in `dashboardModulesSmoke.spec.ts` |

## Improvements

- ~~Either wire custom templates to a manual "Send to guest" or hide Create until wired.~~ Done — manual send shipped.
- ~~Dedupe TipTap extensions.~~ Done.

## Doc gaps

- Guide honestly documents unwired custom templates — keep that callout.

## Evidence

Live Templates load; guide `templates.md`.
