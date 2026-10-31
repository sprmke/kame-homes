import type { AssetType } from '@/features/dashboard/bookings/hooks/useUploadBookingAsset';

const URL_COLUMN: Record<AssetType, string> = {
  parking_endorsement: 'parking_endorsement_url',
  parking_payment_receipt: 'parking_payment_receipt_url',
  approved_gaf: 'approved_gaf_pdf_url',
  approved_pet: 'approved_pet_pdf_url',
  sd_refund_receipt: 'sd_refund_receipt_url',
  guest_balance_payment_receipt: 'guest_balance_payment_receipt_url',
  valid_id: 'valid_id_url',
  guest2_valid_id: 'guest2_valid_id_url',
  guest3_valid_id: 'guest3_valid_id_url',
  guest4_valid_id: 'guest4_valid_id_url',
  guest5_valid_id: 'guest5_valid_id_url',
  payment_receipt: 'payment_receipt_url',
  pet_vaccination: 'pet_vaccination_url',
  pet_image: 'pet_image_url',
};

const AI_COLUMNS: Partial<Record<AssetType, { verdict: string; summary: string }>> = {
  payment_receipt: {
    verdict: 'dp_receipt_ai_verdict',
    summary: 'dp_receipt_ai_summary',
  },
  guest_balance_payment_receipt: {
    verdict: 'balance_receipt_ai_verdict',
    summary: 'balance_receipt_ai_summary',
  },
  parking_payment_receipt: {
    verdict: 'parking_receipt_ai_verdict',
    summary: 'parking_receipt_ai_summary',
  },
  valid_id: {
    verdict: 'valid_id_ai_verdict',
    summary: 'valid_id_ai_summary',
  },
  guest2_valid_id: {
    verdict: 'guest2_valid_id_ai_verdict',
    summary: 'guest2_valid_id_ai_summary',
  },
  guest3_valid_id: {
    verdict: 'guest3_valid_id_ai_verdict',
    summary: 'guest3_valid_id_ai_summary',
  },
  guest4_valid_id: {
    verdict: 'guest4_valid_id_ai_verdict',
    summary: 'guest4_valid_id_ai_summary',
  },
  guest5_valid_id: {
    verdict: 'guest5_valid_id_ai_verdict',
    summary: 'guest5_valid_id_ai_summary',
  },
};

/** DB patch to clear a booking asset URL and related AI verdict columns. */
export function bookingAssetClearPatch(assetType: AssetType): Record<string, null> {
  const patch: Record<string, null> = {
    [URL_COLUMN[assetType]]: null,
  };
  const ai = AI_COLUMNS[assetType];
  if (ai) {
    patch[ai.verdict] = null;
    patch[ai.summary] = null;
  }
  return patch;
}
