import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';

import { zodResolver } from '@hookform/resolvers/zod';
import dayjs from 'dayjs';
import {
  Upload,
  Loader2,
  Settings,
  ClipboardPaste,
  XCircle,
  PartyPopper,
  User,
} from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import { GuestVoucherEstimateSummary } from '@/features/guest/account/components/GuestVoucherUi';
import { useGuestVouchersQuery } from '@/features/guest/account/hooks/useGuestVouchersQuery';
import {
  computePercentDiscountPhp,
  formatVoucherOfferLabel,
} from '@/features/guest/account/lib/voucherDiscount';
import { useGuestAuth } from '@/features/guest/auth/context/GuestAuthContext';
import { guestEdgeAuthHeaders } from '@/features/guest/auth/lib/guestEdgeAuthHeaders';
import {
  maxAllowedCheckOutTime,
  minAllowedCheckInTime,
} from '@/features/guest/calendar/lib/guestCalendarAvailability';
import { GuestFormGuestsSection } from '@/features/guest/form/components/GuestFormGuestsSection';
import {
  GuestFormInfoCallout,
  GuestFormOptionCard,
} from '@/features/guest/form/components/GuestFormOptionCard';
import { GuestFormPaymentStepContent } from '@/features/guest/form/components/GuestFormPaymentStepContent';
import { GuestFormStepNavigation } from '@/features/guest/form/components/GuestFormStepNavigation';
import { GuestFormStepper } from '@/features/guest/form/components/GuestFormStepper';
import { GuestFormVoucherPicker } from '@/features/guest/form/components/GuestFormVoucherPicker';
import {
  defaultFormValues,
  getGuestFormDefaultValuesFromSearchParams,
} from '@/features/guest/form/constants/guestFormData';
import {
  DEFAULT_GUEST_PAYMENT_INFO,
  useGuestPaymentInfo,
} from '@/features/guest/form/hooks/useGuestPaymentInfo';
import {
  formatBookingInfoForClipboard,
  parseBookingInfoFromClipboard,
} from '@/features/guest/form/lib/bookingFormatter';
import {
  bookingSourceFromUrlSearchParams,
  hasStrippedGuestQueryKeys,
  stripLegacyFromQueryParam,
} from '@/features/guest/form/lib/bookingSourceFromSearchParams';
import { FIND_US_OPTIONS } from '@/features/guest/form/lib/findUsOptions';
import {
  appendGuestBookingAccess,
  captureGuestBookingAccessFromSearchParams,
  guestFormFetchUrl,
  storeGuestBookingAccessToken,
} from '@/features/guest/form/lib/guestBookingAccess';
import { computeGuestCountsByAge } from '@/features/guest/form/lib/guestCounts';
import {
  formatGafEmailHint,
  formatGuestCopyPasteHint,
  formatGuestLockedChangeHint,
  formatNoPaidParkingDescription,
  formatPaidParkingDescription,
  formatPetFeeLine,
  formatPetPolicyTitle,
  formatResidenceShortName,
  pickGuestBrandHeaderProps,
} from '@/features/guest/form/lib/guestFormBranding';
import {
  clampGuestFormStep,
  getFieldsForGuestFormStep,
  isGuestFormStepComplete,
  getGuestFormSteps,
  getGuestFormStepCount,
  type GuestFormStepId,
  type GuestFormVisibilityFlags,
} from '@/features/guest/form/lib/guestFormSteps';
import {
  appendGuestPropertyToParams,
  guestBookedDatesUrl,
} from '@/features/guest/form/lib/guestPropertyScope';
import {
  createGuestFormSchema,
  type GuestFormData,
} from '@/features/guest/form/schemas/guestFormSchema';
import {
  useGuestPropertySearchParams,
  useGuestPropertySlug,
} from '@/features/guest/hooks/useGuestPropertySlug';
import {
  guestCalendarPath,
  guestFormPath,
  guestSuccessPath,
} from '@/features/guest/lib/guestPublicPaths';
import { usePublicPropertyDetail } from '@/features/guest/marketing/properties/hooks/usePublicPropertyDetail';
import { GuestStayContextBar } from '@/features/guest/property/components/GuestStayContextBar';


import {
  computeDefaultBookingRate,
  FALLBACK_PROPERTY_PRICING_DEFAULTS,
} from '@/features/dashboard/pricing/lib/pricingCompute';

import { GuestFormBrandHeader } from '@/components/branding/GuestFormBrandHeader';
import { bottomTabBarOffsetClassName } from '@/components/mobile/BottomTabBar';
import { useAntiSpamSubmit } from '@/components/security/useAntiSpamSubmit';
import { GuestFormPageSkeleton } from '@/components/skeletons/GuestPageSkeletons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { IsoDateInput } from '@/components/ui/iso-date-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { TimePicker } from '@/components/ui/time-picker';
import { FORM_PLACEHOLDERS } from '@/lib/constants/formPlaceholders';
import { prepareUpload } from '@/lib/media/prepareUpload';
import { setAnalyticsScope } from '@/lib/posthog/context';
import {
  clearGuestFormStartedMarker,
  guestFormStepAnalyticsName,
  trackGuestFormAbandoned,
  trackGuestFormStarted,
  trackGuestFormStepCompleted,
  trackGuestFormStepFailed,
} from '@/lib/posthog/guestFormAnalytics';
import { antiSpamErrorMessage, isAntiSpamFailure } from '@/lib/security/antiSpamResponse';
import { cn } from '@/lib/utils';
import { generateRandomData, setDummyFile } from '@/utils/dev/mockData';
import {
  formatTimeToAMPM,
  formatStayDateRange,
  getNextDay,
  createDisabledDateMatcher,
  createDisabledCheckoutDateMatcher,
  stringToDate,
  dateToString,
  normalizeDateString,
  getManilaYmdToday,
  DATE_PICKER_DISPLAY_FORMAT,
  type BookedDateRange,
} from '@/utils/format/dates';
import { toCapitalCase, transformFieldValues } from '@/utils/text/formatters';
import {
  handleNameInputChange,
  validateImageFile,
  fetchImageAsFile,
  handleFileUpload,
} from '@/utils/text/helpers';

function guestContactChannelLabel(isAirbnb: boolean, isFacebook: boolean): string {
  if (isAirbnb) return 'on Airbnb';
  if (isFacebook) return 'on Facebook';
  return 'to contact us';
}

function guestNameFieldLabel(isAirbnb: boolean, isFacebook: boolean): string {
  if (isAirbnb) return 'Airbnb Name';
  if (isFacebook) return 'Facebook Name';
  return 'Full Name';
}

function guestNamePlaceholder(isAirbnb: boolean, isFacebook: boolean): string {
  if (isAirbnb || isFacebook) {
    return `Your exact full name in ${isAirbnb ? 'Airbnb' : 'Facebook'}`;
  }
  return 'Your exact full name';
}

function decorPlatformLabel(isAirbnb: boolean, isFacebook: boolean): string | null {
  if (isAirbnb) return 'Airbnb';
  if (isFacebook) return 'Facebook';
  return null;
}

function guestEarlyLateContactLabel(isAirbnb: boolean, isFacebook: boolean): string {
  if (isAirbnb) return 'Message host via Airbnb.';
  if (isFacebook) return 'Message us on Facebook.';
  return 'Contact us to arrange.';
}

const isProduction = import.meta.env.VITE_NODE_ENV === 'production';
const apiUrl = import.meta.env.VITE_API_URL;

/** Step actions lifted into a host footer (e.g. GuestDialogShell). */
export type GuestFormEmbedNav = {
  currentStep: GuestFormStepId;
  stepCount: number;
  isSubmitting: boolean;
  canProceed: boolean;
  submitReady: boolean;
  show: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
};

/** Booking summary handed to the host surface on successful submission. */
export type GuestFormBookingSummary = {
  checkInDate: string;
  checkOutDate: string;
  checkInTime: string;
  checkOutTime: string;
  numberOfAdults: number;
  numberOfChildren: number;
  primaryGuestName: string;
  guest2Name?: string;
  guest3Name?: string;
  guest4Name?: string;
  guest5Name?: string;
  hasPets: boolean;
  petName?: string;
  needParking: boolean;
  guestEmail: string;
  guestPhoneNumber: string;
};

export type GuestFormSubmitSuccess = {
  bookingId: string;
  bookingData: GuestFormBookingSummary;
};

/** Embed the same form on another surface (e.g. property Reserve modal, admin New booking modal). */
export type GuestFormEmbed = {
  checkInDate?: string | null;
  checkOutDate?: string | null;
  numberOfAdults?: number;
  numberOfChildren?: number;
  /** Tighter outer padding when hosted inside a dialog. */
  compactChrome?: boolean;
  /** When set, step nav is omitted inline and reported here for a modal footer. */
  onNavChange?: (nav: GuestFormEmbedNav | null) => void;
  /** Admin-created bookings: skip the guest sign-in gate (shares the admin's own Supabase session). */
  skipAuthGate?: boolean;
  /** When set, submission success is reported here instead of navigating to the public success page. */
  onSubmitSuccess?: (result: GuestFormSubmitSuccess) => void;
};

export type GuestFormProps = {
  embed?: GuestFormEmbed;
};

