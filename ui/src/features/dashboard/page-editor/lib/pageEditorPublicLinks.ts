import { toast } from 'sonner';

import { withGuestEmbedPreviewUrl } from '@/features/guest/lib/guestEmbedPreview';
import { absoluteGuestPath } from '@/features/guest/lib/guestPublicPaths';

import { buildPropertyGuestPublicPages } from '@/features/dashboard/property/lib/propertyGuestPublicPages';

export type PageEditorPageId = 'listing' | 'stay-guide' | 'showcase';

export function resolvePageEditorPublicLinks(
  pageId: PageEditorPageId,
  propertySlug: string,
  propertyId: string
): { openHref: string; copyHref: string; pageLabel: string } | null {
  const page = buildPropertyGuestPublicPages(propertySlug, propertyId).find(
    (entry) => entry.id === pageId
  );
  if (!page) return null;

  const href = absoluteGuestPath(page.path);
  const copyHref = absoluteGuestPath(page.copyPath ?? page.path);
  const openHref = page.openUsesEmbed ? withGuestEmbedPreviewUrl(href) : href;

  return { openHref, copyHref, pageLabel: page.label };
}

export async function copyPageEditorPublicLink(href: string, pageLabel: string) {
  try {
    await navigator.clipboard.writeText(href);
    toast.success(`${pageLabel} link copied`);
  } catch {
    toast.error('Could not copy link');
  }
}
