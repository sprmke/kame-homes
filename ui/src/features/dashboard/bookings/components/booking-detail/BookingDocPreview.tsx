import { useEffect, useState, type ReactNode } from 'react';

import { ExternalLink, FileText, ImageIcon, Loader2 } from 'lucide-react';

import {
  formatReceiptAiVerdictLabel,
  ReceiptAiVerdictBadge,
  ReceiptAiVerdictMark,
  type DocumentAiVerdictVariant,
  type ReceiptAiVerdict,
} from '@/features/dashboard/bookings/components/ReceiptAiVerdictBadge';
import {
  isStorageObjectNotFoundError,
  normalizeStoragePublicUrl,
  parseStorageUrl,
  PRIVATE_STORAGE_BUCKETS,
  resolveAssetUrlForBrowser,
} from '@/features/dashboard/bookings/lib/storageUrls';

import { DocThumbnailSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Skeleton } from '@/components/ui/skeleton';

export function getDocType(url: string): 'image' | 'pdf' | 'file' {
  const path = url.split('?')[0].toLowerCase();
  if (/\.(jpg|jpeg|png|webp|gif|heic|heif)$/.test(path)) return 'image';
  if (/\.pdf$/.test(path)) return 'pdf';
  return 'file';
}

function docPreviewOuterWidth(compact?: boolean) {
  if (compact) return 'size-14 shrink-0 sm:size-16';
  return 'min-w-0 w-full max-w-full lg:max-w-[255px]';
}

function docPreviewLabelRow(
  label: string,
  icon: ReactNode,
  receiptAiVerdict?: ReceiptAiVerdict,
  receiptAiLoading?: boolean,
  receiptAiVariant: DocumentAiVerdictVariant = 'receipt'
) {
  return (
    <span className="text-caption inline-flex min-w-0 flex-1 items-center gap-1.5 font-medium">
      {icon}
      <span className="truncate">{label}</span>
      {receiptAiLoading ? (
        <Loader2
          className="text-muted-foreground size-3 shrink-0 animate-spin"
          aria-label={receiptAiVariant === 'valid_id' ? 'Checking valid ID' : 'Checking receipt'}
        />
      ) : receiptAiVerdict && String(receiptAiVerdict).toLowerCase() !== 'skipped' ? (
        <ReceiptAiVerdictBadge
          verdict={receiptAiVerdict}
          compact
          className="shrink-0"
          variant={receiptAiVariant}
        />
      ) : null}
    </span>
  );
}

