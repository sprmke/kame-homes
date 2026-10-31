/**
 * Playwright harness — next-stay voucher redemption (wallet → form apply → host pricing).
 *
 * Messaging / in-chat voucher share is **not** implemented in product yet; specs cover
 * wallet → Book again → form picker → host review instead.
 */

import { expect, type Page, type Route } from '@playwright/test';

import { VOUCHER_E2E_BOOKING_ID } from './voucherRevealHarness';
import {
  applyTeamMemberSessionStorage,
  installPropertyTeamRbacMocks,
  TEAM_E2E_ORG_SLUG,
  TEAM_E2E_PROPERTY_ID,
  TEAM_E2E_PROPERTY_SLUG,
} from '../../team/shared/propertyTeamRbacHarness';

/** Mirrors `GuestVoucherDto` — kept local so e2e harnesses avoid UI path aliases. */
export type E2eGuestVoucher = {
  sourceBookingId: string;
  code: string;
  percentOff: number;
  legacyAmountPhp: number | null;
  awardedAt: string | null;
  checkInDate: string;
  checkOutDate: string;
  propertyId: string | null;
  propertySlug: string | null;
  propertyName: string | null;
  propertyImageUrl: string | null;
  redeemedAt: string | null;
  redeemedBookingId: string | null;
};

export const VOUCHER_SOURCE_BOOKING_ID = VOUCHER_E2E_BOOKING_ID;
export const VOUCHER_REDEEMING_BOOKING_ID = 'b2c3d4e5-f6a7-8901-bcde-voucher000002';
export const VOUCHER_GUEST_USER_ID = 'user-e2e-voucher-guest-001';
export const VOUCHER_GUEST_EMAIL = 'maria@example.com';

const GUEST_SESSION_KEY = 'kame:e2e-guest-session';
const SUPABASE_AUTH_STORAGE_KEY = 'sb-127-auth-token';

function e2eSupabaseGuestAuthSession() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    access_token: 'playwright-voucher-guest-token',
    refresh_token: 'playwright-voucher-guest-refresh',
    expires_in: 60 * 60,
    expires_at: nowSeconds + 60 * 60,
    token_type: 'bearer',
    user: {
      id: VOUCHER_GUEST_USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: VOUCHER_GUEST_EMAIL,
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: 'Maria Santos' },
      identities: [],
      created_at: new Date(0).toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

/** 1×1 PNG — valid ID upload in guest form specs. */
export const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

export const voucherRedemptionPaths = {
  wallet: '/account/vouchers',
  guestForm: (propertySlug = TEAM_E2E_PROPERTY_SLUG) =>
    `/properties/${propertySlug}/form?checkInDate=2026-09-05&checkOutDate=2026-09-07&source=airbnb`,
  hostBookingDetail: (bookingId = VOUCHER_REDEEMING_BOOKING_ID) =>
    `/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/bookings/${bookingId}`,
  propertyMessages: (propertySlug = TEAM_E2E_PROPERTY_SLUG) =>
    `/properties/${propertySlug}/messages?checkInDate=2026-09-05&checkOutDate=2026-09-07`,
} as const;

export type VoucherRedemptionGuestState = {
  vouchers: E2eGuestVoucher[];
  submitCalls: number;
  lastSubmitFields: Record<string, string> | null;
};

export type VoucherRedemptionHostState = {
  booking: Record<string, unknown>;
};

export function createAvailableVoucher(overrides: Partial<E2eGuestVoucher> = {}): E2eGuestVoucher {
  return {
    sourceBookingId: VOUCHER_SOURCE_BOOKING_ID,
    code: 'OFF-10',
    percentOff: 10,
    legacyAmountPhp: null,
    awardedAt: '2026-08-28T10:00:00.000Z',
    checkInDate: '08-25-2026',
    checkOutDate: '08-27-2026',
    propertyId: TEAM_E2E_PROPERTY_ID,
    propertySlug: TEAM_E2E_PROPERTY_SLUG,
    propertyName: 'Solea Mactan',
    propertyImageUrl: null,
    redeemedAt: null,
    redeemedBookingId: null,
    ...overrides,
  };
}

export function createUsedVoucher(overrides: Partial<E2eGuestVoucher> = {}): E2eGuestVoucher {
  return createAvailableVoucher({
    redeemedAt: '2026-09-01T08:00:00.000Z',
    redeemedBookingId: VOUCHER_REDEEMING_BOOKING_ID,
    ...overrides,
  });
}

export function createVoucherRedemptionGuestState(
  overrides: Partial<VoucherRedemptionGuestState> = {}
): VoucherRedemptionGuestState {
  return {
    vouchers: [createAvailableVoucher()],
    submitCalls: 0,
    lastSubmitFields: null,
    ...overrides,
  };
}

