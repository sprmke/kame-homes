import { useSyncExternalStore } from 'react';

import { ListChecks } from 'lucide-react';

import { SectionNavIssueDot } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import { useOptionalSetupGuide } from '@/features/dashboard/setup-guide/components/setupGuideContext';
import {
  getSetupGuideRequiredRemaining,
  hasSetupGuideIssues,
  subscribeSetupGuideIssues,
} from '@/features/dashboard/setup-guide/lib/setupGuideIssuesStore';

import { cn } from '@/lib/utils';

/** Sidebar control — opens Setup Guide while required steps remain. */
export function SetupGuideSidebarEntry({ collapsed }: { collapsed?: boolean }) {
  const guide = useOptionalSetupGuide();
  const remaining = useSyncExternalStore(
    subscribeSetupGuideIssues,
    getSetupGuideRequiredRemaining,
    () => 0
  );
  const showDot = useSyncExternalStore(subscribeSetupGuideIssues, hasSetupGuideIssues, () => false);

  if (!guide?.org || remaining <= 0 || guide.persisted.completedAt) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => guide.openGuide()}
        title="Finish setup"
        aria-label={`Finish setup, ${remaining} left`}
        className="border-primary/25 from-primary/[0.12] to-primary/[0.04] text-primary hover:from-primary/15 relative mx-auto flex size-10 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br shadow-sm transition-colors"
      >
        <ListChecks className="size-4 shrink-0" aria-hidden />
        {showDot ? <SectionNavIssueDot className="absolute right-1 top-1" /> : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => guide.openGuide()}
      className={cn(
        'border-primary/20 from-primary/[0.10] to-primary/[0.03] hover:from-primary/[0.14] mx-3 mb-2 flex min-h-11 items-center gap-2 rounded-xl border bg-gradient-to-br px-3 py-2 text-left transition-colors'
      )}
    >
      <ListChecks className="text-primary size-4 shrink-0" aria-hidden />
      <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
        Finish setup
      </span>
      <span className="text-muted-foreground text-xs tabular-nums">{remaining}</span>
      {showDot ? <SectionNavIssueDot /> : null}
    </button>
  );
}
