import { type Page, type Route } from '@playwright/test';

import {
  E2E_PROPERTY_BOOKING_ID,
  E2E_PROPERTY_ID,
  E2E_PROPERTY_SLUG,
  e2eFreePropertyEntitlementsPayload,
  e2ePropertyAccessPayload,
  e2ePropertyBookingRow,
  e2ePropertyEntitlementsPayload,
  installParkingFlowMocks,
  type ParkingFlowState,
} from './parkingFlowHarness';

export const PROPERTY_ID = E2E_PROPERTY_ID;
export const PROPERTY_SLUG = E2E_PROPERTY_SLUG;
export const PROPERTY_BOOKING_ID = E2E_PROPERTY_BOOKING_ID;

export const propertyBookingParkingPaths = {
  bookingDetail: `/org/kame-homes-ph/property/${PROPERTY_SLUG}/bookings/${PROPERTY_BOOKING_ID}`,
  propertySettings: `/org/kame-homes-ph/property/${PROPERTY_SLUG}/settings`,
} as const;

export type PropertyBookingParkingState = {
  linked: boolean;
  linkedStatus: string;
  parkingBookingId: string;
  hostContact: { name: string; email: string; phone: string | null } | null;
  endorsementSentAt: string | null;
  /** When false, Find parking opens marketplace search (no org-owned default). */
  hasOwnDefaultParking: boolean;
};

export type PropertyBookingWorkflowState = {
  /** Free plan — `automatedBookingFlow: false`. */
  freePlan: boolean;
  /** Mutable guest_submissions row for the property booking under test. */
  booking: Record<string, unknown>;
  /** Bodies posted to `send-booking-workflow-email`. */
  workflowEmailsSent: Array<{ bookingId: string; kind: string }>;
  /** Last `transition-booking` body. */
  lastTransition: Record<string, unknown> | null;
};

export type InstallPropertyBookingParkingMocksOptions = {
  /** Free plan entitlements + workflow email / transition mocks. */
  freePlan?: boolean;
  /** Overrides merged into the default property booking row. */
  bookingOverrides?: Record<string, unknown>;
};

export function createPropertyBookingParkingState(
  overrides: Partial<PropertyBookingParkingState> = {}
): PropertyBookingParkingState {
  return {
    linked: true,
    linkedStatus: 'READY_FOR_CHECKIN',
    parkingBookingId: 'e2e-linked-parking-booking',
    hostContact: {
      name: 'Parking Host',
      email: 'host@example.com',
      phone: '09171230000',
    },
    endorsementSentAt: '2026-08-24T16:20:00.000Z',
    hasOwnDefaultParking: false,
    ...overrides,
  };
}

