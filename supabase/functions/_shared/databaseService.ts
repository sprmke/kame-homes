import { createClient } from './supabaseJs.ts';
import { GuestFormData, GuestSubmission, transformFormToSubmission } from './types.ts';
import { applyGafDefaultsToFormData } from './appSettings.ts';
import { hasBlockedNightsInRange } from './propertyBlockedDates.ts';
import {
  pendingDocumentsClearCompletionsJsonbPatch,
  pendingDocumentsClearPatchForGuestEditRevert,
  requestPdfClearPatchForChangedFormFields,
  shouldRevertGuestFieldEditsToPendingReview,
} from './statusMachine.ts';
import { UploadService } from './uploadService.ts';
import { assertWithinUploadLimit } from './uploadLimits.ts';
import { assertPropertyGuestPartyRules, guestPartySlotsFromFormData } from './guestCounts.ts';
import { resolveGuestFormSettings } from './guestFormSettings.ts';
import { getDefaultPropertyId } from './propertyScope.ts';
import { createNotification } from './notificationService.ts';
import { bookingNotificationMetadata } from './notificationEnrichment.ts';
import { resolveOrganizationIdForParking } from './parkingScope.ts';
import {
  formatDate,
  formatTime,
  DEFAULT_CHECK_IN_TIME,
  DEFAULT_CHECK_OUT_TIME,
  formatPublicUrl,
} from './utils.ts';
import {
  applyAssetScopeFilter,
  applyPropertyOrLegacySingletonFilter,
  callRpcObject,
  updateAssetScopedSingleton,
  updatePropertyScopedSingleton,
} from './supabaseQuery.ts';
import {
  compareBookingsForListSort,
  manilaTodayIso,
  matchesDefaultBookingsListVisibility,
  passesListCheckInDateRangeFilter,
  type BookingsListSort,
} from './bookingsListSort.ts';
import {
  buildBookingsListStatusOrFilter,
  passesBookingsListStatusFilter,
} from './bookingsStatusFilter.ts';

