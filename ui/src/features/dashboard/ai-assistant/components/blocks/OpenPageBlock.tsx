import { ArrowUpRight } from 'lucide-react';

import type { OpenPageBlock as OpenPageBlockData } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import {
  assistantRouteSectionLabel,
  isOpenableAssistantHref,
} from '@/features/dashboard/ai-assistant/lib/assistantRoutes';
import { useAssistantNavigate } from '@/features/dashboard/ai-assistant/lib/assistantSurfaceContext';

import { Button } from '@/components/ui/button';

/** Handoff to the exact screen: loads it in the canvas (AI mode) or the page (Advanced). */
export function OpenPageBlock({ routeKey, label, href }: OpenPageBlockData) {
  const navigateTo = useAssistantNavigate();
  if (!isOpenableAssistantHref(href)) return null;
  const section = assistantRouteSectionLabel(routeKey);

  return (
    <div className="border-border/60 bg-card flex min-w-0 items-center gap-3 rounded-xl border p-3">
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-sm font-semibold" title={label}>
          {label}
        </p>
        {section ? <p className="text-muted-foreground text-caption truncate">{section}</p> : null}
      </div>
      <Button
        type="button"
        size="sm"
        className="min-h-[44px] shrink-0 gap-1.5 px-4"
        onClick={() => navigateTo(href)}
      >
        Open
        <ArrowUpRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
