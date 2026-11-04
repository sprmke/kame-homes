import { useState } from 'react';

import {
  SampleClip,
  SamplePicture,
  SamplePostPreview,
} from '@/features/dashboard/marketing/components/ai-studio/AiStudioSampleMedia';
import {
  usePostSampleImage,
  type PostSampleRenderer,
} from '@/features/dashboard/marketing/hooks/useAiStudioPostSamples';
import { useCanAutoplay } from '@/features/dashboard/marketing/hooks/useCanAutoplay';
import { useVisibleThumbnailRequest } from '@/features/dashboard/marketing/hooks/useVisibleThumbnailRequest';
import { OUTPUT_FEATURE } from '@/features/dashboard/marketing/lib/aiStudioPostOptions';
import {
  SAMPLE_OUTPUT_NOUN,
  aspectSize,
  sampleAspect,
  sampleFiles,
  sampleMeta,
  type AiStudioSample,
} from '@/features/dashboard/marketing/lib/aiStudioSamples';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';

import { cn } from '@/lib/utils';

/**
 * The example's media at its real shape, framed on a quiet backdrop so a 16:9 photo and
 * a 9:16 clip sit in the same grid without cropping what the host would get.
 */
export function AiStudioSampleArt({
  sample,
  renderer,
  active,
  view = 'after',
  controls = false,
  eager = false,
}: {
  sample: AiStudioSample;
  renderer: PostSampleRenderer;
  /** Visible (posts draw) / hovered or open (clips play). */
  active: boolean;
  view?: 'before' | 'after';
  controls?: boolean;
  eager?: boolean;
}) {
  const post = usePostSampleImage(sample.output === 'post' ? sample : null, renderer, active);
  const { width, height } = aspectSize(sampleAspect(sample));
  const frame = cn('size-full object-cover');
  const alt = `${sample.title}, ${SAMPLE_OUTPUT_NOUN[sample.output].toLowerCase()} example`;

  return (
    <span
      className="relative block max-h-full max-w-full overflow-hidden rounded-lg shadow-[0_6px_20px_-12px_rgba(15,23,42,0.5)] ring-1 ring-black/5"
      style={{
        aspectRatio: `${width} / ${height}`,
        width: width >= height ? '100%' : 'auto',
        height: width >= height ? 'auto' : '100%',
      }}
    >
      {sample.output === 'post' ? (
        <SamplePostPreview image={post} title={sample.title} className={frame} />
      ) : sample.output === 'image' ? (
        <SampleImageSwap sample={sample} view={view} eager={eager} alt={alt} />
      ) : (
        <SampleVideo sample={sample} view={view} playing={active} controls={controls} alt={alt} />
      )}
    </span>
  );
}

function SampleImageSwap({
  sample,
  view,
  eager,
  alt,
}: {
  sample: Extract<AiStudioSample, { output: 'image' }>;
  view: 'before' | 'after';
  eager: boolean;
  alt: string;
}) {
  const files = sampleFiles(sample);
  if (files.kind !== 'image') return null;
  const sizes = '(min-width: 1024px) 22vw, 45vw';
  return (
    <>
      <SamplePicture
        image={files.after}
        alt={alt}
        sizes={sizes}
        eager={eager}
        className="size-full object-cover"
      />
      <span
        className={cn(
          'absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none',
          view === 'before' ? 'opacity-100' : 'opacity-0'
        )}
        aria-hidden={view !== 'before'}
      >
        <SamplePicture
          image={files.before}
          alt={`${sample.title}, photo it started from`}
          sizes={sizes}
          className="size-full object-cover"
        />
      </span>
    </>
  );
}

function SampleVideo({
  sample,
  view,
  playing,
  controls,
  alt,
}: {
  sample: Extract<AiStudioSample, { output: 'video' }>;
  view: 'before' | 'after';
  playing: boolean;
  controls: boolean;
  alt: string;
}) {
  const files = sampleFiles(sample);
  if (files.kind !== 'video') return null;
  if (view === 'before') {
    return (
      <SamplePicture
        image={files.before}
        alt={`${sample.title}, photo it started from`}
        sizes="(min-width: 1024px) 40vw, 90vw"
        className="size-full object-cover"
      />
    );
  }
  return (
    <SampleClip
      src={files.mp4}
      poster={files.poster}
      alt={alt}
      playing={playing}
      controls={controls}
      className="size-full object-cover"
    />
  );
}

/** One example in the gallery. Opens the detail view; never generates anything. */
export function AiStudioSampleCard({
  sample,
  renderer,
  allowHighResolution,
  onOpen,
  compact = false,
}: {
  sample: AiStudioSample;
  renderer: PostSampleRenderer;
  allowHighResolution: boolean;
  onOpen: (sample: AiStudioSample) => void;
  compact?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const canAutoplay = useCanAutoplay();
  const ref = useVisibleThumbnailRequest({ onVisible: () => setVisible(true) });

  return (
    <div ref={ref} className="group relative min-w-0">
      <button
        type="button"
        onClick={() => onOpen(sample)}
        onPointerEnter={(event) => event.pointerType === 'mouse' && setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        aria-label={`${sample.title}, ${SAMPLE_OUTPUT_NOUN[sample.output].toLowerCase()} example`}
        className={cn(
          'border-border bg-card flex w-full flex-col overflow-hidden rounded-xl border text-left transition-[border-color,box-shadow] duration-200',
          'hover:border-primary/40 focus-visible:ring-ring native-press hover:shadow-md focus-visible:outline-none focus-visible:ring-2'
        )}
      >
        <span
          className={cn(
            'bg-muted/40 flex w-full items-center justify-center p-3',
            compact ? 'aspect-square' : 'aspect-[4/5]'
          )}
        >
          <AiStudioSampleArt
            sample={sample}
            renderer={renderer}
            active={sample.output === 'video' ? hovered && canAutoplay : visible}
            view={sample.output === 'image' && hovered ? 'before' : 'after'}
          />
        </span>
        <span className="block min-w-0 px-3 py-2.5">
          <span className="text-foreground block truncate text-[13px] font-semibold sm:text-sm">
            {sample.title}
          </span>
          <span className="text-muted-foreground block truncate text-xs">
            {sampleMeta(sample, allowHighResolution)}
          </span>
        </span>
      </button>
      {sample.output === 'image' && hovered ? (
        <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
          Before
        </span>
      ) : null}
      <span className="pointer-events-none absolute right-2 top-2">
        <TierBadge feature={OUTPUT_FEATURE[sample.output]} />
      </span>
    </div>
  );
}
