import { expect, type Page, type Route } from '@playwright/test';

import { captureParkingScreen } from './parkingScreenCapture';

const ORG_ID = 'org-e2e-001';
export { ORG_ID };
export const E2E_PROPERTY_ID = 'property-e2e-001';
export const E2E_PROPERTY_SLUG = 'solea-mactan';
export const E2E_PROPERTY_BOOKING_ID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
const PARKING_ID = 'parking-e2e-001';
const BOOKING_ID = 'booking-e2e-001';
const GUEST_USER_ID = 'user-e2e-guest-001';
const DIRECT_LINK_TOKEN = 'e2e-direct-link-token-001';
const SUPABASE_AUTH_STORAGE_KEY = 'sb-127-auth-token';

function e2eSupabaseAuthSession() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    access_token: 'playwright-admin-token',
    refresh_token: 'playwright-refresh-token',
    expires_in: 60 * 60,
    expires_at: nowSeconds + 60 * 60,
    token_type: 'bearer',
    user: {
      id: 'user-e2e-host-001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'host@example.com',
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: 'Parking Host' },
      identities: [],
      created_at: new Date(0).toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

export const parkingFlowPaths = {
  guestForm: '/parkings/slot-12a/form?checkInDate=2026-08-25&checkOutDate=2026-08-27',
  guestDirectLinkForm: `/parkings/slot-12a/form?checkInDate=2026-08-25&checkOutDate=2026-08-27&dl=${DIRECT_LINK_TOKEN}`,
  guestStatus: `/parkings/requests/${BOOKING_ID}`,
  hostBookings: '/org/kame-homes-ph/parking/slot-12a/bookings?from=2026-08-01&to=2026-08-31',
  hostBookingDetail: `/org/kame-homes-ph/parking/slot-12a/bookings/${BOOKING_ID}`,
  hostPricing: '/org/kame-homes-ph/parking/slot-12a/pricing',
} as const;

export const parkingFlowLabels = {
  guestName: 'Guest name',
  email: 'Email',
  phone: 'Phone',
  unitNumber: 'Unit',
  vehicleType: 'Vehicle type',
  plateNumber: 'Plate',
  brandModel: 'Brand / model',
  color: 'Color',
  continue: 'Continue',
  submit: 'Submit request',
  whichStay: 'Which stay?',
  differentBooking: 'Different booking. Enter details',
  confirmRequest: 'Confirm request',
  accept: 'Accept',
  decline: 'Decline',
  accessInstructions: 'Access instructions',
  payNow: 'Pay now',
  cancelRequest: 'Cancel request',
  markReady: 'Mark ready',
  complete: 'Complete',
} as const;

/** Guest status page copy (`parkingFlowCopy` / `GuestFormBrandHeader` + status body). */
export const parkingGuestStatusLabels = {
  findingHost: 'Finding a host',
  searchingNearby: 'Searching for hosts nearby',
  payToConfirm: 'Pay to confirm',
  payDetail: 'A host accepted — confirm before the timer ends.',
  parkingConfirmed: 'Parking confirmed',
  requestCancelled: 'Request cancelled',
  noHostAvailable: 'No host available',
  nonRefundable: 'Non-refundable once paid.',
  hostAndEndorsement: 'Host & endorsement',
  chatWithHost: 'Chat with host',
  stayRange: 'Aug 25-27, 2026',
  confirmRequest: 'Confirm request',
  assignedSlot: 'Tower 1 · B2 · 12A',
  assignedSlotEyebrow: 'One Palm Residences · Tower 1 · B2 · 12A',
} as const;

/** Host dashboard status chips / toasts. */
export const parkingHostStatusLabels = {
  awaitingPayment: 'Awaiting payment',
  findingHost: 'Finding host',
  bookingAccepted: 'Booking accepted',
  pendingReview: 'Pending Review',
  readyForCheckin: 'Ready for Check-in',
  completed: 'Completed',
} as const;

