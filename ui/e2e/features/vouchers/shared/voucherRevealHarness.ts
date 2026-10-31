/**
 * Playwright harness — voucher reveal styles (host settings + guest SD form / guest-review).
 *
 * Three **worlds** (reel / wheel / flip) share fixtures but use different `voucher_reveal_style`
 * values so specs can assert style-specific copy and animation labels.
 */

import { expect, type Page, type Route } from '@playwright/test';

import {
  FULL_ACCESS_PERMISSIONS,
  installPropertyTeamRbacMocks,
  TEAM_E2E_ORG_SLUG,
  TEAM_E2E_PROPERTY_ID,
  TEAM_E2E_PROPERTY_SLUG,
  teamRbacPaths,
} from '../../team/shared/propertyTeamRbacHarness';

export type VoucherRevealStyle = 'reel' | 'wheel' | 'flip';

export const VOUCHER_E2E_BOOKING_ID = 'a1b2c3d4-e5f6-7890-abcd-voucher000001';

export const DEFAULT_VOUCHER_PRIZES = [
  { code: 'OFF-5', percentOff: 5, chancePercent: 25 },
  { code: 'OFF-10', percentOff: 10, chancePercent: 34 },
  { code: 'OFF-15', percentOff: 15, chancePercent: 20 },
  { code: 'OFF-20', percentOff: 20, chancePercent: 12 },
  { code: 'OFF-25', percentOff: 25, chancePercent: 5 },
  { code: 'OFF-50', percentOff: 50, chancePercent: 3 },
  { code: 'FREE-STAY', percentOff: 100, chancePercent: 1 },
] as const;

/** Style-specific guest-facing expectations for parametrized specs. */
export type VoucherRevealWorld = {
  style: VoucherRevealStyle;
  introHeadline: RegExp;
  animationAriaLabel: string;
  claimingLabel: RegExp;
};

export const VOUCHER_REVEAL_WORLDS: Record<VoucherRevealStyle, VoucherRevealWorld> = {
  reel: {
    style: 'reel',
    introHeadline: /Spin for your next-stay reward/i,
    animationAriaLabel: 'Spinning voucher reel',
    claimingLabel: /Spinning the reel/i,
  },
  wheel: {
    style: 'wheel',
    introHeadline: /Spin the wheel for your next-stay reward/i,
    animationAriaLabel: 'Spinning prize wheel',
    claimingLabel: /Spinning the wheel/i,
  },
  flip: {
    style: 'flip',
    introHeadline: /Flip for your next-stay reward/i,
    animationAriaLabel: 'Flipping voucher card',
    claimingLabel: /Flipping/i,
  },
};

export const voucherHostPaths = {
  settings: teamRbacPaths.settings,
} as const;

export function voucherGuestPaths(propertySlug = TEAM_E2E_PROPERTY_SLUG) {
  return {
    sdForm: (bookingId: string) =>
      `/properties/${propertySlug}/sd-form?bookingId=${encodeURIComponent(bookingId)}`,
    guestReview: (bookingId: string) =>
      `/properties/${propertySlug}/guest-review?bookingId=${encodeURIComponent(bookingId)}`,
  };
}

export type VoucherHostState = {
  vouchersEnabled: boolean;
  voucherRevealStyle: VoucherRevealStyle;
  voucherPrizes: Array<{ code: string; percentOff: number; chancePercent: number }>;
  patchBodies: Array<Record<string, unknown>>;
};

export type VoucherGuestState = {
  bookingId: string;
  revealStyle: VoucherRevealStyle;
  guestReviewSubmitted: boolean;
  primaryGuestName: string;
  checkInDate: string;
  checkOutDate: string;
  existingVoucherCode: string | null;
  existingVoucherAmount: number | null;
  claimResponse: { code: string; amount: number; alreadyAwarded: boolean };
  claimCalls: number;
};

export function createVoucherHostState(
  overrides: Partial<VoucherHostState> = {}
): VoucherHostState {
  return {
    vouchersEnabled: true,
    voucherRevealStyle: 'reel',
    voucherPrizes: [...DEFAULT_VOUCHER_PRIZES],
    patchBodies: [],
    ...overrides,
  };
}

export function createVoucherGuestState(
  overrides: Partial<VoucherGuestState> = {}
): VoucherGuestState {
  return {
    bookingId: VOUCHER_E2E_BOOKING_ID,
    revealStyle: 'reel',
    guestReviewSubmitted: true,
    primaryGuestName: 'Maria Santos',
    checkInDate: '08-25-2026',
    checkOutDate: '08-27-2026',
    existingVoucherCode: null,
    existingVoucherAmount: null,
    claimResponse: { code: 'OFF-10', amount: 10, alreadyAwarded: false },
    claimCalls: 0,
    ...overrides,
  };
}

