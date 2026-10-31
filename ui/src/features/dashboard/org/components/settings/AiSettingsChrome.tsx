import * as React from 'react';

import type { LucideIcon } from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type AiSettingsToggleRowProps = {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  pending?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/** Shared master / feature toggle row — consistent type and touch target. */
export function AiSettingsToggleRow({
  id,
  label,
  checked,
  disabled = false,
  pending = false,
  onCheckedChange,
}: AiSettingsToggleRowProps) {
  return (
    <div className="border-border/50 bg-muted/20 flex min-h-[44px] items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
      <label htmlFor={id} className="text-foreground text-sm font-medium leading-snug">
        {label}
      </label>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled || pending}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  );
}

/** @deprecated Prefer AiSettingsToggleRow */
export const AiSettingsMasterToggle = AiSettingsToggleRow;
/** @deprecated Prefer AiSettingsToggleRow */
export const AiSettingsInlineToggle = AiSettingsToggleRow;

type AiSettingsUsageStatProps = {
  label: string;
  value: React.ReactNode;
};

export function AiSettingsUsageStat({ label, value }: AiSettingsUsageStatProps) {
  return (
    <div className="border-border/40 bg-muted/10 rounded-lg border px-3 py-2.5">
      <p className="text-muted-foreground text-xs font-medium leading-none">{label}</p>
      <p className="text-foreground mt-1.5 truncate text-sm font-semibold tabular-nums leading-tight">
        {value}
      </p>
    </div>
  );
}

type AiSettingsCreditsBarProps = {
  consumed: number;
  limit: number;
  walletBalance?: number;
};

export function AiSettingsCreditsBar({
  consumed,
  limit,
  walletBalance,
}: AiSettingsCreditsBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground font-medium">Credits used this month</span>
        <span className="text-foreground font-semibold tabular-nums">
          ~{Math.round(consumed).toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <Progress
        value={Math.min(100, (consumed / Math.max(1, limit)) * 100)}
        aria-label="Monthly AI credits used"
      />
      {walletBalance != null && walletBalance > 0 ? (
        <p className="text-muted-foreground text-xs tabular-nums">
          Top-up wallet: {Math.round(walletBalance).toLocaleString()} credits
        </p>
      ) : null}
    </div>
  );
}

type AiSettingsFeatureGroupProps = {
  title: string;
  icon?: LucideIcon;
  /** Header trailing control (usually the feature enable toggle). */
  headerAction?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

/** Nested AI product block. Put the feature toggle in `headerAction`; body only when on. */
export function AiSettingsFeatureGroup({
  title,
  icon: Icon,
  headerAction,
  children,
  className,
}: AiSettingsFeatureGroupProps) {
  return (
    <section className={cn('border-border/60 space-y-3 rounded-lg border p-3 sm:p-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-card-title flex min-w-0 items-center gap-2">
          {Icon ? <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden /> : null}
          <span className="min-w-0">{title}</span>
        </h3>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>
      {children}
    </section>
  );
}

type AiSettingsStatusNoteProps = {
  children: React.ReactNode;
  className?: string;
};

export function AiSettingsStatusNote({ children, className }: AiSettingsStatusNoteProps) {
  return (
    <p className={cn('text-muted-foreground text-sm leading-relaxed', className)}>{children}</p>
  );
}
