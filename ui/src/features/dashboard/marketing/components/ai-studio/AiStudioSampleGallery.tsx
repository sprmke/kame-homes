import { useEffect, useMemo, useState } from 'react';

import { AiStudioSampleCard } from '@/features/dashboard/marketing/components/ai-studio/AiStudioSampleCard';
import { AiStudioSampleDetail } from '@/features/dashboard/marketing/components/ai-studio/AiStudioSampleDetail';
import {
  useAiStudioPostSampleRenderer,
  type PostSampleRenderer,
} from '@/features/dashboard/marketing/hooks/useAiStudioPostSamples';
import {
  listSamples,
  type AiStudioSample,
} from '@/features/dashboard/marketing/lib/aiStudioSamples';
import {
  isAiStudioOutput,
  type AiStudioOutput,
} from '@/features/dashboard/marketing/lib/marketingStudioRoute';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/sliding-tabs';
import { cn } from '@/lib/utils';

type Mode =
  /** Full grid with the type filter (empty home, See all). */
  | 'grid'
  /** One scrolling row with the filter and See all (returning home). */
  | 'row'
  /** One output, compact, scrolling (step 2 on phones). */
  | 'strip'
  /** One output, compact grid (step 2 preview pane on desktop). */
  | 'pane';

const ALL = 'all';
const OUTPUT_LABEL: Record<AiStudioOutput, string> = {
  post: 'Posts',
  image: 'Photos',
  video: 'Clips',
};

function filterStorageKey(propertyId: string | null) {
  return `ai-studio-examples-filter:${propertyId ?? 'none'}`;
}

function readStoredFilter(propertyId: string | null): AiStudioOutput | null {
  try {
    const value = window.localStorage.getItem(filterStorageKey(propertyId));
    return isAiStudioOutput(value) ? value : null;
  } catch {
    return null;
  }
}

function storeFilter(propertyId: string | null, value: AiStudioOutput | null) {
  try {
    if (value) window.localStorage.setItem(filterStorageKey(propertyId), value);
    else window.localStorage.removeItem(filterStorageKey(propertyId));
  } catch {
    // Private mode / blocked storage: the filter just is not remembered.
  }
}

/** Post examples the host's listing can show (others need details it lacks). */
function useVisibleSamples(
  samples: AiStudioSample[],
  renderer: PostSampleRenderer
): AiStudioSample[] {
  return useMemo(
    () =>
      samples.filter(
        (sample) => sample.output !== 'post' || !renderer.ready || renderer.planFor(sample) !== null
      ),
    [samples, renderer]
  );
}

/**
 * "Start from an example": finished posts, photos and clips the host can point at.
 * Opening one shows how it was made; Use this example fills the create form.
 */
export function AiStudioSampleGallery({
  mode,
  output,
  access,
  onUse,
  onSeeAll,
  onCollapse,
  className,
}: {
  mode: Mode;
  /** Fixed output (strip / pane). */
  output?: AiStudioOutput;
  access: Record<AiStudioOutput, boolean>;
  onUse: (sample: AiStudioSample) => void;
  onSeeAll?: () => void;
  /** Grid opened from See all: back to one row. */
  onCollapse?: () => void;
  className?: string;
}) {
  const propertyId = usePropertyIdParam();
  const renderer = useAiStudioPostSampleRenderer();
  const videoGate = useFeatureGate('aiMarketingVideoGeneration');
  const allowHighResolution = videoGate.isLoading || videoGate.allowed;
  const fixedOutput = mode === 'strip' || mode === 'pane' ? (output ?? null) : null;

  const [filter, setFilter] = useState<AiStudioOutput | null>(() =>
    fixedOutput ? null : readStoredFilter(propertyId)
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const catalog = useMemo(() => listSamples(), []);
  const all = useVisibleSamples(catalog, renderer);
  const outputsWithSamples = useMemo(
    () =>
      (['post', 'image', 'video'] as const).filter((value) => all.some((s) => s.output === value)),
    [all]
  );
  // A remembered filter whose examples are gone falls back to All.
  const activeFilter =
    fixedOutput ?? (filter && outputsWithSamples.includes(filter) ? filter : null);
  const samples = useMemo(
    () => (activeFilter ? all.filter((sample) => sample.output === activeFilter) : all),
    [all, activeFilter]
  );

  useEffect(() => setOpenIndex(null), [activeFilter]);

  if (samples.length === 0) return null;

  const compact = mode === 'strip' || mode === 'pane';
  const scrolls = mode === 'row' || mode === 'strip';
  const showFilter = !fixedOutput && outputsWithSamples.length > 1;

  return (
    <section className={cn('min-w-0 space-y-2.5', className)} aria-label="Examples">
      {mode === 'pane' ? null : (
        <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="text-section-title mr-auto">
            {compact ? 'Examples' : 'Start from an example'}
          </h3>
          {showFilter ? (
            <SegmentedControl
              value={activeFilter ?? ALL}
              onChange={(next) => {
                const value = isAiStudioOutput(next) ? next : null;
                setFilter(value);
                storeFilter(propertyId, value);
              }}
              size="dense"
              aria-label="Example type"
              options={[
                { value: ALL, label: 'All' },
                ...outputsWithSamples.map((value) => ({ value, label: OUTPUT_LABEL[value] })),
              ]}
            />
          ) : null}
          {mode === 'grid' && onCollapse ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-[44px] px-3"
              onClick={onCollapse}
            >
              Show less
            </Button>
          ) : null}
          {mode === 'row' && onSeeAll ? (
            <Button type="button" variant="ghost" className="min-h-[44px] px-3" onClick={onSeeAll}>
              See all
            </Button>
          ) : null}
        </div>
      )}

      <ul
        className={cn(
          scrolls
            ? '-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:-mx-4 sm:px-4 lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden'
            : mode === 'pane'
              ? 'grid grid-cols-2 gap-3 xl:grid-cols-3'
              : 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
        )}
      >
        {samples.map((sample, index) => (
          <li
            key={sample.id}
            className={cn(
              'min-w-0',
              scrolls && 'shrink-0 snap-start',
              mode === 'row' && 'w-[44vw] sm:w-48 lg:w-52',
              mode === 'strip' && 'w-[38vw] sm:w-40'
            )}
          >
            <AiStudioSampleCard
              sample={sample}
              renderer={renderer}
              allowHighResolution={allowHighResolution}
              compact={compact}
              onOpen={() => setOpenIndex(index)}
            />
          </li>
        ))}
      </ul>

      <AiStudioSampleDetail
        samples={samples}
        index={openIndex}
        onIndexChange={setOpenIndex}
        renderer={renderer}
        access={access}
        allowHighResolution={allowHighResolution}
        onUse={(sample) => {
          setOpenIndex(null);
          onUse(sample);
        }}
      />
    </section>
  );
}
