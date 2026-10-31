import { useEffect } from 'react';

import { useSearchParams } from 'react-router-dom';

import { isGuestEmbedPreview } from '@/features/guest/lib/guestEmbedPreview';

const ROOT_CLASS = 'guest-embed-preview';

/** Clips guest pages loaded in dashboard Public Pages iframe thumbnails. */
export function GuestEmbedPreviewEffect() {
  const [searchParams] = useSearchParams();
  const embed = isGuestEmbedPreview(searchParams);

  useEffect(() => {
    if (!embed) return;
    document.documentElement.classList.add(ROOT_CLASS);
    return () => document.documentElement.classList.remove(ROOT_CLASS);
  }, [embed]);

  return null;
}
