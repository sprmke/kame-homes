/**
 * Upload sheet for GAF / pet approval substeps.
 *
 * Opened from the pending-doc row **Upload** action or the footer
 * **Mark … as complete** CTA. Requires an approved PDF on file (upload or
 * email listener) before confirm.
 */

import { useEffect, useRef, useState } from 'react';

import { FileCheck2, Loader2, UploadCloud } from 'lucide-react';
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

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { formatUploadLimit } from '@/lib/media/uploadLimits';
import { cn } from '@/lib/utils';

const ACCEPT = 'application/pdf,image/*';

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

  const [currentUrl, setCurrentUrl] = useState(
    () => approvedPdfUrlForDocStep(booking, sub, requirements) ?? ''
  );
  const [previewBust, setPreviewBust] = useState(0);
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const uploadMut = useUploadBookingAsset();
  const clearMut = useClearBookingAsset();

  useEffect(() => {
    if (!open) return;
    setCurrentUrl(approvedPdfUrlForDocStep(booking, sub, requirements) ?? '');
    setPreviewBust(0);
    setDragging(false);
  }, [open, booking, sub, requirements]);

  if (!open || !assetType) return null;

  const approvalAssetType: DocApprovalAssetType = assetType;
  const busy = isConfirming || uploadMut.isPending || clearMut.isPending;
  const hasApprovedFile = Boolean(currentUrl.trim());
  const description = hasApprovedFile
    ? 'Signed copy on file. Mark the step complete to continue.'
    : 'Upload the signed copy if it did not arrive by email.';

  async function handleUpload(file: File, type: DocApprovalAssetType) {
    try {
      const result = await uploadMut.mutateAsync({
        bookingId: booking.id,
        assetType: type,
        file,
      });
      setCurrentUrl(result.url);
      setPreviewBust(Date.now());
      window.requestAnimationFrame(() => confirmRef.current?.focus());
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

  function pickFile(file: File | undefined) {
    if (!file || busy) return;
    const ok = file.type === 'application/pdf' || file.type.startsWith('image/');
    if (!ok) {
      toast.error('Upload a PDF or image');
      return;
    }
    void handleUpload(file, approvalAssetType).catch(() => undefined);
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <ResponsiveModalContent
        disableDrag={busy}
        overlayClassName="z-[150]"
        className="z-[150] w-[min(calc(100vw-1.5rem),28rem)] max-w-none sm:max-w-[min(90vw,28rem)]"
      >
        <ResponsiveModalHeader className="space-y-0 text-left">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
              <FileCheck2 className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 pt-0.5">
              <ResponsiveModalTitle className="text-base font-semibold leading-snug sm:text-lg">
                {hasApprovedFile ? label : `Upload ${label}`}
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {description}
              </ResponsiveModalDescription>
            </div>
          </div>
        </ResponsiveModalHeader>

        {hasApprovedFile ? (
          <BookingCompactAssetControl
            label={uploadLabel}
            currentUrl={currentUrl}
            accept={ACCEPT}
            showLabel={false}
            disabled={busy}
            uploading={uploadMut.isPending}
            removing={clearMut.isPending}
            previewCacheBust={previewBust || undefined}
            onSelectFile={(file) => handleUpload(file, approvalAssetType)}
            onRemove={() => handleRemove(approvalAssetType)}
            onPreview={onPreview}
          />
        ) : (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setDragging(false);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              pickFile(event.dataTransfer.files?.[0]);
            }}
            className={cn(
              'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-7 text-center transition-colors',
              dragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/25'
            )}
          >
            <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-full">
              {uploadMut.isPending ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <UploadCloud className="size-5" aria-hidden />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-foreground text-sm font-medium">
                {uploadMut.isPending ? 'Uploading…' : 'Drop the signed copy here'}
              </p>
              <p className="text-muted-foreground text-xs">
                PDF or image, up to {formatUploadLimit('pdf')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="focus-ring border-border bg-card hover:bg-muted text-foreground mt-0.5 inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
            >
              Choose file
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(event) => {
                pickFile(event.target.files?.[0]);
                event.target.value = '';
              }}
              disabled={busy}
            />
          </div>
        )}

        <ResponsiveModalFooter className="gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="focus-ring border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => void onConfirm()}
            disabled={!hasApprovedFile || busy}
            aria-busy={isConfirming || undefined}
            className="gradient-primary text-primary-foreground shadow-soft hover:shadow-primary-glow focus-ring min-h-11 rounded-xl px-5 py-2 text-sm font-bold transition-all duration-200 hover:brightness-[1.03] disabled:opacity-50 motion-safe:active:scale-[0.98]"
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
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