export type ParkingFlowState = {
  bookingId: string;
  status:
    | 'draft'
    | 'PENDING_HOST_ACCEPTANCE'
    | 'PENDING_PAYMENT'
    | 'PENDING_REVIEW'
    | 'READY_FOR_CHECKIN'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'NO_HOST_AVAILABLE';
  broadcastResponse: 'pending' | 'claimed' | 'declined' | 'expired';
  parkingId: string | null;
  parkingLabel: string | null;
  parkingSlug: string | null;
  endorsementNote: string | null;
  expiresAt: string | null;
  paymentExpiresAt: string | null;
  batchNumber: number;
  bookingChannel: 'standard' | 'direct_link';
  linkedPropertyBookingId: string | null;
  endorsementSentAt: string | null;
  endorsementSendError: string | null;
  endorsementEmailSnapshot: string | null;
  hostContact: { name: string; email: string; phone: string | null } | null;
  supportEscalationPhone: string | null;
  lastSubmitBody: Record<string, unknown> | null;
  /** When true, submit-parking-booking-request returns no_parking_available. */
  rejectSubmitNoParking: boolean;
};

const MOCK_HOST_CONTACT = {
  name: 'Parking Host',
  email: 'host@example.com',
  phone: '09171230000',
};

const MOCK_ENDORSEMENT_SNAPSHOT =
  '<p>Endorsement for Jamie Park — vehicle ABC-1234 approved for Tower 1 B2 slot 12A.</p>';

export function createParkingFlowState(): ParkingFlowState {
  const expiresAt = new Date(Date.now() + 45 * 60_000).toISOString();
  return {
    bookingId: BOOKING_ID,
    status: 'draft',
    broadcastResponse: 'pending',
    parkingId: null,
    parkingLabel: null,
    parkingSlug: null,
    endorsementNote: null,
    expiresAt,
    paymentExpiresAt: null,
    batchNumber: 1,
    bookingChannel: 'standard',
    linkedPropertyBookingId: null,
    endorsementSentAt: null,
    endorsementSendError: null,
    endorsementEmailSnapshot: null,
    hostContact: null,
    supportEscalationPhone: '+639171234567',
    lastSubmitBody: null,
    rejectSubmitNoParking: false,
  };
}

export function markParkingFlowUnavailable(
  state: ParkingFlowState,
  response: Extract<ParkingFlowState['broadcastResponse'], 'declined' | 'expired'> = 'expired'
) {
  state.status = 'NO_HOST_AVAILABLE';
  state.broadcastResponse = response;
  state.parkingId = null;
  state.parkingLabel = null;
  state.parkingSlug = null;
  state.endorsementNote = null;
  state.paymentExpiresAt = null;
}

export function fulfillParkingPayment(state: ParkingFlowState) {
  if (state.status !== 'PENDING_PAYMENT') return;
  state.status = 'PENDING_REVIEW';
  state.expiresAt = null;
  state.paymentExpiresAt = null;
  state.endorsementSentAt = new Date().toISOString();
  state.endorsementSendError = null;
  state.endorsementEmailSnapshot = MOCK_ENDORSEMENT_SNAPSHOT;
  state.hostContact = MOCK_HOST_CONTACT;
  state.parkingSlug = 'slot-12a';
}

function effectiveStatus(state: ParkingFlowState) {
  return state.status === 'draft' ? 'PENDING_HOST_ACCEPTANCE' : state.status;
}

function bookingRow(state: ParkingFlowState) {
  const status = effectiveStatus(state);
  return {
    id: state.bookingId,
    created_at: '2026-08-24T16:00:00.000Z',
    updated_at: '2026-08-24T16:00:00.000Z',
    booking_kind: 'parking',
    property_id: null,
    property_name: null,
    property_slug: null,
    parking_id: state.parkingId,
    parking_name: 'Slot 12A',
    parking_slug: 'slot-12a',
    guest_facebook_name: '',
    primary_guest_name: 'Jamie Park',
    guest_email: 'jamie@example.com',
    guest_phone_number: '09171234567',
    guest_address: null,
    nationality: null,
    primary_guest_age: null,
    guest2_name: null,
    guest2_age: null,
    guest3_name: null,
    guest3_age: null,
    guest4_name: null,
    guest4_age: null,
    guest5_name: null,
    guest5_age: null,
    guest2_valid_id_url: null,
    guest3_valid_id_url: null,
    guest4_valid_id_url: null,
    guest5_valid_id_url: null,
    check_in_date: '08-25-2026',
    check_out_date: '08-27-2026',
    check_in_time: null,
    check_out_time: null,
    number_of_adults: 1,
    number_of_children: 0,
    number_of_nights: 2,
    need_parking: false,
    car_plate_number: 'ABC-1234',
    car_brand_model: 'Toyota Vios',
    car_color: 'Gray',
    parking_endorsement_url: null,
    parking_broadcast_expires_at: status === 'PENDING_HOST_ACCEPTANCE' ? state.expiresAt : null,
    parking_payment_expires_at: status === 'PENDING_PAYMENT' ? state.paymentExpiresAt : null,
    parking_claimed_at:
      status === 'PENDING_PAYMENT' ||
      status === 'PENDING_REVIEW' ||
      status === 'READY_FOR_CHECKIN' ||
      status === 'COMPLETED'
        ? '2026-08-24T16:03:00.000Z'
        : null,
    parking_endorsement_note: state.endorsementNote,
    parking_request_organization_id: ORG_ID,
    parking_booking_channel: state.bookingChannel,
    linked_property_booking_id: state.linkedPropertyBookingId,
    has_pets: false,
    pet_name: null,
    pet_type: null,
    pet_breed: null,
    pet_age: null,
    pet_vaccination_date: null,
    find_us: null,
    find_us_details: null,
    booking_source: null,
    guest_requests_surprise_decor: false,
    surprise_decor_staff_acknowledged: false,
    guest_special_requests: null,
    valid_id_url: null,
    payment_receipt_url: null,
    pet_vaccination_url: null,
    pet_image_url: null,
    pdf_url: null,
    status,
    booking_rate: 1200,
  };
}

