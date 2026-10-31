import type { KeyboardEvent, ReactNode } from 'react';

import { cn } from '@/lib/utils';

type AdminCardGridProps = {
  children: ReactNode;
  isRefreshing?: boolean;
  className?: string;
  /** Grid columns — defaults to 2-col phone density used by bookings. */
  denser?: boolean;
};

/**
 * Shared card-list shell for admin list pages on mobile.
 * Phone = single-column list (native density); denser packs from `sm` up.
 */
export function AdminCardGrid({
  children,
  isRefreshing,
  className,
  denser = true,
}: AdminCardGridProps) {
  return (
    <div
      className={cn(
        denser
          ? 'native-stagger grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3.5 lg:grid-cols-3 lg:gap-4 xl:grid-cols-4'
          : 'native-stagger grid grid-cols-1 items-stretch gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4',
        'transition-opacity duration-300',
        isRefreshing && 'opacity-60',
        className
      )}
    >
      {children}
    </div>
  );
}

type AdminCardRowProps = {
  children: ReactNode;
  onOpen: () => void;
  className?: string;
  'aria-label'?: string;
};

/** Tappable card row with keyboard support (Enter / Space). */
export function AdminCardRow({
  children,
  onOpen,
  className,
  'aria-label': ariaLabel,
}: AdminCardRowProps) {
  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={onOpen}
      onKeyDown={handleKey}
      className={cn(
        'surface-card-interactive flex cursor-pointer flex-col p-4',
        'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'min-h-[44px]',
        className
      )}
    >
      {children}
    </div>
  );
}

type AdminCardStateProps = {
  title: string;
  description?: string;
  variant?: 'empty' | 'error';
};

export function AdminCardState({ title, description, variant = 'empty' }: AdminCardStateProps) {
  return (
    <div className="surface-card flex flex-col items-center justify-center gap-3 px-4 py-12 text-center sm:py-20">
      <div
        className={cn(
          'flex size-9 items-center justify-center rounded-full',
          variant === 'error' ? 'bg-red-50 dark:bg-red-500/15' : 'bg-muted'
        )}
      >
        <span
          className={cn(
            'text-base font-black leading-none',
            variant === 'error' ? 'text-red-500' : 'text-muted-foreground text-lg'
          )}
        >
          {variant === 'error' ? '!' : '∅'}
        </span>
      </div>
      <div>
        <p className="text-section-title text-foreground font-bold">{title}</p>
        {description ? <p className="text-caption mt-1 max-w-xs">{description}</p> : null}
      </div>
    </div>
  );
}
