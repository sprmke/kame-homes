import { useQuery } from '@tanstack/react-query';

import {
  GUEST_FORM_DEFAULT_CHECK_IN_TIME,
  GUEST_FORM_DEFAULT_CHECK_OUT_TIME,
} from '@/features/guest/form/lib/guestFormPropertyDefaults';
import { useGuestPropertySlug } from '@/features/guest/hooks/useGuestPropertySlug';

import { DEFAULT_CLEANING_BUFFER_MINUTES } from '@/lib/cleaningBuffer';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;

export type GuestPaymentMethod = {
  id: string;
  provider: string;
  accountName: string;
  accountNumber: string;
  qrImageUrl: string | null;
  isPrimary: boolean;
};

export type GuestPaymentInfo = {
  gcashName: string;
  gcashNumber: string;
  gcashQrImageUrl: string;
  paymentProvider: string;
  paymentMethods: GuestPaymentMethod[];
  emailLogoUrl: string;
  brandColor: string;
  gafUnitOwner: string;
  gafTowerAndUnitNumber: string;
  gafGuestsOnsiteContactPerson: string;
  gafOwnerContactNumber: string;
  allowPets: boolean;
  allowParking: boolean;
  allowSurpriseDecor: boolean;
  checkInTime: string;
  checkOutTime: string;
  /** Required minutes between a checkout and the next check-in on a same-day turnover (min 1 hour). */
  cleaningBufferMinutes: number;
  maxAdults: number;
  maxChildren: number;
  propertyName: string;
  propertyEyebrow: string;
  propertyCoverImageUrl: string | null;
  residenceName: string | null;
  organizationName: string;
  defaultParkingRateGuest: number;
  petFee: number;
  /** Property Default down payment (flat, per booking). */
  downPayment: number;
};

export const DEFAULT_GUEST_PAYMENT_INFO: GuestPaymentInfo = {
  gcashName: '',
  gcashNumber: '',
  gcashQrImageUrl: '',
  paymentProvider: 'GCash',
  paymentMethods: [],
  emailLogoUrl: '/images/logo.png',
  brandColor: '#24a88e',
  gafUnitOwner: '',
  gafTowerAndUnitNumber: '',
  gafGuestsOnsiteContactPerson: '',
  gafOwnerContactNumber: '',
  allowPets: true,
  allowParking: true,
  allowSurpriseDecor: true,
  checkInTime: GUEST_FORM_DEFAULT_CHECK_IN_TIME,
  checkOutTime: GUEST_FORM_DEFAULT_CHECK_OUT_TIME,
  cleaningBufferMinutes: DEFAULT_CLEANING_BUFFER_MINUTES,
  maxAdults: 4,
  maxChildren: 1,
  propertyName: '',
  propertyEyebrow: '',
  propertyCoverImageUrl: null,
  residenceName: null,
  organizationName: '',
  defaultParkingRateGuest: 400,
  petFee: 300,
  downPayment: 1500,
};

function guestPaymentInfoUrl(propertySlug: string | null): string {
  const base = `${FUNCTIONS_URL}/get-guest-payment-info`;
  if (!propertySlug) return base;
  return `${base}?property=${encodeURIComponent(propertySlug)}`;
}

export function useGuestPaymentInfo() {
  const propertySlug = useGuestPropertySlug() || null;

  return useQuery({
    queryKey: ['guest-payment-info', propertySlug],
    queryFn: async (): Promise<GuestPaymentInfo> => {
      const res = await fetch(guestPaymentInfoUrl(propertySlug));
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: GuestPaymentInfo;
      };
      if (!json.success || !json.data) {
        throw new Error(json.error ?? 'Failed to load payment info');
      }
      return json.data;
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: DEFAULT_GUEST_PAYMENT_INFO,
  });
}