export function createVoucherRedemptionHostState(
  overrides: Partial<VoucherRedemptionHostState> = {}
): VoucherRedemptionHostState {
  return {
    booking: e2eRedeemingBookingRow(),
    ...overrides,
  };
}

export function e2eRedeemingBookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: VOUCHER_REDEEMING_BOOKING_ID,
    created_at: '2026-09-01T09:00:00.000Z',
    updated_at: '2026-09-01T09:00:00.000Z',
    status_updated_at: '2026-09-01T09:00:00.000Z',
    booking_kind: 'property',
    property_id: TEAM_E2E_PROPERTY_ID,
    property_name: 'Solea Mactan',
    property_slug: TEAM_E2E_PROPERTY_SLUG,
    parking_id: null,
    parking_name: null,
    parking_slug: null,
    guest_facebook_name: 'Maria Santos',
    primary_guest_name: 'Maria Santos',
    guest_email: VOUCHER_GUEST_EMAIL,
    guest_phone_number: '09171234567',
    check_in_date: '09-05-2026',
    check_out_date: '09-07-2026',
    check_in_time: '14:00',
    check_out_time: '12:00',
    number_of_adults: 2,
    number_of_children: 0,
    number_of_nights: 2,
    need_parking: false,
    has_pets: false,
    booking_source: 'Airbnb',
    status: 'PENDING_REVIEW',
    booking_rate: null,
    down_payment: null,
    security_deposit: null,
    pet_fee: null,
    parking_rate_guest: null,
    applied_voucher_source_booking_id: VOUCHER_SOURCE_BOOKING_ID,
    applied_voucher_code: 'OFF-10',
    applied_voucher_percent: 10,
    applied_voucher_discount_php: 500,
    gaf_request_pdf_url: null,
    pet_request_pdf_url: null,
    ...overrides,
  };
}

export function e2eCompletedSourceBookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: VOUCHER_SOURCE_BOOKING_ID,
    created_at: '2026-08-20T10:00:00.000Z',
    updated_at: '2026-08-28T12:00:00.000Z',
    status_updated_at: '2026-08-28T12:00:00.000Z',
    booking_kind: 'property',
    property_id: TEAM_E2E_PROPERTY_ID,
    property_name: 'Solea Mactan',
    property_slug: TEAM_E2E_PROPERTY_SLUG,
    guest_facebook_name: 'Maria Santos',
    primary_guest_name: 'Maria Santos',
    guest_email: VOUCHER_GUEST_EMAIL,
    check_in_date: '08-25-2026',
    check_out_date: '08-27-2026',
    status: 'COMPLETED',
    next_stay_voucher_code: 'OFF-10',
    next_stay_voucher_amount: 10,
    next_stay_voucher_awarded_at: '2026-08-28T10:00:00.000Z',
    next_stay_voucher_redeemed_at: '2026-09-01T09:00:00.000Z',
    next_stay_voucher_redeemed_booking_id: VOUCHER_REDEEMING_BOOKING_ID,
    ...overrides,
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function guestPaymentInfoPayload() {
  return {
    gcashName: 'Host GCash',
    gcashNumber: '09170000000',
    gcashQrImageUrl: '',
    paymentProvider: 'gcash',
    paymentMethods: [],
    emailLogoUrl: '',
    brandColor: '#0f766e',
    gafUnitOwner: '',
    gafTowerAndUnitNumber: '',
    gafGuestsOnsiteContactPerson: '',
    gafOwnerContactNumber: '',
    allowPets: false,
    allowParking: false,
    allowSurpriseDecor: false,
    maxAdults: 4,
    maxChildren: 2,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    cleaningBufferMinutes: 60,
    residenceName: 'Solea Mactan',
    organizationName: 'Kame Homes PH',
    propertyName: 'Solea Mactan',
    propertyEyebrow: 'Solea Mactan',
    propertyCoverImageUrl: null,
    defaultParkingRateGuest: 350,
    petFee: 500,
  };
}

export async function installVoucherRedemptionGuestSession(page: Page) {
  await page.addInitScript(
    ({ guestKey, guestSession, supabaseAuthKey, supabaseAuthSession }) => {
      window.localStorage.setItem(guestKey, JSON.stringify(guestSession));
      window.localStorage.setItem(supabaseAuthKey, JSON.stringify(supabaseAuthSession));
    },
    {
      guestKey: GUEST_SESSION_KEY,
      guestSession: {
        accessToken: 'playwright-voucher-guest-token',
        refreshToken: 'playwright-voucher-guest-refresh',
        userId: VOUCHER_GUEST_USER_ID,
        email: VOUCHER_GUEST_EMAIL,
        name: 'Maria Santos',
      },
      supabaseAuthKey: SUPABASE_AUTH_STORAGE_KEY,
      supabaseAuthSession: e2eSupabaseGuestAuthSession(),
    }
  );
}

