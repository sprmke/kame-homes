import * as React from 'react';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command as CommandPrimitive } from 'cmdk';
import { Search } from 'lucide-react';

import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      'bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-xl',
      className
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

type CommandDialogProps = React.ComponentProps<typeof DialogPrimitive.Root> & {
  label?: string;
};

function CommandDialog({ children, label = 'Search', ...props }: CommandDialogProps) {
  return (
    <Dialog {...props}>
      <DialogPortal>
        <DialogOverlay data-assistant-command-palette="" className="z-[120]" />
        <DialogPrimitive.Content
          data-assistant-command-palette=""
          aria-label={label}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.stopPropagation()}
          className={cn(
            'border-border/50 bg-card shadow-elevated-lg fixed left-1/2 top-1/2 z-[121] w-[min(calc(100vw-1.5rem),32rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border p-0 outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
        >
          <DialogTitle className="sr-only">{label}</DialogTitle>
          <Command className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-input-wrapper]_svg]:size-4">
            {children}
          </Command>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="border-border/60 flex items-center border-b px-3" cmdk-input-wrapper="">
    <Search className="text-muted-foreground me-2 size-4 shrink-0" aria-hidden />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        'placeholder:text-muted-foreground flex h-12 w-full bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn(
      'max-h-[min(24rem,60dvh)] overflow-y-auto overflow-x-hidden overscroll-contain p-1.5 [-webkit-overflow-scrolling:touch]',
      className
    )}
    {...props}
  />
));
CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="text-muted-foreground px-2 py-6 text-center text-sm"
    {...props}
  />
));
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn('text-foreground overflow-hidden', className)}
    {...props}
  />
));
CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      'native-press data-[selected=true]:bg-primary/10 data-[selected=true]:text-foreground relative flex min-h-[44px] cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none',
      'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
      className
    )}
    {...props}
  />
));
CommandItem.displayName = CommandPrimitive.Item.displayName;

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
};
