import dayjs from 'dayjs';
import customParseFormat from 'npm:dayjs@1.11.10/plugin/customParseFormat.js';

dayjs.extend(customParseFormat);

/** Copy bytes into an ArrayBuffer-backed Uint8Array for Blob/File/upload APIs. */
export function copyBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Uint8Array(buffer);
}

/**
 * Normalizes MM-DD-YYYY (DB) or YYYY-MM-DD (guest form) to YYYY-MM-DD for APIs.
 */
export const normalizeDateToYYYYMMDD = (dateStr: string): string => {
  if (!dateStr?.trim()) return '';
  const s = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const mdy = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mdy) {
    const [, month, day, year] = mdy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const parsed = dayjs(s);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
};

/**
 * Formats a date string to YYYY-MM-DD format
 * @param dateStr - The date string to format
 * @returns Formatted date string or empty string if invalid
 */
export const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  const parsed = dayjs(dateStr);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
};

/**
 * Formats dates for guest-facing email copy (e.g. "Jun 13, 2026").
 * Accepts MM-DD-YYYY (DB), YYYY-MM-DD, or parseable date strings.
 */
export const formatDateForEmail = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';

  const normalized = normalizeDateToYYYYMMDD(dateStr);
  const parsed = normalized ? dayjs(normalized, 'YYYY-MM-DD', true) : dayjs(dateStr);

  return parsed.isValid() ? parsed.format('MMM D, YYYY') : String(dateStr);
};

/** Whole-night count between check-in and check-out (exclusive of checkout night). */
export function countStayNights(checkInDate: string, checkOutDate: string): number {
  const ci = normalizeDateToYYYYMMDD(checkInDate);
  const co = normalizeDateToYYYYMMDD(checkOutDate);
  if (!ci || !co) return 0;
  const d = dayjs(co, 'YYYY-MM-DD', true).diff(dayjs(ci, 'YYYY-MM-DD', true), 'day');
  return Math.max(0, d);
}

/** Formats a time string to 24-hour HH:mm (parses 12-hour AM/PM before bare H:mm). */
export const formatTime = (timeStr: string | null | undefined): string => {
  if (!timeStr) return '';
  let s = timeStr.trim();
  if (!s) return '';

  const ampm = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])$/);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = ampm[2];
    const meridiem = ampm[4].toUpperCase();
    if (meridiem === 'AM' && h === 12) h = 0;
    else if (meridiem === 'PM' && h !== 12) h += 12;
    return `${String(h).padStart(2, '0')}:${m}`;
  }

  // Postgres TIME may include fractional seconds or a trailing offset.
  s = s
    .replace(/\.\d+(?=[\s+-]|Z|$)/i, '')
    .replace(/[+-]\d{2}(?::?\d{2})?\s*$|Z\s*$/i, '')
    .trim();

  for (const format of ['HH:mm:ss', 'HH:mm', 'H:mm'] as const) {
    const parsed = dayjs(s, format, true);
    if (parsed.isValid()) return parsed.format('HH:mm');
  }
  return '';
};

/** User-facing 12-hour time (e.g. `2:00 PM`). DB stores 24h `HH:mm`. */
export const formatTimeForDisplay = (timeStr: string | null | undefined, fallback = ''): string => {
  const hm24 = formatTime(timeStr);
  if (!hm24) return fallback;
  // Match UI `formatTimeToAMPM`: anchor on a fixed date; do not parse with `HH:mm` only.
  const parsed = dayjs(`2000-01-01T${hm24}`);
  return parsed.isValid() ? parsed.format('h:mm A') : fallback;
};

/**
 * Default check-in time (14:00 / 2 PM)
 */
export const DEFAULT_CHECK_IN_TIME = '14:00';

/**
 * Default check-out time (11:00 / 11 AM)
 */
export const DEFAULT_CHECK_OUT_TIME = '11:00';

/**
 * Extracts a route parameter from a URL path
 * @param pathname - The URL pathname
 * @param routePattern - The route pattern to match (e.g., '/submit-form/')
 * @returns The extracted parameter or null if not found
 */
export const extractRouteParam = (pathname: string, routePattern: string): string | null => {
  // Escape special regex characters in the route pattern
  const escapedPattern = routePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Create a regex pattern that matches the route followed by a parameter
  const regex = new RegExp(`${escapedPattern}([^\\/\\?]+)`);
  const match = pathname.match(regex);
  return match && match[1] ? match[1] : null;
};

// Format URLs so browsers can load them (edge getPublicUrl often uses internal Kong host).
export const formatPublicUrl = (url: string) => {
  if (!url) return '';
  return url
    .replace(/^http:\/\/kong:8000\b/, 'http://127.0.0.1:54321')
    .replace(/^https:\/\/kong:8000\b/, 'https://127.0.0.1:54321')
    .replace(/^http:\/\/supabase_kong_[^/:]+:8000\b/, 'http://127.0.0.1:54321');
};

