import type { ReactNode } from 'react';

import { AlertTriangle, Heart, Info, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type NoticeTone = 'info' | 'thanks' | 'warning';

type NoticeCalloutProps = {
  tone?: NoticeTone;
  /** Override the default icon for the tone. */
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
};

const TONE_STYLES: Record<NoticeTone, { shell: string; icon: LucideIcon }> = {
  info: {
    shell: 'border-primary/20 bg-primary/[0.06] text-foreground',
    icon: Info,
  },
  thanks: {
    shell:
      'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100',
    icon: Heart,
  },
  warning: {
    shell:
      'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100',
    icon: AlertTriangle,
  },
};

/**
 * Static, non-dismissible note. Use only where the context changes the
 * decision the host is about to make, such as the Support "Broken" thank-you
 * note or the Smart Pricing autopilot warning. Everywhere else use `InfoHint`.
 */
export function NoticeCallout({ tone = 'info', icon, children, className }: NoticeCalloutProps) {
  const styles = TONE_STYLES[tone];
  const Icon = icon ?? styles.icon;

  return (
    <div
      role="note"
      className={cn(
        'motion-safe:animate-in motion-safe:fade-in-0 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed',
        styles.shell,
        className
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
