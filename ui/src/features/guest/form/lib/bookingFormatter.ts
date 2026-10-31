import type { BookingSource } from '@/features/guest/form/lib/bookingSourceFromSearchParams';
import { type GuestFormData } from '@/features/guest/form/schemas/guestFormSchema';

import { formatTimeToAMPM } from '@/utils/format/dates';

function clipboardGuestNameLabel(source: BookingSource): string {
  if (source === 'Airbnb') return 'Airbnb Name';
  if (source === 'Facebook') return 'Facebook Name';
  return 'Full Name';
}

/**
 * Formats booking data into a human-readable and parseable string format
 * that can be copied to clipboard and shared via messenger
 */
export function formatBookingInfoForClipboard(
  formData: GuestFormData,
  bookingId: string | null,
  bookingSource: BookingSource = 'Direct'
): string {
  const lines: string[] = [];

  lines.push('=== BOOKING INFORMATION ===');
  lines.push('');

  // Booking ID
  if (bookingId) {
    lines.push(`Booking ID: ${bookingId}`);
  }

  // Guest Information
  lines.push('--- Guest Information ---');
  lines.push(`${clipboardGuestNameLabel(bookingSource)}: ${formData.guestFacebookName || ''}`);
  lines.push(`Primary Guest: ${formData.primaryGuestName || ''}`);
  lines.push(`Email: ${formData.guestEmail || ''}`);
  lines.push(`Phone: ${formData.guestPhoneNumber || ''}`);
  lines.push(`Address: ${formData.guestAddress || ''}`);
  lines.push(`Nationality: ${formData.nationality || 'Filipino'}`);

  // Booking Details
  lines.push('');
  lines.push('--- Booking Details ---');
  lines.push(`Check-in Date: ${formData.checkInDate || ''}`);
  lines.push(
    `Check-in Time: ${formData.checkInTime ? formatTimeToAMPM(formData.checkInTime, true) : ''}`
  );
  lines.push(`Check-out Date: ${formData.checkOutDate || ''}`);
  lines.push(
    `Check-out Time: ${formData.checkOutTime ? formatTimeToAMPM(formData.checkOutTime, false) : ''}`
  );
  lines.push(`Number of Adults: ${formData.numberOfAdults || 0}`);
  lines.push(`Number of Children: ${formData.numberOfChildren || 0}`);

  // Additional Guests
  if (formData.guest2Name) {
    lines.push(`Guest 2 Name: ${formData.guest2Name}`);
  }
  if (formData.guest3Name) {
    lines.push(`Guest 3 Name: ${formData.guest3Name}`);
  }
  if (formData.guest4Name) {
    lines.push(`Guest 4 Name: ${formData.guest4Name}`);
  }

  lines.push('');
  lines.push('--- Surprise decor ---');
  lines.push(`Surprise decor requested: ${formData.guestRequestsSurpriseDecor ? 'Yes' : 'No'}`);

  // Parking Information
  lines.push('');
  lines.push('--- Parking Information ---');
  lines.push(`Need Parking: ${formData.needParking ? 'Yes' : 'No'}`);
  if (formData.needParking) {
    lines.push(`Car Plate Number: ${formData.carPlateNumber || ''}`);
    lines.push(`Car Brand/Model: ${formData.carBrandModel || ''}`);
    lines.push(`Car Color: ${formData.carColor || ''}`);
  }

  // Pet Information
  lines.push('');
  lines.push('--- Pet Information ---');
  lines.push(`Has Pets: ${formData.hasPets ? 'Yes' : 'No'}`);
  if (formData.hasPets) {
    lines.push(`Pet Name: ${formData.petName || ''}`);
    lines.push(`Pet Type: ${formData.petType || ''}`);
    lines.push(`Pet Breed: ${formData.petBreed || ''}`);
    lines.push(`Pet Age: ${formData.petAge || ''}`);
    lines.push(`Pet Vaccination Date: ${formData.petVaccinationDate || ''}`);
  }

  // Additional Information
  lines.push('');
  lines.push('--- Additional Information ---');
  lines.push(`How did you find us: ${formData.findUs || ''}`);
  if (formData.findUsDetails) {
    lines.push(`Find Us Details: ${formData.findUsDetails}`);
  }
  if (formData.guestSpecialRequests) {
    lines.push(`Special Requests: ${formData.guestSpecialRequests}`);
  }

  // Property Information
  lines.push('');
  lines.push('--- Property Information ---');
  lines.push(`Unit Owner: ${formData.unitOwner || ''}`);
  lines.push(`Tower/Unit Number: ${formData.towerAndUnitNumber || ''}`);
  lines.push(`Onsite Contact Person: ${formData.ownerOnsiteContactPerson || ''}`);
  lines.push(`Contact Number: ${formData.ownerContactNumber || ''}`);

  lines.push('');
  lines.push('=== END BOOKING INFORMATION ===');
  lines.push('');
  lines.push('Notes:');
  lines.push(
    '- File attachments (downpayment receipt, valid ID, pet documents) cannot be copied. Please keep them ready for resubmission.'
  );
  lines.push('- Please do not modify or edit any information to prevent any errors.');

  return lines.join('\n');
}