export function GuestForm({ embed }: GuestFormProps = {}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guestCanUpdate, setGuestCanUpdate] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);
  const [invalidBookingId, setInvalidBookingId] = useState(false);
  const [validIdPreviews, setValidIdPreviews] = useState<Record<string, string | null>>({});
  const [validIdImageErrors, setValidIdImageErrors] = useState<Record<string, boolean>>({});
  const [paymentReceiptPreview, setPaymentReceiptPreview] = useState<string | null>(null);
  const [petVaccinationPreview, setPetVaccinationPreview] = useState<string | null>(null);
  const [petImagePreview, setPetImagePreview] = useState<string | null>(null);
  const [currentBookingId, setCurrentBookingId] = useState<string | null>(null);
  const [bookedDates, setBookedDates] = useState<BookedDateRange[]>([]);
  const [guestSectionSeedKey, setGuestSectionSeedKey] = useState(0);
  const prevGuestFacebookNameRef = useRef('');
  const [currentStep, setCurrentStep] = useState<GuestFormStepId>(1);
  const [submitReady, setSubmitReady] = useState(false);
  const stepPanelRef = useRef<HTMLDivElement>(null);
  const pendingSubmitAfterAuthRef = useRef(false);
  const guestFormStartedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const petVaccinationInputRef = useRef<HTMLInputElement>(null);
  const petImageInputRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const propertySlug = useGuestPropertySlug();
  const scopedSearchParams = useGuestPropertySearchParams();
  const { data: publicProperty } = usePublicPropertyDetail(propertySlug ?? '');
  const { data: propertyVouchers = [], isLoading: propertyVouchersLoading } = useGuestVouchersQuery(
    {
      propertySlug: propertySlug ?? undefined,
      enabled: Boolean(propertySlug),
    }
  );
  const bookingId = searchParams.get('bookingId');
  // Calendar-sync Phase 2 (§6.5): host-forwarded link to complete an already-ingested
  // Airbnb/OTA booking. Dates come locked from the reservation; submit goes to a dedicated
  // update-only endpoint.
  const completionToken = searchParams.get('complete');
  const isCompletionMode = Boolean(completionToken);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [completionReady, setCompletionReady] = useState(!isCompletionMode);
  // Invisible anti-spam (Turnstile + honeypot/timing). The Turnstile `action`
  // must match the edge scope. Plan: docs/workflow/for-testing/captcha-anti-spam-hardening.md
  const antiSpam = useAntiSpamSubmit({
    action: isCompletionMode ? 'submit-form-completion' : 'submit-form',
  });
  const navigate = useNavigate();
  const skipAuthGate = Boolean(embed?.skipAuthGate);
  const { status: guestAuthStatus, requireGuestAuth, formSubmitResumeTick } = useGuestAuth();

  // Same entry gate as `/messages`: require sign-in before the form is usable.
  useEffect(() => {
    if (skipAuthGate || guestAuthStatus !== 'anonymous') return;
    const to = `${location.pathname}${location.search}`;
    requireGuestAuth(() => undefined, {
      resume: { type: 'navigate', to },
    });
  }, [skipAuthGate, guestAuthStatus, requireGuestAuth, location.pathname, location.search]);
  const {
    data: guestPaymentInfo = DEFAULT_GUEST_PAYMENT_INFO,
    isFetched: guestPaymentInfoFetched,
    isPlaceholderData: guestPaymentInfoPlaceholder,
  } = useGuestPaymentInfo();

  // `?source=airbnb` → Airbnb labels + DB `booking_source`. The completion link (§6.5) is
  // always for an Airbnb/OTA booking → same visibility (no payment step, no receipt).
  const bookingSource = isCompletionMode
    ? 'Airbnb'
    : bookingSourceFromUrlSearchParams(searchParams);
  const isAirbnb = bookingSource === 'Airbnb';
  const isFacebook = bookingSource === 'Facebook';

  const visibilityFlags = useMemo<GuestFormVisibilityFlags>(
    () => ({
      isAirbnb,
      allowParking: guestPaymentInfo.allowParking,
      allowPets: guestPaymentInfo.allowPets,
      allowSurpriseDecor: guestPaymentInfo.allowSurpriseDecor,
      maxAdults: guestPaymentInfo.maxAdults,
      maxChildren: guestPaymentInfo.maxChildren,
      residenceName: guestPaymentInfo.residenceName,
      bookedDates,
      cleaningBufferMinutes: guestPaymentInfo.cleaningBufferMinutes,
      currentBookingId,
    }),
    [
      isAirbnb,
      guestPaymentInfo.allowParking,
      guestPaymentInfo.allowPets,
      guestPaymentInfo.allowSurpriseDecor,
      guestPaymentInfo.maxAdults,
      guestPaymentInfo.maxChildren,
      guestPaymentInfo.residenceName,
      bookedDates,
      guestPaymentInfo.cleaningBufferMinutes,
      currentBookingId,
    ]
  );

  const parkingNoPaidDescription = formatNoPaidParkingDescription(guestPaymentInfo.residenceName);
  const parkingPaidDescription = formatPaidParkingDescription(guestPaymentInfo.residenceName);
  const petPolicyTitle = formatPetPolicyTitle(guestPaymentInfo.residenceName);
  const petPolicyResidence =
    formatResidenceShortName(guestPaymentInfo.residenceName) || 'The building';
  const gafEmailHint = formatGafEmailHint(guestPaymentInfo.residenceName);
  const petFeeLine = formatPetFeeLine(guestPaymentInfo.petFee);
  const brandHeader = pickGuestBrandHeaderProps(guestPaymentInfo);

  const propertyCheckInTime = guestPaymentInfo.checkInTime;
  const propertyCheckOutTime = guestPaymentInfo.checkOutTime;
  const propertyCheckInLabel = formatTimeToAMPM(propertyCheckInTime, true);
  const propertyCheckOutLabel = formatTimeToAMPM(propertyCheckOutTime, false);
  const guestCapacity = useMemo(
    () => ({
      maxAdults: guestPaymentInfo.maxAdults,
      maxChildren: guestPaymentInfo.maxChildren,
    }),
    [guestPaymentInfo.maxAdults, guestPaymentInfo.maxChildren]
  );

  /** Snapshot once per mount so RHF defaults match calendar URL (not overwritten by object identity). */
  const seededDefaultsRef = useRef<Partial<GuestFormData> | null>(null);
  if (seededDefaultsRef.current === null) {
    const defaults = getGuestFormDefaultValuesFromSearchParams(searchParams);
    const embedIn = embed?.checkInDate?.trim();
    const embedOut = embed?.checkOutDate?.trim();
    if (embedIn && embedOut && !searchParams.get('bookingId')?.trim()) {
      const normalizedIn = normalizeDateString(embedIn);
      const normalizedOut = normalizeDateString(embedOut);
      if (normalizedIn && normalizedOut) {
        defaults.checkInDate = normalizedIn;
        defaults.checkOutDate = normalizedOut;
      }
    }
    if (embed?.numberOfAdults != null && embed.numberOfAdults >= 1) {
      defaults.numberOfAdults = embed.numberOfAdults;
    }
    if (embed?.numberOfChildren != null && embed.numberOfChildren >= 0) {
      defaults.numberOfChildren = embed.numberOfChildren;
    }
    if (isAirbnb) {
      defaults.findUs = 'Airbnb';
    }
    seededDefaultsRef.current = defaults;
  }

  // Pre-selected dates: embed (Reserve modal) wins over URL calendar handoff
  const urlCheckInDate = embed?.checkInDate?.trim() || searchParams.get('checkInDate');
  const urlCheckOutDate = embed?.checkOutDate?.trim() || searchParams.get('checkOutDate');

  /** Dev control panel: non-production builds only — never gated by `?dev=true`. */
  const showDevControls = !isProduction;

  // Dev API action controls — all on by default; uncheck to skip (matches admin dev-control UX).
  const [devApiControls, setDevApiControls] = useState({
    saveToDatabase: true,
    saveImagesToStorage: true,
    sendEmail: true,
  });

  const guestFormSteps = useMemo(() => getGuestFormSteps(visibilityFlags), [visibilityFlags]);
  const guestFormStepCount = getGuestFormStepCount(visibilityFlags);
  const activeStepConfig = guestFormSteps[currentStep - 1];

  const form = useForm<GuestFormData>({
    resolver: zodResolver(createGuestFormSchema(visibilityFlags), undefined, {
      raw: true,
      mode: 'sync',
    }),
    defaultValues: seededDefaultsRef.current ?? defaultFormValues,
    mode: 'all',
  });

  const checkInWatched = useWatch({ control: form.control, name: 'checkInDate' });
  const checkOutWatched = useWatch({ control: form.control, name: 'checkOutDate' });
  const appliedVoucherSourceBookingId = useWatch({
    control: form.control,
    name: 'appliedVoucherSourceBookingId',
  });
  const estimatedStayPhp = useMemo(() => {
    if (!checkInWatched || !checkOutWatched) return null;
    const base =
      publicProperty?.pricing?.baseRate ?? FALLBACK_PROPERTY_PRICING_DEFAULTS.weekdayNightlyRate;
    const defaults = {
      ...FALLBACK_PROPERTY_PRICING_DEFAULTS,
      weekdayNightlyRate: base,
      weekendNightlyRate: base,
    };
    return computeDefaultBookingRate(
      {
        check_in_date: checkInWatched,
        check_out_date: checkOutWatched,
        number_of_nights: null,
      },
      defaults
    );
  }, [checkInWatched, checkOutWatched, publicProperty?.pricing?.baseRate]);
  const selectedVoucher = propertyVouchers.find(
    (v) => v.sourceBookingId === appliedVoucherSourceBookingId
  );
  const estimatedVoucherDiscount =
    selectedVoucher && estimatedStayPhp != null
      ? selectedVoucher.percentOff > 0
        ? computePercentDiscountPhp(estimatedStayPhp, selectedVoucher.percentOff)
        : selectedVoucher.legacyAmountPhp
          ? Math.min(estimatedStayPhp, selectedVoucher.legacyAmountPhp)
          : 0
      : 0;

  // Generate a new booking ID for new submissions
  useEffect(() => {
    if (!bookingId) {
      const newBookingId = crypto.randomUUID();
      setCurrentBookingId(newBookingId);
    } else {
      // Sanitize bookingId to remove any query parameters or extra characters
      // Extract only the UUID part (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
      const cleanBookingId = bookingId.split('?')[0].split('&')[0].trim();
      setCurrentBookingId(cleanBookingId);
      captureGuestBookingAccessFromSearchParams(cleanBookingId, searchParams);
    }
  }, [bookingId, searchParams]);

  // Strip `dev` / `testing` / control flags / legacy `from`; migrate `from=airbnb` → `source=airbnb`
  // Skip when embedded — must not navigate the host page away to `/form`.
  useEffect(() => {
    if (embed) return;
    if (!propertySlug || !hasStrippedGuestQueryKeys(searchParams)) return;
    const next = stripLegacyFromQueryParam(new URLSearchParams(searchParams));
    if (searchParams.get('from')?.trim().toLowerCase() === 'airbnb') {
      next.set('source', 'airbnb');
    }
    navigate(guestFormPath(propertySlug, next), { replace: true });
  }, [embed, navigate, propertySlug, searchParams]);

  // Fetch booked dates function (extracted so it can be reused)
  const fetchBookedDates = async () => {
    try {
      const response = await fetch(guestBookedDatesUrl(apiUrl, propertySlug, searchParams), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });

      const result = await response.json();

      if (response.ok && result.success && result.data) {
        // Normalize all date strings to YYYY-MM-DD format
        const normalizedDates = result.data.map((booking: BookedDateRange) => ({
          ...booking,
          checkInDate: normalizeDateString(booking.checkInDate),
          checkOutDate: normalizeDateString(booking.checkOutDate),
        }));
        setBookedDates(normalizedDates);
      } else {
        console.error('❌ Failed to fetch booked dates:', result);
        toast.error('Could not load availability. Some already-booked dates may not be blocked.');
      }
    } catch (error) {
      console.error('❌ Error fetching booked dates:', error);
      toast.error('Could not load availability. Some already-booked dates may not be blocked.');
    }
  };

  // Fetch booked dates on component mount
  useEffect(() => {
    fetchBookedDates();
  }, []);

  // Calendar-sync completion link: resolve the token → lock the stay onto the form.
  useEffect(() => {
    if (!completionToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiUrl}/get-form-completion?complete=${encodeURIComponent(completionToken)}`,
          {
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
          }
        );
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json?.data) {
          setCompletionError(
            res.status === 410
              ? 'This link has expired. The stay has already ended. Contact your host if you still need to complete it.'
              : 'This link is not valid. Ask your host to send you a fresh guest-form link.'
          );
          setCompletionReady(true);
          return;
        }
        const stay = json.data.stay ?? {};
        const prefill = json.data.prefill ?? {};
        if (stay.checkInDate) form.setValue('checkInDate', normalizeDateString(stay.checkInDate));
        if (stay.checkOutDate)
          form.setValue('checkOutDate', normalizeDateString(stay.checkOutDate));
        if (stay.checkInTime) form.setValue('checkInTime', stay.checkInTime);
        if (stay.checkOutTime) form.setValue('checkOutTime', stay.checkOutTime);
        if (typeof stay.numberOfNights === 'number' && stay.numberOfNights > 0) {
          form.setValue('numberOfNights', stay.numberOfNights);
        }
        if (prefill.primaryGuestName && !form.getValues('primaryGuestName')) {
          form.setValue('primaryGuestName', prefill.primaryGuestName);
        }
        setCompletionReady(true);
      } catch {
        if (cancelled) return;
        setCompletionError('Could not load your booking. Please try again in a moment.');
        setCompletionReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [completionToken, form]);

  // Set dates from URL params (from calendar page)
  useEffect(() => {
    if (isCompletionMode) return; // dates are locked from the reservation
    if (urlCheckInDate && urlCheckOutDate && !bookingId) {
      // Normalize and set the dates from URL
      const normalizedCheckIn = normalizeDateString(urlCheckInDate);
      const normalizedCheckOut = normalizeDateString(urlCheckOutDate);

      if (normalizedCheckIn && normalizedCheckOut) {
        form.setValue('checkInDate', normalizedCheckIn);
        form.setValue('checkOutDate', normalizedCheckOut);
      }
    }
  }, [urlCheckInDate, urlCheckOutDate, bookingId, isCompletionMode, form]);

  useEffect(() => {
    if (bookingId || !guestPaymentInfoFetched || guestPaymentInfoPlaceholder) return;
    form.setValue('checkInTime', propertyCheckInTime);
    form.setValue('checkOutTime', propertyCheckOutTime);
  }, [
    bookingId,
    guestPaymentInfoFetched,
    guestPaymentInfoPlaceholder,
    propertyCheckInTime,
    propertyCheckOutTime,
    form,
  ]);

  useEffect(() => {
    if (bookingId || !guestPaymentInfoFetched || guestPaymentInfoPlaceholder) return;
    const {
      gafUnitOwner,
      gafTowerAndUnitNumber,
      gafGuestsOnsiteContactPerson,
      gafOwnerContactNumber,
    } = guestPaymentInfo;
    if (gafUnitOwner) form.setValue('unitOwner', gafUnitOwner);
    if (gafTowerAndUnitNumber) form.setValue('towerAndUnitNumber', gafTowerAndUnitNumber);
    if (gafGuestsOnsiteContactPerson) {
      form.setValue('ownerOnsiteContactPerson', gafGuestsOnsiteContactPerson);
    }
    if (gafOwnerContactNumber) form.setValue('ownerContactNumber', gafOwnerContactNumber);
  }, [bookingId, guestPaymentInfo, guestPaymentInfoFetched, guestPaymentInfoPlaceholder, form]);

  const fetchFormData = async () => {
    if (!bookingId) return;

    setIsLoading(true);
    setInvalidBookingId(false);
    setGuestCanUpdate(true);

    try {
      const response = await fetch(guestFormFetchUrl(apiUrl, bookingId), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch form data');
      }

      // If the form data is successfully fetched, set the form data
      if (result.success && result.data) {
        setGuestCanUpdate(result.guestCanUpdate !== false);
        const formData = { ...result.data };

        // Set file input URLs if they exist
        if (formData.paymentReceiptUrl) {
          // Fetch the image and convert it to a File object
          const paymentReceiptFile = await fetchImageAsFile(
            formData.paymentReceiptUrl,
            formData.primaryGuestName
          );
          if (paymentReceiptFile) {
            formData.paymentReceipt = paymentReceiptFile;
            setPaymentReceiptPreview(formData.paymentReceiptUrl);
          }
        }

        const loadValidIdAsset = async (
          url: string | undefined,
          field: keyof GuestFormData,
          previewKey: string,
          guestName: string
        ) => {
          if (!url) return;
          setValidIdImageErrors((prev) => ({ ...prev, [previewKey]: false }));
          const file = await fetchImageAsFile(url, guestName);
          if (file) {
            (formData as Record<string, unknown>)[field] = file;
          }
          setValidIdPreviews((prev) => ({ ...prev, [previewKey]: url }));
        };

        await loadValidIdAsset(
          formData.validIdUrl,
          'validId',
          'validId',
          formData.primaryGuestName
        );
        await loadValidIdAsset(
          formData.guest2ValidIdUrl,
          'guest2ValidId',
          'guest2ValidId',
          formData.guest2Name || formData.primaryGuestName
        );
        await loadValidIdAsset(
          formData.guest3ValidIdUrl,
          'guest3ValidId',
          'guest3ValidId',
          formData.guest3Name || formData.primaryGuestName
        );
        await loadValidIdAsset(
          formData.guest4ValidIdUrl,
          'guest4ValidId',
          'guest4ValidId',
          formData.guest4Name || formData.primaryGuestName
        );
        await loadValidIdAsset(
          formData.guest5ValidIdUrl,
          'guest5ValidId',
          'guest5ValidId',
          formData.guest5Name || formData.primaryGuestName
        );

        if (formData.petVaccinationUrl) {
          // Fetch the image and convert it to a File object
          const petVaccinationFile = await fetchImageAsFile(
            formData.petVaccinationUrl,
            formData.primaryGuestName
          );
          if (petVaccinationFile) {
            formData.petVaccination = petVaccinationFile;
            setPetVaccinationPreview(formData.petVaccinationUrl);
          }
        }

        if (formData.petImageUrl) {
          const petImageFile = await fetchImageAsFile(
            formData.petImageUrl,
            formData.primaryGuestName
          );
          if (petImageFile) {
            formData.petImage = petImageFile;
            setPetImagePreview(formData.petImageUrl);
          }
        }

        if (formData.petVaccinationDate) {
          formData.petVaccinationDate = normalizeDateString(formData.petVaccinationDate);
        } else if (formData.hasPets) {
          formData.petVaccinationDate = getManilaYmdToday();
        }

        // Reset form with the modified data
        form.reset(formData);
        prevGuestFacebookNameRef.current = formData.guestFacebookName ?? '';
        setGuestSectionSeedKey((key) => key + 1);
      } else {
        setInvalidBookingId(true);
      }
    } catch (error) {
      console.error('Error fetching form data:', error);
      setInvalidBookingId(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch form data if bookingId is present
  useEffect(() => {
    fetchFormData();
  }, [bookingId]);

  // Paste booking info from clipboard
  const handlePasteFromClipboard = async () => {
    if (!showDevControls) return;

    try {
      const clipboardText = await navigator.clipboard.readText();
      const parsedData = parseBookingInfoFromClipboard(clipboardText);

      if (!parsedData) {
        toast.error('Invalid clipboard data');
        return;
      }

      // Populate the form with parsed data
      Object.entries(parsedData).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          form.setValue(key as keyof GuestFormData, value as GuestFormData[keyof GuestFormData]);
        }
      });

      toast.success('Form filled from clipboard');
    } catch (error) {
      console.error('Failed to paste from clipboard:', error);
      toast.error('Could not read clipboard');
    }
  };

  // Update file input when generating new data
  const handleGenerateNewData = useCallback(
    async (opts?: { preserveCalendarStayDates?: boolean }) => {
      if (!showDevControls) return;

      try {
        const randomData = await generateRandomData();

        if (opts?.preserveCalendarStayDates) {
          const rawIn = urlCheckInDate;
          const rawOut = urlCheckOutDate;
          if (rawIn && rawOut) {
            const checkInDate = normalizeDateString(rawIn);
            const checkOutDate = normalizeDateString(rawOut);
            if (checkInDate && checkOutDate) {
              randomData.checkInDate = checkInDate;
              randomData.checkOutDate = checkOutDate;
              randomData.numberOfNights = dayjs(checkOutDate).diff(dayjs(checkInDate), 'day');
            }
          }
        }

        form.reset(randomData);
        prevGuestFacebookNameRef.current = randomData.guestFacebookName ?? '';
        setGuestSectionSeedKey((key) => key + 1);

        const nextValidIdPreviews: Record<string, string | null> = {};
        for (const field of [
          'validId',
          'guest2ValidId',
          'guest3ValidId',
          'guest4ValidId',
          'guest5ValidId',
        ] as const) {
          const file = randomData[field];
          if (file) {
            nextValidIdPreviews[field] = URL.createObjectURL(file);
          }
        }
        setValidIdPreviews(nextValidIdPreviews);
        setValidIdImageErrors({});

        // Set the dummy files in the file inputs
        if (randomData.paymentReceipt) {
          setDummyFile(fileInputRef, randomData.paymentReceipt);
        }

        if (randomData.petVaccination) {
          setDummyFile(petVaccinationInputRef, randomData.petVaccination);
        }
        if (randomData.petImage) {
          setDummyFile(petImageInputRef, randomData.petImage);
        }
      } catch (error) {
        toast.error('Could not generate sample data');
      }
    },
    [showDevControls, urlCheckInDate, urlCheckOutDate, form.reset]
  );

  // Generate random sample payload on load in dev; calendar URL dates stay on the row above.
  useEffect(() => {
    if (showDevControls && !bookingId && !isLoading) {
      void handleGenerateNewData({ preserveCalendarStayDates: true });
    }
  }, [isLoading, bookingId, showDevControls, handleGenerateNewData]);

  const handleCancelBooking = async () => {
    if (!showDevControls || !bookingId) return;

    // Confirmation dialog
    if (
      !window.confirm(
        '⚠️ Are you sure you want to CANCEL this booking?\n\n' +
          'This will:\n' +
          '• Mark booking status as "Canceled" in database\n' +
          '• Free up the booked dates for new bookings\n\n' +
          'All booking data will be preserved for records.'
      )
    ) {
      return;
    }

    setIsCancellingBooking(true);

    try {
      const response = await fetch(`${apiUrl}/cancel-booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ bookingId, confirm: true }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to cancel booking');
      }

      toast.success('Booking cancelled');

      // Refresh booked dates after cancellation
      await fetchBookedDates();

      // Back to calendar; drop bookingId + stripped legacy keys; keep source / dates.
      const next = stripLegacyFromQueryParam(new URLSearchParams(scopedSearchParams));
      next.delete('bookingId');
      navigate(
        propertySlug
          ? guestCalendarPath(propertySlug, next)
          : next.toString()
            ? `/properties?${next.toString()}`
            : '/properties'
      );
    } catch (error) {
      console.error('Cancel booking error:', error);
      toast.error('Could not cancel booking');
    } finally {
      setIsCancellingBooking(false);
    }
  };

  function buildBookingSummary(values: GuestFormData): GuestFormBookingSummary {
    return {
      checkInDate: values.checkInDate,
      checkOutDate: values.checkOutDate,
      checkInTime: values.checkInTime,
      checkOutTime: values.checkOutTime,
      numberOfAdults: values.numberOfAdults,
      numberOfChildren: values.numberOfChildren,
      primaryGuestName: values.primaryGuestName,
      guest2Name: values.guest2Name,
      guest3Name: values.guest3Name,
      guest4Name: values.guest4Name,
      guest5Name: values.guest5Name,
      hasPets: values.hasPets,
      petName: values.petName,
      needParking: values.needParking,
      guestEmail: values.guestEmail,
      guestPhoneNumber: values.guestPhoneNumber,
    };
  }

  async function onSubmit(values: GuestFormData) {
    if (bookingId && !guestCanUpdate) {
      toast.error('This booking can no longer be updated online. Contact your host for changes.');
      return;
    }

    setIsSubmitting(true);

    try {
      const transformedValues = transformFieldValues(values, {
        gafUnitOwner: guestPaymentInfo.gafUnitOwner,
        gafTowerAndUnitNumber: guestPaymentInfo.gafTowerAndUnitNumber,
        gafGuestsOnsiteContactPerson: guestPaymentInfo.gafGuestsOnsiteContactPerson,
        gafOwnerContactNumber: guestPaymentInfo.gafOwnerContactNumber,
      });
      const formData = new FormData();

      // Add the booking ID to form data
      formData.append('bookingId', currentBookingId || '');
      if (currentBookingId) appendGuestBookingAccess(formData, currentBookingId);

      // Add all form values to FormData, excluding file upload fields
      const fileFields = new Set([
        'paymentReceipt',
        'validId',
        'guest2ValidId',
        'guest3ValidId',
        'guest4ValidId',
        'guest5ValidId',
        'petVaccination',
        'petImage',
      ]);

      Object.entries(transformedValues).forEach(([key, value]) => {
        if (value !== undefined && value !== null && !fileFields.has(key)) {
          formData.append(key, value.toString());
        }
      });

      formData.append('bookingSource', bookingSource);

      const guestFileUploads: Array<{
        prefix: string;
        file: File | null | undefined;
        guestName: string;
        required: boolean;
      }> = [
        {
          prefix: 'paymentReceipt',
          file: values.paymentReceipt,
          guestName: values.primaryGuestName,
          required: !isAirbnb,
        },
        {
          prefix: 'validId',
          file: values.validId,
          guestName: values.primaryGuestName,
          required: values.primaryGuestAge != null && values.primaryGuestAge >= 18,
        },
        {
          prefix: 'guest2ValidId',
          file: values.guest2ValidId,
          guestName: values.guest2Name || values.primaryGuestName,
          required: values.guest2Age != null && values.guest2Age >= 18,
        },
        {
          prefix: 'guest3ValidId',
          file: values.guest3ValidId,
          guestName: values.guest3Name || values.primaryGuestName,
          required: values.guest3Age != null && values.guest3Age >= 18,
        },
        {
          prefix: 'guest4ValidId',
          file: values.guest4ValidId,
          guestName: values.guest4Name || values.primaryGuestName,
          required: values.guest4Age != null && values.guest4Age >= 18,
        },
        {
          prefix: 'guest5ValidId',
          file: values.guest5ValidId,
          guestName: values.guest5Name || values.primaryGuestName,
          required: values.guest5Age != null && values.guest5Age >= 18,
        },
        {
          prefix: 'petVaccination',
          file: values.petVaccination,
          guestName: values.primaryGuestName,
          required: values.hasPets,
        },
        {
          prefix: 'petImage',
          file: values.petImage,
          guestName: values.primaryGuestName,
          required: values.hasPets,
        },
      ];

      for (const { prefix, file, guestName, required } of guestFileUploads) {
        let uploadFile = file;
        if (file) {
          // Pet photos are decorative (CONTENT); every ID / receipt / vaccination
          // record must stay legible for AI + manual review (DOCUMENT, near-lossless).
          const prepared = await prepareUpload(file, {
            imagePreset: prefix === 'petImage' ? 'CONTENT' : 'DOCUMENT',
            surface: `guest-form-${prefix}`,
          });
          if (prepared.error) throw new Error(prepared.error);
          uploadFile = prepared.file;
        }
        handleFileUpload(
          formData,
          uploadFile,
          prefix,
          guestName,
          values.checkInDate,
          values.checkOutDate,
          required,
          12
        );
      }

      // Property scope stays on the URL; side-effect flags go in FormData (never browser/share URLs).
      const queryParams = new URLSearchParams();
      appendGuestPropertyToParams(queryParams, propertySlug, searchParams);

      if (showDevControls) {
        formData.append('saveToDatabase', devApiControls.saveToDatabase ? 'true' : 'false');
        formData.append(
          'saveImagesToStorage',
          devApiControls.saveImagesToStorage ? 'true' : 'false'
        );
        formData.append('sendEmail', devApiControls.sendEmail ? 'true' : 'false');
      }

      // Completion link (§6.5): dedicated update-only endpoint; server re-reads the locked
      // dates from the stored row and ignores any dates in this payload.
      if (isCompletionMode && completionToken) {
        formData.append('complete', completionToken);
      }
      // Invisible bot check — waits for a Turnstile token (if configured) then
      // stamps the honeypot + timing fields. Degrades to '' when unconfigured.
      const antiSpamFields = await antiSpam.collect();
      antiSpam.applyToFormData(formData, antiSpamFields);

      const submitFnName = isCompletionMode ? 'submit-form-completion' : 'submit-form';
      const queryParamsString = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const apiUrlWithParams = `${apiUrl}/${submitFnName}${queryParamsString}`;

      const authHeaders = await guestEdgeAuthHeaders();
      const response = await fetch(apiUrlWithParams, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (isAntiSpamFailure(response.status, errorData)) {
          throw new Error(antiSpamErrorMessage(response.status, errorData));
        }
        throw new Error(
          errorData.error ||
            errorData.message ||
            `HTTP error! status: ${response.status} - ${JSON.stringify(errorData)}`
        );
      }

      const result = await response.json();
      if (!result.success) {
        const errorMessage =
          result.error || result.details?.message || 'Failed to submit the guest form';
        console.error('Failed to submit the guest form:', result);
        throw new Error(errorMessage);
      }

      if (
        typeof result.guestAccessToken === 'string' &&
        result.guestAccessToken &&
        currentBookingId
      ) {
        storeGuestBookingAccessToken(currentBookingId, result.guestAccessToken);
      }

      if (typeof result.voucherWarning === 'string' && result.voucherWarning) {
        toast.warning('Booking submitted without the voucher', {
          description: result.voucherWarning.replace(/^VOUCHER_[A-Z_]+:\s*/, ''),
          duration: 7000,
        });
      }

      // Check if submission was skipped due to no changes
      if (result.skipped) {
        console.log('ℹ️ No changes detected, redirecting to success page');
        clearGuestFormStartedMarker();

        // Prepare booking data to pass to success page
        const bookingData = buildBookingSummary(values);

        if (embed?.onSubmitSuccess) {
          embed.onSubmitSuccess({ bookingId: currentBookingId ?? '', bookingData });
          return;
        }

        // Redirect to success page with booking data
        navigate(
          guestSuccessPath(
            propertySlug,
            new URLSearchParams({ bookingId: currentBookingId ?? '' })
          ),
          {
            state: { bookingData },
          }
        );
        return;
      }

      clearGuestFormStartedMarker();

      // Reset form and redirect to success page
      // Only reset form in normal production mode (not dev controls)
      if (!showDevControls) {
        form.reset(defaultFormValues);
        prevGuestFacebookNameRef.current = '';
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }

      // Prepare booking summary data to pass to success page
      const bookingData = buildBookingSummary(values);

      if (embed?.onSubmitSuccess) {
        embed.onSubmitSuccess({ bookingId: currentBookingId ?? '', bookingData });
        return;
      }

      // Redirect to success page with bookingId and booking data
      navigate(
        guestSuccessPath(propertySlug, new URLSearchParams({ bookingId: currentBookingId ?? '' })),
        {
          state: { bookingData },
        }
      );
    } catch (error: unknown) {
      console.error('Error submitting form:', {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';

      // Dismiss any existing error toasts first to prevent stacking
      toast.dismiss();

      // Helper function to copy booking info to clipboard
      const handleCopyBookingInfo = async () => {
        try {
          const formValues = form.getValues();
          const bookingInfo = formatBookingInfoForClipboard(
            formValues,
            currentBookingId,
            bookingSource
          );
          await navigator.clipboard.writeText(bookingInfo);

          // Dismiss all existing toasts (including the error toast) before showing success
          toast.dismiss();

          toast.success('Booking info copied');
        } catch (clipboardError) {
          console.error('Failed to copy to clipboard:', clipboardError);

          // Dismiss all existing toasts before showing the new error
          toast.dismiss();

          toast.error('Could not copy to clipboard');
        }
      };

      // Check if it's a booking overlap error
      if (errorMessage.includes('BOOKING_OVERLAP') || errorMessage.includes('already booked')) {
        // Show prominent warning toast for booking overlap
        toast.error('Those dates are already booked', {
          id: 'booking-error',
          duration: 7000,
        });
      } else if (errorMessage.includes('DATES_BLOCKED')) {
        toast.error('Selected dates are unavailable', {
          id: 'booking-error',
          duration: 7000,
        });
      } else if (errorMessage.includes('CLEANING_BUFFER')) {
        toast.error('Not enough cleaning time', {
          id: 'booking-error',
          description: errorMessage.replace(/^.*CLEANING_BUFFER:\s*/, ''),
          duration: 7000,
        });
      } else if (errorMessage.includes('GUEST_FORM_LOCKED')) {
        toast.error('Booking already reviewed', {
          id: 'guest-form-locked',
          description: formatGuestLockedChangeHint(isAirbnb, isFacebook),
          duration: 7000,
        });
        setGuestCanUpdate(false);
      } else if (errorMessage.includes('VOUCHER_AUTH')) {
        toast.error('Sign in to use a voucher', { id: 'voucher-error', duration: 7000 });
      } else if (errorMessage.includes('VOUCHER_USED')) {
        toast.error('That voucher was already used', { id: 'voucher-error', duration: 7000 });
      } else if (errorMessage.includes('VOUCHER_PROPERTY')) {
        toast.error('Voucher is for a different property', {
          id: 'voucher-error',
          duration: 7000,
        });
      } else if (errorMessage.includes('VOUCHER_FORBIDDEN')) {
        toast.error('This voucher belongs to another guest', {
          id: 'voucher-error',
          duration: 7000,
        });
      } else if (errorMessage.includes('VOUCHER_LOCKED')) {
        toast.error('A voucher is already on this booking', {
          id: 'voucher-error',
          duration: 7000,
        });
      } else if (errorMessage.includes('VOUCHER_')) {
        toast.error('Could not apply voucher', {
          id: 'voucher-error',
          description: errorMessage.replace(/^.*VOUCHER_[A-Z_]+:\s*/, ''),
          duration: 7000,
        });
      } else {
        // Show regular error toast for other errors
        const cleanedMessage = errorMessage.replace('Error: ', '').replace('BOOKING_OVERLAP: ', '');

        toast.error('Could not submit form', {
          id: 'submission-error',
          description: (
            <div className="text-foreground space-y-3">
              <p className="text-foreground text-sm font-semibold leading-relaxed">
                {cleanedMessage}
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {formatGuestCopyPasteHint(isAirbnb, isFacebook)}
              </p>
              <Button
                type="button"
                variant="outline"
                className="bg-card text-foreground hover:bg-muted h-10 min-h-[44px] w-full"
                onClick={handleCopyBookingInfo}
              >
                Copy Booking Information
              </Button>
            </div>
          ),
          duration: 7000,
        });
      }
    } finally {
      // Turnstile tokens are single-use — always re-arm for the next attempt.
      antiSpam.reset();
      setIsSubmitting(false);
    }
  }

  // Scoped subscriptions for the two effects below — narrower than a whole-form
  // watch so unrelated field edits (e.g. payment step) don't re-run guest-count sync.
  const guestAgeWatch = useWatch({
    control: form.control,
    name: [
      'primaryGuestName',
      'primaryGuestAge',
      'guest2Name',
      'guest2Age',
      'guest3Name',
      'guest3Age',
      'guest4Name',
      'guest4Age',
      'guest5Name',
      'guest5Age',
    ],
  });
  const guestFacebookNameWatch = useWatch({ control: form.control, name: 'guestFacebookName' });

  // `canProceed` deliberately watches every field: `isGuestFormStepComplete` validates
  // against a per-step field set that itself depends on already-entered values (e.g. step 4's
  // required fields change based on `hasPets`, step 2's on `findUs`) — see
  // `getFieldsForGuestFormStep`. Narrowing this to a static field list would have to
  // re-derive that same conditional logic and risks silently diverging from it (the "Next"
  // button staying disabled, or enabling early, on a guest-facing booking form). Kept broad.
  const watchedValues = useWatch({ control: form.control });

  // Keep adults/children counts in sync with per-guest ages for downstream consumers.
  useEffect(() => {
    const counts = computeGuestCountsByAge([
      { age: form.getValues('primaryGuestAge') },
      { age: form.getValues('guest2Age') },
      { age: form.getValues('guest3Age') },
      { age: form.getValues('guest4Age') },
      { age: form.getValues('guest5Age') },
    ]);
    form.setValue('numberOfAdults', Math.max(counts.adults, 1));
    form.setValue('numberOfChildren', counts.children);
  }, [
    guestAgeWatch?.[0],
    guestAgeWatch?.[1],
    guestAgeWatch?.[2],
    guestAgeWatch?.[3],
    guestAgeWatch?.[4],
    guestAgeWatch?.[5],
    guestAgeWatch?.[6],
    guestAgeWatch?.[7],
    guestAgeWatch?.[8],
    guestAgeWatch?.[9],
    form,
  ]);

  // Pre-fill primary guest name from the contact name until the guest edits it separately.
  useEffect(() => {
    const facebookName = form.getValues('guestFacebookName') ?? '';
    const primaryName = form.getValues('primaryGuestName') ?? '';
    const prevFacebook = prevGuestFacebookNameRef.current;

    if (!primaryName.trim() || primaryName === prevFacebook) {
      form.setValue('primaryGuestName', facebookName, {
        shouldValidate: Boolean(primaryName.trim()),
      });
    }
    prevGuestFacebookNameRef.current = facebookName;
  }, [guestFacebookNameWatch, form]);

  const canProceed = useMemo(
    () =>
      activeStepConfig
        ? isGuestFormStepComplete(activeStepConfig.id, form.getValues(), visibilityFlags)
        : false,
    [activeStepConfig, watchedValues, form, visibilityFlags]
  );

  const handleNextStep = async () => {
    const stepId = activeStepConfig?.id ?? currentStep;
    const stepName = guestFormStepAnalyticsName(stepId);
    if (!canProceed || !activeStepConfig) {
      const values = form.getValues();
      const fields = getFieldsForGuestFormStep(activeStepConfig?.id ?? currentStep, values);
      await form.trigger(fields);
      trackGuestFormStepFailed({
        stepId,
        stepName,
        errorCount: Math.max(Object.keys(form.formState.errors).length, 1),
      });
      toast.error('Please complete all required fields before continuing.');
      return;
    }
    trackGuestFormStepCompleted({ stepId, stepName });
    setCurrentStep((step) => clampGuestFormStep(step + 1, visibilityFlags));
  };

  const handleBackStep = () => {
    setCurrentStep((step) => clampGuestFormStep(step - 1, visibilityFlags));
  };

  useEffect(() => {
    setCurrentStep((step) => clampGuestFormStep(step, visibilityFlags));
  }, [visibilityFlags]);

  useEffect(() => {
    if (publicProperty?.id) {
      setAnalyticsScope({ propertyId: publicProperty.id });
    }
  }, [publicProperty?.id]);

  useEffect(() => {
    if (guestFormStartedRef.current) return;
    if (!guestPaymentInfoFetched || isLoading || invalidBookingId || !completionReady) return;
    guestFormStartedRef.current = true;
    trackGuestFormStarted({
      bookingSource: bookingSource.toLowerCase(),
      stepCount: guestFormStepCount,
      propertyId: publicProperty?.id,
    });
  }, [
    guestPaymentInfoFetched,
    isLoading,
    invalidBookingId,
    completionReady,
    bookingSource,
    guestFormStepCount,
    publicProperty?.id,
  ]);

  useEffect(() => {
    const onLeave = () => {
      trackGuestFormAbandoned(activeStepConfig?.id ?? currentStep);
    };
    window.addEventListener('pagehide', onLeave);
    return () => window.removeEventListener('pagehide', onLeave);
  }, [currentStep, activeStepConfig?.id]);

  useEffect(() => {
    stepPanelRef.current?.focus({ preventScroll: true });
    if (embed?.compactChrome) {
      stepPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep, embed?.compactChrome]);

  useEffect(() => {
    if (currentStep !== guestFormStepCount) {
      setSubmitReady(false);
      return;
    }
    setSubmitReady(false);
    const timer = window.setTimeout(() => setSubmitReady(true), 400);
    return () => window.clearTimeout(timer);
  }, [currentStep]);

  const handleSubmitGuestForm = () => {
    if (!submitReady || isSubmitting || !canProceed) return;
    if (skipAuthGate) {
      pendingSubmitAfterAuthRef.current = false;
      void form.handleSubmit(onSubmit)();
      return;
    }
    requireGuestAuth(
      () => {
        pendingSubmitAfterAuthRef.current = false;
        void form.handleSubmit(onSubmit)();
      },
      { resume: { type: 'form_submit' } }
    );
  };

  const onNavChange = embed?.onNavChange;
  const onNavChangeRef = useRef(onNavChange);
  onNavChangeRef.current = onNavChange;

  // Lift step actions into the host modal footer when embedded.
  useEffect(() => {
    const report = onNavChangeRef.current;
    if (!report) return;
    const show = !bookingId || guestCanUpdate;
    report({
      currentStep,
      stepCount: guestFormStepCount,
      isSubmitting,
      canProceed,
      submitReady,
      show,
      onBack: handleBackStep,
      onNext: () => {
        void handleNextStep();
      },
      onSubmit: handleSubmitGuestForm,
    });
  }, [
    bookingId,
    guestCanUpdate,
    currentStep,
    guestFormStepCount,
    isSubmitting,
    canProceed,
    submitReady,
    onNavChange,
  ]);

  useEffect(() => {
    return () => onNavChangeRef.current?.(null);
  }, [onNavChange]);

  useEffect(() => {
    if (formSubmitResumeTick < 1) return;
    pendingSubmitAfterAuthRef.current = true;
  }, [formSubmitResumeTick]);

  useEffect(() => {
    if (!pendingSubmitAfterAuthRef.current) return;
    if (!submitReady || isSubmitting || !canProceed) return;
    pendingSubmitAfterAuthRef.current = false;
    void form.handleSubmit(onSubmit)();
  }, [formSubmitResumeTick, submitReady, isSubmitting, canProceed]);

  const StepIcon = activeStepConfig?.icon ?? User;

  if (!skipAuthGate && (guestAuthStatus === 'loading' || guestAuthStatus === 'anonymous')) {
    return (
      <div className={cn(embed?.compactChrome ? 'p-0 sm:p-1' : 'p-4 sm:p-6 lg:p-8')}>
        <GuestFormPageSkeleton embed={Boolean(embed?.compactChrome)} />
      </div>
    );
  }

  if (isCompletionMode && completionError) {
    return (
      <div className="flex flex-col items-center justify-center space-y-3 px-4 py-20 text-center">
        <h2 className="text-destructive text-lg font-bold sm:text-xl">Link unavailable</h2>
        <p className="text-muted-foreground max-w-md text-sm">{completionError}</p>
      </div>
    );
  }

  if (isCompletionMode && !completionReady) {
    return (
      <div className={cn(embed?.compactChrome ? 'p-0 sm:p-1' : 'p-4 sm:p-6 lg:p-8')}>
        <GuestFormPageSkeleton embed={Boolean(embed?.compactChrome)} />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (currentStep < guestFormStepCount) {
            if (canProceed) void handleNextStep();
          }
        }}
        className={cn(
          'guest-inner-enter relative',
          embed?.compactChrome ? 'space-y-4' : 'space-y-6',
          embed?.compactChrome ? 'p-0 sm:p-1' : 'p-4 sm:p-6 lg:p-8',
          /* Standalone page: clears the floating ContextualActionBar on phone/tablet. */
          !embed ? bottomTabBarOffsetClassName() : null
        )}
      >
        {isLoading ? (
          <GuestFormPageSkeleton embed={Boolean(embed?.compactChrome)} />
        ) : invalidBookingId ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-20">
            <div className="text-center">
              <h2 className="text-destructive mb-2 text-lg font-bold sm:text-xl">
                Booking Not Found
              </h2>
              <p className="text-muted-foreground max-w-md">
                Invalid booking link or no form data. Screenshot this and contact us{' '}
                {guestContactChannelLabel(isAirbnb, isFacebook)}.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setInvalidBookingId(false);
                  const next = stripLegacyFromQueryParam(new URLSearchParams(scopedSearchParams));
                  next.delete('bookingId');
                  navigate(propertySlug ? guestCalendarPath(propertySlug, next) : '/properties', {
                    replace: true,
                  });
                }}
                className="mt-4"
              >
                Return to calendar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setInvalidBookingId(false);
                  fetchFormData();
                }}
                className="mt-4"
              >
                Try again
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {embed ? null : <GuestFormBrandHeader {...brandHeader} />}
            {embed ? null : <GuestStayContextBar />}
            {bookingId && !guestCanUpdate ? (
              <div
                className="text-foreground rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"
                role="status"
              >
                {isAirbnb
                  ? 'This booking was already reviewed. Contact your host on Airbnb to change details.'
                  : isFacebook
                    ? 'This booking was already reviewed. Contact your host on Facebook to change details.'
                    : 'This booking was already reviewed. Contact your host to change details.'}
              </div>
            ) : null}
            <GuestFormStepper activeStep={currentStep} steps={guestFormSteps} />

            <fieldset
              disabled={Boolean(bookingId && !guestCanUpdate)}
              className={cn('min-w-0 border-0 p-0', bookingId && !guestCanUpdate && 'opacity-80')}
            >
              <div
                ref={stepPanelRef}
                id="guest-form-step-panel"
                tabIndex={-1}
                className={cn(
                  'border-border/80 bg-card space-y-5 rounded-xl border shadow-sm outline-none',
                  embed?.compactChrome ? 'px-4 py-4 sm:px-5 sm:py-5' : 'px-4 py-5 sm:px-6 sm:py-6'
                )}
                aria-labelledby="guest-form-step-heading"
              >
                <header
                  className={cn(
                    'flex items-center gap-3',
                    embed?.compactChrome ? 'pb-3 sm:pb-2' : 'border-separator border-b pb-4'
                  )}
                >
                  <div
                    className={cn(
                      'bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg',
                      embed?.compactChrome && 'sm:hidden'
                    )}
                  >
                    <StepIcon className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h2
                      id="guest-form-step-heading"
                      className={cn(
                        'text-foreground font-bold',
                        embed?.compactChrome ? 'text-sm sm:text-base' : 'text-base sm:text-lg'
                      )}
                    >
                      {activeStepConfig?.title}
                    </h2>
                    {activeStepConfig?.hint ? (
                      <p className="text-muted-foreground mt-0.5 text-sm">
                        {activeStepConfig.hint}
                      </p>
                    ) : null}
                  </div>
                </header>

                {activeStepConfig?.id === 1 && (
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="guestFacebookName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {guestNameFieldLabel(isAirbnb, isFacebook)}{' '}
                            <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={guestNamePlaceholder(isAirbnb, isFacebook)}
                              {...field}
                              onChange={(e) =>
                                handleNameInputChange(e, field.onChange, toCapitalCase)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="guestEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Email Address <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input type="email" placeholder={FORM_PLACEHOLDERS.email} {...field} />
                          </FormControl>
                          <FormMessage />
                          {field.value && !form.formState.errors.guestEmail && (
                            <p className="text-muted-foreground mt-1 text-xs">{gafEmailHint}</p>
                          )}
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="guestPhoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Phone Number <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="tel"
                              inputMode="numeric"
                              placeholder={FORM_PLACEHOLDERS.phone}
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => {
                                // Only allow numbers
                                const value = e.target.value.replace(/[^\d]/g, '');
                                // Limit to 11 digits
                                const trimmed = value.slice(0, 11);
                                field.onChange(trimmed);

                                // Trigger validation on change
                                form.trigger('guestPhoneNumber');
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="guestAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Address <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="City, Province"
                              {...field}
                              onChange={(e) => field.onChange(toCapitalCase(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nationality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nationality</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Ex. Filipino"
                              onChange={(e) => field.onChange(toCapitalCase(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <GuestFormGuestsSection
                      form={form}
                      validIdPreviews={validIdPreviews}
                      validIdImageErrors={validIdImageErrors}
                      seedKey={guestSectionSeedKey}
                      guestCapacity={guestCapacity}
                      onValidIdPreviewChange={(field, preview) =>
                        setValidIdPreviews((prev) => ({ ...prev, [field]: preview }))
                      }
                      onValidIdImageErrorChange={(field, hasError) =>
                        setValidIdImageErrors((prev) => ({
                          ...prev,
                          [field]: hasError,
                        }))
                      }
                    />
                  </div>
                )}

                {activeStepConfig?.id === 2 && (
                  <div className="space-y-4">
                    {isCompletionMode ? (
                      <div className="border-primary/25 bg-primary/5 dark:border-primary/30 dark:bg-primary/10 space-y-1 rounded-lg border-2 px-4 py-3">
                        <p className="text-sm font-semibold">Your Airbnb stay</p>
                        <p className="text-sm">
                          {formatStayDateRange(
                            form.watch('checkInDate'),
                            form.watch('checkOutDate')
                          ) || '-'}{' '}
                          · check-in {formatTimeToAMPM(form.watch('checkInTime') || '', true)},
                          check-out {formatTimeToAMPM(form.watch('checkOutTime') || '', true)}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          These dates come from your reservation and can’t be changed here. Contact
                          your host if they’re wrong.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 md:[&>*]:min-w-0">
                          <FormField
                            control={form.control}
                            name="checkInDate"
                            render={({ field }) => (
                              <FormItem className="min-w-0">
                                <FormLabel>
                                  Check-in Date <span className="text-destructive">*</span>
                                </FormLabel>
                                <FormControl>
                                  <DatePicker
                                    date={field.value ? stringToDate(field.value) : undefined}
                                    rangeEnd={
                                      form.watch('checkOutDate')
                                        ? stringToDate(form.watch('checkOutDate'))
                                        : undefined
                                    }
                                    onSelect={(date) => {
                                      if (date) {
                                        const dateStr = dateToString(date);
                                        field.onChange(dateStr);
                                        // Always auto-set checkout to next day when check-in changes
                                        form.setValue('checkOutDate', getNextDay(dateStr));
                                      }
                                    }}
                                    disabled={(date) => {
                                      // Disable past dates
                                      const today = new Date();
                                      today.setHours(0, 0, 0, 0);
                                      if (date < today) {
                                        return true;
                                      }

                                      // Disable booked dates
                                      return createDisabledDateMatcher(
                                        bookedDates,
                                        currentBookingId
                                      )(date);
                                    }}
                                    minDate={new Date()}
                                    placeholder={DATE_PICKER_DISPLAY_FORMAT}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="checkInTime"
                            render={({ field }) => {
                              const checkInDate = form.watch('checkInDate');
                              const minCheckInTime = checkInDate
                                ? minAllowedCheckInTime(
                                    bookedDates,
                                    stringToDate(checkInDate),
                                    guestPaymentInfo.cleaningBufferMinutes,
                                    currentBookingId
                                  )
                                : null;
                              return (
                                <FormItem className="min-w-0">
                                  <FormLabel>Check-in Time</FormLabel>
                                  <FormControl>
                                    <TimePicker
                                      value={field.value}
                                      onChange={field.onChange}
                                      disabledTime={
                                        minCheckInTime ? (time) => time < minCheckInTime : undefined
                                      }
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              );
                            }}
                          />
                        </div>

                        {form.watch('checkInTime') &&
                          form.watch('checkInTime') < propertyCheckInTime && (
                            <div
                              className="border-primary/25 bg-primary/5 dark:border-primary/30 dark:bg-primary/10 rounded-lg border-2 px-4 py-3"
                              role="alert"
                            >
                              <p className="text-sm font-medium">
                                Check-in is {propertyCheckInLabel}. Early arrival needs approval and
                                may cost extra. {guestEarlyLateContactLabel(isAirbnb, isFacebook)}
                              </p>
                            </div>
                          )}

                        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 md:[&>*]:min-w-0">
                          <FormField
                            control={form.control}
                            name="checkOutDate"
                            render={({ field }) => (
                              <FormItem className="min-w-0">
                                <FormLabel>
                                  Check-out Date <span className="text-destructive">*</span>
                                </FormLabel>
                                <FormControl>
                                  <DatePicker
                                    date={field.value ? stringToDate(field.value) : undefined}
                                    rangeEnd={
                                      form.watch('checkInDate')
                                        ? stringToDate(form.watch('checkInDate'))
                                        : undefined
                                    }
                                    onSelect={(date) => {
                                      if (date) {
                                        const dateStr = dateToString(date);
                                        field.onChange(dateStr);
                                        form.trigger('checkOutTime');
                                      }
                                    }}
                                    disabled={(date) => {
                                      // Use checkout-specific matcher that allows checkout on check-in dates
                                      const isBooked = createDisabledCheckoutDateMatcher(
                                        bookedDates,
                                        currentBookingId
                                      )(date);

                                      // Disable dates before or equal to check-in date
                                      const checkInDate = form.watch('checkInDate');
                                      if (checkInDate) {
                                        const checkIn = stringToDate(checkInDate);
                                        if (date <= checkIn) {
                                          return true;
                                        }
                                      }

                                      return isBooked;
                                    }}
                                    minDate={
                                      form.watch('checkInDate')
                                        ? stringToDate(getNextDay(form.watch('checkInDate')))
                                        : new Date()
                                    }
                                    placeholder={DATE_PICKER_DISPLAY_FORMAT}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="checkOutTime"
                            render={({ field }) => {
                              const checkOutDate = form.watch('checkOutDate');
                              const maxCheckOutTime = checkOutDate
                                ? maxAllowedCheckOutTime(
                                    bookedDates,
                                    stringToDate(checkOutDate),
                                    guestPaymentInfo.cleaningBufferMinutes,
                                    currentBookingId
                                  )
                                : null;
                              return (
                                <FormItem className="min-w-0">
                                  <FormLabel>Check-out Time</FormLabel>
                                  <FormControl>
                                    <TimePicker
                                      value={field.value}
                                      onChange={field.onChange}
                                      disabledTime={
                                        maxCheckOutTime
                                          ? (time) => time > maxCheckOutTime
                                          : undefined
                                      }
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              );
                            }}
                          />
                        </div>

                        {form.watch('checkOutTime') &&
                          form.watch('checkOutTime') > propertyCheckOutTime && (
                            <div
                              className="border-primary/25 bg-primary/5 dark:border-primary/30 dark:bg-primary/10 rounded-lg border-2 px-4 py-3"
                              role="alert"
                            >
                              <p className="text-sm font-medium">
                                Check-out is {propertyCheckOutLabel}. Late departure needs approval
                                and may cost extra.{' '}
                                {guestEarlyLateContactLabel(isAirbnb, isFacebook)}
                              </p>
                            </div>
                          )}
                      </>
                    )}

                    <FormField
                      control={form.control}
                      name="guestSpecialRequests"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Special requests / Notes to owner</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Ex. Late check-in, cash only for balance payment, celebrating special occasion, etc."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="findUs"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>How did you find us?</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value || 'Facebook'}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select how you found us" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {FIND_US_OPTIONS.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {(form.watch('findUs') === 'Friend' || form.watch('findUs') === 'Others') && (
                      <FormField
                        control={form.control}
                        name="findUsDetails"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {form.watch('findUs') === 'Friend'
                                ? "Friend's Name"
                                : 'Please specify where you found us'}
                              <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={
                                  form.watch('findUs') === 'Friend'
                                    ? "Enter your friend's name"
                                    : 'Please specify how you found us'
                                }
                                {...field}
                                onChange={(e) => field.onChange(toCapitalCase(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {guestPaymentInfo.allowSurpriseDecor ? (
                      <FormField
                        control={form.control}
                        name="guestRequestsSurpriseDecor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Has surprise decor / room setup?</FormLabel>
                            <div className="flex min-h-[44px] items-start gap-3">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  className="mt-1"
                                  aria-describedby="surprise-decor-hint"
                                />
                              </FormControl>
                              <div className="min-w-0 flex-1 space-y-2">
                                <FormLabel className="!mt-0 cursor-pointer text-sm font-medium leading-snug">
                                  <span className="inline-flex items-center gap-1.5">
                                    Yes, I requested a surprise decor / room setup
                                    <PartyPopper
                                      className="size-4 shrink-0 text-violet-600"
                                      aria-hidden
                                    />
                                  </span>
                                </FormLabel>
                                {field.value ? (
                                  <div
                                    id="surprise-decor-hint"
                                    className="border-primary/25 bg-primary/5 dark:border-primary/30 dark:bg-primary/10 rounded-lg border-2 px-4 py-3"
                                    role="status"
                                  >
                                    <p className="text-foreground text-sm leading-relaxed">
                                      {decorPlatformLabel(isAirbnb, isFacebook) ? (
                                        <>
                                          You confirm you messaged us on{' '}
                                          <span className="font-semibold">
                                            {decorPlatformLabel(isAirbnb, isFacebook)}
                                          </span>{' '}
                                          and agreed on theme and price before your stay.
                                        </>
                                      ) : (
                                        <>
                                          You confirm you agreed on theme and price with us before
                                          your stay.
                                        </>
                                      )}
                                    </p>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : null}

                    <GuestFormVoucherPicker
                      propertySlug={propertySlug}
                      selectedSourceBookingId={appliedVoucherSourceBookingId || null}
                      vouchers={propertyVouchers}
                      isLoading={propertyVouchersLoading}
                      estimatedStayPhp={estimatedStayPhp}
                      onSelect={(id) =>
                        form.setValue('appliedVoucherSourceBookingId', id ?? '', {
                          shouldDirty: true,
                        })
                      }
                    />

                    {selectedVoucher && estimatedStayPhp != null ? (
                      <GuestVoucherEstimateSummary
                        offerLabel={formatVoucherOfferLabel({
                          code: selectedVoucher.code,
                          percentOff: selectedVoucher.percentOff,
                          legacyAmountPhp: selectedVoucher.legacyAmountPhp,
                        })}
                        estimatedStayPhp={estimatedStayPhp}
                        discountPhp={estimatedVoucherDiscount}
                      />
                    ) : null}
                  </div>
                )}

                {activeStepConfig?.id === 3 && (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                        Do you need paid parking?
                      </p>
                      <div className="flex flex-col gap-2">
                        <GuestFormOptionCard
                          selected={!form.watch('needParking')}
                          onSelect={() => form.setValue('needParking', false)}
                          title="No paid parking needed"
                          description={parkingNoPaidDescription}
                        />
                        <GuestFormOptionCard
                          selected={form.watch('needParking')}
                          onSelect={() => form.setValue('needParking', true)}
                          title="Yes, reserve paid parking"
                          description={parkingPaidDescription}
                        />
                      </div>
                    </div>

                    {form.watch('needParking') && (
                      <div className="border-primary/20 bg-primary/5 space-y-2 rounded-lg border p-4 pt-4">
                        <p className="text-foreground text-sm font-medium">
                          Good news — you don't need to add vehicle or date details here.
                        </p>
                        <p className="text-muted-foreground text-sm">
                          Once your booking is confirmed, we'll send you a link to reserve and pay
                          for a specific parking spot for your exact stay dates.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeStepConfig?.id === 4 && (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                        Will a pet join your stay?
                      </p>
                      <div className="flex flex-col gap-2">
                        <GuestFormOptionCard
                          selected={!form.watch('hasPets')}
                          onSelect={() => form.setValue('hasPets', false)}
                          title="No pets on this stay"
                        />
                        <GuestFormOptionCard
                          selected={form.watch('hasPets')}
                          onSelect={() => {
                            form.setValue('hasPets', true);
                            if (!form.getValues('petVaccinationDate')?.trim()) {
                              form.setValue('petVaccinationDate', getManilaYmdToday());
                            }
                          }}
                          title="Yes, I'm bringing a pet"
                        />
                      </div>
                    </div>

                    {form.watch('hasPets') && (
                      <div className="space-y-5">
                        <GuestFormInfoCallout title={petPolicyTitle}>
                          <ul className="list-inside list-disc space-y-2">
                            <li>
                              Only one toy/small dog is allowed.{' '}
                              <span className="text-foreground font-semibold">{petFeeLine}</span>
                            </li>
                            <li>
                              Use the service elevator only. Keep pets leashed outside the unit.
                            </li>
                            <li>
                              {petPolicyResidence} requires complete pet details and vaccination
                              records for PMO approval.
                            </li>
                            <li>
                              No pets allowed in: Main Lobby, Viewing Deck, Common/Amenity Areas,
                              Roof Deck
                            </li>
                          </ul>
                        </GuestFormInfoCallout>

                        <FormField
                          control={form.control}
                          name="petName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Pet Name{' '}
                                {form.watch('hasPets') && (
                                  <span className="text-destructive">*</span>
                                )}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Ex. Max"
                                  {...field}
                                  onChange={(e) => field.onChange(toCapitalCase(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="petType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Pet Type{' '}
                                {form.watch('hasPets') && (
                                  <span className="text-destructive">*</span>
                                )}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Ex. Dog, Cat"
                                  {...field}
                                  onChange={(e) => field.onChange(toCapitalCase(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="petBreed"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Pet Breed{' '}
                                {form.watch('hasPets') && (
                                  <span className="text-destructive">*</span>
                                )}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Ex. Labrador"
                                  {...field}
                                  onChange={(e) => field.onChange(toCapitalCase(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="petAge"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Pet Age{' '}
                                {form.watch('hasPets') && (
                                  <span className="text-destructive">*</span>
                                )}
                              </FormLabel>
                              <FormControl>
                                <Input placeholder="Ex. 2 years old" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="petVaccinationDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Last Vaccination Date{' '}
                                {form.watch('hasPets') && (
                                  <span className="text-destructive">*</span>
                                )}
                              </FormLabel>
                              <FormControl>
                                <IsoDateInput
                                  {...field}
                                  className="border-border/50 bg-muted/40 focus-within:border-primary/40 focus-within:bg-background focus-within:ring-ring/30 h-11 rounded-xl"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="petImage"
                          render={({ field: { onChange, value, ...field } }) => (
                            <FormItem>
                              <FormLabel>
                                Pet Image{' '}
                                {form.watch('hasPets') && (
                                  <span className="text-destructive">*</span>
                                )}
                              </FormLabel>
                              <FormControl>
                                <div className="guest-image-upload-dropzone group">
                                  {petImagePreview || value ? (
                                    <>
                                      <img
                                        src={
                                          petImagePreview || (value && URL.createObjectURL(value))
                                        }
                                        alt="Pet Image Preview"
                                        className="h-full w-full object-cover"
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                                        <label className="guest-image-upload-replace">
                                          <Upload className="h-4 w-4" />
                                          Replace Image
                                          <input
                                            type="file"
                                            accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                                            className="hidden"
                                            {...field}
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                const validation = validateImageFile(file);
                                                if (!validation.valid) {
                                                  alert(validation.message);
                                                  return;
                                                }
                                                onChange(file);
                                                setPetImagePreview(URL.createObjectURL(file));
                                              }
                                            }}
                                          />
                                        </label>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <label className="guest-image-upload-trigger">
                                        <Upload className="h-4 w-4" />
                                        Upload Image
                                        <input
                                          type="file"
                                          accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                                          className="hidden"
                                          {...field}
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              const validation = validateImageFile(file);
                                              if (!validation.valid) {
                                                alert(validation.message);
                                                return;
                                              }
                                              onChange(file);
                                              setPetImagePreview(URL.createObjectURL(file));
                                            }
                                          }}
                                        />
                                      </label>
                                    </div>
                                  )}
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="petVaccination"
                          render={({ field: { onChange, value, ...field } }) => (
                            <FormItem>
                              <FormLabel>
                                Pet Vaccination Record{' '}
                                {form.watch('hasPets') && <span className="text-red-500">*</span>}
                              </FormLabel>
                              <FormControl>
                                <div className="guest-image-upload-dropzone group">
                                  {petVaccinationPreview || value ? (
                                    <>
                                      <img
                                        src={
                                          petVaccinationPreview ||
                                          (value && URL.createObjectURL(value))
                                        }
                                        alt="Pet Vaccination Record Preview"
                                        className="h-full w-full object-cover"
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                                        <label className="guest-image-upload-replace">
                                          <Upload className="h-4 w-4" />
                                          Replace Image
                                          <input
                                            type="file"
                                            accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                                            className="hidden"
                                            {...field}
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                const validation = validateImageFile(file);
                                                if (!validation.valid) {
                                                  alert(validation.message);
                                                  return;
                                                }
                                                onChange(file);
                                                setPetVaccinationPreview(URL.createObjectURL(file));
                                              }
                                            }}
                                          />
                                        </label>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <label className="guest-image-upload-trigger">
                                        <Upload className="h-4 w-4" />
                                        Upload Image
                                        <input
                                          type="file"
                                          accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                                          className="hidden"
                                          {...field}
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              const validation = validateImageFile(file);
                                              if (!validation.valid) {
                                                alert(validation.message);
                                                return;
                                              }
                                              onChange(file);
                                              setPetVaccinationPreview(URL.createObjectURL(file));
                                            }
                                          }}
                                        />
                                      </label>
                                    </div>
                                  )}
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>
                )}

                {activeStepConfig?.id === 5 && (
                  <div className="space-y-4">
                    <GuestFormPaymentStepContent
                      form={form}
                      estimatedStayPhp={estimatedStayPhp}
                      voucherDiscountPhp={estimatedVoucherDiscount}
                      voucherLabel={
                        selectedVoucher
                          ? formatVoucherOfferLabel({
                              code: selectedVoucher.code,
                              percentOff: selectedVoucher.percentOff,
                              legacyAmountPhp: selectedVoucher.legacyAmountPhp,
                            })
                          : null
                      }
                    />

                    <FormField
                      control={form.control}
                      name="paymentReceipt"
                      render={({ field: { onChange, value, ...field } }) => (
                        <FormItem>
                          <FormLabel>
                            Downpayment receipt <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="guest-image-upload-dropzone group">
                              {paymentReceiptPreview || value ? (
                                <>
                                  <img
                                    src={
                                      paymentReceiptPreview || (value && URL.createObjectURL(value))
                                    }
                                    alt="Downpayment receipt preview"
                                    className="h-full w-full object-cover"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                                    <label className="guest-image-upload-replace">
                                      <Upload className="h-4 w-4" />
                                      Replace Image
                                      <input
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                                        className="hidden"
                                        {...field}
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            const validation = validateImageFile(file);
                                            if (!validation.valid) {
                                              alert(validation.message);
                                              return;
                                            }
                                            onChange(file);
                                            setPaymentReceiptPreview(URL.createObjectURL(file));
                                          }
                                        }}
                                      />
                                    </label>
                                  </div>
                                </>
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <label className="guest-image-upload-trigger">
                                    <Upload className="h-4 w-4" />
                                    Upload Image
                                    <input
                                      type="file"
                                      accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                                      className="hidden"
                                      {...field}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const validation = validateImageFile(file);
                                          if (!validation.valid) {
                                            alert(validation.message);
                                            return;
                                          }
                                          onChange(file);
                                          setPaymentReceiptPreview(URL.createObjectURL(file));
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Developer API Controls (non-production only) — shown on the last step */}
                {showDevControls && currentStep === guestFormStepCount && (
                  <div className="border-border/80 bg-muted/20 space-y-4 rounded-xl border border-dashed px-4 py-4">
                    <div className="border-separator flex items-center gap-3 border-b pb-3">
                      <Settings className="text-primary size-5" aria-hidden />
                      <h3 className="text-foreground text-sm font-semibold">Developer controls</h3>
                    </div>

                    <div className="space-y-4">
                      <p className="text-muted-foreground text-sm">
                        Control which actions run upon form submission.
                      </p>

                      <div className="space-y-3">
                        <div className="bg-muted/30 hover:bg-muted/50 flex items-center space-x-3 rounded-lg p-3 transition-colors">
                          <Checkbox
                            id="saveToDatabase"
                            checked={devApiControls.saveToDatabase}
                            onCheckedChange={(checked) =>
                              setDevApiControls({
                                ...devApiControls,
                                saveToDatabase: checked === true,
                              })
                            }
                          />
                          <label
                            htmlFor="saveToDatabase"
                            className="flex-1 cursor-pointer text-sm font-medium"
                          >
                            Save data to database
                          </label>
                        </div>

                        <div className="bg-muted/30 hover:bg-muted/50 flex items-center space-x-3 rounded-lg p-3 transition-colors">
                          <Checkbox
                            id="saveImagesToStorage"
                            checked={devApiControls.saveImagesToStorage}
                            onCheckedChange={(checked) =>
                              setDevApiControls({
                                ...devApiControls,
                                saveImagesToStorage: checked === true,
                              })
                            }
                          />
                          <label
                            htmlFor="saveImagesToStorage"
                            className="flex-1 cursor-pointer text-sm font-medium"
                          >
                            Save image assets to Supabase Storage
                          </label>
                        </div>

                        <div className="bg-muted/30 hover:bg-muted/50 flex items-center space-x-3 rounded-lg p-3 transition-colors">
                          <Checkbox
                            id="sendEmail"
                            checked={devApiControls.sendEmail}
                            onCheckedChange={(checked) =>
                              setDevApiControls({
                                ...devApiControls,
                                sendEmail: checked === true,
                              })
                            }
                          />
                          <label
                            htmlFor="sendEmail"
                            title="New Booking Request email to owners (EMAIL_REPLY_TO)"
                            className="flex-1 cursor-pointer text-sm font-medium"
                          >
                            Send email
                          </label>
                        </div>
                      </div>

                      {/* Paste Booking Info from Clipboard Button */}
                      {!bookingId && (
                        <div className="border-t pt-4">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handlePasteFromClipboard}
                            className="w-full"
                          >
                            <ClipboardPaste className="mr-2 h-4 w-4" />
                            Paste Booking Info from Clipboard
                          </Button>
                          <p className="text-muted-foreground mt-2 text-center text-xs">
                            Load booking information copied from an error message
                          </p>
                        </div>
                      )}

                      {/* Generate New Data Button */}
                      {!bookingId && (
                        <div className="border-t pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void handleGenerateNewData()}
                            className="w-full"
                          >
                            Generate New Data
                          </Button>
                          <p className="text-muted-foreground mt-2 text-center text-xs">
                            Populate form with random sample data
                          </p>
                        </div>
                      )}

                      {/* Cancel Booking Button - Only show when viewing an existing booking */}
                      {bookingId && (
                        <div className="border-t pt-4">
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={handleCancelBooking}
                            disabled={isCancellingBooking}
                            className="w-full"
                          >
                            {isCancellingBooking ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Cancelling booking...
                              </>
                            ) : (
                              <>
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancel This Booking
                              </>
                            )}
                          </Button>
                          <p className="text-muted-foreground mt-2 text-center text-xs">
                            Cancels the booking and frees dates. Data stays on file.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </fieldset>

            {antiSpam.render}

            {(!bookingId || guestCanUpdate) && !embed?.onNavChange ? (
              <GuestFormStepNavigation
                bare
                mobileVariant="floating"
                currentStep={currentStep}
                stepCount={guestFormStepCount}
                isSubmitting={isSubmitting}
                canProceed={canProceed}
                submitReady={submitReady}
                onBack={handleBackStep}
                onNext={handleNextStep}
                onSubmit={handleSubmitGuestForm}
              />
            ) : null}
          </div>
        )}
      </form>
    </Form>
  );
}
