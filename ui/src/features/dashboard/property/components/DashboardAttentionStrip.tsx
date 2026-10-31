import { Link } from 'react-router-dom';

import { AlertTriangle, ArrowRight, Bell, Info } from 'lucide-react';

import type { DashboardAttentionItem } from '@/features/dashboard/property/lib/types';

import { ATTENTION_SEVERITY_STYLES } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

const SEVERITY_ICONS = {
  critical: AlertTriangle,
  warning: Bell,
  info: Info,
} as const;

type Props = {
  items: DashboardAttentionItem[];
};

export function DashboardAttentionStrip({ items }: Props) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section
      className="lg:surface-card min-w-0 max-lg:px-0 max-lg:py-0 lg:px-4 lg:py-3"
      aria-label="Needs attention"
    >
      <p className="section-eyebrow mb-2.5 hidden px-0.5 lg:block">Needs attention</p>
      <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const style = ATTENTION_SEVERITY_STYLES[item.severity];
          const Icon = SEVERITY_ICONS[item.severity];
          return (
            <Link
              key={item.id}
              to={item.href}
              className={cn(
                'group inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border px-3 py-2 transition-colors sm:gap-2.5 sm:px-3.5',
                style.chipInteractive
              )}
            >
              <Icon className={cn('size-4 shrink-0', style.iconWrap)} aria-hidden />
              <span className="text-foreground text-xs font-semibold sm:whitespace-nowrap sm:text-sm">
                {item.label}
              </span>
              {item.count != null ? (
                <span
                  className={cn(
                    'bg-card/80 inline-flex min-w-[1.75rem] items-center justify-center rounded-lg px-2 py-0.5 text-sm font-bold tabular-nums shadow-sm',
                    style.count
                  )}
                >
                  {item.count}
                </span>
              ) : null}
              <ArrowRight
                className="text-muted-foreground ml-auto hidden size-3.5 shrink-0 opacity-70 motion-reduce:opacity-70 lg:ml-0 lg:block lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100"
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
