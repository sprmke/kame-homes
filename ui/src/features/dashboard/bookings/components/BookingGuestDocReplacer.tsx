/**
 * Self-managed guest-document replace control for booking edit
 * (Valid ID, downpayment receipt, pet files). UI matches Progress rail
 * via `BookingCompactAssetControl`.
 */

import { toast } from 'sonner';

import { BookingCompactAssetControl } from '@/features/dashboard/bookings/components/BookingCompactAssetControl';
import {
  receiptAiUploadToastMessage,
  showDocumentAiModelErrorToast,
} from '@/features/dashboard/bookings/components/ReceiptAiVerdictBadge';
import { useClearBookingAsset } from '@/features/dashboard/bookings/hooks/useClearBookingAsset';
import {
  useUploadBookingAsset,
  type GuestDocAssetType,
} from '@/features/dashboard/bookings/hooks/useUploadBookingAsset';

export type BookingGuestDocDef = {
  assetType: GuestDocAssetType;
  label: string;
  currentUrl: string | null | undefined;
  accept: string;
};

function isValidIdAssetType(assetType: GuestDocAssetType): boolean {
  return (
    assetType === 'valid_id' ||
    assetType === 'guest2_valid_id' ||
    assetType === 'guest3_valid_id' ||
    assetType === 'guest4_valid_id' ||
    assetType === 'guest5_valid_id'
  );
}

export function BookingGuestDocReplacer({
  bookingId,
  assetType,
  label,
  currentUrl,
  accept,
  onPreview,
}: BookingGuestDocDef & {
  bookingId: string;
  onPreview: (label: string, rawUrl: string) => void | Promise<void>;
}) {
  const uploadMut = useUploadBookingAsset();
  const clearAssetMut = useClearBookingAsset();

  async function handleSelectFile(file: File) {
    try {
      const result = await uploadMut.mutateAsync({ bookingId, assetType, file });
      const validation = result.receiptValidation;
      if (validation && isValidIdAssetType(assetType)) {
        if (validation.aiModelError) {
          showDocumentAiModelErrorToast(validation.aiModelError);
        } else {
          const toastMsg = receiptAiUploadToastMessage(validation.verdict, 'valid_id');
          if (toastMsg?.type === 'error') {
            toast.error(toastMsg.message, { description: toastMsg.description });
          } else if (toastMsg?.type === 'warning') {
            toast.warning(toastMsg.message);
          } else if (toastMsg?.type === 'success') {
            toast.success(toastMsg.message);
          } else {
            toast.success(`${label} replaced`);
          }
        }
      } else {
        toast.success(`${label} replaced`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Failed to upload ${label}`);
      throw err;
    }
  }

  async function handleRemove() {
    try {
      await clearAssetMut.mutateAsync({ bookingId, assetType });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Failed to remove ${label}`);
      throw err;
    }
  }

  return (
    <BookingCompactAssetControl
      label={label}
      currentUrl={currentUrl}
      accept={accept}
      uploading={uploadMut.isPending}
      removing={clearAssetMut.isPending}
      onSelectFile={handleSelectFile}
      onRemove={handleRemove}
      onPreview={onPreview}
    />
  );
}
