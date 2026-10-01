import { useId } from 'react';

import { Lock, Sparkles } from 'lucide-react';

import { useDashboardMode } from '@/features/dashboard/ai-assistant/lib/dashboardModeContext';

import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

function shortcutHint(): string {
  if (typeof navigator === 'undefined') return 'Ctrl+J';
  return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘J' : 'Ctrl+J';
}

type Props = {
  className?: string;
  /**
   * `row` sits above the plan row in the sidebar / rail / More sheet footer.
   * `icon` is the collapsed-rail form. `compact` fits the AI mode phone top bar.
   */
  variant?: 'row' | 'icon' | 'compact';
};

/** "AI mode" on/off switch. Hidden when AI mode is unavailable; locked when plan-blocked. */
export function DashboardModeToggle({ className, variant = 'row' }: Props) {
  const { mode, availability, setMode } = useDashboardMode();
  const switchId = useId();
  if (availability === 'hidden' || availability === 'pending') return null;
  const locked = availability === 'locked';
  const on = mode === 'ai';
  const title = `AI mode (${shortcutHint()})`;
  const onCheckedChange = (checked: boolean) => setMode(checked ? 'ai' : 'advanced');

  if (variant === 'icon') {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="AI mode"
        title={title}
        data-testid="dashboard-mode-toggle"
        onClick={() => onCheckedChange(!on)}
        className={cn(
          'focus-visible:ring-ring relative mx-auto flex size-10 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2',
          on
            ? 'bg-primary/10 text-primary hover:bg-primary/15'
            : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-foreground',
          className
        )}
      >
        <Sparkles className="size-4" aria-hidden />
        {locked ? (
          <Lock
            className="bg-sidebar absolute bottom-1.5 right-1.5 size-2.5 rounded-sm"
            aria-hidden
          />
        ) : null}
      </button>
    );
  }

  const compact = variant === 'compact';
  return (
    <label
      htmlFor={switchId}
      title={title}
      data-testid="dashboard-mode-toggle"
      className={cn(
        'flex cursor-pointer select-none items-center rounded-lg transition-colors',
        compact
          ? 'min-h-[44px] shrink-0 gap-2 px-1.5'
          : 'hover:bg-sidebar-accent h-10 w-full gap-2.5 px-2',
        className
      )}
    >
      {compact ? null : (
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-md transition-colors',
            on ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          )}
          aria-hidden
        >
          <Sparkles className="size-3.5" />
        </span>
      )}
      <span
        className={cn(
          'text-foreground flex min-w-0 items-center gap-1.5 font-medium',
          compact ? 'text-xs' : 'flex-1 truncate text-sm'
        )}
      >
        {compact ? 'AI' : 'AI mode'}
        {locked ? <Lock className="text-muted-foreground size-3 shrink-0" aria-hidden /> : null}
      </span>
      <Switch
        id={switchId}
        checked={on}
        className="aria-[checked=false]:bg-muted-foreground/25"
        aria-label={locked ? 'AI mode, upgrade required' : 'AI mode'}
        onCheckedChange={onCheckedChange}
      />
    </label>
  );
}
