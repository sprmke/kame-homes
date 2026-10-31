/**
 * useUploadBookingAsset — mutation to upload/replace a booking document.
 *
 * Calls the `upload-booking-asset` edge function (multipart/form-data).
 * On success the edge function writes the new public URL to the DB column
 * and returns it; we then invalidate the booking cache so the UI refreshes.
 *
 * Supported assetTypes:
 *   Workflow:  parking_endorsement | parking_payment_receipt | approved_gaf | approved_pet | sd_refund_receipt
 *              | guest_balance_payment_receipt
 *   Guest docs: valid_id | payment_receipt (downpayment) | pet_vaccination | pet_image
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import type { OptimizePreset } from '@/lib/media/imageOptimizationPlan';
import { prepareUpload } from '@/lib/media/prepareUpload';
import { supabase } from '@/lib/supabase/client';

import { BOOKING_QUERY_KEY } from './useBooking';
import { invalidateBookingAiReviewQueries } from './useBookingAiReview';
import { BOOKINGS_QUERY_KEY } from './useBookings';

export type GuestDocAssetType =
  | 'valid_id'
  | 'guest2_valid_id'
  | 'guest3_valid_id'
  | 'guest4_valid_id'
  | 'guest5_valid_id'
  | 'payment_receipt'
  | 'pet_vaccination'
  | 'pet_image';

export type WorkflowAssetType =
  | 'parking_endorsement'
  | 'parking_payment_receipt'
  | 'approved_gaf'
  | 'approved_pet'
  | 'sd_refund_receipt'
  | 'guest_balance_payment_receipt';

export type AssetType = GuestDocAssetType | WorkflowAssetType;

type UploadAssetResult = {
  url: string;
  bucket: string;
  path: string;
  column: string;
  receiptValidation?: {
    verdict: string;
    confidence: number | null;
    summary: string;
    has_amount: boolean;
    has_date: boolean;
    has_reference: boolean;
    aiModelError?: string;
  } | null;
};

async function getAdminJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

/**
 * Only the pet photo is decorative. Every other booking asset (valid IDs,
 * receipts, GAF, vaccination records) must stay pixel-faithful for AI receipt
 * validation and manual approval, so it goes through the near-lossless
 * DOCUMENT preset.
 */
function presetForAsset(assetType: AssetType): OptimizePreset {
  return assetType === 'pet_image' ? 'CONTENT' : 'DOCUMENT';
}

type UploadArgs = {
  bookingId: string;
  assetType: AssetType;
  file: File;
};

export function useUploadBookingAsset() {
  const qc = useQueryClient();
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: async ({
      bookingId,
      assetType,
      file: rawFile,
    }: UploadArgs): Promise<UploadAssetResult> => {
      const prepared = await prepareUpload(rawFile, {
        imagePreset: presetForAsset(assetType),
        surface: `booking-asset-${assetType}`,
      });
      if (prepared.error) throw new Error(prepared.error);
      const file = prepared.file;

      const jwt = await getAdminJwt();

      // Build a predictable, collision-free storage key:
      // <bookingId>/<assetType>.<originalExtension>
      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
      const storageName = `${assetType}${ext}`;

      const body = new FormData();
      body.append('bookingId', bookingId);
      body.append('assetType', assetType);
      body.append('file', file);
      body.append('fileName', storageName);

      const res = await fetch(scopedFunctionsUrl('/upload-booking-asset', propertyId), {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      return json.data as UploadAssetResult;
    },

    onSuccess: async (_, { bookingId }) => {
      // Refresh the booking detail so the new URL renders immediately
      await qc.invalidateQueries({ queryKey: BOOKING_QUERY_KEY(bookingId) });
      await qc.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
      await invalidateBookingAiReviewQueries(qc, bookingId);
    },
  });
}
