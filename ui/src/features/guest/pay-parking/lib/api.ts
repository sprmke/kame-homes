import {
  guestPayParkingPath,
  type GuestPayParkingPathOptions,
} from '@/features/guest/lib/guestPublicPaths';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function fnHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    apikey: ANON,
    Authorization: `Bearer ${ANON}`,
  };
}

export type PayParkingBootstrap = {
  bookingId: string;
  property_slug?: string;
  primary_guest_name: string;
  guest_facebook_name: string;
  check_in_date: string;
  check_out_date: string;
  check_in_time: string;
  check_out_time: string;
  number_of_nights: number;
  number_of_adults: number;
  number_of_children: number;
  pax: number;
  parking_rate_guest: number;
  parking_check_in_date: string;
  parking_check_out_date: string;
  number_of_parking_nights: number;
  car_plate_number: string;
  car_brand_model: string;
  car_color: string;
  already_submitted: boolean;
  status: string;
  email_logo_url?: string;
  brand_color?: string;
  /** Marketplace parking booking linked to this property stay (Phase pay-parking connect). */
  linked_parking_booking_id?: string | null;
  /** Optional city slug for `/parkings/in/:location?linkStay=…`. */
  city_location_slug?: string | null;
  /** Org-owned available parking slug when the property host also lists parking. */
  owner_default_parking_slug?: string | null;
  owner_default_check_in?: string | null;
  owner_default_check_out?: string | null;
};

export async function fetchPayParking(bookingId: string): Promise<PayParkingBootstrap> {
  const url = `${FUNCTIONS_URL}/get-pay-parking?bookingId=${encodeURIComponent(bookingId)}`;
  const res = await fetch(url, { headers: fnHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success || !json.data) {
    const msg =
      json.message ??
      json.error ??
      'This form is not available. Please contact your host if you need help.';
    throw new Error(typeof msg === 'string' ? msg : 'Form unavailable');
  }
  return json.data as PayParkingBootstrap;
}

export type BuildPayParkingPathOptions = GuestPayParkingPathOptions;

export function buildPayParkingPath(
  propertySlug: string,
  bookingId: string,
  options: BuildPayParkingPathOptions = {}
): string {
  return guestPayParkingPath(propertySlug, bookingId, options);
}

export function buildPayParkingAbsoluteUrl(
  propertySlug: string,
  bookingId: string,
  options: BuildPayParkingPathOptions = {}
): string {
  return `${window.location.origin}${buildPayParkingPath(propertySlug, bookingId, options)}`;
}
