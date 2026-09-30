import { Lock } from 'lucide-react';

import type { DashboardMode } from '@/features/dashboard/ai-assistant/lib/dashboardMode';
import { useDashboardMode } from '@/features/dashboard/ai-assistant/lib/dashboardModeContext';

import { cn } from '@/lib/utils';

const OPTIONS: Array<{ value: DashboardMode; label: string }> = [
  { value: 'advanced', label: 'Advanced' },
  { value: 'ai', label: 'AI' },
];

function shortcutHint(): string {
  if (typeof navigator === 'undefined') return 'Ctrl+J';
  return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘J' : 'Ctrl+J';
}

type Props = {
  className?: string;
  /** `compact` fits the mobile top bar and the collapsed rail. */
  size?: 'default' | 'compact';
};

/** Segmented Advanced | AI switch. Hidden when AI mode is unavailable; locked when plan-blocked. */
export function DashboardModeToggle({ className, size = 'default' }: Props) {
  const { mode, availability, setMode } = useDashboardMode();
  if (availability === 'hidden' || availability === 'pending') return null;
  const locked = availability === 'locked';
  const compact = size === 'compact';

  return (
    <div
      role="radiogroup"
      aria-label="Dashboard mode"
      title={`Switch mode (${shortcutHint()})`}
      data-testid="dashboard-mode-toggle"
      className={cn('bg-muted/70 relative flex rounded-full p-0.5', className)}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        setMode(mode === 'ai' ? 'advanced' : 'ai');
      }}
    >
      {OPTIONS.map(({ value, label }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => setMode(value)}
            className={cn(
              'focus-visible:ring-ring relative inline-flex flex-1 items-center justify-center gap-1 rounded-full font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2',
              compact ? 'min-h-[36px] px-3 text-xs' : 'min-h-[36px] px-3.5 text-sm',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
            {value === 'ai' && locked ? <Lock className="size-3" aria-label="Upgrade" /> : null}
          </button>
        );
      })}
    </div>
  );
}