const VOUCHER_HOST_PERMISSIONS = [...FULL_ACCESS_PERMISSIONS, 'settings.socials:edit'] as const;

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function buildAppSettingsPayload(host: VoucherHostState) {
  const fieldDefault = 'default' as const;
  const emptyTelegramCreds = {
    tokenConfigured: false,
    chatIdConfigured: false,
    tokenSource: fieldDefault,
    chatIdSource: fieldDefault,
    secretsEncryptionConfigured: false,
  };
  return {
    emailTo: 'host@example.com',
    emailReplyTo: '',
    parkingOwnerEmails: [] as string[],
    sdRefundCronEmailLeadMinutes: 60,
    sdRefundCronMaxCheckoutAgeDays: 14,
    publicGuestAppOrigin: 'http://127.0.0.1:4173',
    facebookReviewsUrl: '',
    emailLogoUrl: '',
    brandColorStored: '',
    inheritedBrandColor: '#0f766e',
    resolvedBrandColor: '#0f766e',
    facebookPageUrl: '',
    airbnbUrl: '',
    instagramUrl: '',
    tiktokUrl: '',
    defaultParkingRateGuest: 0,
    gcashName: '',
    gcashNumber: '',
    gcashQrImageUrl: '',
    paymentProvider: 'gcash',
    paymentMethods: [] as unknown[],
    gafUnitOwner: '',
    gafTowerAndUnitNumber: '',
    gafGuestsOnsiteContactPerson: '',
    gafOwnerContactNumber: '',
    gafUnitOwnerSignatureUrl: '',
    automationToggles: {
      emailNewBookingRequest: true,
      emailGafRequest: true,
      emailBookingAcknowledgement: true,
      emailPetRequest: true,
      emailParkingBroadcast: true,
      emailReadyForCheckin: true,
      emailSdRefundCheckout: true,
    },
    updatedAt: null,
    fieldSources: {
      emailTo: fieldDefault,
      emailReplyTo: fieldDefault,
      parkingOwnerEmails: fieldDefault,
      sdRefundCronEmailLeadMinutes: fieldDefault,
      sdRefundCronMaxCheckoutAgeDays: fieldDefault,
      publicGuestAppOrigin: fieldDefault,
      facebookReviewsUrl: fieldDefault,
      emailLogoUrl: fieldDefault,
      brandColorStored: fieldDefault,
      facebookPageUrl: fieldDefault,
      airbnbUrl: fieldDefault,
      instagramUrl: fieldDefault,
      tiktokUrl: fieldDefault,
      defaultParkingRateGuest: fieldDefault,
      gcashName: fieldDefault,
      gcashNumber: fieldDefault,
      gcashQrImageUrl: fieldDefault,
      paymentProvider: fieldDefault,
      gafUnitOwner: fieldDefault,
      gafTowerAndUnitNumber: fieldDefault,
      gafGuestsOnsiteContactPerson: fieldDefault,
      gafOwnerContactNumber: fieldDefault,
      gafUnitOwnerSignatureUrl: fieldDefault,
    },
    propertyIntegrations: {
      telegram: {
        marketing: emptyTelegramCreds,
        staff: emptyTelegramCreds,
        admin: emptyTelegramCreds,
        finance: emptyTelegramCreds,
        maintenance: emptyTelegramCreds,
        chat: emptyTelegramCreds,
      },
    },
    platformSecrets: {
      resendApiKeyConfigured: false,
      secretsEncryptionKeyConfigured: false,
      geminiApiKeyConfigured: false,
      groqApiKeyConfigured: false,
    },
    externalReviews: [],
    vouchersEnabled: host.vouchersEnabled,
    voucherPrizes: host.voucherPrizes,
    voucherRevealStyle: host.voucherRevealStyle,
    documentRequirementsOverride: null,
    resolvedDocumentRequirements: [],
    residenceDefaultDocumentRequirements: [],
  };
}

function sdFormBootstrap(guest: VoucherGuestState) {
  return {
    bookingId: guest.bookingId,
    primary_guest_name: guest.primaryGuestName,
    guest_phone_number: '09171234567',
    security_deposit: 1500,
    check_in_date: guest.checkInDate,
    check_out_date: guest.checkOutDate,
    guest_review_submitted: guest.guestReviewSubmitted,
    next_stay_voucher_code: guest.existingVoucherCode,
    next_stay_voucher_amount: guest.existingVoucherAmount,
    awaiting_balance_settlement: false,
    vouchers_enabled: true,
    voucher_prizes: DEFAULT_VOUCHER_PRIZES,
    voucher_reveal_style: guest.revealStyle,
  };
}

