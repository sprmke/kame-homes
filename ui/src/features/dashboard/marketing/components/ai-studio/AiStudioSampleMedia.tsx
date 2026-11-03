import { useEffect, useRef, useState } from 'react';

import { Play } from 'lucide-react';

import { AI_OUTPUT_ICON } from '@/features/dashboard/marketing/components/ai-studio/AiSessionCard';
import type { PostSampleImage } from '@/features/dashboard/marketing/hooks/useAiStudioPostSamples';
import type { SampleImage } from '@/features/dashboard/marketing/lib/aiStudioSamples';
import type { AiStudioOutput } from '@/features/dashboard/marketing/lib/marketingStudioRoute';

import { cn } from '@/lib/utils';

/** AVIF with a WebP fallback, lazy, never a broken-image icon. */
export function SamplePicture({
  image,
  alt,
  sizes,
  className,
  eager = false,
  onError,
}: {
  image: SampleImage;
  alt: string;
  sizes: string;
  className?: string;
  eager?: boolean;
  onError?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={cn('bg-muted block', className)} aria-hidden />;
  return (
    <picture>
      <source type="image/avif" srcSet={image.avifSrcSet} sizes={sizes} />
      <source type="image/webp" srcSet={image.webpSrcSet} sizes={sizes} />
      <img
        src={image.src}
        alt={alt}
        width={image.width}
        height={image.height}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className={className}
        onError={() => {
          setFailed(true);
          onError?.();
        }}
      />
    </picture>
  );
}

/**
 * A sample clip. Plays muted and looped while `playing`; otherwise shows the poster.
 * `controls` is for the detail view, where the host chooses to watch it.
 */
export function SampleClip({
  src,
  poster,
  alt,
  playing,
  controls = false,
  className,
}: {
  src: string;
  poster: SampleImage;
  alt: string;
  playing: boolean;
  controls?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (playing) void video.play().catch(() => undefined);
    else video.pause();
  }, [playing]);

  if (failed || (!playing && !controls)) {
    return (
      <span className="relative block size-full">
        <SamplePicture
          image={poster}
          alt={alt}
          sizes="(min-width: 1024px) 20vw, 45vw"
          className={className}
        />
        {failed ? null : (
          <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
            <span className="flex size-10 items-center justify-center rounded-full bg-black/35 backdrop-blur-sm">
              <Play className="size-5 fill-white text-white" />
            </span>
          </span>
        )}
      </span>
    );
  }

  return (
    <video
      ref={ref}
      src={src}
      poster={poster.src.replace(/-480\.webp$/, '-960.webp')}
      muted={!controls}
      loop
      playsInline
      controls={controls}
      preload={controls ? 'metadata' : 'none'}
      aria-label={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

/** A live post example; a quiet tile while it draws, the output icon if it cannot. */
export function SamplePostPreview({
  image,
  title,
  className,
}: {
  image: PostSampleImage;
  title: string;
  className?: string;
}) {
  if (image.status === 'ready') {
    return (
      <img
        src={image.dataUrl}
        alt={`${title}, post example`}
        className={cn('animate-in fade-in duration-300', className)}
        decoding="async"
      />
    );
  }
  return (
    <SampleMediaPlaceholder
      output="post"
      loading={image.status !== 'error'}
      className={className}
    />
  );
}

export function SampleMediaPlaceholder({
  output,
  loading,
  className,
}: {
  output: AiStudioOutput;
  loading: boolean;
  className?: string;
}) {
  const Icon = AI_OUTPUT_ICON[output];
  return (
    <span
      className={cn(
        'bg-muted/60 text-muted-foreground/60 flex items-center justify-center',
        loading && 'animate-pulse',
        className
      )}
      aria-hidden
    >
      <Icon className="size-6" />
    </span>
  );
}
