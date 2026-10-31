import * as React from 'react';

import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'focus:ring-ring inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary-strong text-primary-foreground border-transparent shadow-sm',
        secondary: 'bg-secondary text-secondary-foreground border-transparent',
        destructive: 'bg-destructive/15 text-destructive dark:bg-destructive/20 border-transparent',
        outline: 'border-border text-foreground',
        success: 'bg-primary/10 text-primary dark:bg-primary/15 border-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
