import type { GuestDocAssetType } from '@/features/dashboard/bookings/hooks/useUploadBookingAsset';

/** Shared date-picker input styling for the edit tabs (Stay + Pet vaccination date). */
export const bookingEditDatePickerClass =
  'h-11 border border-border/70 bg-card font-medium hover:border-primary/30 field-focus';

export type BookingEditFormValues = {
  booking_source: string;
  guest_facebook_name: string;
  primary_guest_name: string;
  guest_email: string;
  guest_phone_number: string;
  guest_address: string;
  nationality: string;
  primary_guest_age: number | '';
  guest2_name: string;
  guest2_age: number | '';
  guest3_name: string;
  guest3_age: number | '';
  guest4_name: string;
  guest4_age: number | '';
  guest5_name: string;
  guest5_age: number | '';
  check_in_date: string;
  check_out_date: string;
  check_in_time: string;
  check_out_time: string;
  number_of_adults: number;
  number_of_children: number;
  number_of_nights: number;
  need_parking: boolean;
  car_plate_number: string;
  car_brand_model: string;
  car_color: string;
  has_pets: boolean;
  pet_name: string;
  pet_type: string;
  pet_breed: string;
  pet_age: string;
  pet_vaccination_date: string;
  find_us: string;
  find_us_details: string;
  guest_special_requests: string;
  guest_requests_surprise_decor: boolean;
};

export type AdditionalGuestSlotConfig = {
  partyPosition: number;
  nameField: 'guest2_name' | 'guest3_name' | 'guest4_name' | 'guest5_name';
  ageField: 'guest2_age' | 'guest3_age' | 'guest4_age' | 'guest5_age';
  validIdUrlKey:
    'guest2_valid_id_url' | 'guest3_valid_id_url' | 'guest4_valid_id_url' | 'guest5_valid_id_url';
  assetType: GuestDocAssetType;
};
