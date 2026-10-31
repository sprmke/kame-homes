import { useEffect, useState } from 'react';

import { normalizeStoragePublicUrl } from '@/features/dashboard/bookings/lib/storageUrls';

import { cn } from '@/lib/utils';

type Size = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<Size, string> = {
  xs: 'size-5 text-[9px]',
  sm: 'size-7 text-[11px]',
  md: 'size-9 text-[12px]',
  lg: 'size-12 text-[15px]',
};

type Props = {
  name: string;
  /** Public/signed URL of the guest's valid ID (preferred). May be null. */
  validIdUrl?: string | null;
  size?: Size;
  className?: string;
};

/**
 * Guest avatar — renders the valid-ID picture when available, falling back
 * to a green initial bubble when the URL is missing OR fails to load.
 *
 * Per UI spec: only one accent color (sidebar primary green) is used for
 * the fallback background. Avoid the multi-color hashed palette we used
 * before so the table reads cleanly.
 */
export function GuestAvatar({ name, validIdUrl, size = 'md', className }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const displayUrl = validIdUrl ? (normalizeStoragePublicUrl(validIdUrl) ?? validIdUrl) : null;
  const initial = (name?.trim()[0] ?? '?').toUpperCase();
  const showImage = Boolean(displayUrl) && !imgFailed;

  useEffect(() => {
    setImgFailed(false);
  }, [validIdUrl]);

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full font-black ring-1 ring-inset ring-black/[0.04]',
        SIZE_CLASS[size],
        !showImage && 'gradient-primary text-primary-foreground',
        className
      )}
      aria-hidden
    >
      {showImage ? (
        <img
          src={displayUrl ?? undefined}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