export class DatabaseService {
  private static supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  static async getRawData(bookingId: string) {
    console.log('Fetching raw data for booking:', bookingId);

    try {
      const { data, error } = await this.supabase
        .from('guest_submissions')
        .select('*')
        .eq('id', bookingId)
        .single();

      // PGRST116 means no rows found - this is expected for new bookings
      if (error && error.code === 'PGRST116') {
        console.log('No existing booking found (this is normal for new bookings)');
        return null;
      }

      if (error) {
        // PGRST116 means "not found" - this is expected for new submissions
        if (error.code === 'PGRST116') {
          console.log('Booking not found in database (new submission)');
          return null;
        }

        console.error('Database error:', error);
        throw new Error('Failed to fetch guest submission');
      }

      if (!data) {
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching raw data:', error);
      throw error;
    }
  }

  static async getFormData(bookingId: string) {
    console.log('Fetching form data for booking:', bookingId);

    try {
      const { data, error } = await this.supabase
        .from('guest_submissions')
        .select('*')
        .eq('id', bookingId)
        .single();

      // PGRST116 means no rows found - return null for non-existent bookings
      if (error && error.code === 'PGRST116') {
        console.log('No existing booking found');
        return null;
      }

      if (error) {
        console.error('Database error:', error);
        throw new Error('Failed to fetch guest submission');
      }

      if (!data) {
        return null;
      }

      // Format dates and times
      const checkInDate = formatDate(data.check_in_date);
      const checkOutDate = formatDate(data.check_out_date);
      const parkingCheckInDate = formatDate(data.parking_check_in_date) || checkInDate;
      const parkingCheckOutDate = formatDate(data.parking_check_out_date) || checkOutDate;
      const parkingSameAsBookingDuration =
        parkingCheckInDate === checkInDate && parkingCheckOutDate === checkOutDate;

      const checkInTime = formatTime(data.check_in_time) || DEFAULT_CHECK_IN_TIME;
      const checkOutTime = formatTime(data.check_out_time) || DEFAULT_CHECK_OUT_TIME;

      // Transform the database record back to form data format
      const formData: GuestFormData = {
        guestFacebookName: data.guest_facebook_name || '',
        guestEmail: data.guest_email || '',
        guestPhoneNumber: data.guest_phone_number || '',
        guestAddress: data.guest_address || '',
        checkInDate,
        checkInTime,
        checkOutDate,
        checkOutTime,
        nationality: data.nationality || '',
        numberOfAdults: data.number_of_adults || 1,
        numberOfChildren: data.number_of_children || 0,
        primaryGuestName: data.primary_guest_name || '',
        primaryGuestAge: data.primary_guest_age ?? 18,
        guest2Name: data.guest2_name || '',
        guest2Age: data.guest2_name?.trim() ? (data.guest2_age ?? 18) : undefined,
        guest3Name: data.guest3_name || '',
        guest3Age: data.guest3_name?.trim() ? (data.guest3_age ?? 18) : undefined,
        guest4Name: data.guest4_name || '',
        guest4Age: data.guest4_name?.trim() ? (data.guest4_age ?? 18) : undefined,
        guest5Name: data.guest5_name || '',
        guest5Age: data.guest5_name?.trim() ? (data.guest5_age ?? 3) : undefined,
        guestSpecialRequests: data.guest_special_requests || '',
        findUs: data.find_us || 'Facebook',
        findUsDetails: data.find_us_details || '',
        bookingSource: data.booking_source || 'Direct',
        guestRequestsSurpriseDecor: !!data.guest_requests_surprise_decor,
        needParking: data.need_parking || false,
        parkingSameAsBookingDuration,
        parkingCheckInDate,
        parkingCheckOutDate,
        carPlateNumber: data.car_plate_number || '',
        carBrandModel: data.car_brand_model || '',
        carColor: data.car_color || '',
        hasPets: data.has_pets || false,
        petName: data.pet_name || '',
        petType: data.pet_type || '',
        petBreed: data.pet_breed || '',
        petAge: data.pet_age || '',
        petVaccinationDate: formatDate(data.pet_vaccination_date),
        petVaccinationUrl: formatPublicUrl(data.pet_vaccination_url) || '',
        petImageUrl: formatPublicUrl(data.pet_image_url) || '',
        paymentReceiptUrl: formatPublicUrl(data.payment_receipt_url) || '',
        validIdUrl: formatPublicUrl(data.valid_id_url) || '',
        guest2ValidIdUrl: formatPublicUrl(data.guest2_valid_id_url) || '',
        guest3ValidIdUrl: formatPublicUrl(data.guest3_valid_id_url) || '',
        guest4ValidIdUrl: formatPublicUrl(data.guest4_valid_id_url) || '',
        guest5ValidIdUrl: formatPublicUrl(data.guest5_valid_id_url) || '',
        unitOwner: data.unit_owner || '',
        towerAndUnitNumber: data.tower_and_unit_number || '',
        ownerOnsiteContactPerson: data.owner_onsite_contact_person || '',
        ownerContactNumber: data.owner_contact_number || '',
      };

      console.log('Form data fetched successfully:', formData);
      return formData;
    } catch (error) {
      console.error('Error fetching form data:', error);
      throw error;
    }
  }

  static async processFormData(
    formData: FormData,
    saveToDatabase = true,
    saveImagesToStorage = true,
    revertReadyForCheckinToPendingReview = false,
    propertyId?: string,
    guestUserId?: string,
    revertChangedFormFields: string[] = []
  ): Promise<{
    data: GuestFormData;
    submissionData: any;
    validIdUrl: string;
    paymentReceiptUrl: string;
    petVaccinationUrl?: string;
    petImageUrl?: string;
  }> {
    try {
      console.log('Processing form data...');

      // Get required form fields
      const fullName = formData.get('primaryGuestName') as string;
      const checkInDate = formData.get('checkInDate') as string;
      const checkOutDate = formData.get('checkOutDate') as string;
      const guestEmail = formData.get('guestEmail') as string;
      const bookingId = formData.get('bookingId') as string;

      if (!fullName) {
        throw new Error('Full Name is required');
      }

      if (!checkInDate || !checkOutDate) {
        throw new Error('Check-in and check-out dates are required');
      }

      if (!guestEmail) {
        throw new Error('Email is required');
      }

      if (!bookingId) {
        throw new Error('Booking ID is required');
      }

      // Format dates
      const formattedCheckIn = formatDate(checkInDate);
      const formattedCheckOut = formatDate(checkOutDate);

      if (!formattedCheckIn || !formattedCheckOut) {
        throw new Error('Invalid check-in or check-out date format');
      }

      // Check if booking already exists using the booking ID (only if saving to database or storage)
      let existingBooking = null;
      if (saveToDatabase || saveImagesToStorage) {
        const { data, error: fetchError } = await this.supabase
          .from('guest_submissions')
          .select('*')
          .eq('id', bookingId)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          // PGRST116 is "not found" error
          console.error('Error fetching existing booking:', fetchError);
          throw new Error('Failed to check for existing booking');
        }

        existingBooking = data;
      } else {
        console.log(
          '⚠️ Skipping existing booking check (both saveToDatabase and saveImagesToStorage are false)'
        );
      }

      // Handle file uploads
      let petVaccinationUrl: string | undefined;
      let petImageUrl: string | undefined;
      let paymentReceiptUrl: string;

      // Get the pet vaccination file and pet image file
      const petVaccination = formData.get('petVaccination') as File;
      const petImage = formData.get('petImage') as File;
      const hasPets = formData.get('hasPets') === 'true';

      // Server-side ceiling (client already compresses; this catches bypass /
      // pass-through). Unified limits: `_shared/uploadLimits.ts`.
      if (petVaccination instanceof File && petVaccination.size > 0) {
        assertWithinUploadLimit(petVaccination, 'document');
      }
      if (petImage instanceof File && petImage.size > 0) {
        assertWithinUploadLimit(petImage, 'image');
      }

      if (hasPets) {
        // Handle pet vaccination upload
        if (petVaccination) {
          const petVaccinationFileName = formData.get('petVaccinationFileName') as string;
          const prefixedFileName = petVaccinationFileName;
          if (saveImagesToStorage) {
            petVaccinationUrl = await UploadService.uploadPetVaccination(
              petVaccination,
              prefixedFileName,
              propertyId
            );
          } else {
            console.log('⚠️ Skipping pet vaccination upload (saveImagesToStorage=false)');
            petVaccinationUrl = 'dev-mode-skipped';
          }
        } else if (existingBooking) {
          petVaccinationUrl = existingBooking.pet_vaccination_url;
        } else if (!saveImagesToStorage) {
          petVaccinationUrl = 'dev-mode-skipped';
        } else {
          throw new Error('Pet vaccination record is required when bringing pets');
        }

        // Handle pet image upload
        if (petImage) {
          const petImageFileName = formData.get('petImageFileName') as string;
          const prefixedFileName = petImageFileName;
          if (saveImagesToStorage) {
            petImageUrl = await UploadService.uploadPetImage(
              petImage,
              prefixedFileName,
              propertyId
            );
          } else {
            console.log('⚠️ Skipping pet image upload (saveImagesToStorage=false)');
            petImageUrl = 'dev-mode-skipped';
          }
        } else if (existingBooking) {
          petImageUrl = existingBooking.pet_image_url;
        } else if (!saveImagesToStorage) {
          petImageUrl = 'dev-mode-skipped';
        } else {
          throw new Error('Pet image is required when bringing pets');
        }
      }

      // Get the downpayment receipt file (FormData: paymentReceipt → payment_receipt_url)
      // Airbnb bookings skip the payment step — receipt is not required.
      const isAirbnbSource = (formData.get('bookingSource') as string)?.trim() === 'Airbnb';
      const paymentReceipt = formData.get('paymentReceipt') as File;
      if (paymentReceipt instanceof File && paymentReceipt.size > 0) {
        assertWithinUploadLimit(paymentReceipt, 'document');
      }
      if (paymentReceipt) {
        const paymentReceiptFileName = formData.get('paymentReceiptFileName') as string;
        const prefixedFileName = paymentReceiptFileName;
        if (saveImagesToStorage) {
          paymentReceiptUrl = await UploadService.uploadPaymentReceipt(
            paymentReceipt,
            prefixedFileName,
            propertyId
          );
        } else {
          console.log('⚠️ Skipping downpayment receipt upload (saveImagesToStorage=false)');
          paymentReceiptUrl = 'dev-mode-skipped';
        }
      } else if (existingBooking) {
        paymentReceiptUrl = existingBooking.payment_receipt_url;
      } else if (!saveImagesToStorage) {
        paymentReceiptUrl = 'dev-mode-skipped';
      } else if (isAirbnbSource) {
        paymentReceiptUrl = '';
      } else {
        throw new Error('Downpayment receipt is required');
      }

      // Get the valid ID files (primary + additional guests)
      const primaryGuestAge = Number(formData.get('primaryGuestAge') || 0);
      if (primaryGuestAge < 18) {
        throw new Error('Primary guest must be 18 years or older');
      }

      const guest2Age = Number(formData.get('guest2Age') || 0);
      const guest3Age = Number(formData.get('guest3Age') || 0);
      const guest4Age = Number(formData.get('guest4Age') || 0);
      const guest5Age = Number(formData.get('guest5Age') || 0);
      const primaryGuestName = (formData.get('primaryGuestName') as string)?.trim() || '';
      const guest2Name = (formData.get('guest2Name') as string)?.trim() || '';
      const guest3Name = (formData.get('guest3Name') as string)?.trim() || '';
      const guest4Name = (formData.get('guest4Name') as string)?.trim() || '';
      const guest5Name = (formData.get('guest5Name') as string)?.trim() || '';

      const partySlots = guestPartySlotsFromFormData(formData);
      const resolvedPropertyId = propertyId ?? (await getDefaultPropertyId());
      const guestFormSettings = await resolveGuestFormSettings(resolvedPropertyId);
      assertPropertyGuestPartyRules(partySlots, {
        maxAdults: guestFormSettings.maxAdults,
        maxChildren: guestFormSettings.maxChildren,
      });

      const uploadValidIdIfPresent = async (
        field: string,
        fileNameField: string,
        required: boolean
      ): Promise<string | undefined> => {
        const file = formData.get(field) as File;
        if (file && file.size > 0) {
          assertWithinUploadLimit(file, 'document');
          const prefixedFileName = formData.get(fileNameField) as string;
          if (saveImagesToStorage) {
            return await UploadService.uploadValidId(file, prefixedFileName, propertyId);
          }
          console.log(`⚠️ Skipping ${field} upload (saveImagesToStorage=false)`);
          return 'dev-mode-skipped';
        }
        if (existingBooking) {
          const dbField =
            field === 'validId'
              ? 'valid_id_url'
              : `${field.replace('ValidId', '_valid_id_url').replace('guest', 'guest')}`;
          return existingBooking[dbField];
        }
        if (!saveImagesToStorage) {
          return required ? 'dev-mode-skipped' : undefined;
        }
        if (required) {
          throw new Error(`${field} is required`);
        }
        return undefined;
      };

      const validIdUrl = (await uploadValidIdIfPresent('validId', 'validIdFileName', true)) || '';
      const guest2ValidIdUrl =
        guest2Age >= 18
          ? await uploadValidIdIfPresent('guest2ValidId', 'guest2ValidIdFileName', true)
          : undefined;
      const guest3ValidIdUrl =
        guest3Age >= 18
          ? await uploadValidIdIfPresent('guest3ValidId', 'guest3ValidIdFileName', true)
          : undefined;
      const guest4ValidIdUrl =
        guest4Age >= 18
          ? await uploadValidIdIfPresent('guest4ValidId', 'guest4ValidIdFileName', true)
          : undefined;
      const guest5ValidIdUrl =
        guest5Age >= 18
          ? await uploadValidIdIfPresent('guest5ValidId', 'guest5ValidIdFileName', true)
          : undefined;

      // Convert form data to an object
      const formDataObj: Partial<GuestFormData> = {};
      const excludedFormFields = new Set([
        'paymentReceipt',
        'validId',
        'guest2ValidId',
        'guest3ValidId',
        'guest4ValidId',
        'guest5ValidId',
        'petVaccination',
        'petImage',
      ]);
      formData.forEach((value, key) => {
        if (!excludedFormFields.has(key)) {
          (formDataObj as Record<string, FormDataEntryValue>)[key] = value;
        }
      });

      // Create the final data object
      const data = {
        ...(formDataObj as GuestFormData),
      };

      const dataWithGafDefaults = await applyGafDefaultsToFormData(data, propertyId);

      console.log('Form data processed successfully');

      // Transform data for database — Airbnb bookings may have no receipt
      if (!paymentReceiptUrl && !isAirbnbSource) {
        throw new Error('Failed to upload downpayment receipt');
      }

      if (!validIdUrl) {
        throw new Error('Failed to upload valid ID');
      }

      const dbData = transformFormToSubmission(
        dataWithGafDefaults,
        paymentReceiptUrl,
        validIdUrl,
        petVaccinationUrl,
        petImageUrl,
        {
          guest2ValidIdUrl,
          guest3ValidIdUrl,
          guest4ValidIdUrl,
          guest5ValidIdUrl,
        }
      );

      if (propertyId) {
        (dbData as unknown as Record<string, unknown>).property_id = propertyId;
      }

      if (guestUserId) {
        (dbData as unknown as Record<string, unknown>).guest_user_id = guestUserId;
      }

      // Save or update in database using the booking ID
      let submissionData;
      if (saveToDatabase) {
        if (existingBooking) {
          const patch: GuestSubmission = { ...dbData };
          if (
            revertReadyForCheckinToPendingReview &&
            shouldRevertGuestFieldEditsToPendingReview(existingBooking.status)
          ) {
            Object.assign(patch, pendingDocumentsClearPatchForGuestEditRevert());
            Object.assign(patch, requestPdfClearPatchForChangedFormFields(revertChangedFormFields));
            (patch as unknown as Record<string, unknown>).document_requirement_completions =
              pendingDocumentsClearCompletionsJsonbPatch(
                existingBooking.document_requirement_completions
              );
            patch.status = 'PENDING_REVIEW';
            patch.status_updated_at = new Date().toISOString();
          }
          submissionData = await this.updateGuestSubmission(bookingId, patch);
        } else {
          submissionData = await this.saveGuestSubmission({
            ...dbData,
            id: bookingId,
          });
        }
      } else {
        console.log('⚠️ Skipping database save (saveToDatabase=false)');
        // Return mock data for development
        submissionData = {
          id: bookingId,
          ...dbData,
          created_at: new Date().toISOString(),
        };
      }

      return {
        data: dataWithGafDefaults,
        submissionData,
        petVaccinationUrl: petVaccinationUrl ? formatPublicUrl(petVaccinationUrl) : undefined,
        petImageUrl: petImageUrl ? formatPublicUrl(petImageUrl) : undefined,
        validIdUrl: formatPublicUrl(validIdUrl),
        paymentReceiptUrl: paymentReceiptUrl ? formatPublicUrl(paymentReceiptUrl) : '',
      };
    } catch (error) {
      console.error('Error processing form data:', error);
      throw new Error(
        'Failed to process form data: ' + (error instanceof Error ? error.message : String(error))
      );
    }
  }