function guestReviewBootstrap(guest: VoucherGuestState) {
  return {
    bookingId: guest.bookingId,
    primary_guest_name: guest.primaryGuestName,
    check_in_date: guest.checkInDate,
    check_out_date: guest.checkOutDate,
    guest_review_submitted: guest.guestReviewSubmitted,
    next_stay_voucher_code: guest.existingVoucherCode,
    next_stay_voucher_amount: guest.existingVoucherAmount,
    review_path: 'airbnb_post_stay' as const,
    vouchers_enabled: true,
    voucher_prizes: DEFAULT_VOUCHER_PRIZES,
    voucher_reveal_style: guest.revealStyle,
  };
}

export async function installVoucherRevealHostMocks(page: Page, host: VoucherHostState) {
  await installPropertyTeamRbacMocks(page, 'full_access');

  await page.route('**/functions/v1/property-access**', async (route) => {
    await fulfillJson(route, {
      success: true,
      data: {
        accessKind: 'owner' as const,
        permissions: [...VOUCHER_HOST_PERMISSIONS],
        memberId: null,
        propertyId: TEAM_E2E_PROPERTY_ID,
        orgSlug: TEAM_E2E_ORG_SLUG,
        orgName: 'Kame Homes PH',
        propertySlug: TEAM_E2E_PROPERTY_SLUG,
        propertyName: 'Solea Mactan',
        planLimited: false,
      },
    });
  });

  await page.route('**/functions/v1/app-settings**', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      host.patchBodies.push(body);
      if (typeof body.voucherRevealStyle === 'string') {
        host.voucherRevealStyle = body.voucherRevealStyle as VoucherRevealStyle;
      }
      if (typeof body.vouchersEnabled === 'boolean') {
        host.vouchersEnabled = body.vouchersEnabled;
      }
      if (Array.isArray(body.voucherPrizes)) {
        host.voucherPrizes = body.voucherPrizes as VoucherHostState['voucherPrizes'];
      }
    }
    await fulfillJson(route, { success: true, data: buildAppSettingsPayload(host) });
  });

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
      },
    });
  });
}

export async function installVoucherRevealGuestMocks(page: Page, guest: VoucherGuestState) {
  await page.route('**/functions/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/').pop();

    switch (endpoint) {
      case 'get-sd-form':
        await fulfillJson(route, { success: true, data: sdFormBootstrap(guest) });
        return;
      case 'get-guest-review':
        await fulfillJson(route, { success: true, data: guestReviewBootstrap(guest) });
        return;
      case 'claim-sd-voucher':
        guest.claimCalls += 1;
        await fulfillJson(route, { success: true, data: guest.claimResponse });
        return;
      case 'get-guest-payment-info':
        await fulfillJson(route, {
          success: true,
          data: {
            organizationName: 'Kame Homes PH',
            propertyName: 'Voucher E2E Solea',
            emailLogoUrl: null,
            brandColor: '#0f766e',
            maxAdults: 4,
            maxGuests: 6,
          },
        });
        return;
      default:
        await fulfillJson(route, { success: true, data: {} });
    }
  });
}

export async function openVoucherSettingsSection(page: Page) {
  await page.goto(voucherHostPaths.settings);
  await expect(page.getByRole('heading', { name: 'Settings' }).first()).toBeVisible({
    timeout: 25_000,
  });
  const nav = page.getByRole('button', { name: 'Reviews & vouchers' });
  await expect(nav).toBeVisible({ timeout: 15_000 });
  await nav.click();
  await expect(page.locator('#section-guest-rewards')).toBeVisible({ timeout: 10_000 });
}

export async function openVoucherManageModal(page: Page) {
  const section = page.locator('#section-guest-rewards');
  await section
    .locator('div')
    .filter({ hasText: /^Next-stay vouchers/ })
    .getByRole('button', { name: 'Manage' })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Next-stay vouchers' })
  ).toBeVisible();
}

export async function selectRevealStyleInModal(page: Page, style: VoucherRevealStyle) {
  const label = style === 'wheel' ? 'Wheel' : style === 'flip' ? 'Flip' : 'Reel';
  await page.getByRole('dialog').getByRole('radio', { name: label }).click();
}

export async function savePropertySettings(page: Page) {
  const save = page.getByRole('button', { name: 'Save Changes' }).last();
  await expect(save).toBeVisible({ timeout: 10_000 });
  await save.click();
  await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 15_000 });
}

/** Fast guest path — skips 7–10s reel/wheel animations in CI. */
export async function useReducedMotionForVoucherClaim(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
}
