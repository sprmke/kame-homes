/**
 * Shared chrome for the import wizard: header rhythm, body gutters, footer alignment.
 */

import * as React from 'react';

import { AlertTriangle, FileSpreadsheet, Info, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ResponsiveModalTitle } from '@/components/ui/responsive-modal';
import { SegmentedStepProgress } from '@/components/wizard/SegmentedStepProgress';
import { WizardStepHeading } from '@/components/wizard/WizardStepHeading';
import { cn } from '@/lib/utils';

/** Matches the app's other split modals (GetVerifiedModal) so this reads as one system. */
const GUTTER = 'px-5 sm:px-6';

// ── Header ────────────────────────────────────────────────────────────────────

type HeaderProps = {
  icon: React.ReactNode;
  title: string;
  /** Rendered left of the close button (refresh, etc.). */
  actions?: React.ReactNode;
  /** Full-width row under the title (stepper). */
  below?: React.ReactNode;
  closeDisabled?: boolean;
  onClose: () => void;
};

export function ImportModalHeader({
  icon,
  title,
  actions,
  below,
  closeDisabled,
  onClose,
}: HeaderProps) {
  return (
    <div className={cn('border-border/70 shrink-0 border-b pb-3.5 pt-5', GUTTER)}>
      <div className="flex items-center gap-3">
        <span
          className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl"
          aria-hidden
        >
          {icon}
        </span>
        <ResponsiveModalTitle className="min-w-0 flex-1 truncate text-left text-base font-semibold">
          {title}
        </ResponsiveModalTitle>
        {actions}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground size-9 shrink-0"
          aria-label="Close"
          disabled={closeDisabled}
          onClick={onClose}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
      {below ? <div className="mt-4">{below}</div> : null}
    </div>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────────

type StepperProps = {
  labels: string[];
  currentIndex: number;
};

/**
 * Segmented progress, not a labelled rail. The step heading in the body already
 * names where you are, so the header only has to say how far along you are.
 */
export function ImportStepper({ labels, currentIndex }: StepperProps) {
  return <SegmentedStepProgress labels={labels} currentIndex={currentIndex} />;
}

// ── Body ──────────────────────────────────────────────────────────────────────

export function ImportModalBody({
  className,
  children,
  /** When true, body grows to fill a tall modal shell (preview / column mapping). */
  fill,
}: {
  className?: string;
  children: React.ReactNode;
  fill?: boolean;
}) {
  return (
    <div className={cn('min-h-0 overflow-y-auto py-4', fill && 'flex-1', GUTTER, className)}>
      {children}
    </div>
  );
}

/** Step title + one-line explanation. Same slot on every step so nothing jumps. */
export function ImportStepHeading({
  title,
  description,
  headingRef,
  className,
}: {
  title: string;
  description: string;
  headingRef?: React.Ref<HTMLHeadingElement>;
  className?: string;
}) {
  return (
    <WizardStepHeading
      title={title}
      description={description}
      headingRef={headingRef}
      className={className}
    />
  );
}

/** Persistent reminder of which file is being worked on — sits under the step heading. */
export function ImportFileBar({
  fileName,
  rowCount,
  columnCount,
  onReplace,
  replaceDisabled,
}: {
  fileName: string;
  rowCount: number;
  columnCount?: number;
  onReplace?: () => void;
  replaceDisabled?: boolean;
}) {
  return (
    <div className="border-border/70 bg-muted/30 group flex items-center gap-3 rounded-xl border px-3 py-2.5">
      <span
        className="bg-background text-primary flex size-9 shrink-0 items-center justify-center rounded-lg border shadow-sm"
        aria-hidden
      >
        <FileSpreadsheet className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-sm font-medium">{fileName}</p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {rowCount.toLocaleString()} row{rowCount !== 1 ? 's' : ''}
          {typeof columnCount === 'number'
            ? ` · ${columnCount} column${columnCount !== 1 ? 's' : ''}`
            : ''}
        </p>
      </div>
      {onReplace ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground min-h-11 shrink-0 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
          disabled={replaceDisabled}
          onClick={onReplace}
        >
          Replace
        </Button>
      ) : null}
    </div>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────────

type AlertTone = 'error' | 'warning' | 'info';

const ALERT_STYLES: Record<AlertTone, string> = {
  error: 'border-destructive/30 bg-destructive/5 text-destructive',
  warning:
    'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200',
  info: 'border-border bg-muted/40 text-muted-foreground',
};

export function ImportAlert({
  tone = 'error',
  children,
  action,
  className,
}: {
  tone?: AlertTone;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const Icon = tone === 'info' ? Info : AlertTriangle;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm',
        ALERT_STYLES[tone],
        className
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="text-xs leading-relaxed">{children}</div>
        {action}
      </div>
    </div>
  );
}

// ── Stat strip ────────────────────────────────────────────────────────────────

export type ImportStat = {
  label: string;
  value: number;
  tone?: 'primary' | 'neutral' | 'danger' | 'warning';
  selected?: boolean;
  onSelect?: () => void;
};

const STAT_TONES: Record<NonNullable<ImportStat['tone']>, string> = {
  primary: 'text-primary',
  neutral: 'text-foreground',
  danger: 'text-destructive',
  warning: 'text-amber-600 dark:text-amber-400',
};

export function ImportStatStrip({
  stats,
  ariaLabel = 'Filter import rows by status',
}: {
  stats: ImportStat[];
  ariaLabel?: string;
}) {
  const interactive = stats.some((stat) => stat.onSelect);

  return (
    <div
      role={interactive ? 'group' : undefined}
      aria-label={interactive ? ariaLabel : undefined}
      className={cn(
        'divide-border/70 border-border/70 grid divide-x overflow-hidden rounded-xl border',
        stats.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4',
        stats.length > 2 && 'max-sm:divide-y'
      )}
    >
      {stats.map((stat) => {
        const content = (
          <>
            <span className="text-muted-foreground block text-left text-xs">{stat.label}</span>
            <span
              className={cn(
                'mt-0.5 block text-left text-lg font-semibold tabular-nums sm:text-xl',
                STAT_TONES[stat.tone ?? 'neutral']
              )}
            >
              {stat.value.toLocaleString()}
            </span>
          </>
        );

        return (
          <div key={stat.label} className="bg-muted/25 min-w-0">
            {stat.onSelect ? (
              <button
                type="button"
                className={cn(
                  'hover:bg-muted/70 focus-visible:ring-ring h-full w-full px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
                  stat.selected && 'bg-primary/10 shadow-[inset_0_-2px_0_hsl(var(--primary))]'
                )}
                aria-pressed={stat.selected}
                aria-label={`${stat.label}: ${stat.value.toLocaleString()} rows`}
                onClick={stat.onSelect}
              >
                {content}
              </button>
            ) : (
              <div className="px-3 py-2.5">{content}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

/** Secondary action sits left, primary right, on every step. */
export function ImportModalFooter({
  left,
  right,
}: {
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  if (!left && !right) return null;

  return (
    <div
      className={cn(
        'border-border/70 shrink-0 border-t pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3.5 sm:pb-4 sm:pt-4',
        GUTTER
      )}
    >
      <div
        className={cn(
          'flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center',
          left ? 'sm:justify-between' : 'sm:justify-end'
        )}
      >
        <div className="flex items-center justify-start gap-2 empty:hidden">{left}</div>
        <div className="flex items-center justify-end gap-2 empty:hidden">{right}</div>
      </div>
    </div>
  );
}
