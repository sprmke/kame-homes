import * as React from 'react';

import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'border-border/70 bg-card text-foreground placeholder:text-muted-foreground/70 hover:border-primary/30 dark:border-border/50 dark:bg-muted/40 dark:hover:border-primary/25 field-focus flex min-h-[100px] w-full resize-y rounded-lg border px-4 py-3 text-sm font-medium shadow-[inset_0_1px_2px_hsl(240_6%_10%_/0.04)] transition-colors disabled:cursor-not-allowed disabled:opacity-50 max-lg:px-3 dark:shadow-none',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
