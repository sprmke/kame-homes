import { useEffect, useState } from 'react';

import { FileText } from 'lucide-react';

import { renderPdfBytesToPageImages } from '@/features/dashboard/bookings/lib/renderPdfPageImages';

import { DocThumbnailSkeleton } from '@/components/skeletons/AdminSkeletons';
import { cn } from '@/lib/utils';

type Props = {
  url: string;
  type: 'image' | 'pdf' | 'file';
  label: string;
  className?: string;
};

/**
 * Inline document thumbnail for verification review grids.
 * Images use `<img>`; PDFs render page 1 via pdf.js (tiny iframes show unreadable text).
 */
export function VerificationDocThumbnail({ url, type, label, className }: Props) {
  const [pdfThumb, setPdfThumb] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(type === 'pdf');

  useEffect(() => {
    setImgError(false);
  }, [url]);

  useEffect(() => {
    if (type !== 'pdf') {
      setPdfThumb(null);
      setPdfLoading(false);
      setPdfError(false);
      return;
    }

    let cancelled = false;
    setPdfLoading(true);
    setPdfError(false);
    setPdfThumb(null);

    void (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        const pages = await renderPdfBytesToPageImages(new Uint8Array(buffer), 1.1, 1);
        if (cancelled) return;
        const first = pages[0] ?? null;
        if (!first) throw new Error('Empty PDF');
        setPdfThumb(first);
      } catch {
        if (!cancelled) {
          setPdfError(true);
          setPdfThumb(null);
        }
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, type]);

  if (type === 'image') {
    if (imgError) {
      return (
        <div
          className={cn(
            'flex h-full w-full flex-col items-center justify-center gap-2 px-3',
            className
          )}
        >
          <FileText className="text-muted-foreground size-8" aria-hidden />
          <p className="text-muted-foreground text-center text-xs">Preview unavailable</p>
        </div>
      );
    }
    return (
      <img
        src={url}
        alt=""
        className={cn('h-full w-full object-cover', className)}
        onError={() => setImgError(true)}
      />
    );
  }

  if (type === 'pdf') {
    if (pdfLoading) {
      return (
        <div
          className={cn('h-full w-full', className)}
          aria-busy="true"
          aria-label={`Loading ${label} preview`}
        >
          <DocThumbnailSkeleton className="h-full w-full rounded-none" />
        </div>
      );
    }
    if (pdfThumb && !pdfError) {
      return (
        <img
          src={pdfThumb}
          alt=""
          className={cn('h-full w-full object-cover object-top', className)}
        />
      );
    }
    return (
      <div
        className={cn(
          'flex h-full w-full flex-col items-center justify-center gap-2 bg-rose-100 px-3 dark:bg-rose-950/40',
          className
        )}
      >
        <FileText className="size-10 text-rose-500" aria-hidden />
        <p className="text-xs font-medium uppercase tracking-wide text-rose-700/80 dark:text-rose-300/80">
          PDF
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center gap-2 px-3',
        className
      )}
    >
      <FileText className="text-muted-foreground size-8" aria-hidden />
      <p className="text-muted-foreground text-center text-xs">Preview unavailable</p>
    </div>
  );
}
