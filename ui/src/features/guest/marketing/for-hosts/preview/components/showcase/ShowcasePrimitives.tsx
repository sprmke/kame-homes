import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

/**
 * Small presentational building blocks shared by the showcase demo panels. They mirror the
 * real dashboard's structure (KPI tiles, status pills, chips) using design tokens — the
 * panels read as product UI because of layout, not a bespoke palette.
 */

const pillTones = {
  neutral: 'bg-muted text-muted-foreground',
  teal: 'bg-primary/10 text-primary',
  amber: 'bg-warning/15 text-warning-foreground dark:text-warning',
  green: 'bg-success/10 text-success',
} as const;

export function Pill({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof pillTones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        pillTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function KpiTile({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="border-border bg-card rounded-xl border p-3">
      <p className="text-muted-foreground text-[11px] font-semibold">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-foreground text-lg font-bold tabular-nums tracking-tight">{value}</p>
        {delta ? <span className="text-success text-[11px] font-semibold">{delta}</span> : null}
      </div>
    </div>
  );
}

export function Chip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="border-border bg-card text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
      <Icon className="text-primary h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}

/** Static area/line chart drawn from 0–100 values across a fixed viewBox. */
export function AreaLine({ points, className }: { points: number[]; className?: string }) {
  const width = 240;
  const height = 72;
  const stepX = width / (points.length - 1);
  const coords = points.map((value, index) => {
    const x = index * stepX;
    const y = height - (value / 100) * (height - 8) - 4;
    return `${x},${y}`;
  });
  const line = `M${coords.join(' L')}`;
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('w-full', className)}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="showcase-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#showcase-area)" />
      <path
        d={line}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
