import { useEffect, useState } from 'react';

import { isPlatformSeedMediaUrl } from '@/features/dashboard/lib/storedMediaDisplay';

import { entityInitials, isUsableLogoNaturalSize } from '@/lib/entityInitials';
import { cn } from '@/lib/utils';

type Props = {
  src?: string | null;
  /** Used for initials when there is no usable image. */
  name?: string | null;
  alt?: string;
  className?: string;
  imageClassName?: string;
  initialsClassName?: string;
};

function resolveLogoSrc(src?: string | null): string | null {
  const trimmed = src?.trim() || null;
  if (!trimmed || isPlatformSeedMediaUrl(trimmed)) return null;
  return trimmed;
}

/**
 * Org / listing mark: custom logo when present, otherwise brand-tinted initials.
 * Tiny or broken images (e.g. 1×1 placeholders) fall back to initials.
 */
export function TeamLogoMark({
  src,
  name,
  alt = 'Organization',
  className,
  imageClassName,
  initialsClassName,
}: Props) {
  const url = resolveLogoSrc(src);
  const [failed, setFailed] = useState(false);
  const initials = entityInitials(name?.trim() || alt, '?');

  useEffect(() => {
    setFailed(false);
  }, [url]);

  const showImage = Boolean(url) && !failed;

  return (
    <div
      className={cn(
        'bg-primary-strong text-primary-foreground shadow-soft flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl',
        className
      )}
    >
      {showImage ? (
        <img
          src={url!}
          alt={alt}
          className={cn('h-full w-full object-cover', imageClassName)}
          width={40}
          height={40}
          onError={() => setFailed(true)}
          onLoad={(event) => {
            const img = event.currentTarget;
            if (!isUsableLogoNaturalSize(img.naturalWidth, img.naturalHeight)) {
              setFailed(true);
            }
          }}
        />
      ) : (
        <span
          className={cn('text-[11px] font-bold tracking-tight sm:text-xs', initialsClassName)}
          aria-hidden
        >
          {initials}
        </span>
      )}
    </div>
  );
}
