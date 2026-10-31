/**
 * Compact booking asset row — shared by edit form docs and Progress rail uploads.
 * One row: thumb + View, icon Replace, icon Remove. Empty = dashed Upload row.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { CheckCircle2, FileText, Loader2, Trash2, Upload } from 'lucide-react';

import {
  normalizeStoragePublicUrl,
  withStorageUrlCacheBust,
} from '@/features/dashboard/bookings/lib/storageUrls';

import { cn } from '@/lib/utils';

function getDocType(url: string): 'image' | 'pdf' | 'file' {
  const path = url.split('?')[0].toLowerCase();
  if (/\.(jpg|jpeg|png|webp|gif|heic|heif)$/.test(path)) return 'image';
  if (/\.pdf$/.test(path)) return 'pdf';
  return 'file';
}

const iconActionClass =
  'focus-ring inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40';

export type BookingCompactAssetControlProps = {
  label: string;
  currentUrl: string | null | undefined;
  accept?: string;
  /** When false, Field / outer label owns the name (still used for a11y). Default true. */
  showLabel?: boolean;
  readOnly?: boolean;
  /** Blocks picking a new file (e.g. settlement total missing). */
  disabled?: boolean;
  uploading?: boolean;
  removing?: boolean;
  /** Bust CDN cache after replace. */
  previewCacheBust?: number;
  /**
   * Optional resolved / signed thumb URL (private buckets). When omitted, the
   * control normalizes `currentUrl` for display.
   */
  thumbSrc?: string | null;
  thumbPending?: boolean;
  /** Skip normalized URL fallback (e.g. storage object missing). */
  suppressNormalizedThumb?: boolean;
  onSelectFile: (file: File) => void | Promise<void>;
  onRemove: () => void | Promise<void>;
  /** In-page preview modal (required — do not open a new tab). */
  onPreview: (label: string, rawUrl: string) => void | Promise<void>;
  /** Optional content under the row (e.g. AI verdict). */
  footer?: ReactNode;
};

export function BookingCompactAssetControl({
  label,
  currentUrl,
  accept = 'image/*',
  showLabel = true,
  readOnly = false,
  disabled = false,
  uploading = false,
  removing = false,
  previewCacheBust,
  thumbSrc,
  thumbPending = false,
  suppressNormalizedThumb = false,
  onSelectFile,
  onRemove,
  onPreview,
  footer,
}: BookingCompactAssetControlProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [justUploaded, setJustUploaded] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);

  const rawUrl = currentUrl?.trim() ?? '';
  const hasFile = Boolean(rawUrl);
  const normalized = rawUrl ? (normalizeStoragePublicUrl(rawUrl) ?? rawUrl) : '';
  const cacheBusted = normalized
    ? withStorageUrlCacheBust(normalized, previewCacheBust || null)
    : '';
  const displayUrl = thumbSrc?.trim() || (suppressNormalizedThumb ? '' : cacheBusted);

  useEffect(() => {
    setThumbFailed(false);
  }, [rawUrl, displayUrl, previewCacheBust]);

  useEffect(() => {
    if (!uploading && justUploaded) {
      const t = window.setTimeout(() => setJustUploaded(false), 3000);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [uploading, justUploaded]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await onSelectFile(file);
      setJustUploaded(true);
    } catch {
      // Parent surfaces the error (toast).
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRemove() {
    setThumbFailed(false);
    setJustUploaded(false);
    if (inputRef.current) inputRef.current.value = '';
    try {
      await onRemove();
    } catch {
      // Parent surfaces the error (toast).
    }
  }

  function handlePreview() {
    if (!rawUrl) return;
    void onPreview(label, rawUrl);
  }

  const busy = uploading || removing;
  const pickDisabled = busy || disabled || readOnly;
  const docType = rawUrl ? getDocType(rawUrl) : 'file';
  const showImageThumb =
    Boolean(displayUrl) && docType === 'image' && !thumbFailed && !thumbPending;

  return (
    <div className="min-w-0 space-y-1.5">
      {showLabel ? <p className="text-muted-foreground text-xs font-medium">{label}</p> : null}

      {!readOnly ? (
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => void handleFileChange(e)}
          disabled={pickDisabled}
        />
      ) : null}

      <div
        className={cn(
          'border-border/70 bg-card flex min-h-11 min-w-0 items-center gap-1.5 rounded-lg border py-1 pl-1.5 pr-1',
          !hasFile && 'border-dashed'
        )}
      >
        {hasFile ? (
          <button
            type="button"
            aria-label={`Preview ${label}`}
            onClick={handlePreview}
            disabled={busy}
            className="focus-ring hover:bg-muted/40 flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md p-1 text-left transition-colors disabled:pointer-events-none disabled:opacity-60"
          >
            {thumbPending ? (
              <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
                <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />
              </span>
            ) : showImageThumb ? (
              <span className="bg-muted size-9 shrink-0 overflow-hidden rounded-md">
                <img
                  src={displayUrl}
                  alt=""
                  className="size-full object-cover"
                  onError={() => setThumbFailed(true)}
                />
              </span>
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-50 dark:bg-red-500/15">
                <FileText className="size-4 text-red-400 dark:text-red-300" aria-hidden />
              </span>
            )}
            <span className="text-primary min-w-0 truncate text-sm font-medium underline-offset-2 hover:underline">
              View
            </span>
          </button>
        ) : readOnly ? (
          <span className="text-muted-foreground flex min-h-10 min-w-0 flex-1 items-center px-2 text-sm">
            None
          </span>
        ) : (
          <button
            type="button"
            disabled={pickDisabled}
            onClick={() => inputRef.current?.click()}
            className="focus-ring text-muted-foreground hover:text-foreground hover:bg-muted/40 flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm transition-colors disabled:pointer-events-none disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="size-4 shrink-0" aria-hidden />
                Upload
              </>
            )}
          </button>
        )}

        {hasFile && !readOnly ? (
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              disabled={pickDisabled}
              onClick={() => inputRef.current?.click()}
              aria-label={justUploaded ? `${label} uploaded` : `Replace ${label}`}
              title="Replace"
              aria-busy={uploading || undefined}
              className={cn(iconActionClass, justUploaded && 'text-success hover:text-success')}
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : justUploaded ? (
                <CheckCircle2 className="size-4" aria-hidden />
              ) : (
                <Upload className="size-4" aria-hidden />
              )}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleRemove()}
              aria-label={`Remove ${label}`}
              title="Remove"
              aria-busy={removing || undefined}
              className={cn(
                iconActionClass,
                'hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400'
              )}
            >
              {removing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4" aria-hidden />
              )}
            </button>
          </div>
        ) : null}
      </div>

      {footer}
    </div>
  );
}
