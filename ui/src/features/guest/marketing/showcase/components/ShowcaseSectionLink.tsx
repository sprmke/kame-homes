import { Link, type LinkProps } from 'react-router-dom';

import { useSmoothScroll } from '@/features/guest/marketing/showcase/components/SmoothScrollProvider';

import { usePageEditorPreviewScroll } from '@/features/dashboard/page-editor/lib/pageEditorPreviewScroll';

/** In-page `#section` href used by Stay Guide hero CTAs and shell nav. */
export function parseShowcaseHashAnchor(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed.startsWith('#')) return null;
  const id = trimmed.slice(1).trim();
  return id || null;
}

type Props = Omit<LinkProps, 'to'> & { to: string };

/**
 * Router link for guest routes, or smooth in-page scroll for `#anchor` targets.
 * Hash links use the Page Editor preview scrollport when present so hero CTAs
 * work inside the contained preview frame (Stay Guide + Showcase editor).
 */
export function ShowcaseSectionLink({ to, onClick, ...rest }: Props) {
  const { scrollToAnchor } = useSmoothScroll();
  const previewScroll = usePageEditorPreviewScroll();
  const hashId = parseShowcaseHashAnchor(to);

  if (hashId) {
    return (
      <a
        {...rest}
        href={`#${hashId}`}
        onClick={(event) => {
          event.preventDefault();
          if (previewScroll) {
            previewScroll.scrollToAnchor(hashId);
          } else {
            scrollToAnchor(hashId);
          }
          onClick?.(event);
        }}
      />
    );
  }

  return <Link to={to} onClick={onClick} {...rest} />;
}
