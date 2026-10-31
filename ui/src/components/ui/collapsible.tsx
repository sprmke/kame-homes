import * as React from 'react';

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';

import { cn } from '@/lib/utils';

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

/**
 * Height animation runs on this element. Do not put padding / vertical gap here —
 * wrap children in an inner `div` with `p-*` / `space-y-*` or collapse looks jumpy.
 */
const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.CollapsibleContent>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleContent>
>(({ className, children, ...props }, ref) => (
  <CollapsiblePrimitive.CollapsibleContent
    ref={ref}
    className={cn(
      'data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden motion-reduce:animate-none',
      className
    )}
    {...props}
  >
    {children}
  </CollapsiblePrimitive.CollapsibleContent>
));
CollapsibleContent.displayName = CollapsiblePrimitive.CollapsibleContent.displayName;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
