import dayjs from 'dayjs';

import { computeGuestCounts } from '@/features/guest/form/lib/guestCounts';
import { type GuestFormData } from '@/features/guest/form/schemas/guestFormSchema';

import {
  DEFAULT_GAF_DETAILS,
  gafDetailsToFormSubmitFields,
  type GafDetailsValues,
} from '@/features/dashboard/bookings/lib/gafDefaults';

import { formatDateToMMDDYYYY, formatTimeToAMPM } from '@/utils/format/dates';

export const toCapitalCase = (text: string): string => {
  if (!text) return text;
  return text
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Helper to handle empty strings
const handleEmptyString = (value: string | undefined): string | undefined => {
  if (!value || value.trim() === '') return undefined;
  return value;
};

export const transformFieldValues = (
  values: GuestFormData,
  gafDetails: GafDetailsValues = DEFAULT_GAF_DETAILS
) => {
  // Calculate number of nights
  const checkIn = dayjs(values.checkInDate);
  const checkOut = dayjs(values.checkOutDate);
  const numberOfNights = Math.ceil(
    (checkOut.valueOf() - checkIn.valueOf()) / (1000 * 60 * 60 * 24)
  );
  const useStayParkingDates =
    !values.needParking || numberOfNights <= 1 || values.parkingSameAsBookingDuration !== false;

  const guestCounts = computeGuestCounts([
    { name: values.primaryGuestName, age: values.primaryGuestAge },
    { name: values.guest2Name, age: values.guest2Age },
    { name: values.guest3Name, age: values.guest3Age },
    { name: values.guest4Name, age: values.guest4Age },
    { name: values.guest5Name, age: values.guest5Age },
  ]);

  return {
    ...values,
    // Unit and Owner Information (from Settings → GAF Details)
    ...gafDetailsToFormSubmitFields(gafDetails),

    // Primary Guest Information
    guestFacebookName: toCapitalCase(values.guestFacebookName),
    primaryGuestName: toCapitalCase(values.primaryGuestName),
    guestEmail: values.guestEmail,
    guestPhoneNumber: values.guestPhoneNumber,
    guestAddress: toCapitalCase(values.guestAddress),
    nationality: toCapitalCase(values.nationality || 'Filipino'),

    // Check-in/out Information
    checkInDate: formatDateToMMDDYYYY(values.checkInDate),
    checkOutDate: formatDateToMMDDYYYY(values.checkOutDate),
    checkInTime: formatTimeToAMPM(values.checkInTime, true),
    checkOutTime: formatTimeToAMPM(values.checkOutTime, false),
    numberOfNights: numberOfNights,

    // Guest Count (derived from per-guest ages)
    numberOfAdults: guestCounts.adults,
    numberOfChildren: guestCounts.children,
    primaryGuestAge: values.primaryGuestAge,

    // Additional Guests
    guest2Name: handleEmptyString(values.guest2Name ? toCapitalCase(values.guest2Name) : undefined),
    guest2Age: values.guest2Name?.trim() ? values.guest2Age : undefined,
    guest3Name: handleEmptyString(values.guest3Name ? toCapitalCase(values.guest3Name) : undefined),
    guest3Age: values.guest3Name?.trim() ? values.guest3Age : undefined,
    guest4Name: handleEmptyString(values.guest4Name ? toCapitalCase(values.guest4Name) : undefined),
    guest4Age: values.guest4Name?.trim() ? values.guest4Age : undefined,
    guest5Name: handleEmptyString(values.guest5Name ? toCapitalCase(values.guest5Name) : undefined),
    guest5Age: values.guest5Name?.trim() ? values.guest5Age : undefined,

    // Parking Information
    carPlateNumber: values.needParking ? handleEmptyString(values.carPlateNumber) : undefined,
    carBrandModel: values.needParking
      ? handleEmptyString(values.carBrandModel ? toCapitalCase(values.carBrandModel) : undefined)
      : undefined,
    carColor: values.needParking
      ? handleEmptyString(values.carColor ? toCapitalCase(values.carColor) : undefined)
      : undefined,
    parkingCheckInDate: values.needParking
      ? formatDateToMMDDYYYY(
          useStayParkingDates
            ? values.checkInDate
            : (values.parkingCheckInDate ?? values.checkInDate)
        )
      : undefined,
    parkingCheckOutDate: values.needParking
      ? formatDateToMMDDYYYY(
          useStayParkingDates
            ? values.checkOutDate
            : (values.parkingCheckOutDate ?? values.checkOutDate)
        )
      : undefined,

    // Pet Information
    petName: values.hasPets
      ? handleEmptyString(values.petName ? toCapitalCase(values.petName) : undefined)
      : undefined,
    petBreed: values.hasPets
      ? handleEmptyString(values.petBreed ? toCapitalCase(values.petBreed) : undefined)
      : undefined,
    petAge: values.hasPets ? handleEmptyString(values.petAge) : undefined,
    petVaccinationDate: values.hasPets
      ? values.petVaccinationDate
        ? formatDateToMMDDYYYY(values.petVaccinationDate)
        : undefined
      : undefined,

    // Other Information
    findUs: values.findUs,
    findUsDetails: handleEmptyString(
      values.findUsDetails ? toCapitalCase(values.findUsDetails) : undefined
    ),
    guestSpecialRequests: handleEmptyString(values.guestSpecialRequests),
  };
};
