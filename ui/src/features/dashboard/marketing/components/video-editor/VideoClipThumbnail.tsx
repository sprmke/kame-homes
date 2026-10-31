import { Film, Play } from 'lucide-react';

import { inferBackgroundMediaType } from '@/features/dashboard/marketing/lib/propertyBindingMedia';

import { cn } from '@/lib/utils';

type Props = {
  url: string;
  mediaType?: 'image' | 'video';
  className?: string;
  fit?: 'cover' | 'contain';
};

/** Static clip thumb — avoids mounting HTML video decoders in lists. */
export function VideoClipThumbnail({ url, mediaType, className, fit = 'cover' }: Props) {
  const isVideo = mediaType === 'video' || inferBackgroundMediaType(url) === 'video';

  if (isVideo) {
    return (
      <div
        className={cn(
          'relative flex size-full items-center justify-center overflow-hidden',
          'bg-gradient-to-br from-neutral-900/80 via-neutral-800/75 to-neutral-900/85',
          className
        )}
      >
        <Film className="absolute inset-0 m-auto size-10 text-white/15" aria-hidden />
        <span className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm">
          <Play className="ml-0.5 size-4 fill-current" aria-hidden />
        </span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      className={cn(
        'size-full',
        fit === 'cover' ? 'object-cover object-center' : 'object-contain object-center',
        className
      )}
      draggable={false}
    />
  );
}
