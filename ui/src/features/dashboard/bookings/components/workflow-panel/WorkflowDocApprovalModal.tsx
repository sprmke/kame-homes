/**
 * Modal for marking GAF / pet document substeps complete.
 * Requires an approved PDF on file (upload or email listener) before confirm.
 */

import { useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

import { BookingCompactAssetControl } from '@/features/dashboard/bookings/components/BookingCompactAssetControl';
import type { BookingAssetPreviewHandler } from '@/features/dashboard/bookings/hooks/useBookingAssetPreview';
import { useClearBookingAsset } from '@/features/dashboard/bookings/hooks/useClearBookingAsset';
import { useUploadBookingAsset } from '@/features/dashboard/bookings/hooks/useUploadBookingAsset';
import type { DocumentRequirement } from '@/features/dashboard/bookings/lib/documentRequirements';
import {
  approvedPdfUploadLabel,
  approvedPdfUrlForDocStep,
  pendingDocStepApprovalAsset,
  type DocApprovalAssetType,
} from '@/features/dashboard/bookings/lib/pendingDocApproval';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import {
  nestedKeyLabel,
  type PendingDocNestedKey,
} from '@/features/dashboard/bookings/lib/workflow';

import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  booking: BookingRow;
  sub: PendingDocNestedKey;
  requirements: DocumentRequirement[];
  onPreview: BookingAssetPreviewHandler;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  isConfirming: boolean;
};

export function WorkflowDocApprovalModal({
  open,
  booking,
  sub,
  requirements,
  onPreview,
  onConfirm,
  onClose,
  isConfirming,
}: Props) {
  const assetType = pendingDocStepApprovalAsset(sub, requirements);
  const label = nestedKeyLabel(sub, requirements);
  const uploadLabel = assetType ? approvedPdfUploadLabel(assetType) : 'Approved document';

  const [currentUrl, setCurrentUrl] = useState('');
  const [previewBust, setPreviewBust] = useState(0);

  const uploadMut = useUploadBookingAsset();
  const clearMut = useClearBookingAsset();

  useEffect(() => {
    if (!open) return;
    setCurrentUrl(approvedPdfUrlForDocStep(booking, sub, requirements) ?? '');
    setPreviewBust(0);
  }, [open, booking, sub, requirements]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isConfirming && !uploadMut.isPending && !clearMut.isPending) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, isConfirming, uploadMut.isPending, clearMut.isPending, onClose]);

  if (!open || !assetType || typeof document === 'undefined') return null;

  const busy = isConfirming || uploadMut.isPending || clearMut.isPending;
  const hasApprovedFile = Boolean(currentUrl.trim());
  const instruction =
    'If the signed PDF was not received via email, manually upload it and mark it as complete.';

  async function handleUpload(file: File, type: DocApprovalAssetType) {
    try {
      const result = await uploadMut.mutateAsync({
        bookingId: booking.id,
        assetType: type,
        file,
      });
      setCurrentUrl(result.url);
      setPreviewBust(Date.now());
    } catch (err) {
      toast.error(friendlyToastError(err, 'Upload failed'));
      throw err;
    }
  }

  async function handleRemove(type: DocApprovalAssetType) {
    try {
      await clearMut.mutateAsync({ bookingId: booking.id, assetType: type });
      setCurrentUrl('');
      setPreviewBust(0);
    } catch (err) {
      toast.error(friendlyToastError(err, 'Could not remove file'));
      throw err;
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/40 p-3 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="workflow-doc-approval-title"
        aria-describedby="workflow-doc-approval-description"
        className="border-border bg-card flex max-h-[min(90dvh,calc(100dvh-1.5rem))] w-full max-w-[min(calc(100vw-1.5rem),28rem)] flex-col overflow-hidden rounded-xl border shadow-2xl"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-5">
          <header className="space-y-2">
            <h3
              id="workflow-doc-approval-title"
              className="text-foreground text-base font-semibold"
            >
              Mark {label} as complete
            </h3>
            <p
              id="workflow-doc-approval-description"
              className="text-muted-foreground text-sm leading-relaxed"
            >
              {instruction}
            </p>
          </header>

          <div className="mt-6 space-y-2">
            <p className="text-foreground text-sm font-medium">{uploadLabel}</p>
            <BookingCompactAssetControl
              label={uploadLabel}
              currentUrl={currentUrl}
              accept="application/pdf,image/*"
              showLabel={false}
              disabled={busy}
              uploading={uploadMut.isPending}
              removing={clearMut.isPending}
              previewCacheBust={previewBust || undefined}
              onSelectFile={(file) => handleUpload(file, assetType)}
              onRemove={() => handleRemove(assetType)}
              onPreview={onPreview}
            />
          </div>
        </div>
        <div className="border-border flex shrink-0 justify-end gap-2 border-t px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-muted-foreground hover:bg-muted min-h-[44px] rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={!hasApprovedFile || busy}
            aria-busy={isConfirming || undefined}
            className={cn(
              'gradient-primary text-primary-foreground shadow-soft hover:shadow-primary-glow min-h-[44px] rounded-xl px-5 py-2 text-sm font-bold transition-all duration-200 hover:brightness-[1.03] disabled:opacity-50 motion-safe:active:scale-[0.98]'
            )}
          >
            {isConfirming ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Processing…
              </span>
            ) : (
              'Mark as complete'
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
