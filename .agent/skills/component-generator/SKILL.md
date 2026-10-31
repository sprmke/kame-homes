---
name: component-generator
description: Scaffold new React components following GFM conventions — feature folder, PascalCase file, props interface, Tailwind + shadcn.
---

# Component generator (GFM)

## Before creating

1. Can an existing `ui/src/components/ui/*` or feature component be extended?
2. Will 2+ features use it? → `ui/src/components/` or `ui/src/utils/`
3. Domain-specific? → `ui/src/features/<feature>/components/`

## Template

```tsx
import { cn } from '@/lib/utils';

interface MyWidgetProps {
  className?: string;
}

export function MyWidget({ className }: MyWidgetProps) {
  return (
    <section className={cn('border-border bg-card rounded-xl border', className)}>
      {/* content */}
    </section>
  );
}
```

## Checklist

- [ ] `PascalCase.tsx` filename (`.cursor/rules/naming-conventions.mdc`)
- [ ] Named export
- [ ] `@/` imports only
- [ ] Light + dark theme tokens
- [ ] Mobile-first layout
- [ ] Loading / error if async parent
- [ ] `aria-label` on icon-only controls
- [ ] No extra helper text (`ui-minimal-copy.mdc`)
- [ ] Update route guide if user-visible behavior changes

## Rules

`components.mdc`, `frontend-design` skill, `accessibility` skill.
