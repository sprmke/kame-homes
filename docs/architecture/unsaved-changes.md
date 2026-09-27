---
title: 'Unsaved-changes guard — leave / close confirmation for every editable surface'
status: active
tags: [architecture, ui, forms, router, ux]
updated: 2026-09-27
---

# Unsaved-changes guard

Part of the [`docs/PROJECT.md`](../PROJECT.md) architecture split.

Any surface where the user edits fields and must press Save / Apply / Update warns
before those edits are lost. One global mechanism, one dialog, one hook per surface.

## What the user sees

Editing a field then clicking another menu item, pressing browser back/forward,
or closing a modal/sheet (X, Esc, backdrop, Cancel) opens a confirmation:

| Action           | Result                                                           |
| ---------------- | ---------------------------------------------------------------- |
| **Keep editing** | Stay on the page / keep the modal open (also Esc)                |
| **Discard**      | Leave and drop the edits                                         |
| **Save & leave** | Run the same save as the Save button; leave only if it succeeded |

If validation blocks the save (or the request fails) the user stays, sees the
field errors / toast, and nothing is lost. If a surface cannot save from where it
is, only **Keep editing** and **Discard** are shown ("Discard your changes?").
Tab close / refresh uses the browser's native `beforeunload` prompt (custom text
is not allowed by browsers).

## Architecture

```
main.tsx  createBrowserRouter([{ path: '*', element: <AppShell/> }])
  AppShell (components/routing/AppShell.tsx)
    UnsavedChangesProvider          one useBlocker + beforeunload + one dialog
      registry (lib/unsavedChanges/registry.ts)   pure, unit-tested
        ▲ register({ isDirty(), save?, discard? })
        │
   useUnsavedChangesGuard(...)   pages / cards / editors / RHF forms
   useGuardedClose(...)          modals / sheets / inline editors (also registers globally)
```

| Piece                                          | Path                                                   |
| ---------------------------------------------- | ------------------------------------------------------ |
| Router (data router, required by `useBlocker`) | `ui/src/main.tsx`                                      |
| Provider (blocker, `beforeunload`, dialog)     | `ui/src/components/forms/UnsavedChangesProvider.tsx`   |
| Context + `useUnsavedChangesContext`           | `ui/src/components/forms/unsavedChangesContext.ts`     |
| Confirm dialog (`AlertDialog`)                 | `ui/src/components/forms/UnsavedChangesDialog.tsx`     |
| Page/card hook + `useRunUnguarded`             | `ui/src/hooks/useUnsavedChangesGuard.ts`               |
| Modal hook                                     | `ui/src/hooks/useGuardedClose.ts`                      |
| Registry (dirty getters, save-all, discard)    | `ui/src/lib/unsavedChanges/registry.ts` (+ `.test.ts`) |
| E2E                                            | `ui/e2e/features/org/unsavedChangesGuard.spec.ts`      |

### Design decisions

- **Data router, not `<BrowserRouter>`.** `useBlocker` only works under a data
  router. `main.tsx` uses `createBrowserRouter` with a single splat route so the
  existing `<Routes>` tree is unchanged.
- **Getters, not snapshots.** Forms register `isDirty()` reading a ref, so dirty
  edits cause no extra renders and the blocker always reads the latest value.
- **Blocks on pathname by default.** In-page `?tab=` / hash changes are not
  blocked (`blocksOn: 'location'` opts in when a search param unmounts the form).
- **Multiple guards, one prompt.** A page with several independently saveable
  sections registers several guards. Save & leave saves every dirty one in order
  and stops at the first failure.
- **Post-commit re-check.** A form that saves and navigates in the same tick still
  holds a stale dirty flag when the blocker runs; the provider re-checks after
  commit and proceeds silently if everything is clean. Redirects that cannot rely
  on that (slug rename, create-then-open) use `useRunUnguarded()`.
- **No provider, no-op.** Outside the provider (isolated tests) the hooks do nothing.

## Adding a guard

Use the `unsaved-changes-guard` skill (`.agent/skills/unsaved-changes-guard/SKILL.md`)
and always-on rule `.cursor/rules/unsaved-changes.mdc`. Short version:

```tsx
// Page, card, editor
useUnsavedChangesGuard({ isDirty, onSave: handleSave /* () => Promise<boolean> */ });

// Modal, sheet
const { onOpenChange, requestClose, dialogProps } = useGuardedClose({
  open,
  onOpenChange: setOpen,
  isDirty,
  onSave,
  onDiscard: resetDraft,
});
<UnsavedChangesDialog {...dialogProps} />;
```

## Coverage

See the route guides under [`docs/guides/routes/`](../guides/routes/README.md): each
page with a manual Save notes its guard in the Save flow section.

Exempt by design: autosave surfaces, filters/search, confirm/delete/OTP dialogs,
chat composers, guest drafts persisted by `useOfflineFormDraft`.