export async function installVoucherRedemptionGuestMocks(
  page: Page,
  state: VoucherRedemptionGuestState
) {
  await installVoucherRedemptionGuestSession(page);

  await page.route('**/functions/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/').pop();

    switch (endpoint) {
      case 'list-guest-vouchers': {
        const propertySlug = url.searchParams.get('property');
        const includeRedeemed = url.searchParams.get('includeRedeemed') === '1';
        let list = state.vouchers;
        if (propertySlug) {
          list = list.filter((v) => v.propertySlug === propertySlug && !v.redeemedAt);
        } else if (!includeRedeemed) {
          list = list.filter((v) => !v.redeemedAt);
        }
        await fulfillJson(route, { success: true, data: { vouchers: list } });
        return;
      }
      case 'guest-profile':
        await fulfillJson(route, {
          success: true,
          data: {
            displayName: 'Maria Santos',
            bio: null,
            avatarUrl: null,
            phone: '09171234567',
            locationLabel: null,
            email: VOUCHER_GUEST_EMAIL,
          },
        });
        return;
      case 'get-guest-payment-info':
        await fulfillJson(route, { success: true, data: guestPaymentInfoPayload() });
        return;
      case 'get-public-property':
        await fulfillJson(route, { success: false, error: 'Not found' }, 404);
        return;
      case 'get-booked-dates':
        await fulfillJson(route, { success: true, data: [] });
        return;
      case 'submit-form': {
        state.submitCalls += 1;
        const raw = route.request().postData() ?? '';
        const fields: Record<string, string> = {};
        const fieldPattern = /name="([^"]+)"\r?\n\r?\n([^\r\n-][^\r\n]*)/g;
        let match: RegExpExecArray | null;
        while ((match = fieldPattern.exec(raw)) !== null) {
          fields[match[1]] = match[2];
        }
        state.lastSubmitFields = fields;
        await fulfillJson(route, {
          success: true,
          data: { bookingId: VOUCHER_REDEEMING_BOOKING_ID },
        });
        return;
      }
      case 'guest-web-chat-start':
        await fulfillJson(route, {
          success: true,
          data: {
            conversationId: 'e2e-voucher-chat-conversation',
            voiceReceptionistEnabled: false,
            property: { name: 'Solea Mactan', slug: TEAM_E2E_PROPERTY_SLUG },
            host: { ownerName: 'Host', ownerAvatarUrl: null },
          },
        });
        return;
      case 'guest-web-chat-messages':
        await fulfillJson(route, {
          success: true,
          data: { messages: [], hasMore: false, replyStatus: 'idle' },
        });
        return;
      case 'guest-web-chat-resume':
        await fulfillJson(route, {
          success: true,
          data: { conversationId: null },
        });
        return;
      default:
        await route.fallback();
    }
  });
}

/** After a guest-leg spec, restore host dashboard auth before opening booking detail. */
export async function switchToVoucherRedemptionHostSession(page: Page) {
  await applyTeamMemberSessionStorage(page);
}

export async function installVoucherRedemptionHostMocks(
  page: Page,
  hostState: VoucherRedemptionHostState
) {
  await installPropertyTeamRbacMocks(page, 'full_access');

  await page.route('**/functions/v1/property-pricing**', async (route) => {
    await fulfillJson(route, {
      success: true,
      data: {
        weekdayNightlyRate: 2500,
        weekendNightlyRate: 3000,
        downPayment: 1500,
        securityDeposit: 1500,
        petFee: 500,
        parkingRateGuest: 350,
        guestAdditionalFee: 0,
        dateOverrides: {},
        holidayRules: [],
        bookedDateKeys: [],
        blockedDateKeys: [],
        calendarBookings: [],
      },
    });
  });

  await page.route('**/rest/v1/guest_submissions*', async (route) => {
    const url = new URL(route.request().url());
    const id = url.searchParams.get('id');
    const propertyId = url.searchParams.get('property_id');

    if (id === `eq.${hostState.booking.id}`) {
      await fulfillJson(route, hostState.booking);
      return;
    }

    if (id === `eq.${VOUCHER_SOURCE_BOOKING_ID}`) {
      await fulfillJson(route, e2eCompletedSourceBookingRow());
      return;
    }

    if (propertyId === `eq.${TEAM_E2E_PROPERTY_ID}`) {
      await fulfillJson(route, [hostState.booking]);
      return;
    }

    await route.fallback();
  });
}

