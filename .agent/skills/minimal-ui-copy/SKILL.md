---
name: minimal-ui-copy
description: >-
  Keeps UI copy minimal — no extra labels, descriptions, or helper text unless
  the user requests it or it is required (errors, form labels, destructive
  confirms). Use for every UI change in ui/src/**, new components, admin
  settings cards, forms, modals, and empty states.
---

# Minimal UI copy

## Core rule

Strictly do not add unnecessary long descriptions, labels, or text in our UI. This makes our app very dirty and hard to maintain.

**Unless we say so or really needed, do not add any text!**

## Before adding any string

Ask:

1. Is the UI unusable without this text?
2. Did the user ask for explanatory copy?
3. Is this a required accessibility label or error message?

If all three are **no** → omit the text.

## Patterns

### Prefer

- Existing headings, table columns, badges, icons, and data values
- Shorter labels: `GAF` not `Guest Acknowledgment Form settings`
- Tooltips / `aria-label` only for icon-only actions (one to three words)

### Avoid

```tsx
// ❌ Verbose card chrome
<CardHeader>
  <CardTitle>Telegram settings</CardTitle>
  <CardDescription>
    Configure how Telegram notifications are sent to your staff group,
    including daily summaries and instant check-in alerts.
  </CardDescription>
</CardHeader>

// ✅ Title only (or no header if context is obvious)
<CardHeader>
  <CardTitle>Telegram</CardTitle>
</CardHeader>
```

```tsx
// ❌ Helper under every field
<Label>Bot token</Label>
<Input ... />
<p className="text-xs text-muted-foreground">
  Paste the token from @BotFather. Keep it secret.
</p>

// ✅ Prefer no helper; if needed, ? tooltip on the label (`FieldLabel` `help`)
<FieldLabel htmlFor="bot-token" label="Bot token" help="Paste the token from @BotFather." />
<Input id="bot-token" ... />
```

```tsx
// ❌ Page subtitle restating the title
<AdminPageHeader
  title="Finance"
  subtitle="View revenue, expenses, and stay-level financial metrics for your property."
/>

// ✅ Title only
<AdminPageHeader title="Finance" />
```

## Exceptions (add text)

| Case                | Guidance                                     |
| ------------------- | -------------------------------------------- |
| Form labels         | Short noun phrase; see `accessibility` skill |
| Buttons             | Verb or verb phrase: `Save`, `Send test`     |
| Errors              | State what failed; no preamble               |
| Empty states        | Optional one line; never a paragraph         |
| User-requested copy | Follow the brief; still prefer short         |

## Refactors

When touching a file, **do not** expand existing copy. If you add a feature, default to zero new prose. Remove redundant descriptions when safe (don't delete legally required or user-facing transactional copy on guest flows without explicit ask).

## Related

- Rule: `.cursor/rules/ui-minimal-copy.mdc`
- Skill + rule: `human-copy` (how required text must sound: short, plain, no AI tells / em dashes)
- `frontend-design` — visual hierarchy without extra words
- `accessibility` — required labels stay short