function guestStatusPayload(state: ParkingFlowState) {
  const status = effectiveStatus(state);
  return {
    status,
    checkInDate: '2026-08-25',
    checkOutDate: '2026-08-27',
    expiresAt:
      status === 'PENDING_HOST_ACCEPTANCE'
        ? state.expiresAt
        : status === 'PENDING_PAYMENT'
          ? state.paymentExpiresAt
          : null,
    batchNumber: state.batchNumber,
    parkingLabel: state.parkingLabel,
    parkingSlug: state.parkingSlug,
    parkingName: state.parkingSlug ? 'Slot 12A' : null,
    residenceName: state.parkingSlug ? 'One Palm Residences' : null,
    coverImage: state.parkingSlug
      ? 'https://images.unsplash.com/photo-1590674899484-d5640e854fbb?w=600'
      : null,
    brandColor: '#0f766e',
    logoUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=200',
    endorsementNote: state.endorsementNote,
    organizationName: 'Kame Homes PH',
    endorsementSentAt: state.endorsementSentAt,
    endorsementSendError: state.endorsementSendError,
    endorsementEmailSnapshot: state.endorsementEmailSnapshot,
    hostContact: state.hostContact,
    supportEscalationPhone: state.supportEscalationPhone,
  };
}

function publicParkingDetail() {
  return {
    id: PARKING_ID,
    slug: 'slot-12a',
    name: 'Slot 12A',
    residenceName: 'One Palm Residences',
    tower: 'Tower 1',
    level: 'B2',
    slotLabel: '12A',
    parkingType: 'covered',
    ratePerNight: 1200,
    brandColor: '#0f766e',
    description: 'Covered parking slot near the main lobby.',
    spaceLengthM: 5.2,
    spaceWidthM: 2.4,
    heightClearanceM: 2.1,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    pricing: {
      weekdayNightlyRate: 1200,
      weekendNightlyRate: 1350,
      dateOverrides: {},
      currency: 'PHP',
    },
    coverImage: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=1200&q=80',
    images: ['https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=1200&q=80'],
    features: ['Covered', 'Near elevator'],
    notes: null,
    address: 'IT Park Drive',
    city: 'Cebu City',
    province: 'Cebu',
    country: 'Philippines',
    zipCode: '6000',
    latitude: 10.3285,
    longitude: 123.9053,
    placeId: null,
    orgSlug: 'kame-homes-ph',
    orgName: 'Kame Homes PH',
  };
}

