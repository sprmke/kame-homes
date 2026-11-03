import { Loader2 } from 'lucide-react';

import type { VideoExportPhase } from '@/features/dashboard/marketing/lib/exportVideoV2';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

export type VideoExportState = { phase: VideoExportPhase | 'preparing'; progress: number };

type Props = {
  state: VideoExportState | null;
  onCancel: () => void;
};

const PHASE_LABEL: Record<VideoExportState['phase'], string> = {
  preparing: 'Getting your music ready',
  checking: 'Checking your files',
  rendering: 'Making your video',
};

/** Blocking progress for an MP4 export, with Cancel. Not dismissible by outside click. */
export function VideoExportDialog({ state, onCancel }: Props) {
  const percent = Math.round(Math.max(0, Math.min(1, state?.progress ?? 0)) * 100);
  return (
    <ResponsiveModal open={Boolean(state)} onOpenChange={() => undefined}>
      <ResponsiveModalContent
        className="sm:max-w-sm"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
        showCloseButton={false}
      >
        <ResponsiveModalHeader>
          <ResponsiveModalTitle className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {state ? PHASE_LABEL[state.phase] : 'Exporting'}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Keep this tab open and in front until it finishes.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <div className="space-y-2 px-1 pb-1">
          <Progress
            value={state?.phase === 'rendering' ? percent : undefined}
            aria-label="Export progress"
          />
          <p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
            {state?.phase === 'rendering' ? `${percent}%` : 'Just a moment'}
          </p>
        </div>
        <div className="flex justify-end px-1 pt-2">
          <Button type="button" variant="outline" className="min-h-[44px]" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
