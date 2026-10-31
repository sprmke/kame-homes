import {
  useCallback,
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';

import { MoreVertical } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type Props = {
  outbound: boolean;
  children: ReactNode;
  className?: string;
};

type ActionItemProps = ComponentPropsWithoutRef<typeof DropdownMenuItem> & {
  destructive?: boolean;
};

/** Dense chat-native row — hugs content, no admin-dropdown width. */
export function ChatMessageActionItem({
  className,
  destructive = false,
  ...props
}: ActionItemProps) {
  return (
    <DropdownMenuItem
      className={cn(
        'min-h-[36px] gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium',
        destructive &&
          'text-destructive focus:bg-destructive/10 focus:text-destructive [&>svg]:text-destructive',
        className
      )}
      {...props}
    />
  );
}

/**
 * Per-message ⋮ — opens a compact menu beside the bubble (WhatsApp / Messenger style),
 * not a wide form dropdown over the message.
 */
export function ChatMessageActionsMenu({ outbound, children, className }: Props) {
  const [open, setOpen] = useState(false);

  const dismiss = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const dismissFromScroll = () => dismiss();
    let attached = false;

    const attachId = window.requestAnimationFrame(() => {
      attached = true;
      document.addEventListener('scroll', dismissFromScroll, true);
      document.addEventListener('wheel', dismissFromScroll, { capture: true, passive: true });
      window.addEventListener('resize', dismissFromScroll);
    });

    return () => {
      window.cancelAnimationFrame(attachId);
      if (!attached) return;
      document.removeEventListener('scroll', dismissFromScroll, true);
      document.removeEventListener('wheel', dismissFromScroll, true);
      window.removeEventListener('resize', dismissFromScroll);
    };
  }, [open, dismiss]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'text-muted-foreground/60 hover:text-foreground focus-visible:ring-ring flex shrink-0 items-center justify-center rounded-full transition-[color,opacity,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2',
            'size-9 min-h-[36px] min-w-[36px] [@media(hover:hover)]:size-7 [@media(hover:hover)]:min-h-0 [@media(hover:hover)]:min-w-0',
            'opacity-70 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/msg:opacity-100 [@media(hover:hover)]:group-hover/msg:opacity-100',
            'hover:bg-muted/70 active:bg-muted data-[state=open]:bg-muted data-[state=open]:text-foreground data-[state=open]:opacity-100',
            className
          )}
          aria-label="Message actions"
        >
          <MoreVertical className="size-3.5" strokeWidth={2.25} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={outbound ? 'left' : 'right'}
        align="center"
        sideOffset={4}
        collisionPadding={12}
        className={cn(
          'border-border/60 bg-popover text-popover-foreground z-[110] w-max min-w-0 max-w-[min(90vw,11rem)] rounded-lg border p-1 shadow-md',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
        )}
        onCloseAutoFocus={(event: Event) => event.preventDefault()}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