function organizationList() {
  return {
    organizations: [
      {
        id: ORG_ID,
        name: 'Kame Homes PH',
        slug: 'kame-homes-ph',
        description: null,
        logoUrl: null,
        settings: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  };
}

function e2ePropertyList() {
  return {
    properties: [
      {
        id: E2E_PROPERTY_ID,
        organizationId: ORG_ID,
        name: 'Solea Mactan',
        slug: E2E_PROPERTY_SLUG,
        type: 'condo',
        status: 'ACTIVE',
        address: 'Mactan',
        towerAndUnit: null,
        tower: 'Tower A',
        unitNumber: null,
        residenceName: 'Solea Mactan',
        maxGuests: 4,
        settings: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  };
}

export function e2ePropertyAccessPayload() {
  return {
    accessKind: 'owner' as const,
    permissions: [
      'bookings:view',
      'bookings:edit',
      'bookings:manage',
      'bookings:workflow',
      'finance:view',
      'maintenance:view',
      'marketing:view',
      'inbox:view',
      'notifications:view',
      'templates:view',
      'settings:view',
      'team:view',
      'plans:view',
    ],
    memberId: null,
    propertyId: E2E_PROPERTY_ID,
    orgSlug: 'kame-homes-ph',
    orgName: 'Kame Homes PH',
    propertySlug: E2E_PROPERTY_SLUG,
    propertyName: 'Solea Mactan',
    planLimited: false,
  };
}

export function e2ePropertyEntitlementsPayload(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    automatedBookingFlow: true,
    verifiedBadgeEligible: false,
    recommendedBadgeEligible: false,
    telegramNotifications: false,
    teamManagement: { enabled: true, maxMembers: null },
    searchVisibilityTier: 'none' as const,
    marketingPublishLimitPerGroup: 0,
    aiValidations: false,
    aiMonthlyCreditAllowance: 0,
    marketingStudio: false,
    customPages: false,
    propertyShowcase: false,
    aiDashboardAssistant: false,
    aiReceptionist: false,
    aiMarketingGeneration: false,
    aiChatAutoReply: false,
    fullyManagedByPlatform: false,
    financeReporting: true,
    maintenanceReporting: true,
    metaChatChannel: false,
    quickReplies: false,
    customTemplates: false,
    publicPagesAutosave: false,
    bookingImport: false,
    calendarSync: false,
    customRoles: true,
    planId: 'plan-e2e-001',
    planCode: 'starter',
    planName: 'Starter',
    pricingModel: 'monthly',
    status: 'active',
    propertySubscriptionId: 'sub-e2e-001',
    ...overrides,
  };
}

/** Free plan: automated workflow emails gated; host uses Automation Triggers. */
export function e2eFreePropertyEntitlementsPayload(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return e2ePropertyEntitlementsPayload({
    automatedBookingFlow: false,
    teamManagement: { enabled: false, maxMembers: null },
    financeReporting: false,
    maintenanceReporting: false,
    customRoles: false,
    planId: 'plan-e2e-free',
    planCode: 'free',
    planName: 'Free',
    propertySubscriptionId: 'sub-e2e-free',
    ...overrides,
  });
}

export type E2ePropertyBookingRow = ReturnType<typeof e2ePropertyBookingRow>;

export function e2ePropertyBookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: E2E_PROPERTY_BOOKING_ID,
    created_at: '2026-08-20T10:00:00.000Z',
    updated_at: '2026-08-24T16:00:00.000Z',
    status_updated_at: '2026-08-24T16:00:00.000Z',
    booking_kind: 'property',
    property_id: E2E_PROPERTY_ID,
    property_name: 'Solea Mactan',
    property_slug: E2E_PROPERTY_SLUG,
    parking_id: null,
    parking_name: null,
    parking_slug: null,
    guest_facebook_name: 'Maria Santos',
    primary_guest_name: 'Maria Santos',
    guest_email: 'maria@example.com',
    guest_phone_number: '09171234567',
    check_in_date: '08-25-2026',
    check_out_date: '08-27-2026',
    check_in_time: '14:00',
    check_out_time: '12:00',
    number_of_adults: 2,
    number_of_children: 0,
    number_of_nights: 2,
    need_parking: true,
    car_plate_number: 'ABC-1234',
    car_brand_model: 'Toyota Vios',
    car_color: 'Gray',
    parking_owner: null,
    parking_rate_guest: null,
    parking_rate_paid: null,
    parking_endorsement_url: null,
    parking_endorsement_note: null,
    has_pets: false,
    status: 'PENDING_DOCUMENTS',
    booking_rate: 5000,
    gaf_request_pdf_url: 'https://example.com/e2e-gaf-request.pdf',
    valid_id_url: 'https://example.com/e2e-valid-id.pdf',
    pet_request_pdf_url: null,
    ...overrides,
  };
}

function parkingList() {
  return {
    parkings: [
      {
        id: PARKING_ID,
        organizationId: ORG_ID,
        name: 'Slot 12A',
        slug: 'slot-12a',
        status: 'ACTIVE',
        residenceName: 'One Palm Residences',
        tower: 'Tower 1',
        level: 'B2',
        slotLabel: '12A',
        parkingType: 'covered',
        ratePerNight: 1200,
        acceptedVehicleTypes: ['car'],
        settings: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  };
}

function parkingPricingPayload() {
  return {
    weekdayNightlyRate: 1200,
    weekendNightlyRate: 1350,
    dateOverrides: {},
    currency: 'PHP',
    guestRateCapWeekday: 400,
    guestRateCapWeekend: 450,
    commissionPct: 0.2,
    directBookingToken: DIRECT_LINK_TOKEN,
    directBookingSlug: 'slot-12a',
    directCommissionPct: 0.1,
  };
}

function linkablePropertyBookings() {
  return {
    bookings: [
      {
        id: E2E_PROPERTY_BOOKING_ID,
        propertyName: 'Solea Mactan',
        checkInDate: '2026-08-24',
        checkOutDate: '2026-08-28',
        towerAndUnitNumber: 'Tower A - 1204',
        carPlateNumber: 'ABC-1234',
        carBrandModel: 'Toyota Vios',
        carColor: 'Gray',
        guestName: 'Jamie Park',
        guestEmail: 'jamie@example.com',
        guestPhone: '09171234567',
      },
    ],
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function parseRequestedParkingId(url: URL): string | null {
  return url.searchParams.get('parking_id');
}

function resolveDirectLinkChannel(
  body: Record<string, unknown> | undefined
): 'standard' | 'direct_link' {
  const token = body?.directLinkToken;
  return typeof token === 'string' && token === DIRECT_LINK_TOKEN ? 'direct_link' : 'standard';
}

export async function installParkingGuestSession(page: Page) {
  await page.addInitScript(
    ({ guestKey, guestSession }) => {
      window.localStorage.setItem(guestKey, JSON.stringify(guestSession));
    },
    {
      guestKey: 'kame:e2e-guest-session',
      guestSession: {
        accessToken: 'playwright-guest-token',
        refreshToken: 'playwright-guest-refresh',
        userId: GUEST_USER_ID,
        email: 'jamie@example.com',
        name: 'Jamie Park',
      },
    }
  );
}

export async function installParkingHostSession(page: Page) {
  await page.addInitScript(
    ({ authKey, session, supabaseAuthKey, supabaseAuthSession, orgSlug, parkingSlug }) => {
      window.localStorage.setItem(authKey, JSON.stringify(session));
      window.localStorage.setItem(supabaseAuthKey, JSON.stringify(supabaseAuthSession));
      window.localStorage.setItem('kame-last-org-slug', orgSlug);
      window.localStorage.setItem('kame-last-parking-slug', parkingSlug);
      window.localStorage.setItem('kame-last-tenant-kind', 'parking');
    },
    {
      authKey: 'kame:e2e-admin-session',
      supabaseAuthKey: SUPABASE_AUTH_STORAGE_KEY,
      supabaseAuthSession: e2eSupabaseAuthSession(),
      session: {
        accessToken: 'playwright-admin-token',
        refreshToken: 'playwright-refresh-token',
        userId: 'user-e2e-host-001',
        email: 'host@example.com',
        name: 'Parking Host',
      },
      orgSlug: 'kame-homes-ph',
      parkingSlug: 'slot-12a',
    }
  );
}

export async function installParkingFlowMocks(page: Page, state: ParkingFlowState) {
  await installParkingGuestSession(page);
  await installParkingHostSession(page);

  await page.route('**/functions/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/').pop();
    const body = route.request().postDataJSON?.() as Record<string, unknown> | undefined;

    switch (endpoint) {
      case 'get-public-parking':
        await fulfillJson(route, { success: true, data: publicParkingDetail() });
        return;
      case 'submit-parking-booking-request':
        if (state.rejectSubmitNoParking) {
          await fulfillJson(route, { success: false, error: 'no_parking_available' }, 422);
          return;
        }
        state.status = 'PENDING_HOST_ACCEPTANCE';
        state.broadcastResponse = 'pending';
        state.parkingId = null;
        state.parkingLabel = null;
        state.parkingSlug = null;
        state.endorsementNote = null;
        state.paymentExpiresAt = null;
        state.endorsementSentAt = null;
        state.endorsementSendError = null;
        state.endorsementEmailSnapshot = null;
        state.hostContact = null;
        state.bookingChannel = resolveDirectLinkChannel(body);
        state.linkedPropertyBookingId =
          typeof body?.linkedPropertyBookingId === 'string' ? body.linkedPropertyBookingId : null;
        state.lastSubmitBody = body ?? null;
        await fulfillJson(route, {
          success: true,
          data: {
            bookingId: state.bookingId,
            status: 'PENDING_HOST_ACCEPTANCE',
            expiresAt: state.expiresAt,
          },
        });
        return;
      case 'get-parking-booking-status':
        if (state.status === 'draft') {
          await fulfillJson(route, { success: false, error: 'Request not found' }, 404);
          return;
        }
        await fulfillJson(route, { success: true, data: guestStatusPayload(state) });
        return;
      case 'create-parking-payment-checkout':
        fulfillParkingPayment(state);
        await fulfillJson(route, {
          success: true,
          data: {
            checkoutUrl: `${parkingFlowPaths.guestStatus}?e2ePaid=1`,
          },
        });
        return;
      case 'cancel-parking-booking':
        state.status = 'CANCELLED';
        state.broadcastResponse = 'declined';
        state.parkingId = null;
        state.parkingLabel = null;
        state.parkingSlug = null;
        state.paymentExpiresAt = null;
        await fulfillJson(route, { success: true, data: { cancelled: true } });
        return;
      case 'request-parking-endorsement':
        state.endorsementSentAt = new Date().toISOString();
        state.endorsementSendError = null;
        state.endorsementEmailSnapshot = MOCK_ENDORSEMENT_SNAPSHOT;
        state.hostContact = MOCK_HOST_CONTACT;
        await fulfillJson(route, { success: true, data: { sent: true } });
        return;
      case 'list-linkable-property-bookings':
        await fulfillJson(route, { success: true, data: linkablePropertyBookings() });
        return;
      case 'parking-pricing':
        if (route.request().method() === 'GET') {
          await fulfillJson(route, { success: true, data: parkingPricingPayload() });
          return;
        }
        await fulfillJson(route, { success: true, data: parkingPricingPayload() });
        return;
      case 'guest-web-chat-resume':
        await fulfillJson(route, {
          success: true,
          data: { conversationId: 'chat-e2e-001', hasThread: true },
        });
        return;
      case 'guest-web-chat-start':
        await fulfillJson(route, {
          success: true,
          data: { conversationId: 'chat-e2e-001' },
        });
        return;
      case 'guest-web-chat-messages':
        if (route.request().method() === 'GET') {
          await fulfillJson(route, {
            success: true,
            data: {
              messages: [
                {
                  id: 'msg-e2e-001',
                  body: 'Hi, I am on my way to the slot.',
                  senderRole: 'guest',
                  createdAt: '2026-08-24T16:10:00.000Z',
                },
              ],
            },
          });
          return;
        }
        await fulfillJson(route, { success: true, data: { messageId: 'msg-e2e-002' } });
        return;
      case 'list-organizations':
        await fulfillJson(route, { success: true, data: organizationList() });
        return;
      case 'list-properties':
        await fulfillJson(route, { success: true, data: e2ePropertyList() });
        return;
      case 'property-access':
        await fulfillJson(route, { success: true, data: e2ePropertyAccessPayload() });
        return;
      case 'property-entitlements':
        await fulfillJson(route, { success: true, data: e2ePropertyEntitlementsPayload() });
        return;
      case 'get-booking-ai-review':
        await fulfillJson(route, { success: true, data: { review: null } });
        return;
      case 'get-booking-ai-assistant-audit':
        await fulfillJson(route, { success: true, data: { entries: [] } });
        return;
      case 'notifications-list':
        await fulfillJson(route, {
          success: true,
          data: { notifications: [], nextCursor: null, unreadCount: 0 },
        });
        return;
      case 'notifications-mark-read':
        await fulfillJson(route, { success: true, data: { updated: true } });
        return;
      case 'list-parkings':
        await fulfillJson(route, { success: true, data: parkingList() });
        return;
      case 'list-bookings':
        await fulfillJson(route, {
          success: true,
          data: state.status === 'draft' ? [] : [bookingRow(state)],
          total: state.status === 'draft' ? 0 : 1,
        });
        return;
      case 'get-parking-broadcast-status':
        await fulfillJson(route, {
          success: true,
          data: {
            exists: state.status !== 'draft',
            response: state.broadcastResponse,
          },
        });
        return;
      case 'claim-parking-booking':
        if (state.broadcastResponse !== 'pending') {
          await fulfillJson(route, { success: false, error: 'already_claimed' }, 409);
          return;
        }
        state.status = 'PENDING_PAYMENT';
        state.broadcastResponse = 'claimed';
        state.parkingId = PARKING_ID;
        state.parkingLabel = 'Tower 1 · B2 · 12A';
        state.parkingSlug = 'slot-12a';
        state.paymentExpiresAt = new Date(Date.now() + 45 * 60_000).toISOString();
        state.endorsementNote =
          typeof body?.endorsementNote === 'string' ? body.endorsementNote : null;
        await fulfillJson(route, { success: true, data: { booking: bookingRow(state) } });
        return;
      case 'decline-parking-booking':
        markParkingFlowUnavailable(state, 'declined');
        await fulfillJson(route, { success: true, data: { bookingTerminated: true } });
        return;
      case 'transition-parking-booking':
        if (body?.toStatus === 'READY_FOR_CHECKIN') {
          state.status = 'READY_FOR_CHECKIN';
        } else if (body?.toStatus === 'COMPLETED') {
          state.status = 'COMPLETED';
        } else if (body?.toStatus === 'CANCELLED') {
          state.status = 'CANCELLED';
        }
        await fulfillJson(route, { success: true, data: bookingRow(state) });
        return;
      default:
        await route.continue();
    }
  });

  await page.route('**/rest/v1/guest_submissions*', async (route) => {
    const url = new URL(route.request().url());
    const id = url.searchParams.get('id');
    const propertyId = url.searchParams.get('property_id');
    const parkingId = parseRequestedParkingId(url);
    const wantsNullParking = parkingId === 'is.null';
    const row = bookingRow(state);

    if (id === `eq.${E2E_PROPERTY_BOOKING_ID}`) {
      await fulfillJson(route, e2ePropertyBookingRow());
      return;
    }

    if (propertyId === `eq.${E2E_PROPERTY_ID}`) {
      await fulfillJson(route, [e2ePropertyBookingRow()]);
      return;
    }

    if (id !== `eq.${state.bookingId}` || state.status === 'draft') {
      await fulfillJson(
        route,
        { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
        406
      );
      return;
    }

    if (parkingId === `eq.${PARKING_ID}` && row.parking_id === PARKING_ID) {
      await fulfillJson(route, row);
      return;
    }

    if (wantsNullParking && row.parking_id === null) {
      await fulfillJson(route, row);
      return;
    }

    if (!parkingId) {
      await fulfillJson(route, row);
      return;
    }

    await fulfillJson(
      route,
      {
        code: 'PGRST116',
        message: 'JSON object requested, multiple (or no) rows returned',
      },
      406
    );
  });
}

export type SubmitGuestParkingRequestOptions = {
  formPath?: string;
  guestName?: string;
  email?: string;
  phone?: string;
  unitNumber?: string;
  requireDateEntry?: boolean;
  /** Use linked-stay confirm instead of manual stepper entry. */
  linkedStay?: boolean;
  linkedStayPattern?: RegExp | string;
  skipScreens?: boolean;
};

async function fillParkingFormDatesOnStep2(page: Page) {
  const dialog = page.getByRole('dialog');
  const scope = (await dialog.count()) > 0 ? dialog : page;

  const checkInTrigger = scope.getByRole('button', { name: 'MM/DD/YYYY' }).first();
  if (!(await checkInTrigger.isVisible())) return;

  await checkInTrigger.click();
  await page
    .locator('[data-radix-popper-content-wrapper] [role="gridcell"] button:not([disabled])')
    .first()
    .click();

  const checkOutTrigger = scope.getByRole('button', { name: 'MM/DD/YYYY' }).first();
  if (await checkOutTrigger.isVisible()) {
    await checkOutTrigger.click();
    await page
      .locator('[data-radix-popper-content-wrapper] [role="gridcell"] button:not([disabled])')
      .nth(1)
      .click();
  }
}

async function waitForParkingFormEntry(page: Page) {
  const guestNameField = page.getByLabel(parkingFlowLabels.guestName);
  const manualOption = page.getByRole('button', { name: parkingFlowLabels.differentBooking });
  const confirmSubmit = page.getByRole('button', { name: parkingFlowLabels.submit });

  await expect
    .poll(
      async () =>
        (await guestNameField.isVisible()) ||
        (await manualOption.isVisible()) ||
        (await page.getByText(parkingFlowLabels.whichStay).isVisible()) ||
        (await confirmSubmit.isVisible()),
      { timeout: 15_000 }
    )
    .toBe(true);
}

export async function chooseManualParkingEntry(page: Page) {
  await waitForParkingFormEntry(page);

  const manualOption = page.getByRole('button', { name: parkingFlowLabels.differentBooking });
  if (await manualOption.isVisible()) {
    await manualOption.click();
  }

  await expect(page.getByLabel(parkingFlowLabels.guestName)).toBeVisible({ timeout: 15_000 });
}

export async function submitGuestParkingViaLinkedStay(page: Page, stayPattern: RegExp | string) {
  await waitForParkingFormEntry(page);
  await page.getByRole('button', { name: stayPattern }).click();
  await expect(page.getByText(parkingFlowLabels.confirmRequest)).toBeVisible();
  await page.getByRole('button', { name: parkingFlowLabels.submit }).click();
}

export async function fillGuestParkingRegistrationForm(
  page: Page,
  options: {
    guestName?: string;
    email?: string;
    phone?: string;
    unitNumber?: string;
    /** Host modal has no URL date params — pick dates on step 2. */
    requireDateEntry?: boolean;
  } = {}
) {
  const guestName = options.guestName ?? 'Jamie Park';
  const email = options.email ?? 'jamie@example.com';
  const phone = options.phone ?? '09171234567';
  const unitNumber = options.unitNumber ?? 'Tower 1 - 2604';

  await chooseManualParkingEntry(page);

  await page.getByLabel(parkingFlowLabels.guestName).fill(guestName);
  await page.getByLabel(parkingFlowLabels.email).fill(email);
  await page.getByLabel(parkingFlowLabels.phone).fill(phone);
  await page.getByRole('button', { name: parkingFlowLabels.continue }).click();

  await page.getByLabel(parkingFlowLabels.unitNumber).fill(unitNumber);
  if (options.requireDateEntry) {
    await fillParkingFormDatesOnStep2(page);
  }
  await page.getByRole('button', { name: parkingFlowLabels.continue }).click();

  await page.getByLabel(parkingFlowLabels.vehicleType).click();
  await page.getByRole('option', { name: 'Car' }).click();
  await page.getByLabel(parkingFlowLabels.plateNumber).fill('ABC-1234');
  await page.getByLabel(parkingFlowLabels.brandModel).fill('Toyota Vios');
  await page.getByLabel(parkingFlowLabels.color).fill('Gray');
}

export async function submitGuestParkingRequest(
  page: Page,
  options: SubmitGuestParkingRequestOptions = {}
) {
  const formPath = options.formPath ?? parkingFlowPaths.guestForm;

  await page.goto(formPath);
  if (!options.skipScreens) {
    await captureParkingScreen(page, 'guest-form', { role: 'guest' });
  }

  if (options.linkedStay) {
    await submitGuestParkingViaLinkedStay(page, options.linkedStayPattern ?? /Solea Mactan/);
  } else {
    await fillGuestParkingRegistrationForm(page, options);
    await page.getByRole('button', { name: parkingFlowLabels.submit }).click();
  }

  if (!options.skipScreens) {
    await captureParkingScreen(page, 'guest-submit-success', { role: 'guest' });
  }
  await expect(page).toHaveURL(new RegExp(`/parkings/requests/${BOOKING_ID}$`));
  if (!options.skipScreens) {
    await captureParkingScreen(page, 'guest-waiting', { role: 'guest' });
  }
}

export async function guestPayForParking(page: Page, state: ParkingFlowState) {
  await page.getByRole('button', { name: parkingFlowLabels.payNow }).click();
  await expect(page).toHaveURL(/e2ePaid=1/);
  await expect.poll(() => state.status).toBe('PENDING_REVIEW');
  await expect(
    page.getByRole('heading', { name: parkingGuestStatusLabels.parkingConfirmed })
  ).toBeVisible({ timeout: 20_000 });
}

export async function hostAcceptPendingBooking(
  page: Page,
  endorsementNote = 'Use the Tower 1 ramp and show this request at the guard.'
) {
  await page.getByLabel(parkingFlowLabels.accessInstructions).fill(endorsementNote);
  await page.getByRole('button', { name: parkingFlowLabels.accept }).click();
}
