import { ChevronLeft } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import type { PolotnoStore } from '@/features/dashboard/marketing/lib/polotno/polotnoStore';

import { cn } from '@/lib/utils';

type Props = {
  store: PolotnoStore;
};

const VISIBLE_PANEL_NAMES = new Set([
  'text',
  'elements',
  'upload',
  'background',
  'layers',
  'kame-templates',
  'kame-collage',
  'kame-reviews',
  'kame-ai',
]);

export const KameSidePanelCollapse = observer(function KameSidePanelCollapse({ store }: Props) {
  const opened = (store as { openedSidePanel?: string }).openedSidePanel ?? '';
  if (!opened || !VISIBLE_PANEL_NAMES.has(opened)) return null;

  return (
    <button
      type="button"
      aria-label="Collapse panel"
      className={cn(
        'kame-side-panel-collapse',
        'border-border bg-card text-muted-foreground',
        'hover:bg-muted hover:text-foreground',
        'focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
      )}
      onClick={() => store.openSidePanel('')}
    >
      <ChevronLeft className="size-4 shrink-0" aria-hidden />
    </button>
  );
});