/**
 * Checks if the application is running in development mode
 * @returns true if in development mode, false otherwise
 */
const isDevelopment = (): boolean => {
  const env = Deno.env.get('ENVIRONMENT') || Deno.env.get('DENO_ENV') || 'development';
  return env !== 'production';
};

/**
 * Normalizes a value for comparison
 * - Converts empty strings to undefined
 * - Trims strings
 * - Converts boolean-like strings to booleans
 */
const normalizeValue = (value: any): any => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    return trimmed;
  }
  if (typeof value === 'number' && value === 0) return undefined;
  return value;
};

/**
 * Compares new form data with existing database data to detect changes
 * @param newFormData - The new form data from the submission
 * @param existingData - The existing data from the database
 * @returns Object with hasChanges boolean and list of changed fields
 */
export const compareFormData = (
  newFormData: FormData,
  existingData: any
): { hasChanges: boolean; changedFields: string[] } => {
  const changedFields: string[] = [];

  // Define fields to compare (excluding files as they're handled separately)
  const fieldsToCompare = [
    { form: 'guestFacebookName', db: 'guest_facebook_name' },
    { form: 'primaryGuestName', db: 'primary_guest_name' },
    { form: 'guestEmail', db: 'guest_email' },
    { form: 'guestPhoneNumber', db: 'guest_phone_number' },
    { form: 'guestAddress', db: 'guest_address' },
    { form: 'checkInDate', db: 'check_in_date', isDate: true },
    { form: 'checkOutDate', db: 'check_out_date', isDate: true },
    { form: 'checkInTime', db: 'check_in_time', isTime: true },
    { form: 'checkOutTime', db: 'check_out_time', isTime: true },
    { form: 'nationality', db: 'nationality' },
    { form: 'primaryGuestAge', db: 'primary_guest_age', isNumber: true },
    { form: 'numberOfAdults', db: 'number_of_adults', isNumber: true },
    { form: 'numberOfChildren', db: 'number_of_children', isNumber: true },
    { form: 'guest2Name', db: 'guest2_name' },
    { form: 'guest2Age', db: 'guest2_age', isNumber: true },
    { form: 'guest3Name', db: 'guest3_name' },
    { form: 'guest3Age', db: 'guest3_age', isNumber: true },
    { form: 'guest4Name', db: 'guest4_name' },
    { form: 'guest4Age', db: 'guest4_age', isNumber: true },
    { form: 'guest5Name', db: 'guest5_name' },
    { form: 'guest5Age', db: 'guest5_age', isNumber: true },
    { form: 'guestSpecialRequests', db: 'guest_special_requests' },
    { form: 'findUs', db: 'find_us' },
    { form: 'findUsDetails', db: 'find_us_details' },
    { form: 'bookingSource', db: 'booking_source' },
    {
      form: 'guestRequestsSurpriseDecor',
      db: 'guest_requests_surprise_decor',
      isBoolean: true,
    },
    { form: 'needParking', db: 'need_parking', isBoolean: true },
    { form: 'carPlateNumber', db: 'car_plate_number' },
    { form: 'carBrandModel', db: 'car_brand_model' },
    { form: 'carColor', db: 'car_color' },
    { form: 'parkingCheckInDate', db: 'parking_check_in_date', isDate: true },
    { form: 'parkingCheckOutDate', db: 'parking_check_out_date', isDate: true },
    { form: 'hasPets', db: 'has_pets', isBoolean: true },
    { form: 'petName', db: 'pet_name' },
    { form: 'petType', db: 'pet_type' },
    { form: 'petBreed', db: 'pet_breed' },
    { form: 'petAge', db: 'pet_age' },
    { form: 'petVaccinationDate', db: 'pet_vaccination_date', isDate: true },
  ];

  // Check each field for changes
  for (const field of fieldsToCompare) {
    let newValue: any = newFormData.get(field.form);
    let existingValue: any = existingData[field.db];

    // Handle date formatting for comparison
    if (field.isDate && newValue) {
      // Format both dates to YYYY-MM-DD for comparison
      newValue = formatDate(newValue);
      existingValue = formatDate(existingValue);
    }

    // Handle time formatting for comparison
    if (field.isTime && newValue) {
      newValue =
        formatTime(newValue) ||
        (field.db === 'check_in_time' ? DEFAULT_CHECK_IN_TIME : DEFAULT_CHECK_OUT_TIME);
      existingValue =
        formatTime(existingValue) ||
        (field.db === 'check_in_time' ? DEFAULT_CHECK_IN_TIME : DEFAULT_CHECK_OUT_TIME);
    }

    // Handle number conversion
    if (field.isNumber && newValue) {
      newValue = Number(newValue);
    }

    // Handle boolean conversion
    if (field.isBoolean) {
      newValue = newValue === 'true' || newValue === true;
      existingValue = existingValue === true;
    }

    // Normalize both values for comparison
    const normalizedNew = normalizeValue(newValue);
    const normalizedExisting = normalizeValue(existingValue);

    // Compare values
    if (normalizedNew !== normalizedExisting) {
      changedFields.push(field.form);
      console.log(`  📝 Field changed - ${field.form}:`, {
        new: normalizedNew,
        existing: normalizedExisting,
      });
    }
  }

  // Check if files have changed (if new files are uploaded)
  // We need to compare file names to see if they're different from existing ones
  const fileFieldMappings = [
    { form: 'paymentReceipt', formName: 'paymentReceiptFileName', db: 'payment_receipt_url' },
    { form: 'validId', formName: 'validIdFileName', db: 'valid_id_url' },
    { form: 'guest2ValidId', formName: 'guest2ValidIdFileName', db: 'guest2_valid_id_url' },
    { form: 'guest3ValidId', formName: 'guest3ValidIdFileName', db: 'guest3_valid_id_url' },
    { form: 'guest4ValidId', formName: 'guest4ValidIdFileName', db: 'guest4_valid_id_url' },
    { form: 'guest5ValidId', formName: 'guest5ValidIdFileName', db: 'guest5_valid_id_url' },
    { form: 'petVaccination', formName: 'petVaccinationFileName', db: 'pet_vaccination_url' },
    { form: 'petImage', formName: 'petImageFileName', db: 'pet_image_url' },
  ];

  for (const fileField of fileFieldMappings) {
    const file = newFormData.get(fileField.form);
    const fileName = newFormData.get(fileField.formName) as string;
    const existingUrl = existingData[fileField.db];

    console.log(`  🔍 Checking ${fileField.form}:`, {
      hasFile: !!file,
      fileSize: file instanceof File ? file.size : 0,
      fileName,
      existingUrl,
    });

    // Only mark as changed if:
    // 1. A file exists in the form data AND
    // 2. Either there's no existing URL OR the filename is different
    if (file && file instanceof File && file.size > 0 && fileName) {
      // Extract the filename from the existing URL (if it exists)
      let existingFileName = '';
      if (existingUrl && typeof existingUrl === 'string') {
        // URL format is typically: bucket/path/filename or full URL
        // Handle both storage path and full URL
        const urlStr = existingUrl.includes('http') ? existingUrl : existingUrl;
        const urlParts = urlStr.split('/');
        existingFileName = urlParts[urlParts.length - 1];

        // Decode URL-encoded characters
        existingFileName = decodeURIComponent(existingFileName);
      }

      console.log(`    Comparing: new="${fileName}" vs existing="${existingFileName}"`);

      // Compare filenames - if they're different or no existing file, mark as changed
      if (!existingUrl || !existingFileName || fileName !== existingFileName) {
        changedFields.push(fileField.form);
        console.log(
          `    📎 File changed - ${fileField.form}: "${existingFileName}" → "${fileName}"`
        );
      } else {
        console.log(`    ⏭️ File unchanged - ${fileField.form}: "${fileName}"`);
      }
    } else if (!file || !(file instanceof File) || file.size === 0) {
      console.log(`    ⏭️ No file data - ${fileField.form}`);
    }
  }

  const hasChanges = changedFields.length > 0;
  console.log(
    `\n${hasChanges ? '✅' : '❌'} Data comparison complete: ${hasChanges ? changedFields.length + ' changes detected' : 'No changes detected'}`
  );

  return { hasChanges, changedFields };
};

