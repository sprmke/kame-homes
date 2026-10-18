import type { ReactNode } from 'react';

import { MarketingBuilderHeader } from '@/features/dashboard/marketing/components/shared/MarketingBuilderHeader';
import { MarketingStudioHeaderActionsSlot } from '@/features/dashboard/marketing/components/shared/MarketingStudioHeaderActions';

import { cn } from '@/lib/utils';

type Props = {
  tabs?: ReactNode;
  /** Left of the tabs (theme switcher). */
  leading?: ReactNode;
  children: ReactNode;
};

/**
 * Shared builder card chrome — keeps mode tabs mounted for sliding-pill animation.
 *
 * Desktop (`lg+`): a fixed-height card (`100vh - 120px`) so the editor never grows
 * the page. Mobile (`max-lg`): an explicit viewport-derived height because a route
 * wrapper breaks the `flex-1` fill chain. The subtraction reserves the brand hero
 * (≈ 11rem) plus the two stacked floating docks below the card — the editor's own
 * "Templates" dock (≈ 4.75rem up) and, beneath it, the app bottom tab bar (which
 * stays visible so the user can still navigate away). The card ends just above the
 * editor dock so each editor's scrollport only needs a small bottom gutter.
 * `flex-none` so this height wins over the base `flex-1`.
 */
export function MarketingStudioShell({ tabs, leading, children }: Props) {
  return (
    <div
      className={cn(
        'border-border bg-card flex min-h-0 flex-1 flex-col overflow-hidden border max-lg:rounded-none max-lg:border-x-0 lg:rounded-xl',
        'max-lg:h-[calc(100dvh-20rem-env(safe-area-inset-bottom,0px))] max-lg:min-h-[19rem] max-lg:flex-none',
        'lg:h-[calc(100vh-120px)] lg:min-h-[520px] lg:flex-none'
      )}
    >
      {leading || tabs ? (
        <MarketingBuilderHeader
          leading={leading}
          tabs={tabs}
          actions={<MarketingStudioHeaderActionsSlot />}
        />
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
