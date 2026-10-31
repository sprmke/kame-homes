import * as React from 'react';

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';

import { cn } from '@/lib/utils';

const radioItemClassName = cn(
  'border-muted-foreground/45 bg-background aspect-square size-[18px] shrink-0 rounded-full border-2 shadow-sm',
  'transition-[color,background-color,border-color,box-shadow] duration-150 ease-out',
  'hover:border-primary/70',
  'focus-visible:ring-ring ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  'data-[state=checked]:border-primary data-[state=checked]:bg-primary',
  'data-[state=checked]:shadow-[0_1px_3px_hsl(var(--primary)/0.35)]',
  'disabled:cursor-not-allowed disabled:opacity-50'
);

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return <RadioGroupPrimitive.Root className={cn('grid gap-2', className)} {...props} ref={ref} />;
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item ref={ref} className={cn(radioItemClassName, className)} {...props}>
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <span className="bg-primary-foreground size-2 rounded-full" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

/** Visual-only radio when a parent button or row owns the selection interaction. */
function RadioGroupDisplay({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      className={cn(
        radioItemClassName,
        'pointer-events-none flex items-center justify-center',
        checked && 'border-primary bg-primary shadow-[0_1px_3px_hsl(var(--primary)/0.35)]',
        className
      )}
      aria-hidden
    >
      {checked ? <span className="bg-primary-foreground size-2 rounded-full" /> : null}
    </span>
  );
}

export { RadioGroup, RadioGroupItem, RadioGroupDisplay };
