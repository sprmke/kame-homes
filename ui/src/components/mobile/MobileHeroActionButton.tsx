import {
  forwardRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentType,
  type ReactNode,
} from 'react';

import { Link, type LinkProps } from 'react-router-dom';

import { MoreHorizontal } from 'lucide-react';

import { MobileChoiceItem, MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

/** Shared surface for icon-only hero actions beside the tenant switcher (`max-lg`). */
export const mobileHeroActionClassName = cn(
  'mobile-hero-action native-press relative touch-manipulation',
  /* Visual 36px — matches sticky chrome + filter/toolbar density; hit ≥44 via pad. */
  'flex size-9 shrink-0 items-center justify-center rounded-full',
  "before:absolute before:-inset-1 before:content-['']",
  /* Frosted on-primary — matches tenant avatar ring + scope icons (light + dark). */
  'bg-primary-foreground/15 text-primary-foreground',
  'ring-primary-foreground/25 ring-1',
  'transition-[transform,background-color] duration-150',
  'hover:bg-primary-foreground/22',
  'focus-visible:ring-primary-foreground/40 focus-visible:ring-offset-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  'disabled:pointer-events-none disabled:opacity-45',
  /* Force icon size — callers often pass size-5 which would blow out the dense chrome. */
  '[&_svg]:!size-4 [&_svg]:shrink-0'
);

type MobileHeroActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/** Primary icon action beside the tenant switcher on the mobile brand hero. */
export const MobileHeroActionButton = forwardRef<HTMLButtonElement, MobileHeroActionButtonProps>(
  function MobileHeroActionButton({ className, type = 'button', ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(mobileHeroActionClassName, className)}
        {...props}
      />
    );
  }
);

type MobileHeroActionLinkProps = LinkProps & { children: ReactNode };

export function MobileHeroActionLink({ className, children, ...props }: MobileHeroActionLinkProps) {
  return (
    <Link className={cn(mobileHeroActionClassName, className)} {...props}>
      {children}
    </Link>
  );
}

export type MobileHeroActionMenuItem = {
  key: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  onSelect: () => void;
  disabled?: boolean;
};

type MobileHeroActionMenuProps = {
  items: MobileHeroActionMenuItem[];
  /** Accessible name for the menu trigger when there are 2+ items. */
  label?: string;
  /** Icon on the single trigger (defaults to ···). */
  TriggerIcon?: ComponentType<{ className?: string }>;
  className?: string;
  contentClassName?: string;
};

/**
 * Hero trailing actions: one button max.
 * - 1 item → that action’s icon (direct tap)
 * - 2+ items → one ··· button; bottom sheet on `max-lg`, dropdown on desktop
 */
export function MobileHeroActionMenu({
  items,
  label = 'Actions',
  TriggerIcon = MoreHorizontal,
  className,
  contentClassName,
}: MobileHeroActionMenuProps) {
  const isMobileLayout = useIsBelowLg();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (items.length === 0) return null;

  if (items.length === 1) {
    const only = items[0]!;
    const Icon = only.Icon;
    return (
      <MobileHeroActionButton
        aria-label={only.label}
        disabled={only.disabled}
        onClick={only.onSelect}
        className={className}
      >
        <Icon className="size-4" aria-hidden />
      </MobileHeroActionButton>
    );
  }

  if (isMobileLayout) {
    return (
      <>
        <MobileHeroActionButton
          aria-label={label}
          aria-expanded={sheetOpen}
          aria-haspopup="dialog"
          className={className}
          onClick={() => setSheetOpen(true)}
        >
          <TriggerIcon className="size-4" aria-hidden />
        </MobileHeroActionButton>
        <MobileChoiceSheet open={sheetOpen} onOpenChange={setSheetOpen} title={label}>
          <div role="listbox" aria-label={label}>
            {items.map((item) => {
              const Icon = item.Icon;
              return (
                <MobileChoiceItem
                  key={item.key}
                  label={item.label}
                  disabled={item.disabled}
                  icon={<Icon className="size-5" aria-hidden />}
                  onSelect={() => {
                    item.onSelect();
                    setSheetOpen(false);
                  }}
                />
              );
            })}
          </div>
        </MobileChoiceSheet>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MobileHeroActionButton aria-label={label} className={className}>
          <TriggerIcon className="size-4" aria-hidden />
        </MobileHeroActionButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn('w-52', contentClassName)}>
        {items.map((item) => {
          const Icon = item.Icon;
          return (
            <DropdownMenuItem
              key={item.key}
              disabled={item.disabled}
              onSelect={() => item.onSelect()}
              className="min-h-[44px] gap-2"
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type MobileHeroActionGroupProps = {
  children: ReactNode;
  className?: string;
};

/**
 * @deprecated Prefer {@link MobileHeroActionMenu} — never render multiple hero icon buttons.
 * Kept for rare layout wrappers around a single menu/trigger.
 */
export function MobileHeroActionGroup({ children, className }: MobileHeroActionGroupProps) {
  return <div className={cn('flex shrink-0 items-center gap-1.5', className)}>{children}</div>;
}