/**
 * Parses booking information from clipboard text and returns form data
 */
export function parseBookingInfoFromClipboard(
  clipboardText: string
): Partial<GuestFormData> | null {
  try {
    // Check if the text contains our booking information markers
    if (
      !clipboardText.includes('=== BOOKING INFORMATION ===') ||
      !clipboardText.includes('=== END BOOKING INFORMATION ===')
    ) {
      return null;
    }

    const formData: Partial<GuestFormData> = {};

    // Helper function to extract value from line
    const extractValue = (line: string): string => {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) return '';
      return line.substring(colonIndex + 1).trim();
    };

    // Split into lines and process
    const lines = clipboardText.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (
        !trimmedLine ||
        trimmedLine.startsWith('===') ||
        trimmedLine.startsWith('---') ||
        trimmedLine.startsWith('Note:')
      ) {
        continue;
      }

      // Parse each field
      if (
        trimmedLine.startsWith('Facebook/Airbnb Name:') ||
        trimmedLine.startsWith('Facebook Name:') ||
        trimmedLine.startsWith('Airbnb Name:') ||
        trimmedLine.startsWith('Full Name:')
      ) {
        formData.guestFacebookName = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Primary Guest:')) {
        formData.primaryGuestName = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Email:')) {
        formData.guestEmail = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Phone:')) {
        formData.guestPhoneNumber = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Address:')) {
        formData.guestAddress = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Nationality:')) {
        formData.nationality = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Check-in Date:')) {
        formData.checkInDate = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Check-in Time:')) {
        formData.checkInTime = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Check-out Date:')) {
        formData.checkOutDate = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Check-out Time:')) {
        formData.checkOutTime = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Number of Adults:')) {
        formData.numberOfAdults = parseInt(extractValue(trimmedLine)) || 1;
      } else if (trimmedLine.startsWith('Number of Children:')) {
        formData.numberOfChildren = parseInt(extractValue(trimmedLine)) || 0;
      } else if (trimmedLine.startsWith('Guest 2 Name:')) {
        formData.guest2Name = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Guest 3 Name:')) {
        formData.guest3Name = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Guest 4 Name:')) {
        formData.guest4Name = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Surprise decor requested:')) {
        const value = extractValue(trimmedLine).toLowerCase();
        formData.guestRequestsSurpriseDecor = value === 'yes' || value === 'true';
      } else if (trimmedLine.startsWith('Need Parking:')) {
        const value = extractValue(trimmedLine).toLowerCase();
        formData.needParking = value === 'yes' || value === 'true';
      } else if (trimmedLine.startsWith('Car Plate Number:')) {
        formData.carPlateNumber = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Car Brand/Model:')) {
        formData.carBrandModel = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Car Color:')) {
        formData.carColor = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Has Pets:')) {
        const value = extractValue(trimmedLine).toLowerCase();
        formData.hasPets = value === 'yes' || value === 'true';
      } else if (trimmedLine.startsWith('Pet Name:')) {
        formData.petName = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Pet Type:')) {
        formData.petType = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Pet Breed:')) {
        formData.petBreed = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Pet Age:')) {
        formData.petAge = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Pet Vaccination Date:')) {
        formData.petVaccinationDate = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('How did you find us:')) {
        formData.findUs = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Find Us Details:')) {
        formData.findUsDetails = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Special Requests:')) {
        formData.guestSpecialRequests = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Unit Owner:')) {
        formData.unitOwner = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Tower/Unit Number:')) {
        formData.towerAndUnitNumber = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Onsite Contact Person:')) {
        formData.ownerOnsiteContactPerson = extractValue(trimmedLine);
      } else if (trimmedLine.startsWith('Contact Number:')) {
        formData.ownerContactNumber = extractValue(trimmedLine);
      }
    }

    // Only return if we parsed at least some essential fields
    if (formData.guestFacebookName || formData.primaryGuestName || formData.guestEmail) {
      return formData;
    }

    return null;
  } catch (error) {
    console.error('Error parsing booking info from clipboard:', error);
    return null;
  }
}
