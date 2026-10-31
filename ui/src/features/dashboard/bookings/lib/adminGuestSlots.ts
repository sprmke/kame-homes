import type { GuestDocAssetType } from '@/features/dashboard/bookings/hooks/useUploadBookingAsset';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

const ADMIN_GUEST_SLOT_LABELS = ['Primary', 'Second', 'Third', 'Fourth', 'Fifth'] as const;

export type AdminGuestViewSlot = {
  index: number;
  label: (typeof ADMIN_GUEST_SLOT_LABELS)[number];
  nameKey: keyof Pick<
    BookingRow,
    'primary_guest_name' | 'guest2_name' | 'guest3_name' | 'guest4_name' | 'guest5_name'
  >;
  ageKey: keyof Pick<
    BookingRow,
    'primary_guest_age' | 'guest2_age' | 'guest3_age' | 'guest4_age' | 'guest5_age'
  >;
  validIdUrlKey: keyof Pick<
    BookingRow,
    | 'valid_id_url'
    | 'guest2_valid_id_url'
    | 'guest3_valid_id_url'
    | 'guest4_valid_id_url'
    | 'guest5_valid_id_url'
  >;
  validIdAiVerdictKey?: keyof Pick<
    BookingRow,
    | 'valid_id_ai_verdict'
    | 'guest2_valid_id_ai_verdict'
    | 'guest3_valid_id_ai_verdict'
    | 'guest4_valid_id_ai_verdict'
    | 'guest5_valid_id_ai_verdict'
  >;
  validIdAiSummaryKey?: keyof Pick<
    BookingRow,
    | 'valid_id_ai_summary'
    | 'guest2_valid_id_ai_summary'
    | 'guest3_valid_id_ai_summary'
    | 'guest4_valid_id_ai_summary'
    | 'guest5_valid_id_ai_summary'
  >;
  validIdAssetType: GuestDocAssetType;
};

export const ADMIN_GUEST_VIEW_SLOTS: AdminGuestViewSlot[] = [
  {
    index: 1,
    label: 'Primary',
    nameKey: 'primary_guest_name',
    ageKey: 'primary_guest_age',
    validIdUrlKey: 'valid_id_url',
    validIdAiVerdictKey: 'valid_id_ai_verdict',
    validIdAiSummaryKey: 'valid_id_ai_summary',
    validIdAssetType: 'valid_id',
  },
  {
    index: 2,
    label: 'Second',
    nameKey: 'guest2_name',
    ageKey: 'guest2_age',
    validIdUrlKey: 'guest2_valid_id_url',
    validIdAiVerdictKey: 'guest2_valid_id_ai_verdict',
    validIdAiSummaryKey: 'guest2_valid_id_ai_summary',
    validIdAssetType: 'guest2_valid_id',
  },
  {
    index: 3,
    label: 'Third',
    nameKey: 'guest3_name',
    ageKey: 'guest3_age',
    validIdUrlKey: 'guest3_valid_id_url',
    validIdAiVerdictKey: 'guest3_valid_id_ai_verdict',
    validIdAiSummaryKey: 'guest3_valid_id_ai_summary',
    validIdAssetType: 'guest3_valid_id',
  },
  {
    index: 4,
    label: 'Fourth',
    nameKey: 'guest4_name',
    ageKey: 'guest4_age',
    validIdUrlKey: 'guest4_valid_id_url',
    validIdAiVerdictKey: 'guest4_valid_id_ai_verdict',
    validIdAiSummaryKey: 'guest4_valid_id_ai_summary',
    validIdAssetType: 'guest4_valid_id',
  },
  {
    index: 5,
    label: 'Fifth',
    nameKey: 'guest5_name',
    ageKey: 'guest5_age',
    validIdUrlKey: 'guest5_valid_id_url',
    validIdAiVerdictKey: 'guest5_valid_id_ai_verdict',
    validIdAiSummaryKey: 'guest5_valid_id_ai_summary',
    validIdAssetType: 'guest5_valid_id',
  },
];

export function shouldShowAdminGuestViewSlot(
  slot: AdminGuestViewSlot,
  booking: BookingRow
): boolean {
  if (slot.index === 1) return true;
  const name = booking[slot.nameKey]?.trim();
  const age = booking[slot.ageKey];
  return Boolean(name || age != null);
}
