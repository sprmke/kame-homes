import * as React from 'react';

import * as TabsPrimitive from '@radix-ui/react-tabs';

import { SlidingActivePill } from '@/components/ui/SlidingActivePill';
import { useDomActiveSlidingPill } from '@/hooks/useSlidingActivePill';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
  const { containerRef, bounds } = useDomActiveSlidingPill('[data-state="active"]');

  const mergedRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [containerRef, ref]
  );

  return (
    <TabsPrimitive.List
      ref={mergedRef}
      className={cn(
        'bg-muted text-muted-foreground relative inline-flex h-9 items-center justify-center rounded-lg p-1',
        className
      )}
      {...props}
    >
      {bounds ? <SlidingActivePill bounds={bounds} className="bg-card rounded-md shadow" /> : null}
      {children}
    </TabsPrimitive.List>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'ring-offset-background focus-visible:ring-ring relative z-[1] inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
      'data-[state=active]:text-foreground text-muted-foreground hover:text-foreground',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'ring-offset-background focus-visible:ring-ring mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
