/**
 * Booking asset type catalog and permission map.
 * Kept separate from `bookingAssetUpload.ts` so validators can import it
 * without loading storage / AI / Telegram at module init.
 */

export const BOOKING_ASSET_CONFIG = {
  parking_endorsement: {
    bucket: 'parking-endorsements',
    column: 'parking_endorsement_url',
  },
  parking_payment_receipt: {
    bucket: 'payment-receipts',
    column: 'parking_payment_receipt_url',
  },
  approved_gaf: {
    bucket: 'approved-gafs',
    column: 'approved_gaf_pdf_url',
  },
  approved_pet: {
    bucket: 'approved-pet-forms',
    column: 'approved_pet_pdf_url',
  },
  sd_refund_receipt: {
    bucket: 'sd-refund-receipts',
    column: 'sd_refund_receipt_url',
  },
  guest_balance_payment_receipt: {
    bucket: 'sd-refund-receipts',
    column: 'guest_balance_payment_receipt_url',
  },
  valid_id: {
    bucket: 'valid-ids',
    column: 'valid_id_url',
  },
  guest2_valid_id: {
    bucket: 'valid-ids',
    column: 'guest2_valid_id_url',
  },
  guest3_valid_id: {
    bucket: 'valid-ids',
    column: 'guest3_valid_id_url',
  },
  guest4_valid_id: {
    bucket: 'valid-ids',
    column: 'guest4_valid_id_url',
  },
  guest5_valid_id: {
    bucket: 'valid-ids',
    column: 'guest5_valid_id_url',
  },
  payment_receipt: {
    bucket: 'payment-receipts',
    column: 'payment_receipt_url',
  },
  pet_vaccination: {
    bucket: 'pet-vaccinations',
    column: 'pet_vaccination_url',
  },
  pet_image: {
    bucket: 'pet-images',
    column: 'pet_image_url',
  },
} as const;

export type BookingAssetType = keyof typeof BOOKING_ASSET_CONFIG;

export const BOOKING_ASSET_TYPES = Object.keys(BOOKING_ASSET_CONFIG) as BookingAssetType[];

export const BOOKING_ASSET_LABELS: Record<BookingAssetType, string> = {
  parking_endorsement: 'Parking endorsement',
  parking_payment_receipt: 'Parking payment receipt',
  approved_gaf: 'Approved GAF',
  approved_pet: 'Approved pet form',
  sd_refund_receipt: 'SD refund receipt',
  guest_balance_payment_receipt: 'Guest balance payment receipt',
  valid_id: 'Valid ID',
  guest2_valid_id: 'Guest 2 valid ID',
  guest3_valid_id: 'Guest 3 valid ID',
  guest4_valid_id: 'Guest 4 valid ID',
  guest5_valid_id: 'Guest 5 valid ID',
  payment_receipt: 'Downpayment receipt',
  pet_vaccination: 'Pet vaccination',
  pet_image: 'Pet photo',
};

export function isBookingAssetType(value: unknown): value is BookingAssetType {
  return typeof value === 'string' && value in BOOKING_ASSET_CONFIG;
}

export function bookingAssetPermission(
  assetType: BookingAssetType
):
  | 'bookings.detail.workflow:edit'
  | 'bookings.detail.guests:edit'
  | 'bookings.detail.pets:edit'
  | 'bookings.detail.pricing:edit'
  | 'bookings.detail.stay:edit' {
  if (
    assetType === 'parking_endorsement' ||
    assetType === 'parking_payment_receipt' ||
    assetType === 'approved_gaf' ||
    assetType === 'approved_pet' ||
    assetType === 'sd_refund_receipt' ||
    assetType === 'guest_balance_payment_receipt'
  ) {
    return 'bookings.detail.workflow:edit';
  }
  if (
    assetType === 'valid_id' ||
    assetType === 'guest2_valid_id' ||
    assetType === 'guest3_valid_id' ||
    assetType === 'guest4_valid_id' ||
    assetType === 'guest5_valid_id'
  ) {
    return 'bookings.detail.guests:edit';
  }
  if (assetType === 'pet_vaccination' || assetType === 'pet_image') {
    return 'bookings.detail.pets:edit';
  }
  if (assetType === 'payment_receipt') {
    return 'bookings.detail.pricing:edit';
  }
  return 'bookings.detail.stay:edit';
}
