import { absoluteGuestPath, guestPropertyPath } from '@/features/guest/lib/guestPublicPaths';

export function guestShowcasePath(propertySlug: string): string {
  const base = guestPropertyPath(propertySlug);
  return `${base}/showcase`;
}

export function absoluteGuestShowcaseUrl(propertySlug: string): string {
  return absoluteGuestPath(guestShowcasePath(propertySlug));
}

export function guestShowcaseEmbedPath(propertySlug: string): string {
  return `${guestShowcasePath(propertySlug)}?embed=1`;
}
