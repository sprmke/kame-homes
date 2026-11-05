import { X } from 'lucide-react';

import { AI_OUTPUT_ICON } from '@/features/dashboard/marketing/components/ai-studio/AiSessionCard';
import { SamplePicture } from '@/features/dashboard/marketing/components/ai-studio/AiStudioSampleMedia';
import {
  sampleFiles,
  type AiStudioSample,
} from '@/features/dashboard/marketing/lib/aiStudioSamples';

import { Button } from '@/components/ui/button';

/** "Using Golden hour balcony" (or "Based on" once the host edits the words) + Clear. */
export function AiStudioSampleBanner({
  sample,
  edited,
  disabled,
  onClear,
}: {
  sample: AiStudioSample;
  edited: boolean;
  disabled?: boolean;
  onClear: () => void;
}) {
  const Icon = AI_OUTPUT_ICON[sample.output];
  const files = sample.output === 'post' ? null : sampleFiles(sample);
  const thumb = files ? (files.kind === 'image' ? files.after : files.poster) : null;

  return (
    <div className="border-primary/25 bg-primary/[0.05] flex min-h-[52px] items-center gap-3 rounded-xl border py-1.5 pl-2 pr-1">
      <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg">
        {thumb ? (
          <SamplePicture image={thumb} alt="" sizes="40px" className="size-full object-cover" />
        ) : (
          <Icon className="size-4" aria-hidden />
        )}
      </span>
      <p className="min-w-0 flex-1 text-sm leading-tight">
        <span className="text-muted-foreground block text-xs">
          {edited ? 'Based on' : 'Using example'}
        </span>
        <span className="text-foreground block truncate font-medium">{sample.title}</span>
      </p>
      <Button
        type="button"
        variant="ghost"
        className="min-h-[44px] shrink-0 gap-1 px-3"
        disabled={disabled}
        onClick={onClear}
      >
        <X className="size-4" aria-hidden />
        Clear
      </Button>
    </div>
  );
}
