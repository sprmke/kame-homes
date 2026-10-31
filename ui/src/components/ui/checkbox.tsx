import * as React from 'react';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';

import { cn } from '@/lib/utils';

const checkboxRootClassName = cn(
  'border-muted-foreground/45 bg-background peer size-[18px] shrink-0 rounded-[5px] border-2 shadow-sm',
  'transition-[color,background-color,border-color,box-shadow] duration-150 ease-out',
  'hover:border-primary/70',
  'focus-visible:ring-ring ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  'data-[state=checked]:border-primary data-[state=checked]:bg-primary-strong data-[state=checked]:text-primary-foreground',
  'data-[state=checked]:shadow-[0_1px_3px_hsl(var(--primary)/0.35)]',
  'data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary-strong data-[state=indeterminate]:text-primary-foreground',
  'disabled:cursor-not-allowed disabled:opacity-50'
);

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root ref={ref} className={cn(checkboxRootClassName, className)} {...props}>
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current data-[state=indeterminate]:[&_.checkbox-check]:hidden data-[state=indeterminate]:[&_.checkbox-minus]:block">
      <Check className="checkbox-check size-3 stroke-[3]" />
      <Minus className="checkbox-minus hidden size-3 stroke-[3]" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

/** Visual-only checkbox when a parent button or row owns the toggle interaction. */
function CheckboxDisplay({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-background inline-flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 shadow-sm',
        checked
          ? 'border-primary bg-primary-strong text-primary-foreground shadow-[0_1px_3px_hsl(var(--primary)/0.35)]'
          : 'border-muted-foreground/45',
        className
      )}
    >
      {checked ? <Check className="size-3 stroke-[3]" aria-hidden /> : null}
    </span>
  );
}

export { Checkbox, CheckboxDisplay };