/**
 * Form keys emitted by compareFormData().changedFields whose edits require
 * status → PENDING_REVIEW when saving from public /form, while the row is in
 * the documents pipeline or Ready for check-in (see statusMachine
 * `shouldRevertGuestFieldEditsToPendingReview`; docs/todos/ + booking-workflow.mdc §2.3).
 */
const WORKFLOW_SENSITIVE_FORM_FIELDS = new Set<string>([
  'guestFacebookName',
  'primaryGuestName',
  'guestEmail',
  'guestPhoneNumber',
  'guest2Name',
  'guest2Age',
  'guest3Name',
  'guest3Age',
  'guest4Name',
  'guest4Age',
  'guest5Name',
  'guest5Age',
  'checkInDate',
  'checkOutDate',
  'checkInTime',
  'checkOutTime',
  'guestRequestsSurpriseDecor',
  'needParking',
  'carPlateNumber',
  'carBrandModel',
  'carColor',
  'hasPets',
  'petName',
  'petType',
  'petBreed',
  'petAge',
  'petVaccinationDate',
  'paymentReceipt',
  'validId',
  'guest2ValidId',
  'guest3ValidId',
  'guest4ValidId',
  'guest5ValidId',
  'petVaccination',
  'petImage',
]);

/** True if any changed field is workflow-sensitive for pipeline → PENDING_REVIEW revert. */
export function shouldRevertReadyForCheckinToPendingReview(changedFields: string[]): boolean {
  return changedFields.some((f) => WORKFLOW_SENSITIVE_FORM_FIELDS.has(f));
}
