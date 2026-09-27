---
name: unsaved-changes-guard
description: >-
  Checklist so every editable surface (form, settings card, editor, modal with
  inputs) warns before unsaved edits are lost: Save & leave / Discard / Keep
  editing on route change, back button, tab close and modal close. REQUIRED when
  adding or changing any page, section, card, dialog or sheet with user-editable
  fields and a manual Save. Mirrors always-on Cursor rule unsaved-changes.mdc.
  Use before claiming UI work done.
---

# Unsaved-changes guard

**Rule:** if a user can edit a field and must press Save (or Apply / Update) for it
to persist, leaving the surface with pending edits MUST prompt. No exceptions
except the ones listed under "Exempt".

Global pieces (already built, never re-implement):

| Piece                        | Path                                                 | Job                                                                                            |
| ---------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `UnsavedChangesProvider`     | `ui/src/components/forms/UnsavedChangesProvider.tsx` | Mounted once in `AppShell` under the data router. Router blocker + `beforeunload` + the dialog |
| `UnsavedChangesDialog`       | `ui/src/components/forms/UnsavedChangesDialog.tsx`   | The single confirm UI (Keep editing / Discard / Save & leave)                                  |
| `useUnsavedChangesGuard`     | `ui/src/hooks/useUnsavedChangesGuard.ts`             | **Pages, cards, editors.** One call per independently saveable form                            |
| `useGuardedClose`            | `ui/src/hooks/useGuardedClose.ts`                    | **Modals, sheets, inline editors** that close without a route change                           |
| `useRunUnguarded`            | same file as the guard hook                          | Wrap a `navigate()` fired right after a successful save                                        |
| Registry (pure, unit-tested) | `ui/src/lib/unsavedChanges/registry.ts`              | Dirty getters, save-all, discard-all                                                           |

The app uses `createBrowserRouter` (see `main.tsx`), not `<BrowserRouter>`,
because `useBlocker` requires a data router. Never add a second router.

## 1. Page / card / editor (route-level)

```tsx
useUnsavedChangesGuard({
  isDirty, // boolean you already compute for the Save button
  onSave: handleSave, // () => Promise<boolean | void>; resolve false (or throw) to keep the user here
});
```

- `isDirty` must be the **real** "has unsaved edits" flag, false right after a successful save (baseline reset).
- `onSave` powers "Save & leave". It must run the same validation as the Save button
  and return `false` when validation blocks or the request fails (the user stays and
  sees the errors). If a form truly cannot save from where it is, omit `onSave`; the
  prompt then offers Discard only.
- `onDiscard` only when the form stays mounted after leaving (rare).
- Several guards on one page are fine (each section/card). Save & leave saves all dirty ones in order.
- `blocksOn: 'location'` only when a `?param` change unmounts the form; default ignores in-page `?tab=` / hash changes.
- `enabled: false` for read-only / no-permission states (dirty can't happen anyway).
- Place the call before any early `return` (hook rules).

### React Hook Form

```tsx
const { handleSubmit, formState: { isDirty } } = useForm(...);
useUnsavedChangesGuard({
  isDirty,
  onSave: async () => {
    let saved = false;
    await handleSubmit(async (values) => { saved = await submit(values); })();
    return saved;               // invalid form => handleSubmit skips the callback => false
  },
});
```

Have `submit` return `true` on success and `false` on failure/toast.

### Save then navigate

`navigate()` right after `await save()` sees a stale dirty flag. The provider
re-checks after commit, which covers most flows. If the redirect is not
guaranteed to land after the state reset (slug rename, "create then open"),
wrap it: `const runUnguarded = useRunUnguarded(); runUnguarded(() => navigate(...))`.

## 2. Modal / sheet / inline editor (no route change)

```tsx
const { onOpenChange, requestClose, dialogProps } = useGuardedClose({
  open, onOpenChange: setOpen, isDirty, onSave, onDiscard: resetDraft,
});

<AdminDialogShell open={open} onOpenChange={onOpenChange}
  footer={<><Button variant="outline" onClick={requestClose}>Cancel</Button>...</>} />
<UnsavedChangesDialog {...dialogProps} />
```

- Route **every** close path through `requestClose` / the returned `onOpenChange`: X, Esc, backdrop, Cancel button. `setOpen(false)` directly skips the prompt.
- After a **successful** Save, close with the raw `setOpen(false)` (not `requestClose`).
- `onDiscard` must reset the draft so reopening starts clean.
- While open, the hook also registers with the global guard, so browser back / sidebar clicks prompt too.
- `isDirty` = draft differs from what was loaded. Compare against the value captured when the modal opened, not against `''`.

## 3. Tabs and multi-step wizards inside one surface

Tab switches that keep the form mounted need nothing. If a tab/step change
**unmounts** edited state, lift the dirty flag above the switch and guard there,
or keep the panels mounted.

## Exempt (write one line in the PR/route guide saying which)

- Autosave surfaces (debounced or on-blur persist). Guard only the "pending/error" state if edits can be lost, as the Page Editors do.
- Filters, sorting, search boxes, view toggles (not data).
- Pure action dialogs with no draft (confirm/delete), one-field "enter code" prompts, OTP inputs.
- Chat/composer inputs (send-on-enter), AI prompt boxes.
- Guest multi-step forms that already persist a draft (`useOfflineFormDraft`): the draft survives, so no prompt.
- Wizards that save per step and only hold the current step's input.

## Before claiming done

- [ ] Every new/changed editable surface has `useUnsavedChangesGuard` or `useGuardedClose`, or an "Exempt" reason
- [ ] Manually verified: edit a field, click a sidebar link -> prompt; Save & leave persists and navigates; Discard leaves without saving; Keep editing stays
- [ ] Verified browser back and tab refresh prompt (`beforeunload`)
- [ ] `isDirty` is false immediately after a successful save (no prompt after saving)
- [ ] Modal: Cancel, X, Esc and backdrop all prompt when dirty, none prompt when clean
- [ ] Route guide updated (`route-guides` skill): one line under the page's Save flow
- [ ] No hand-rolled `beforeunload`, `useBlocker`, or leave-confirm dialogs