export function DocPreview({
  label,
  url,
  onPreview,
  receiptAiVerdict,
  receiptAiLoading = false,
  receiptAiVariant = 'receipt',
  /** Square thumbnail for dense guest-roster rows (no caption chrome). */
  compact = false,
  className,
}: {
  label: string;
  url: string;
  onPreview: (label: string, rawUrl: string) => void;
  receiptAiVerdict?: ReceiptAiVerdict;
  receiptAiLoading?: boolean;
  receiptAiVariant?: DocumentAiVerdictVariant;
  compact?: boolean;
  className?: string;
}) {
  const normalized = normalizeStoragePublicUrl(url) ?? url;
  const parsed = parseStorageUrl(normalized);
  const inPrivateBucket = Boolean(parsed && PRIVATE_STORAGE_BUCKETS.has(parsed.bucket));
  const layoutType = getDocType(normalized);
  const needsSignedUrl = inPrivateBucket;
  const [displayUrl, setDisplayUrl] = useState<string | null>(() =>
    needsSignedUrl ? null : normalized
  );
  const [imgError, setImgError] = useState(false);
  const [missingInStorage, setMissingInStorage] = useState(false);

  useEffect(() => {
    const n = normalizeStoragePublicUrl(url) ?? url;
    const loc = parseStorageUrl(n);
    const priv = Boolean(loc && PRIVATE_STORAGE_BUCKETS.has(loc.bucket));
    if (!priv) {
      setDisplayUrl(n);
      setImgError(false);
      setMissingInStorage(false);
      return;
    }
    let cancelled = false;
    setDisplayUrl(null);
    setImgError(false);
    setMissingInStorage(false);
    resolveAssetUrlForBrowser(url)
      .then((u) => {
        if (!cancelled) setDisplayUrl(u);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isStorageObjectNotFoundError(err)) {
          setDisplayUrl(null);
          setMissingInStorage(true);
          setImgError(true);
          return;
        }
        setDisplayUrl(n);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const hrefForOpen = displayUrl ?? normalized;
  const widthClass = className ?? docPreviewOuterWidth(compact);

  if (compact) {
    const hasVerdict =
      !receiptAiLoading &&
      receiptAiVerdict &&
      String(receiptAiVerdict).toLowerCase() !== 'skipped' &&
      ['valid', 'likely_valid', 'unclear', 'invalid'].includes(
        String(receiptAiVerdict).toLowerCase()
      );
    const compactAriaLabel = receiptAiLoading
      ? `Open ${label} (checking)`
      : hasVerdict
        ? `Open ${label} (AI: ${formatReceiptAiVerdictLabel(receiptAiVerdict)})`
        : `Open ${label}`;

    if (needsSignedUrl && !displayUrl && !missingInStorage) {
      return (
        <div
          className={`overflow-hidden rounded-lg ${widthClass}`}
          role="status"
          aria-label={label}
        >
          <Skeleton className="size-full rounded-lg" />
        </div>
      );
    }

    if (missingInStorage || (layoutType === 'image' && imgError)) {
      return (
        <div
          className={`border-border bg-muted/50 text-muted-foreground flex items-center justify-center overflow-hidden rounded-lg border border-dashed ${widthClass}`}
          title={missingInStorage ? 'File missing from storage' : 'Preview unavailable'}
          aria-label={label}
        >
          <ImageIcon className="size-4" aria-hidden />
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => onPreview(label, url)}
        aria-label={compactAriaLabel}
        className={`border-border hover:border-primary/50 group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-lg border transition-colors ${widthClass}`}
      >
        {layoutType === 'image' && !imgError ? (
          <img
            src={hrefForOpen}
            alt=""
            className="size-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : layoutType === 'pdf' ? (
          <span className="flex size-full items-center justify-center bg-rose-100 dark:bg-rose-500/20">
            <FileText className="size-5 text-rose-500" aria-hidden />
          </span>
        ) : (
          <span className="bg-muted flex size-full items-center justify-center">
            <ExternalLink className="text-muted-foreground size-4" aria-hidden />
          </span>
        )}
        {receiptAiLoading ? (
          <span className="bg-card/95 absolute right-1 top-1 flex size-5 items-center justify-center rounded-full shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            <Loader2 className="text-muted-foreground size-3 animate-spin" aria-hidden />
          </span>
        ) : hasVerdict ? (
          <span className="absolute right-1 top-1">
            <ReceiptAiVerdictMark verdict={receiptAiVerdict} size="sm" />
          </span>
        ) : null}
      </button>
    );
  }

  if (needsSignedUrl && !displayUrl && !missingInStorage) {
    return (
      <div
        className={`border-border bg-card flex flex-col overflow-hidden rounded-xl border ${widthClass}`}
      >
        <DocThumbnailSkeleton className="rounded-none" />
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          {docPreviewLabelRow(
            label,
            <ImageIcon className="text-muted-foreground size-3 shrink-0" />,
            receiptAiVerdict,
            receiptAiLoading,
            receiptAiVariant
          )}
        </div>
      </div>
    );
  }

  if (missingInStorage) {
    return (
      <div
        className={`border-border bg-muted/40 flex flex-col overflow-hidden rounded-xl border border-dashed ${widthClass}`}
      >
        <div className="bg-muted relative flex aspect-video items-center justify-center px-3 text-center">
          <p className="text-muted-foreground text-[11px] leading-snug">
            File missing from storage
          </p>
        </div>
        <div className="bg-card flex items-center justify-between gap-2 px-3 py-2">
          {docPreviewLabelRow(
            label,
            layoutType === 'pdf' ? (
              <FileText className="size-3 shrink-0 text-rose-500" />
            ) : (
              <ImageIcon className="text-muted-foreground size-3 shrink-0" />
            ),
            receiptAiVerdict,
            receiptAiLoading,
            receiptAiVariant
          )}
        </div>
      </div>
    );
  }

  if (layoutType === 'image' && imgError) {
    return (
      <div
        className={`border-border bg-muted/40 flex flex-col overflow-hidden rounded-xl border border-dashed ${widthClass}`}
      >
        <div className="bg-muted relative flex aspect-video items-center justify-center px-3 text-center">
          <p className="text-muted-foreground text-[11px] leading-snug">Preview unavailable</p>
        </div>
        <div className="bg-card flex items-center justify-between gap-2 px-3 py-2">
          {docPreviewLabelRow(
            label,
            <ImageIcon className="text-muted-foreground size-3 shrink-0" />,
            receiptAiVerdict,
            receiptAiLoading,
            receiptAiVariant
          )}
        </div>
      </div>
    );
  }

  if (layoutType === 'image' && !imgError) {
    return (
      <a
        href={hrefForOpen}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.preventDefault();
          onPreview(label, url);
        }}
        className={`border-border hover:border-primary/40 group flex flex-col overflow-hidden rounded-xl border transition-all hover:shadow-md ${widthClass}`}
      >
        <div className="bg-muted relative aspect-video overflow-hidden">
          <img
            src={hrefForOpen}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
            <ExternalLink className="size-5 text-white opacity-0 drop-shadow-lg transition-opacity group-hover:opacity-100" />
          </div>
        </div>
        <div className="bg-card flex items-center justify-between gap-2 px-3 py-2">
          {docPreviewLabelRow(
            label,
            <ImageIcon className="text-muted-foreground size-3 shrink-0" />,
            receiptAiVerdict,
            receiptAiLoading,
            receiptAiVariant
          )}
          <ExternalLink className="text-muted-foreground size-3 shrink-0" />
        </div>
      </a>
    );
  }

  if (layoutType === 'pdf') {
    return (
      <a
        href={hrefForOpen}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.preventDefault();
          onPreview(label, url);
        }}
        className={`border-border hover:border-primary/40 group flex flex-col overflow-hidden rounded-xl border transition-all hover:shadow-md ${widthClass}`}
      >
        <div className="bg-muted relative aspect-video overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center bg-rose-100">
            <FileText className="size-10 text-rose-500" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
            <ExternalLink className="size-5 text-white opacity-0 drop-shadow-lg transition-opacity group-hover:opacity-100" />
          </div>
        </div>
        <div className="bg-card flex items-center justify-between px-3 py-2">
          <span className="text-caption inline-flex items-center gap-1 truncate font-medium">
            <FileText className="size-3 shrink-0 text-rose-500" />
            <span className="truncate">{label}</span>
          </span>
          <ExternalLink className="text-muted-foreground size-3 shrink-0" />
        </div>
      </a>
    );
  }

  return (
    <a
      href={hrefForOpen}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.preventDefault();
        onPreview(label, url);
      }}
      className={`border-border bg-muted/50 hover:bg-muted flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors ${widthClass}`}
    >
      <ExternalLink className="text-muted-foreground size-4 shrink-0" />
      <span className="text-foreground truncate text-xs font-medium">{label}</span>
    </a>
  );
}
