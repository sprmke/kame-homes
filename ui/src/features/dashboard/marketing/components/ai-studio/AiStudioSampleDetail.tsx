import { useEffect, useState } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { AiStudioSampleArt } from '@/features/dashboard/marketing/components/ai-studio/AiStudioSampleCard';
import type { PostSampleRenderer } from '@/features/dashboard/marketing/hooks/useAiStudioPostSamples';
import { useCanAutoplay } from '@/features/dashboard/marketing/hooks/useCanAutoplay';
import {
  OUTPUT_FEATURE,
  POST_FORMATS,
  POST_GOALS,
} from '@/features/dashboard/marketing/lib/aiStudioPostOptions';
import {
  SAMPLE_OUTPUT_NOUN,
  sampleEtaLabel,
  sampleMeta,
  sampleSettingLabels,
  type AiStudioSample,
} from '@/features/dashboard/marketing/lib/aiStudioSamples';
import {
  VIDEO_CAMERA_MOVES,
  VIDEO_SOUND_MODES,
} from '@/features/dashboard/marketing/lib/marketingGenerationOptions';
import type { AiStudioOutput } from '@/features/dashboard/marketing/lib/marketingStudioRoute';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { SegmentedControl } from '@/components/ui/sliding-tabs';
import { captureAppEvent } from '@/lib/posthog/capture';

function present(values: Array<string | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value));
}

function settingChips(sample: AiStudioSample): string[] {
  if (sample.output === 'post') {
    return present([
      POST_GOALS.find((goal) => goal.value === sample.goal)?.label,
      POST_FORMATS.find((format) => format.value === sample.format)?.label,
    ]);
  }
  if (sample.output === 'video') {
    return present([
      VIDEO_CAMERA_MOVES.find((move) => move.id === sample.cameraMove)?.title,
      VIDEO_SOUND_MODES.find((mode) => mode.value === sample.sound)?.label,
      sample.aspect,
    ]);
  }
  return sampleSettingLabels(sample);
}

type Props = {
  samples: AiStudioSample[];
  /** Index into `samples`; null = closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
  onUse: (sample: AiStudioSample) => void;
  renderer: PostSampleRenderer;
  access: Record<AiStudioOutput, boolean>;
  allowHighResolution: boolean;
};

/**
 * One example up close: the result (and the photo it started from), the words and
 * settings that made it, what the host needs, and the cost. Use this example fills the
 * create form; nothing is generated or charged here.
 */
export function AiStudioSampleDetail({
  samples,
  index,
  onIndexChange,
  onUse,
  renderer,
  access,
  allowHighResolution,
}: Props) {
  const sample = index === null ? null : (samples[index] ?? null);
  const [view, setView] = useState<'before' | 'after'>('after');
  const canAutoplay = useCanAutoplay();
  const count = samples.length;

  useEffect(() => {
    setView('after');
    if (sample)
      captureAppEvent('ai_studio_sample_viewed', { sample_id: sample.id, output: sample.output });
  }, [sample]);

  const step = (delta: number) => {
    if (index === null || count < 2) return;
    onIndexChange((index + delta + count) % count);
  };

  useEffect(() => {
    if (index === null || count < 2) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [role="tablist"], [role="radiogroup"]')) return;
      if (event.key === 'ArrowRight') onIndexChange((index + 1) % count);
      if (event.key === 'ArrowLeft') onIndexChange((index - 1 + count) % count);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, count, onIndexChange]);

  const allowed = sample ? access[sample.output] : false;
  const chips = sample ? settingChips(sample) : [];
  const hasBefore = sample ? sample.output !== 'post' : false;

  return (
    <ResponsiveModal open={Boolean(sample)} onOpenChange={(open) => !open && onIndexChange(null)}>
      <ResponsiveModalContent className="sm:max-w-3xl lg:max-w-4xl" sheetBodyClassName="space-y-4">
        {sample ? (
          <>
            <ResponsiveModalHeader className="pr-8 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <ResponsiveModalTitle>{sample.title}</ResponsiveModalTitle>
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
                  Example
                </span>
                <TierBadge feature={OUTPUT_FEATURE[sample.output]} />
              </div>
              <ResponsiveModalDescription>
                {sampleMeta(sample, allowHighResolution)} · {sampleEtaLabel(sample)}
              </ResponsiveModalDescription>
            </ResponsiveModalHeader>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-6">
              <div className="space-y-2">
                <div className="bg-muted/40 flex h-[min(52vh,30rem)] items-center justify-center rounded-xl p-3 sm:p-4">
                  <AiStudioSampleArt
                    sample={sample}
                    renderer={renderer}
                    active={sample.output === 'video' ? canAutoplay : true}
                    view={view}
                    controls={sample.output === 'video'}
                    eager
                  />
                </div>
                {hasBefore ? (
                  <SegmentedControl
                    value={view}
                    onChange={(next) => setView(next as 'before' | 'after')}
                    size="dense"
                    fullWidth
                    aria-label="Show"
                    options={[
                      { value: 'before', label: 'Your photo' },
                      { value: 'after', label: sample.output === 'video' ? 'Clip' : 'Result' },
                    ]}
                  />
                ) : null}
              </div>

              <div className="flex min-w-0 flex-col gap-4">
                {sample.prompt ? (
                  <div className="space-y-1">
                    <span className="settings-field-label">Description</span>
                    <p className="text-foreground text-sm leading-relaxed">{sample.prompt}</p>
                  </div>
                ) : null}
                {chips.length > 0 ? (
                  <div className="space-y-1.5">
                    <span className="settings-field-label">Settings</span>
                    <ul className="flex flex-wrap gap-1.5">
                      {chips.map((chip) => (
                        <li
                          key={chip}
                          className="border-border/70 text-foreground rounded-full border px-2.5 py-1 text-xs"
                        >
                          {chip}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="space-y-1">
                  <span className="settings-field-label">What you need</span>
                  <p className="text-foreground text-sm">{sample.need}</p>
                  {hasBefore ? (
                    <p className="text-muted-foreground text-xs">Results depend on your photo.</p>
                  ) : null}
                </div>

                <div className="mt-auto flex items-center gap-2 pt-1">
                  {count > 1 ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-11 shrink-0"
                        aria-label="Previous example"
                        onClick={() => step(-1)}
                      >
                        <ChevronLeft className="size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-11 shrink-0"
                        aria-label="Next example"
                        onClick={() => step(1)}
                      >
                        <ChevronRight className="size-4" aria-hidden />
                      </Button>
                    </>
                  ) : null}
                  <Button
                    type="button"
                    className="native-cta min-h-11 min-w-0 flex-1"
                    disabled={!allowed}
                    onClick={() => onUse(sample)}
                  >
                    <span className="truncate">
                      {allowed ? 'Use this example' : 'Ask the owner for access'}
                    </span>
                  </Button>
                </div>
                <p className="sr-only" aria-live="polite">
                  {`${SAMPLE_OUTPUT_NOUN[sample.output]} example ${(index ?? 0) + 1} of ${count}`}
                </p>
              </div>
            </div>
          </>
        ) : null}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
