import { useEffect, useRef, useState } from 'react';

import { withGuestEmbedPreviewUrl } from '@/features/guest/lib/guestEmbedPreview';

import { PublicPagePreview } from '@/features/dashboard/custom-pages/components/PublicPagePreview';
import type { PropertyGuestPublicPage } from '@/features/dashboard/property/lib/propertyGuestPublicPages';

import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

/** Desktop guest viewport — thumbnails show listing-style layout, not phone. */
const PREVIEW_WIDTH = 1280;
/** Above-the-fold capture height per page type. */
const PREVIEW_HEIGHT: Record<PropertyGuestPublicPage['id'], number> = {
  listing: 900,
  calendar: 820,
  form: 820,
  messages: 720,
  'stay-guide': 880,
  showcase: 900,
  'sd-form': 820,
  'guest-review': 720,
  'pay-parking': 760,
};

const LOAD_TIMEOUT_MS = 12_000;

type Props = {
  src: string;
  pageId: PropertyGuestPublicPage['id'];
  label: string;
  propertyName: string;
  coverUrl: string | null;
};

export function PublicPageLivePreview({ src, pageId, label, propertyName, coverUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [adminJwt, setAdminJwt] = useState<string | null>(null);

  const previewHeight = PREVIEW_HEIGHT[pageId];
  const baseSrc = src.includes('embed=1') ? src : withGuestEmbedPreviewUrl(src);

  useEffect(() => {
    // The showcase draft (Lorem ipsum, stock photos, host contact info) requires
    // proof of property access server-side — see get-public-showcase's admin_jwt
    // check. Other page types ignore this param.
    if (pageId !== 'showcase') return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setAdminJwt(data.session?.access_token ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  const iframeSrc =
    pageId === 'showcase' && adminJwt
      ? `${baseSrc}${baseSrc.includes('?') ? '&' : '?'}admin_jwt=${encodeURIComponent(adminJwt)}`
      : baseSrc;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldLoad(true);
          io.disconnect();
        }
      },
      { rootMargin: '120px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? PREVIEW_WIDTH;
      setScale(width / PREVIEW_WIDTH);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldLoad || loaded || failed) return;

    const timer = window.setTimeout(() => setFailed(true), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [shouldLoad, loaded, failed]);

  if (failed) {
    return (
      <div
        ref={containerRef}
        className="bg-muted/40 relative size-full overflow-hidden"
        aria-hidden
      >
        <PublicPagePreview pageId={pageId} propertyName={propertyName} coverUrl={coverUrl} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bg-muted/40 relative size-full overflow-hidden" aria-hidden>
      {!loaded ? (
        <div className="bg-muted/80 absolute inset-0 animate-pulse motion-reduce:animate-none" />
      ) : null}
      {shouldLoad ? (
        <iframe
          src={iframeSrc}
          title={`${label} preview`}
          className={cn(
            'bg-background pointer-events-none absolute left-0 top-0 overflow-hidden border-0 opacity-0 transition-opacity duration-300 motion-reduce:transition-none',
            loaded && 'opacity-100'
          )}
          style={{
            width: PREVIEW_WIDTH,
            height: previewHeight,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
          loading="lazy"
          scrolling="no"
          tabIndex={-1}
          onLoad={() => setLoaded(true)}
        />
      ) : null}
    </div>
  );
}
