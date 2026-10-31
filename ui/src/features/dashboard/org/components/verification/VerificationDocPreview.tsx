import { Expand, ExternalLink, FileText, X } from 'lucide-react';

import { normalizeStoragePublicUrl } from '@/features/dashboard/bookings/lib/storageUrls';
import { VerificationDocThumbnail } from '@/features/dashboard/org/components/verification/VerificationDocThumbnail';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type VerificationPreviewAsset = {
  label: string;
  url: string;
  type: 'image' | 'pdf' | 'file';
};

export function browserVerificationAssetUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  let normalized = normalizeStoragePublicUrl(url.trim()) ?? url.trim();

  const projectBase = (import.meta.env.VITE_SUPABASE_PROJECT_URL as string | undefined)?.replace(
    /\/+$/,
    ''
  );
  if (projectBase && /\/storage\/v1\/object\//.test(normalized)) {
    try {
      const parsed = new URL(normalized);
      const project = new URL(projectBase);
      if (parsed.origin !== project.origin) {
        normalized = `${project.origin}${parsed.pathname}${parsed.search}`;
      }
    } catch {
      /* keep normalized */
    }
  }

  return normalized;
}

export function getVerificationDocType(url: string): 'image' | 'pdf' | 'file' {
  const path = decodeURIComponent(url.split('?')[0] ?? '').toLowerCase();
  if (/\.(jpg|jpeg|png|webp|gif|heic|heif)$/.test(path)) return 'image';
  if (/\.pdf$/.test(path)) return 'pdf';
  return 'file';
}

export function VerificationDocPreviewCard({
  label,
  url,
  onFullView,
}: {
  label: string;
  url: string | null;
  onFullView: (asset: VerificationPreviewAsset) => void;
}) {
  const displayUrl = browserVerificationAssetUrl(url);

  if (!displayUrl) {
    return (
      <div className="border-border bg-muted/30 flex flex-col overflow-hidden rounded-xl border border-dashed">
        <div className="bg-muted flex aspect-[4/3] items-center justify-center px-3 text-center">
          <p className="text-muted-foreground text-xs">Not provided</p>
        </div>
        <div className="px-3 py-2">
          <p className="text-muted-foreground truncate text-xs font-medium">{label}</p>
        </div>
      </div>
    );
  }

  const type = getVerificationDocType(displayUrl);
  const openFull = () => onFullView({ label, url: displayUrl, type });

  return (
    <div className="border-border bg-card flex flex-col overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={openFull}
        className="bg-muted relative aspect-[4/3] w-full overflow-hidden text-left"
        aria-label={`Full view ${label}`}
      >
        <VerificationDocThumbnail url={displayUrl} type={type} label={label} />
      </button>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="text-foreground min-w-0 truncate text-xs font-medium">{label}</p>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={openFull}
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-colors"
            aria-label={`Full view ${label}`}
            title="Full view"
          >
            <Expand className="size-3.5" aria-hidden />
          </button>
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-colors"
            aria-label={`Open ${label} in new tab`}
            title="Open in new tab"
          >
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
      </div>
    </div>
  );
}

export function VerificationDocFullViewDialog({
  asset,
  onClose,
  overlayClassName,
  contentClassName,
}: {
  asset: VerificationPreviewAsset | null;
  onClose: () => void;
  overlayClassName?: string;
  contentClassName?: string;
}) {
  return (
    <Dialog open={Boolean(asset)} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent
        showCloseButton={false}
        overlayClassName={overlayClassName}
        className={cn(
          'flex h-[min(90dvh,calc(100dvh-1.5rem))] max-h-[min(90dvh,calc(100dvh-1.5rem))] w-[min(calc(100vw-1.5rem),56rem)] max-w-none flex-col gap-0 overflow-hidden p-0',
          'sm:w-[min(94vw,56rem)] sm:max-w-[56rem] sm:p-0',
          contentClassName
        )}
      >
        {asset ? (
          <>
            <div className="border-border flex min-h-[52px] shrink-0 items-center justify-between gap-2 border-b px-2.5 sm:min-h-[56px] sm:px-4">
              <DialogHeader className="min-w-0 flex-1 space-y-0 p-0 pr-0 text-left">
                <DialogTitle className="truncate text-xs font-semibold sm:text-sm">
                  {asset.label}
                </DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-2">
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-border hover:bg-muted/50 inline-flex min-h-[44px] items-center justify-center rounded-lg border px-3 text-xs font-medium"
                >
                  Open in new tab
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="border-border text-muted-foreground hover:bg-muted/50 inline-flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border"
                  aria-label="Close preview"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            </div>
            <div className="bg-muted flex min-h-0 flex-1 items-center justify-center overflow-y-auto overscroll-contain p-2 sm:p-3">
              {asset.type === 'image' ? (
                <img
                  src={browserVerificationAssetUrl(asset.url) ?? asset.url}
                  alt={asset.label}
                  className="max-h-full max-w-full object-contain"
                />
              ) : asset.type === 'pdf' ? (
                <iframe
                  title={asset.label}
                  src={browserVerificationAssetUrl(asset.url) ?? asset.url}
                  className="bg-card h-full min-h-[min(50dvh,20rem)] w-full rounded-lg border-0"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 px-4 text-center">
                  <FileText className="text-muted-foreground size-10" aria-hidden />
                  <a
                    href={browserVerificationAssetUrl(asset.url) ?? asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm font-medium underline-offset-4 hover:underline"
                  >
                    Open file
                  </a>
                </div>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