export async function installVoucherRedemptionMocks(
  page: Page,
  guestState: VoucherRedemptionGuestState,
  hostState: VoucherRedemptionHostState
) {
  // Host RBAC first; guest routes register last so they win on overlapping `functions/v1` paths.
  await installVoucherRedemptionHostMocks(page, hostState);
  await installVoucherRedemptionGuestMocks(page, guestState);
}

function readPositiveIntEnv(name: string): number {
  const raw = process.env[name];
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Hold on the current screen so headed demos are watchable.
 * Only runs when `PLAYWRIGHT_DEMO_PAUSE_MS` is set (see `:headed:slow` scripts).
 * `slowMo` alone only delays Playwright actions — navigations / expects stay fast.
 */
export async function demoPause(page: Page) {
  const pauseMs = readPositiveIntEnv('PLAYWRIGHT_DEMO_PAUSE_MS');
  if (!pauseMs) return;
  await page.waitForTimeout(pauseMs);
}

/** Longer timeout when slowMo / demo pauses are enabled. */
export function voucherRedemptionTimeoutMs(): number {
  const slowMo = readPositiveIntEnv('PLAYWRIGHT_SLOW_MO');
  const demoPauseMs = readPositiveIntEnv('PLAYWRIGHT_DEMO_PAUSE_MS');
  return slowMo || demoPauseMs ? 300_000 : 60_000;
}

/** Wait for dev sample seed, then align contact fields with the mocked guest account. */
export async function fillMinimalGuestFormStep1(page: Page) {
  await expect(page.getByRole('heading', { name: 'Guest', exact: true })).toBeVisible({
    timeout: 15_000,
  });

  const nameField = page.getByPlaceholder(/Your exact full name/i);
  await expect(nameField).toBeVisible({ timeout: 15_000 });
  // Dev sample is helpful when present, but do not require it — Continue must not depend on
  // a random 5-guest party (missing IDs / capacity) which flakes under headed+slowMo.
  await expect(nameField)
    .not.toHaveValue('', { timeout: 8_000 })
    .catch(() => undefined);

  const guestName = 'Maria Santos';
  await nameField.fill(guestName);
  await page.getByRole('textbox', { name: 'Email Address *' }).fill(VOUCHER_GUEST_EMAIL);
  await page.getByRole('textbox', { name: 'Phone Number *' }).fill('09171234567');
  await page.getByRole('textbox', { name: 'Address *', exact: true }).fill('Cebu City, Cebu');

  // Collapse random sample party to primary only (Remove is only on the last extra guest).
  for (let i = 0; i < 4; i += 1) {
    const remove = page.getByRole('button', { name: /Remove (second|third|fourth|fifth) guest/i });
    if ((await remove.count()) === 0) break;
    await remove.click();
  }

  const firstGuest = page.locator('section').filter({
    has: page.getByRole('heading', { name: /Primary Guest/ }),
  });
  await firstGuest.getByRole('textbox', { name: 'Name *' }).fill(guestName);
  await firstGuest.getByRole('textbox', { name: 'Age *' }).fill('25');

  const idInput = firstGuest.locator('input[type="file"]');
  await expect(idInput).toBeAttached({ timeout: 5_000 });
  await idInput.setInputFiles({
    name: 'valid-id.png',
    mimeType: 'image/png',
    buffer: TINY_PNG_BUFFER,
  });

  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled({ timeout: 15_000 });
  await demoPause(page);
}

export async function confirmHostPendingReviewAck(page: Page) {
  await page
    .getByRole('checkbox', {
      name: /manually reviewed and confirmed/i,
    })
    .click();
  await demoPause(page);
}

export async function continueGuestForm(page: Page) {
  const continueBtn = page.getByRole('button', { name: 'Continue' });
  await expect(continueBtn).toBeEnabled({ timeout: 15_000 });
  await continueBtn.click();
  await demoPause(page);
}

export async function submitGuestForm(page: Page) {
  const submit = page.getByRole('button', { name: 'Submit guest form' });
  await expect(submit).toBeEnabled({ timeout: 10_000 });
  await submit.click();
  await demoPause(page);
}

export async function selectVoucherOnForm(page: Page, code = 'OFF-10') {
  const group = page.getByRole('group', { name: 'Vouchers' });
  await expect(group).toBeVisible({ timeout: 15_000 });
  await group.getByRole('button').filter({ hasText: code }).click();
  await demoPause(page);
}

export async function openHostPricingTab(page: Page) {
  await page
    .getByRole('tablist', { name: 'Booking detail sections' })
    .getByRole('tab', { name: 'Pricing', exact: true })
    .click();
  await demoPause(page);
}
