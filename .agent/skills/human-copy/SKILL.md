---
name: human-copy
description: >-
  Writes short, plain, production-grade user-facing copy with no AI tells
  (especially no Unicode em dash). Use whenever adding or editing UI strings,
  helpers, toasts, errors, emails, notifications, plan/feature copy, empty
  states, or host-facing guide prose in this repo.
---

# Human / production copy

Mirrors always-on Cursor rule **`.cursor/rules/human-copy.mdc`**. Claude Code and OpenCode should invoke this skill on any string change (Claude does not auto-load `.mdc` files).

**Pair with `minimal-ui-copy`:** omit text when possible; when text is required, write it to this standard.

## Goals

- Short, balanced, easy to understand
- Straightforward (one idea per line)
- Production-grade product English (ops/admin and guest UI)
- Never "AI-looking"

## Hard ban: dashes as clause breaks

**Never** insert Unicode em dash `—` (U+2014) or en dash `–` (U+2013) in new product strings.

| Bad                                   | Good                                     |
| ------------------------------------- | ---------------------------------------- |
| `Save changes — this updates pricing` | `Save changes. This updates pricing.`    |
| `Smart Pricing — Pro plan`            | `Smart Pricing (Pro)` or `Smart Pricing` |
| `Failed — try again`                  | `Failed. Try again.`                     |

Hyphen `-` is fine for compounds: `check-in`, `real-time`, `pre-filled`.

## Other AI tells to strip

Do not use these in new copy:

- _seamless, robust, leverage, empower, unlock, elevate, streamline, cutting-edge, next-level, delightful, exciting, powerful_
- _It's worth noting…_, _In today's…_, _At the end of the day…_
- _This allows you to…_, _This enables…_, _Easily configure…_
- _Simply / Just / Actually_ as filler
- Title Case Marketing Slogans on operational screens
- Emoji in product UI unless the user explicitly asks

## Rewrite patterns

```tsx
// BAD
<CardDescription>
  Seamlessly configure how Telegram notifications are delivered to your team —
  including daily summaries and instant check-in alerts.
</CardDescription>

// GOOD (or omit entirely per minimal-ui-copy)
<CardTitle>Telegram</CardTitle>
```

```tsx
// BAD
toast.message('Success — your pricing calendar has been updated successfully!');

// GOOD
toast.message('Pricing updated');
```

```tsx
// BAD
<p>This lets you easily manage smart pricing rules for your property.</p>

// GOOD: no helper; title/control already says it
```

```tsx
// BAD empty state
'No bookings yet — get started by creating your first reservation and unlock powerful insights.';

// GOOD
'No bookings yet';
```

```ts
// BAD feature gate
'Upgrade to Pro to unlock seamless AI-powered smart pricing.';

// GOOD
'Smart Pricing is available on Pro.';
```

## Checklist (every new string)

- [ ] No `—` or `–` clause breaks
- [ ] No ban-list fluff words
- [ ] As short as meaning allows
- [ ] Sounds like a shipped product, not a model demo
- [ ] Still meets `accessibility` (short labels / `aria-label`s)

## Scope

**Strict:** UI (`ui/src/**`), edge-returned user messages, email subjects/bodies you author, notification titles/bodies, plan presentation / feature gate copy.

**Also prefer for new prose:** docs you write in the same change (route guides Host-facing knowledge, workflow notes). Do not mass-rewrite old docs unless asked.

**Out of scope:** verbatim third-party / legal text; existing strings you are not touching.

## Related

- `.cursor/rules/human-copy.mdc`
- `.cursor/rules/ui-minimal-copy.mdc` + skill `minimal-ui-copy`
- `accessibility` (required labels stay short)
