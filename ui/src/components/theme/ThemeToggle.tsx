import { Moon, Sun } from 'lucide-react';

import { useTheme } from '@/components/theme/ThemeProvider';
import { SlidingActivePill } from '@/components/ui/SlidingActivePill';
import { useSlidingActivePill } from '@/hooks/useSlidingActivePill';
import type { ThemePreference } from '@/lib/theme/preferences';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  /** Compact icon-only control for sidebars / headers. */
  variant?: 'icon' | 'segmented';
};

const OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  Icon: typeof Sun;
}> = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

function SegmentedThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const activeValue: 'light' | 'dark' =
    theme === 'system' ? resolvedTheme : theme === 'dark' ? 'dark' : 'light';

  const { containerRef, setItemRef, bounds } = useSlidingActivePill(activeValue);

  return (
    <div
      className={cn(
        'border-border bg-muted flex w-full rounded-xl border p-1 shadow-[0_1px_2px_hsl(0_0%_0%_/_0.04)]',
        className
      )}
      role="group"
      aria-label="Theme"
    >
      <div ref={containerRef} className="relative flex w-full min-w-0">
        {bounds ? (
          <SlidingActivePill bounds={bounds} className="bg-card rounded-lg shadow-sm" />
        ) : null}
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = theme === value || (theme === 'system' && resolvedTheme === value);
          return (
            <button
              key={value}
              ref={setItemRef(value)}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={active}
              aria-label={label}
              className={cn(
                'relative z-[1] flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
              title={label}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ThemeToggle({ className, variant = 'icon' }: Props) {
  const { toggleTheme, resolvedTheme } = useTheme();

  if (variant === 'segmented') {
    return <SegmentedThemeToggle className={className} />;
  }

  const isDark = resolvedTheme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'border-border bg-card text-muted-foreground shadow-elevated hover:bg-muted hover:text-foreground inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border transition-colors',
        className
      )}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {/* Show the target mode’s icon (tap to switch). */}
      {isDark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  );
}