export function createPropertyBookingWorkflowState(
  options: InstallPropertyBookingParkingMocksOptions = {}
): PropertyBookingWorkflowState {
  return {
    freePlan: Boolean(options.freePlan),
    booking: e2ePropertyBookingRow(options.bookingOverrides ?? {}),
    workflowEmailsSent: [],
    lastTransition: null,
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function ownerDefaultPayload(propertyState: PropertyBookingParkingState) {
  if (!propertyState.hasOwnDefaultParking) {
    return {
      hasOrgParkings: false,
      available: [],
      defaultParking: null,
      unavailableReason: 'none_owned' as const,
      checkInDate: '2026-08-25',
      checkOutDate: '2026-08-27',
    };
  }
  return {
    hasOrgParkings: true,
    available: [
      {
        id: 'parking-own-e2e-001',
        slug: 'slot-12a',
        name: 'Slot 12A',
        residenceName: 'Solea Mactan',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    defaultParking: {
      id: 'parking-own-e2e-001',
      slug: 'slot-12a',
      name: 'Slot 12A',
      residenceName: 'Solea Mactan',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    unavailableReason: null,
    checkInDate: '2026-08-25',
    checkOutDate: '2026-08-27',
  };
}

function e2eAppSettingsPayload() {
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
    sdRefundCronEmailLeadMinutes: 120,
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
      emailGafRequest: false,
      emailBookingAcknowledgement: false,
      emailPetRequest: false,
      emailParkingBroadcast: false,
      emailReadyForCheckin: false,
      emailSdRefundCheckout: false,
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
      resendApiKeyConfigured: true,
      secretsEncryptionKeyConfigured: false,
      geminiApiKeyConfigured: false,
      groqApiKeyConfigured: false,
    },
    externalReviews: [],
    vouchersEnabled: true,
    voucherPrizes: [],
    voucherRevealStyle: 'reel',
    documentRequirementsOverride: null,
    resolvedDocumentRequirements: [
      {
        id: 'gaf',
        label: 'GAF Approval',
        order: 1,
        pdfTemplateId: 'gaf',
        approvalSource: 'email-listener',
        triggerCondition: 'always',
        calendarIcon: null,
      },
      {
        id: 'pet',
        label: 'Pet Approval',
        order: 2,
        pdfTemplateId: 'pet',
        approvalSource: 'email-listener',
        triggerCondition: 'has_pets',
        calendarIcon: '🐶',
      },
    ],
    residenceDefaultDocumentRequirements: [
      {
        id: 'gaf',
        label: 'GAF Approval',
        order: 1,
        pdfTemplateId: 'gaf',
        approvalSource: 'email-listener',
        triggerCondition: 'always',
        calendarIcon: null,
      },
      {
        id: 'pet',
        label: 'Pet Approval',
        order: 2,
        pdfTemplateId: 'pet',
        approvalSource: 'email-listener',
        triggerCondition: 'has_pets',
        calendarIcon: '🐶',
      },
    ],
  };
}

export async function installPropertyBookingParkingMocks(
  page: Page,
  parkingState: ParkingFlowState,
  propertyState: PropertyBookingParkingState,
  options: InstallPropertyBookingParkingMocksOptions = {}
): Promise<PropertyBookingWorkflowState> {
  const workflow = createPropertyBookingWorkflowState(options);

  await installParkingFlowMocks(page, parkingState);
  await page.addInitScript(
    ({ orgSlug, propertySlug }) => {
      window.localStorage.setItem('kame-last-org-slug', orgSlug);
      window.localStorage.setItem('kame-last-property-slug', propertySlug);
      window.localStorage.setItem('kame-last-tenant-kind', 'property');
    },
    { orgSlug: 'kame-homes-ph', propertySlug: PROPERTY_SLUG }
  );

  await page.route('**/functions/v1/get-linked-parking-booking**', async (route) => {
    if (!propertyState.linked) {
      await fulfillJson(route, { success: true, data: { linked: false } });
      return;
    }
    await fulfillJson(route, {
      success: true,
      data: {
        linked: true,
        parkingBookingId: propertyState.parkingBookingId,
        status: propertyState.linkedStatus,
        endorsementSentAt: propertyState.endorsementSentAt,
        endorsementSendError: null,
        endorsementEmailSnapshot: propertyState.endorsementSentAt
          ? '<p>Parking endorsement sent for Maria Santos.</p>'
          : null,
        hostContact: propertyState.hostContact,
      },
    });
  });

  await page.route('**/functions/v1/resolve-owner-default-parking**', async (route) => {
    await fulfillJson(route, { success: true, data: ownerDefaultPayload(propertyState) });
  });

  // Last-wins overrides for Free workflow / mutable booking row.
  await page.route('**/functions/v1/property-access**', async (route) => {
    await fulfillJson(route, { success: true, data: e2ePropertyAccessPayload() });
  });

  await page.route('**/functions/v1/property-entitlements**', async (route) => {
    await fulfillJson(route, {
      success: true,
      data: workflow.freePlan
        ? e2eFreePropertyEntitlementsPayload()
        : e2ePropertyEntitlementsPayload(),
    });
  });

  await page.route('**/functions/v1/app-settings**', async (route) => {
    await fulfillJson(route, { success: true, data: e2eAppSettingsPayload() });
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
        dateOverrides: {},
        holidayRules: [],
        bookedDateKeys: [],
        blockedDateKeys: [],
        calendarBookings: [],
      },
    });
  });

  await page.route('**/functions/v1/send-booking-workflow-email**', async (route) => {
    const body = route.request().postDataJSON?.() as
      { bookingId?: string; kind?: string } | undefined;
    const kind = typeof body?.kind === 'string' ? body.kind : 'unknown';
    const bookingId =
      typeof body?.bookingId === 'string' ? body.bookingId : E2E_PROPERTY_BOOKING_ID;
    workflow.workflowEmailsSent.push({ bookingId, kind });
    await fulfillJson(route, { success: true, kind });
  });

  await page.route('**/functions/v1/sd-refund-cron**', async (route) => {
    const transitioned = workflow.booking.status === 'READY_FOR_CHECKIN' ? 1 : 0;
    if (transitioned) {
      Object.assign(workflow.booking, {
        status: 'READY_FOR_CHECKOUT',
        status_updated_at: new Date().toISOString(),
      });
    }
    await fulfillJson(route, {
      success: true,
      transitioned,
      checkoutEmailsSent: workflow.freePlan ? 0 : transitioned,
      transitionedSdEmailSuppressed: workflow.freePlan && transitioned ? 1 : 0,
    });
  });

  // Host "Find parking" first marks the booking as needing parking (`ensure_need_parking`).
  await page.route('**/functions/v1/update-booking-details**', async (route) => {
    const body = (route.request().postDataJSON?.() as Record<string, unknown> | undefined) ?? {};
    if (body.operation === 'ensure_need_parking') {
      const skipped = workflow.booking.need_parking === true;
      Object.assign(workflow.booking, { need_parking: true });
      await fulfillJson(route, {
        success: true,
        data: { booking: { ...workflow.booking }, skipped },
      });
      return;
    }
    await route.fallback();
  });

  await page.route('**/functions/v1/transition-booking**', async (route) => {
    const body = (route.request().postDataJSON?.() as Record<string, unknown> | undefined) ?? {};
    workflow.lastTransition = body;
    const toStatus =
      typeof body.toStatus === 'string' ? body.toStatus : String(workflow.booking.status);

    Object.assign(workflow.booking, {
      status: toStatus,
      updated_at: new Date().toISOString(),
      status_updated_at: new Date().toISOString(),
      gaf_request_pdf_url:
        workflow.booking.gaf_request_pdf_url ?? 'https://example.com/e2e-gaf-request.pdf',
    });

    const skipped =
      workflow.freePlan && toStatus === 'PENDING_DOCUMENTS'
        ? (['gaf_request', 'booking_acknowledgement'] as const)
        : workflow.freePlan && toStatus === 'READY_FOR_CHECKIN'
          ? (['ready_for_checkin', 'sd_refund_form_request'] as const)
          : [];

    await fulfillJson(route, {
      success: true,
      data: {
        booking: { ...workflow.booking },
        sideEffects: {
          emails: [],
          automationSkippedByPlan: [...skipped],
        },
      },
    });
  });

  await page.route('**/rest/v1/guest_submissions*', async (route) => {
    const url = new URL(route.request().url());
    const id = url.searchParams.get('id');
    const propertyId = url.searchParams.get('property_id');
    const method = route.request().method();

    if (method === 'PATCH' && id === `eq.${E2E_PROPERTY_BOOKING_ID}`) {
      const patch = (route.request().postDataJSON?.() as Record<string, unknown> | undefined) ?? {};
      Object.assign(workflow.booking, patch);
      await fulfillJson(route, workflow.booking);
      return;
    }

    if (id === `eq.${E2E_PROPERTY_BOOKING_ID}`) {
      await fulfillJson(route, workflow.booking);
      return;
    }

    if (propertyId === `eq.${E2E_PROPERTY_ID}`) {
      await fulfillJson(route, [workflow.booking]);
      return;
    }

    await route.fallback();
  });

  return workflow;
}