  private static async saveGuestSubmission(formData: any) {
    console.log('Saving new submission to database...');

    const { data, error } = await this.supabase
      .from('guest_submissions')
      .insert([formData])
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw new Error('Failed to save guest submission');
    }

    console.log('Database submission successful');
    return data;
  }

  private static async updateGuestSubmission(bookingId: string, formData: any) {
    console.log('Updating existing submission in database...');

    const { data, error } = await this.supabase
      .from('guest_submissions')
      .update(formData)
      .eq('id', bookingId)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw new Error('Failed to update guest submission');
    }

    console.log('Database update successful');
    return data;
  }

  // ─── Phase 3 helpers ────────────────────────────────────────────────────────

  /**
   * Fetch a single booking row by ID (used by orchestrator + transition endpoint).
   * Returns null when not found.
   */
  static async getBookingById(bookingId: string) {
    const { data, error } = await this.supabase
      .from('guest_submissions')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch booking ${bookingId}: ${error.message}`);
    }

    return data;
  }

  /** Insert a parking-only reservation row (no property stay workflow). */
  static async createParkingBooking(input: {
    parkingId: string;
    primaryGuestName: string;
    guestEmail: string;
    guestPhoneNumber: string;
    checkInDate: string;
    checkOutDate: string;
    numberOfNights: number;
    carPlateNumber: string;
    carBrandModel?: string | null;
    carColor?: string | null;
    parkingLabel: string;
    residenceName?: string | null;
  }) {
    const now = new Date().toISOString();
    const guestName = input.primaryGuestName.trim();
    const locationLabel =
      [input.residenceName, input.parkingLabel].filter(Boolean).join(' · ') || input.parkingLabel;

    const row = {
      parking_id: input.parkingId,
      property_id: null,
      status: 'PENDING_REVIEW',
      status_updated_at: now,
      guest_facebook_name: guestName,
      primary_guest_name: guestName,
      guest_email: input.guestEmail.trim(),
      guest_phone_number: input.guestPhoneNumber.trim(),
      guest_address: locationLabel,
      check_in_date: input.checkInDate,
      check_out_date: input.checkOutDate,
      parking_check_in_date: input.checkInDate,
      parking_check_out_date: input.checkOutDate,
      number_of_nights: input.numberOfNights,
      number_of_adults: 1,
      number_of_children: 0,
      need_parking: true,
      car_plate_number: input.carPlateNumber.trim(),
      car_brand_model: input.carBrandModel?.trim() || null,
      car_color: input.carColor?.trim() || null,
      has_pets: false,
      find_us: 'Parking',
      booking_source: 'Parking',
      payment_receipt_url: 'parking-only',
      valid_id_url: null,
      unit_owner: input.parkingLabel,
      tower_and_unit_number: locationLabel,
      owner_onsite_contact_person: 'N/A',
      owner_contact_number: 'N/A',
    };

    const { data, error } = await this.supabase
      .from('guest_submissions')
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(`Failed to create parking booking: ${error.message}`);

    try {
      const organizationId = await resolveOrganizationIdForParking(input.parkingId);
      await createNotification({
        organizationId,
        parkingId: input.parkingId,
        type: 'booking_pending_review',
        title: 'New booking submitted',
        body: `${guestName} submitted a new parking booking request.`,
        bookingId: data.id,
        metadata: bookingNotificationMetadata(data),
        dedupeKey: `${data.id}:booking_pending_review`,
      });
    } catch (notifErr) {
      console.error(
        '[databaseService] Could not create parking notification (non-fatal):',
        notifErr
      );
    }

    return data;
  }

  /**
   * Update `status` + `status_updated_at` for a booking.
   * Only the orchestrator should call this — no side effects here.
   */
  static async updateBookingStatus(bookingId: string, status: string, expectedFrom?: string) {
    let query = this.supabase
      .from('guest_submissions')
      .update({
        status,
        status_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    const fromStatus = expectedFrom?.trim();
    if (fromStatus) {
      query = query.eq('status', fromStatus);
    }

    const { data, error } = await query.select().maybeSingle();

    if (error) throw new Error(`Failed to update booking status: ${error.message}`);
    if (!data) {
      throw new Error('STATUS_CONFLICT: Booking status changed. Refresh and try again.');
    }
    return data;
  }

  /**
   * Patch arbitrary workflow-phase fields onto a booking row (pricing, parking,
   * SD refund fields, approved PDF URLs, etc.).  Called by the orchestrator after
   * validating the transition.
   */
  static async setWorkflowFields(bookingId: string, fields: Record<string, unknown>) {
    const { data, error } = await this.supabase
      .from('guest_submissions')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .select()
      .single();

    if (error) throw new Error(`Failed to set workflow fields: ${error.message}`);
    return data;
  }

  /**
   * Paginated, filtered, sorted booking list for the admin `list-bookings` function.
   *
   * Dates in `check_in_date` are stored as `MM-DD-YYYY` text. To sort correctly
   * across year boundaries we convert to `YYYY-MM-DD` via a Postgres expression
   * in a `rpc` call — or fall back to `created_at` when the column isn't sortable.
   *
   * Sorting approach: we fetch the full result set for the current page using the
   * PostgREST range API.  For `check_in_date` sorting we convert in JS (fast enough
   * for admin pages with ≤1000 active rows).
   */
  static async listBookings(params: {
    propertyId?: string;
    parkingId?: string;
    /** Org-wide scope: property stays and/or parking reservations for this org. */
    orgId?: string;
    /**
     * Scoped org admin — filter to assigned listing ids instead of the full org.
     * Prefer this over `orgId` when `all_listings` is false (sets are small).
     */
    propertyIds?: string[];
    parkingIds?: string[];
    includePropertyMeta?: boolean;
    includeParkingMeta?: boolean;
    bookingKind?: 'property' | 'parking' | null;
    q?: string;
    status?: string[];
    from?: string | null; // YYYY-MM-DD
    to?: string | null; // YYYY-MM-DD
    hasPets?: boolean | null;
    needParking?: boolean | null;
    sort?:
      | 'status_priority:asc'
      | 'check_in_date:asc'
      | 'check_in_date:desc'
      | 'created_at:asc'
      | 'created_at:desc';
    page?: number;
    limit?: number;
    /** When true, IMPORTED status filter also matches imported_from_batch_id rows. */
    expandImportedBatch?: boolean;
    /** When true, include COMPLETED rows (cancelled stays hidden unless status filter). */
    showCompletedBookings?: boolean;
  }) {
    const {
      propertyId,
      parkingId,
      orgId,
      propertyIds,
      parkingIds,
      includePropertyMeta = false,
      includeParkingMeta = false,
      bookingKind = null,
      q = '',
      status = [],
      from = null,
      to = null,
      hasPets = null,
      needParking = null,
      sort = 'status_priority:asc',
      page = 1,
      limit = 31,
      showCompletedBookings = false,
      expandImportedBatch = false,
    } = params;

    const todayManila = manilaTodayIso();

    // Org-wide scope is expressed as one query per relation (property / parking),
    // each filtered by `organization_id` through an inner-joined embed — never by
    // building an `id.in.(...)` list of every property/parking id, which blows past
    // request URI length limits once an org has more than a couple hundred assets.
    // Scoped org admins (`propertyIds` / `parkingIds`) use `.in()` — assignment sets stay small.
    const baseRequests: any[] = [];

    if (parkingId) {
      // Broadcast pre-claim requests still have parking_id = null — surface this
      // parking's pending candidacy rows alongside its already-claimed bookings.
      const { data: pendingBroadcasts } = await this.supabase
        .from('parking_booking_broadcasts')
        .select('booking_id')
        .eq('parking_id', parkingId)
        .eq('response', 'pending');
      const pendingBookingIds = (pendingBroadcasts ?? []).map((row) => String(row.booking_id));
      const request = this.supabase.from('guest_submissions').select('*');
      baseRequests.push(
        pendingBookingIds.length > 0
          ? request.or(`parking_id.eq.${parkingId},id.in.(${pendingBookingIds.join(',')})`)
          : request.eq('parking_id', parkingId)
      );
    } else if (propertyId) {
      baseRequests.push(
        this.supabase.from('guest_submissions').select('*').eq('property_id', propertyId)
      );
    } else if (propertyIds || parkingIds) {
      const wantProperty = bookingKind !== 'parking';
      const wantParking = bookingKind !== 'property';
      const scopedPropertyIds = propertyIds ?? [];
      const scopedParkingIds = parkingIds ?? [];
      if (wantProperty && scopedPropertyIds.length > 0) {
        baseRequests.push(
          this.supabase.from('guest_submissions').select('*').in('property_id', scopedPropertyIds)
        );
      }
      if (wantParking && scopedParkingIds.length > 0) {
        baseRequests.push(
          this.supabase.from('guest_submissions').select('*').in('parking_id', scopedParkingIds)
        );
      }
    } else if (orgId) {
      const wantProperty = bookingKind !== 'parking';
      const wantParking = bookingKind !== 'property';
      if (wantProperty) {
        baseRequests.push(
          this.supabase
            .from('guest_submissions')
            .select('*, properties!inner(organization_id)')
            .eq('properties.organization_id', orgId)
        );
      }
      if (wantParking) {
        baseRequests.push(
          this.supabase
            .from('guest_submissions')
            // Disambiguate from guest_submissions.parking_pinned_id → parkings (broadcast flow).
            .select('*, parkings!guest_submissions_parking_id_fkey!inner(organization_id)')
            .eq('parkings.organization_id', orgId)
        );
      }
    }

    if (baseRequests.length === 0) {
      return { rows: [], total: 0 };
    }

    // --- Filters (applied identically to every base request above) ---
    // Free-text search now spans the full guest record:
    //   • Primary guest fields  : facebook name, primary name, email, phone, address, nationality
    //   • Additional guests     : guest2…guest5_name
    //   • Pet                   : pet_name, pet_type, pet_breed
    //   • Parking               : car_plate_number, car_brand_model, car_color
    //   • Notes / source        : guest_special_requests, find_us_details
    // PostgREST `or()` joins each clause as a comma-separated `<col>.ilike.<needle>`.
    const searchOr = q.trim()
      ? [
          // Primary guest
          `guest_facebook_name.ilike.%${q.trim()}%`,
          `primary_guest_name.ilike.%${q.trim()}%`,
          `guest_email.ilike.%${q.trim()}%`,
          `guest_phone_number.ilike.%${q.trim()}%`,
          `guest_address.ilike.%${q.trim()}%`,
          `nationality.ilike.%${q.trim()}%`,
          // Additional guests
          `guest2_name.ilike.%${q.trim()}%`,
          `guest3_name.ilike.%${q.trim()}%`,
          `guest4_name.ilike.%${q.trim()}%`,
          `guest5_name.ilike.%${q.trim()}%`,
          // Pet
          `pet_name.ilike.%${q.trim()}%`,
          `pet_type.ilike.%${q.trim()}%`,
          `pet_breed.ilike.%${q.trim()}%`,
          // Parking
          `car_plate_number.ilike.%${q.trim()}%`,
          `car_brand_model.ilike.%${q.trim()}%`,
          `car_color.ilike.%${q.trim()}%`,
          // Free-text notes
          `guest_special_requests.ilike.%${q.trim()}%`,
          `find_us_details.ilike.%${q.trim()}%`,
        ].join(',')
      : null;

    const requests = baseRequests.map((base) => {
      let request = base;
      if (bookingKind === 'property') {
        request = request.not('property_id', 'is', null);
      } else if (bookingKind === 'parking') {
        request = request.not('parking_id', 'is', null);
      }
      if (searchOr) request = request.or(searchOr);
      if (status.length > 0) {
        const statusOr = buildBookingsListStatusOrFilter(status, expandImportedBatch);
        request = statusOr ? request.or(statusOr) : request.in('status', status);
      }
      if (hasPets === true) request = request.eq('has_pets', true);
      if (hasPets === false) request = request.eq('has_pets', false);
      if (needParking === true) request = request.eq('need_parking', true);
      if (needParking === false) request = request.eq('need_parking', false);
      return request.order('created_at', { ascending: false });
    });

    // Fetch all matching rows first (required for MM-DD-YYYY client-side sort)
    // Then paginate in memory. This is acceptable for admin (≤ a few thousand rows).
    const results = await Promise.all(requests);
    for (const { error } of results) {
      if (error) throw new Error(`listBookings query failed: ${error.message}`);
    }

    let rows = results.flatMap((result) => (result.data ?? []) as any[]);
    if (results.length > 1) {
      const seenIds = new Set<string>();
      rows = rows.filter((row) => {
        const id = String(row.id);
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      });
    }

    // Check-in date-range filter (all statuses)
    if (from || to) {
      rows = rows.filter((r) => passesListCheckInDateRangeFilter(r, from, to));
    }

    // Default list: hide cancelled + completed unless toggle is on
    rows = rows.filter((r) => matchesDefaultBookingsListVisibility(r, showCompletedBookings));

    const listSort = sort as BookingsListSort;
    rows.sort((a, b) => compareBookingsForListSort(a, b, listSort, todayManila));

    // Paginate
    const total = rows.length;
    const from_idx = (page - 1) * limit;
    let paged = rows.slice(from_idx, from_idx + limit);

    if (includePropertyMeta && paged.length > 0) {
      paged = await this.enrichBookingsWithPropertyMeta(paged);
    }
    if (includeParkingMeta && paged.length > 0) {
      paged = await this.enrichBookingsWithParkingMeta(paged, parkingId);
    }

    paged = paged.map((row) => ({
      ...row,
      // A pre-claim broadcast row (parking_id null) scoped by parkingId is still
      // parking-kind — it just hasn't been claimed by this parking yet.
      booking_kind: row.parking_id || parkingId ? 'parking' : 'property',
    }));

    return { rows: paged, total };
  }

  /**
   * `scopedParkingId` is set when the list call is scoped to a single parking — its
   * meta backfills rows with no `parking_id` of their own (pre-claim broadcast rows).
   */
  private static async enrichBookingsWithParkingMeta(
    rows: Record<string, unknown>[],
    scopedParkingId?: string
  ) {
    const ids = [
      ...new Set(
        rows
          .map((row) => row.parking_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      ),
    ];
    if (scopedParkingId) ids.push(scopedParkingId);
    if (ids.length === 0) return rows;

    const { data: parkingRows, error } = await this.supabase
      .from('parkings')
      .select('id, name, slug')
      .in('id', ids);
    if (error) {
      console.warn('[DatabaseService] enrichBookingsWithParkingMeta failed:', error.message);
      return rows;
    }

    const byId = new Map(
      (parkingRows ?? []).map((row) => [
        String(row.id),
        {
          name: typeof row.name === 'string' ? row.name : 'Parking',
          slug: typeof row.slug === 'string' ? row.slug : '',
        },
      ])
    );

    return rows.map((row) => {
      const parkingId = typeof row.parking_id === 'string' ? row.parking_id : scopedParkingId;
      const meta = parkingId ? byId.get(parkingId) : undefined;
      return {
        ...row,
        parking_name: meta?.name ?? null,
        parking_slug: meta?.slug ?? null,
      };
    });
  }

  private static async enrichBookingsWithPropertyMeta(rows: Record<string, unknown>[]) {
    const ids = [
      ...new Set(
        rows
          .map((row) => row.property_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      ),
    ];
    if (ids.length === 0) return rows;

    const { data: propertyRows, error } = await this.supabase
      .from('properties')
      .select('id, name, slug')
      .in('id', ids);
    if (error) {
      console.warn('[DatabaseService] enrichBookingsWithPropertyMeta failed:', error.message);
      return rows;
    }

    const byId = new Map(
      (propertyRows ?? []).map((row) => [
        String(row.id),
        {
          name: typeof row.name === 'string' ? row.name : 'Property',
          slug: typeof row.slug === 'string' ? row.slug : '',
        },
      ])
    );

    return rows.map((row) => {
      const propertyId = typeof row.property_id === 'string' ? row.property_id : null;
      const meta = propertyId ? byId.get(propertyId) : undefined;
      return {
        ...row,
        property_name: meta?.name ?? null,
        property_slug: meta?.slug ?? null,
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────

  static async checkOverlappingBookings(
    checkInDate: string,
    checkOutDate: string,
    bookingId?: string,
    propertyId?: string,
    options?: {
      /**
       * Skip the owner/OTA `property_blocked_dates` check. Used only by the guest-form
       * completion flow (calendar sync §6.5): the booking being completed already has a
       * matching `source='ical_import'` block on its own dates, so a normal blocked-nights
       * check would collide with itself. Dates are locked and were validated at ingestion.
       */
      skipOwnerBlockCheck?: boolean;
    }
  ) {
    console.log('Checking for overlapping bookings...');
    console.log('Check-in:', checkInDate, 'Check-out:', checkOutDate, 'Booking ID:', bookingId);

    try {
      // Normalize dates to YYYY-MM-DD format for comparison
      const normalizeDate = (dateStr: string): string => {
        console.log(`  Normalizing date: "${dateStr}"`);

        // Check if date is in YYYY-MM-DD format (already normalized)
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          console.log(`  → Already in YYYY-MM-DD format: ${dateStr}`);
          return dateStr;
        }
        // Check if date is in MM-DD-YYYY format
        if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
          const [month, day, year] = dateStr.split('-');
          const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          console.log(`  → Converted from MM-DD-YYYY to: ${normalized}`);
          return normalized;
        }
        // Return as-is if format is unknown
        console.warn('  ⚠️ Unknown date format:', dateStr);
        return dateStr;
      };

      const newCheckIn = normalizeDate(checkInDate);
      const newCheckOut = normalizeDate(checkOutDate);

      console.log('Normalized dates - Check-in:', newCheckIn, 'Check-out:', newCheckOut);

      // Query for overlapping bookings
      // Two date ranges overlap if:
      // (StartA < EndB) AND (EndA > StartB)
      //
      // However, we allow check-in on checkout dates (same day turnover), so we exclude:
      // - New check-in === existing check-out
      // - New check-out === existing check-in

      // Phase 2+: only CANCELLED bookings free dates — every other status blocks.
      // IMPORTED bookings are historical records — must not block live availability,
      // same as CANCELLED. A host importing a past stay should not prevent new bookings.
      let query = this.supabase
        .from('guest_submissions')
        .select('id, check_in_date, check_out_date, status, primary_guest_name')
        .neq('status', 'CANCELLED')
        .neq('status', 'IMPORTED');

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      // Exclude the current booking if updating
      if (bookingId) {
        query = query.neq('id', bookingId);
      }

      const { data: allBookings, error } = await query;

      if (error) {
        console.error('Database error:', error);
        throw new Error('Failed to check for overlapping bookings');
      }

      const activeBookings = allBookings || [];

      console.log(
        `Found ${allBookings?.length || 0} non-CANCELLED bookings, ${activeBookings.length} active bookings to check for overlaps`
      );

      // Filter overlapping bookings in memory
      const overlappingBookings =
        activeBookings?.filter((booking) => {
          const existingCheckIn = normalizeDate(booking.check_in_date);
          const existingCheckOut = normalizeDate(booking.check_out_date);

          console.log(`Comparing with existing booking ${booking.id}:`);
          console.log(`  Existing: ${existingCheckIn} to ${existingCheckOut}`);
          console.log(`  New: ${newCheckIn} to ${newCheckOut}`);

          // Check if dates overlap
          // New booking overlaps if:
          // - New check-in is before existing check-out AND
          // - New check-out is after existing check-in
          // However, we allow check-in on checkout dates (same day turnover)
          const overlaps =
            newCheckIn < existingCheckOut &&
            newCheckOut > existingCheckIn &&
            !(newCheckIn === existingCheckOut || newCheckOut === existingCheckIn);

          console.log(`  Overlap detected: ${overlaps}`);
          console.log(
            `    - newCheckIn (${newCheckIn}) < existingCheckOut (${existingCheckOut}): ${newCheckIn < existingCheckOut}`
          );
          console.log(
            `    - newCheckOut (${newCheckOut}) > existingCheckIn (${existingCheckIn}): ${newCheckOut > existingCheckIn}`
          );
          console.log(
            `    - Allowing check-in on checkout date: ${newCheckIn === existingCheckOut ? 'YES (no overlap)' : 'N/A'}`
          );

          if (overlaps) {
            console.warn(
              '⚠️ OVERLAP DETECTED with booking:',
              booking.id,
              '- Guest:',
              booking.primary_guest_name
            );
          }

          return overlaps;
        }) || [];

      console.log(
        `✓ Overlap check complete: Found ${overlappingBookings.length} overlapping booking(s)`
      );

      // Owner-managed date blocks (`property_blocked_dates`) are unavailable to guests
      // the same way an existing booking is — checked alongside the overlap query so
      // every caller (submit-form today, future update paths) gets both signals at once.
      const blockedByOwner =
        propertyId && !options?.skipOwnerBlockCheck
          ? await hasBlockedNightsInRange(propertyId, newCheckIn, newCheckOut)
          : false;

      return {
        hasOverlap: overlappingBookings.length > 0,
        overlappingBookings,
        blockedByOwner,
      };
    } catch (error) {
      console.error('Error checking overlapping bookings:', error);
      throw error;
    }
  }

  /**
   * Adjacent bookings that immediately precede or follow the requested stay on the
   * same day. Used for cleaning-window / turnover warnings in the AI summary.
   */
  static async getAdjacentBookings(
    checkInDate: string,
    checkOutDate: string,
    bookingId?: string,
    propertyId?: string
  ) {
    const normalizeDate = (dateStr: string): string => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
      if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
        const [month, day, year] = dateStr.split('-');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      return dateStr;
    };

    const newCheckIn = normalizeDate(checkInDate);
    const newCheckOut = normalizeDate(checkOutDate);

    let query = this.supabase
      .from('guest_submissions')
      .select(
        'id, check_in_date, check_out_date, check_in_time, check_out_time, status, primary_guest_name'
      )
      .neq('status', 'CANCELLED')
      .neq('status', 'IMPORTED')
      .or(`check_out_date.eq.${newCheckIn},check_in_date.eq.${newCheckOut}`);

    if (propertyId) {
      query = query.eq('property_id', propertyId);
    }
    if (bookingId) {
      query = query.neq('id', bookingId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('getAdjacentBookings error:', error);
      throw new Error('Failed to load adjacent bookings');
    }
    return (data || []).map((b) => ({
      ...b,
      check_in_date: normalizeDate(b.check_in_date),
      check_out_date: normalizeDate(b.check_out_date),
    }));
  }

  /**
   * All non-cancelled stays for calendar availability / Telegram marketing copy.
   */
  static async listBookingRangesForAvailability(
    propertyId?: string
  ): Promise<{ checkInYmd: string; checkOutYmd: string }[]> {
    let query = this.supabase
      .from('guest_submissions')
      .select('check_in_date, check_out_date, status')
      .neq('status', 'CANCELLED')
      // IMPORTED bookings are historical records — must not block live availability.
      .neq('status', 'IMPORTED');
    if (propertyId) {
      query = query.eq('property_id', propertyId);
    }
    const { data, error } = await query;

    if (error) {
      console.error('listBookingRangesForAvailability:', error);
      throw new Error('Failed to load booking ranges');
    }

    const normalizeDate = (dateStr: string): string | null => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
      if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
        const [month, day, year] = dateStr.split('-');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      return null;
    };

    const rows = data ?? [];

    const out: { checkInYmd: string; checkOutYmd: string }[] = [];
    for (const r of rows) {
      const ci = normalizeDate(r.check_in_date);
      const co = normalizeDate(r.check_out_date);
      if (ci && co && ci < co) out.push({ checkInYmd: ci, checkOutYmd: co });
    }
    return out;
  }

  static async getTelegramMarketingSettings(
    propertyId?: string,
    parkingId?: string
  ): Promise<Record<string, unknown> | null> {
    let query = this.supabase.from('telegram_marketing_settings').select('*');
    query = applyAssetScopeFilter(query, { propertyId, parkingId });
    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('getTelegramMarketingSettings:', error);
      const pg = `${error.code ?? ''} ${error.message ?? ''}`.trim();
      throw new Error(
        `Failed to load Telegram marketing settings${pg ? `: ${pg}` : ''}. ` +
          `On production this usually means the table is missing — run migration ` +
          `20260614120000_telegram_marketing_settings.sql (or “supabase db push”) on this project.`
      );
    }
    return data;
  }

  static async updateTelegramMarketingSettings(
    patch: Record<string, unknown>,
    propertyId?: string,
    parkingId?: string
  ): Promise<Record<string, unknown>> {
    return updateAssetScopedSingleton(
      this.supabase,
      'telegram_marketing_settings',
      patch,
      { propertyId, parkingId },
      'updateTelegramMarketingSettings',
      'Failed to update Telegram marketing settings'
    );
  }

  static async updateAppSettings(
    patch: Record<string, unknown>,
    propertyId?: string
  ): Promise<Record<string, unknown>> {
    return updatePropertyScopedSingleton(
      this.supabase,
      'app_settings',
      patch,
      propertyId,
      'updateAppSettings',
      'Failed to update app settings'
    );
  }

  static async updateOrgSettings(
    patch: Record<string, unknown>,
    organizationId: string
  ): Promise<Record<string, unknown>> {
    const { data, error } = await this.supabase
      .from('org_settings')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('updateOrgSettings:', error);
      throw new Error(`Failed to update org settings: ${error.message ?? 'unknown error'}`);
    }
    return data;
  }

  static async syncTelegramMarketingDailyCronJobs(
    slots: { hour: number; minute: number }[]
  ): Promise<{ ok?: boolean; error?: string; scheduled?: number }> {
    return callRpcObject(
      this.supabase,
      'sync_telegram_marketing_daily_cron_jobs',
      {
        p_slots: slots as never,
      },
      'syncTelegramMarketingDailyCronJobs rpc:'
    );
  }

  /** Property-scoped dispatch: single 5-min pg_cron tick; handlers filter by Manila schedule. */
  static async ensureTelegramMultiPropertyCronDispatch(): Promise<{
    ok?: boolean;
    error?: string;
    cronExpr?: string;
  }> {
    return callRpcObject(
      this.supabase,
      'ensure_telegram_multi_property_cron_dispatch',
      undefined,
      'ensureTelegramMultiPropertyCronDispatch rpc:'
    );
  }

  static async getTelegramStaffSettings(
    propertyId?: string,
    parkingId?: string
  ): Promise<Record<string, unknown> | null> {
    let query = this.supabase.from('telegram_staff_settings').select('*');
    query = applyAssetScopeFilter(query, { propertyId, parkingId });
    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('getTelegramStaffSettings:', error);
      const pg = `${error.code ?? ''} ${error.message ?? ''}`.trim();
      throw new Error(
        `Failed to load Telegram staff settings${pg ? `: ${pg}` : ''}. ` +
          `On production this usually means the table is missing — run migration ` +
          `20260622120000_telegram_staff_settings.sql (or "supabase db push") on this project.`
      );
    }
    return data;
  }

  static async updateTelegramStaffSettings(
    patch: Record<string, unknown>,
    propertyId?: string,
    parkingId?: string
  ): Promise<Record<string, unknown>> {
    return updateAssetScopedSingleton(
      this.supabase,
      'telegram_staff_settings',
      patch,
      { propertyId, parkingId },
      'updateTelegramStaffSettings',
      'Failed to update Telegram staff settings'
    );
  }

  static async syncTelegramStaffDailyCronJob(slot: {
    hour: number;
    minute: number;
  }): Promise<{ ok?: boolean; error?: string; cronExpr?: string }> {
    return callRpcObject(
      this.supabase,
      'sync_telegram_staff_daily_cron_job',
      {
        p_slot: slot as never,
      },
      'syncTelegramStaffDailyCronJob rpc:'
    );
  }

  static async getTelegramFinanceSettings(
    propertyId?: string,
    parkingId?: string
  ): Promise<Record<string, unknown> | null> {
    let query = this.supabase.from('telegram_finance_settings').select('*');
    query = applyAssetScopeFilter(query, { propertyId, parkingId });
    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('getTelegramFinanceSettings:', error);
      const pg = `${error.code ?? ''} ${error.message ?? ''}`.trim();
      throw new Error(
        `Failed to load Telegram finance settings${pg ? `: ${pg}` : ''}. ` +
          `Run migration 20260710120000_finance_telegram_reminders.sql on this project.`
      );
    }
    return data;
  }

  static async updateTelegramFinanceSettings(
    patch: Record<string, unknown>,
    propertyId?: string,
    parkingId?: string
  ): Promise<Record<string, unknown>> {
    return updateAssetScopedSingleton(
      this.supabase,
      'telegram_finance_settings',
      patch,
      { propertyId, parkingId },
      'updateTelegramFinanceSettings',
      'Failed to update Telegram finance settings'
    );
  }

  static async syncTelegramFinanceDailyCronJob(slot: {
    hour: number;
    minute: number;
  }): Promise<{ ok?: boolean; error?: string; cronExpr?: string }> {
    return callRpcObject(
      this.supabase,
      'sync_telegram_finance_daily_cron_job',
      {
        p_slot: slot as never,
      },
      'syncTelegramFinanceDailyCronJob rpc:'
    );
  }

  static async getTelegramMaintenanceSettings(
    propertyId?: string,
    parkingId?: string
  ): Promise<Record<string, unknown> | null> {
    let query = this.supabase.from('telegram_maintenance_settings').select('*');
    query = applyAssetScopeFilter(query, { propertyId, parkingId });
    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('getTelegramMaintenanceSettings:', error);
      const pg = `${error.code ?? ''} ${error.message ?? ''}`.trim();
      throw new Error(
        `Failed to load Telegram maintenance settings${pg ? `: ${pg}` : ''}. ` +
          `Run migration 20260818120000_maintenance_module.sql on this project.`
      );
    }
    return data;
  }

  static async getTelegramChatSettings(
    propertyId?: string,
    parkingId?: string
  ): Promise<Record<string, unknown> | null> {
    let query = this.supabase.from('telegram_chat_settings').select('*');
    query = applyAssetScopeFilter(query, { propertyId, parkingId });
    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('getTelegramChatSettings:', error);
      const pg = `${error.code ?? ''} ${error.message ?? ''}`.trim();
      throw new Error(
        `Failed to load Telegram chat settings${pg ? `: ${pg}` : ''}. ` +
          `Run migration 20260929120000_telegram_chat_settings.sql on this project.`
      );
    }
    return data;
  }

  static async updateTelegramChatSettings(
    patch: Record<string, unknown>,
    propertyId?: string,
    parkingId?: string
  ): Promise<Record<string, unknown>> {
    return updateAssetScopedSingleton(
      this.supabase,
      'telegram_chat_settings',
      patch,
      { propertyId, parkingId },
      'updateTelegramChatSettings',
      'Failed to update Telegram chat settings'
    );
  }

  static async updateTelegramMaintenanceSettings(
    patch: Record<string, unknown>,
    propertyId?: string,
    parkingId?: string
  ): Promise<Record<string, unknown>> {
    return updateAssetScopedSingleton(
      this.supabase,
      'telegram_maintenance_settings',
      patch,
      { propertyId, parkingId },
      'updateTelegramMaintenanceSettings',
      'Failed to update Telegram maintenance settings'
    );
  }

  static async syncTelegramMaintenanceHourlyCronJob(): Promise<{
    ok?: boolean;
    error?: string;
    cronExpr?: string;
  }> {
    return callRpcObject(
      this.supabase,
      'sync_telegram_maintenance_hourly_cron_job',
      undefined,
      'syncTelegramMaintenanceHourlyCronJob rpc:'
    );
  }

  static async getTelegramParkingSettings(
    parkingId: string
  ): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.supabase
      .from('telegram_parking_settings')
      .select('*')
      .eq('parking_id', parkingId)
      .maybeSingle();

    if (error) {
      console.error('getTelegramParkingSettings:', error);
      const pg = `${error.code ?? ''} ${error.message ?? ''}`.trim();
      throw new Error(
        `Failed to load Telegram parking settings${pg ? `: ${pg}` : ''}. ` +
          `Run migration 20260918150000_telegram_parking_settings.sql on this project.`
      );
    }
    return data;
  }

  static async updateTelegramParkingSettings(
    patch: Record<string, unknown>,
    parkingId: string
  ): Promise<Record<string, unknown>> {
    return updateAssetScopedSingleton(
      this.supabase,
      'telegram_parking_settings',
      patch,
      { parkingId },
      'updateTelegramParkingSettings',
      'Failed to update Telegram parking settings'
    );
  }

  static async getTelegramAdminSettings(
    propertyId?: string,
    parkingId?: string
  ): Promise<Record<string, unknown> | null> {
    let query = this.supabase.from('telegram_admin_settings').select('*');
    query = applyAssetScopeFilter(query, { propertyId, parkingId });
    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('getTelegramAdminSettings:', error);
      const pg = `${error.code ?? ''} ${error.message ?? ''}`.trim();
      throw new Error(
        `Failed to load Telegram admin settings${pg ? `: ${pg}` : ''}. ` +
          `Run migration 20260702120000_telegram_admin_settings.sql on this project.`
      );
    }
    return data;
  }

  static async updateTelegramAdminSettings(
    patch: Record<string, unknown>,
    propertyId?: string,
    parkingId?: string
  ): Promise<Record<string, unknown>> {
    return updateAssetScopedSingleton(
      this.supabase,
      'telegram_admin_settings',
      patch,
      { propertyId, parkingId },
      'updateTelegramAdminSettings',
      'Failed to update Telegram admin settings'
    );
  }

  static async syncTelegramAdminHourlyCronJob(): Promise<{
    ok?: boolean;
    error?: string;
    cronExpr?: string;
  }> {
    return callRpcObject(
      this.supabase,
      'sync_telegram_admin_hourly_cron_job',
      undefined,
      'syncTelegramAdminHourlyCronJob rpc:'
    );
  }
}
