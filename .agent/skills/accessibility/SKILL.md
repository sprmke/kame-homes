---
name: accessibility
description: Accessibility skill for WCAG 2.1 AA compliance on the guest form, calendar, success page, and new /bookings admin dashboard. Use whenever implementing or reviewing UI: semantic HTML, ARIA, keyboard navigation, focus management, and screen reader support.
---

# Accessibility Skill (WCAG 2.1 AA)

Apply this skill whenever you implement or review UI in `ui/src/**`.

## Principles

- **Semantic HTML**: Use correct elements (`button`, `nav`, `main`, `header`, headings in order). No `div`-as-button.
- **Labels**: Every form control has a visible or programmatic label (`<Label htmlFor="id">`, `aria-label` for icon-only).
- **Keyboard**: All interactive elements focusable and operable with keyboard (Tab, Shift-Tab, Enter, Space, Arrow keys where appropriate).
- **Focus**: Visible focus indicators (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`).
- **Contrast**: ≥ 4.5:1 (body text), ≥ 3:1 (large text). Use `text-foreground` and `text-muted-foreground` tokens; don't invent low-contrast grays.
- **Motion**: Respect `prefers-reduced-motion` when you add animations.

## Patterns to use in this repo

### Buttons with icons

```tsx
<button type="button" aria-label="Delete booking">
  <TrashIcon aria-hidden="true" />
</button>
```

### React Hook Form fields (matches `ui/src/features/guest/form/schemas/guestFormSchema.ts`)

```tsx
<Label htmlFor="guestEmail">Email</Label>
<Input
  id="guestEmail"
  type="email"
  aria-invalid={!!errors.guestEmail}
  aria-describedby={errors.guestEmail ? 'guestEmail-error' : undefined}
  {...register('guestEmail')}
/>
{errors.guestEmail && (
  <p id="guestEmail-error" role="alert" className="text-destructive text-sm">
    {errors.guestEmail.message}
  </p>
)}
```

### Status badges on `/bookings`

Status color alone is not enough — always pair color with text and, for screen readers, an `aria-label` that spells out the state:

```tsx
<span
  aria-label={`Status: ${statusLabel}`}
  className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
>
  <span aria-hidden="true" className={dotColorClass} />
  {statusLabel}
</span>
```

### Dialogs / transition modals

- Use a shadcn/radix `Dialog` (handles `aria-modal`, focus trap, Escape close).
- Return focus to the trigger button on close.

### Sonner toasts (already used in the project)

- Toasts are announced via `aria-live`. Keep messages short and actionable.
- The existing "Copy booking info" pattern in `ui/src/features/guest/form/components/GuestForm.tsx` is a good reference.

## Testing checklist

Before declaring a change done:

1. Tab through the page — every interactive element receives a visible focus ring.
2. Activate every action with Enter/Space (not just mouse).
3. Verify color contrast on both light and dark backgrounds.
4. Screen-reader spot-check critical flows (VoiceOver on macOS is fine) for the new /bookings list, detail page, and workflow transition dialogs.

## When NOT required

- Edge function code or shared services (`supabase/functions/_shared/**`) — no UI, no a11y concerns.
