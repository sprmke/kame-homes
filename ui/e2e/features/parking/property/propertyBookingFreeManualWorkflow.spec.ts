import { expect, test, type Page } from '@playwright/test';

import { createParkingFlowState } from '../shared/parkingFlowHarness';
import { captureParkingScreen, setParkingScreenSuite } from '../shared/parkingScreenCapture';
import { demoPause, sideBySideTimeoutMs } from '../shared/parkingSideBySideHelpers';
import {
  createPropertyBookingParkingState,
  installPropertyBookingParkingMocks,
  PROPERTY_BOOKING_ID,
  propertyBookingParkingPaths,
} from '../shared/propertyBookingParkingHarness';

async function openPropertyBookingDetail(page: Page) {
  await page.goto(propertyBookingParkingPaths.bookingDetail);
  await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
    timeout: 15_000,
  });
  await demoPause(page);
}

async function expandAutomationTriggers(page: Page) {
  const triggers = page.locator('button[aria-expanded]').filter({ hasText: 'Send manually' });
  await expect(triggers).toBeVisible({ timeout: 15_000 });
  if ((await triggers.getAttribute('aria-expanded')) !== 'true') {
    await triggers.click();
  }
  await expect(triggers).toHaveAttribute('aria-expanded', 'true');
  await demoPause(page);
}

/**
 * Click that opens a popup/tab, then hold on both windows.
 * `slowMo` alone does not pause new-page navigations — demoPause does.
 */
async function clickAndHoldPopup(page: Page, click: () => Promise<void>): Promise<Page> {
  const popupPromise = page.waitForEvent('popup');
  await click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded').catch(() => undefined);
  await demoPause(page, popup);
  return popup;
}

test.describe('property booking Free-tier manual workflow', () => {
  test.beforeEach(({ context }) => {
    test.setTimeout(sideBySideTimeoutMs());

    // New tabs/windows inherit browser slowMo for actions, but navigations are
    // still instant — pause so headed demos can see the opened page.
    context.on('page', (newPage) => {
      void (async () => {
        await newPage.waitForLoadState('domcontentloaded').catch(() => undefined);
        await demoPause(newPage);
      })();
    });
  });

  test('Automation Triggers shows Send manually and sends GAF and ack emails', async ({ page }) => {
    setParkingScreenSuite('property-free-manual-workflow-sends');
    const parkingState = createParkingFlowState();
    const propertyState = createPropertyBookingParkingState({ linked: false });
    const workflow = await installPropertyBookingParkingMocks(page, parkingState, propertyState, {
      freePlan: true,
      bookingOverrides: {
        status: 'PENDING_DOCUMENTS',
        need_parking: true,
        gaf_request_pdf_url: 'https://example.com/e2e-gaf-request.pdf',
      },
    });

    await openPropertyBookingDetail(page);
    await captureParkingScreen(page, 'booking-detail-free');

    await expect(page.getByText('Send manually', { exact: true })).toBeVisible();
    await expandAutomationTriggers(page);
    await expect(page.getByLabel(/Automated workflow emails are not on your plan/i)).toBeVisible();
    await captureParkingScreen(page, 'automation-triggers-expanded');
    await demoPause(page);

    await page.getByRole('button', { name: 'Send GAF request' }).click();
    await expect(page.getByText('GAF request email sent')).toBeVisible({ timeout: 10_000 });
    await demoPause(page);

    await page.getByRole('button', { name: 'Send Booking acknowledgement' }).click();
    await expect(page.getByText('Booking acknowledgement email sent')).toBeVisible({
      timeout: 10_000,
    });
    await captureParkingScreen(page, 'after-manual-sends');
    await demoPause(page);

    expect(workflow.workflowEmailsSent.map((entry) => entry.kind)).toEqual([
      'gaf_request',
      'booking_acknowledgement',
    ]);
    expect(
      workflow.workflowEmailsSent.every((entry) => entry.bookingId === PROPERTY_BOOKING_ID)
    ).toBe(true);

    // Parking marketplace path still available from More actions while Free + unlinked.
    await page.getByRole('button', { name: 'More actions' }).click();
    await demoPause(page);
    const popup = await clickAndHoldPopup(page, async () => {
      await page.getByRole('menuitem', { name: 'Find parking' }).click();
    });
    await expect(popup).toHaveURL(new RegExp(`/parkings\\?.*linkStay=${PROPERTY_BOOKING_ID}`));
  });

  test('Proceed skips plan-gated emails, toasts, and expands Automation Triggers', async ({
    page,
  }) => {
    setParkingScreenSuite('property-free-manual-workflow-proceed-skip');
    const parkingState = createParkingFlowState();
    const propertyState = createPropertyBookingParkingState({ linked: false });
    const workflow = await installPropertyBookingParkingMocks(page, parkingState, propertyState, {
      freePlan: true,
      bookingOverrides: {
        status: 'PENDING_REVIEW',
        need_parking: true,
        gaf_request_pdf_url: null,
      },
    });

    await openPropertyBookingDetail(page);
    await captureParkingScreen(page, 'pending-review');

    await page
      .getByLabel(
        'I manually reviewed and confirmed that all details, documents, and receipts are correct.'
      )
      .click();

    await expect(page.getByRole('heading', { name: 'Review pricing' })).toBeVisible({
      timeout: 10_000,
    });
    await demoPause(page);
    await expect(page.getByRole('button', { name: /Proceed to Pending Documents/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: /Proceed to Pending Documents/i }).click();

    const confirm = page.getByRole('button', { name: 'Confirm' });
    await expect(confirm).toBeVisible({ timeout: 10_000 });
    await captureParkingScreen(page, 'proceed-confirm');
    await demoPause(page);
    await confirm.click();

    await expect(page.getByText(/Not sent automatically on your plan/i)).toBeVisible({
      timeout: 10_000,
    });
    await captureParkingScreen(page, 'plan-skip-toast');
    await demoPause(page);

    expect(workflow.lastTransition?.toStatus).toBe('PENDING_DOCUMENTS');
    expect(workflow.booking.status).toBe('PENDING_DOCUMENTS');

    const triggers = page.locator('button[aria-expanded]').filter({ hasText: 'Send manually' });
    await expect(triggers).toBeVisible({ timeout: 10_000 });
    await expect(triggers).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Send manually', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send GAF request' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send Booking acknowledgement' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send Parking broadcast' })).toHaveCount(0);
    await captureParkingScreen(page, 'triggers-auto-expanded');
    await demoPause(page);
  });

  test('READY_FOR_CHECKIN Free plan can send ready + check-out instruction emails', async ({
    page,
  }) => {
    setParkingScreenSuite('property-free-manual-workflow-rfci');
    const parkingState = createParkingFlowState();
    const propertyState = createPropertyBookingParkingState({ linked: true });
    const workflow = await installPropertyBookingParkingMocks(page, parkingState, propertyState, {
      freePlan: true,
      bookingOverrides: {
        status: 'READY_FOR_CHECKIN',
        need_parking: true,
        gaf_request_pdf_url: 'https://example.com/e2e-gaf-request.pdf',
      },
    });

    await openPropertyBookingDetail(page);
    await expandAutomationTriggers(page);
    await captureParkingScreen(page, 'rfci-triggers');

    await page.getByRole('button', { name: 'Send Ready for check-in' }).click();
    await expect(page.getByText('Ready for check-in email sent')).toBeVisible({ timeout: 10_000 });
    await demoPause(page);

    await page.getByRole('button', { name: 'Send Check-out Instructions' }).click();
    await expect(page.getByText('Check-out Instructions email sent')).toBeVisible({
      timeout: 10_000,
    });
    await demoPause(page);

    expect(workflow.workflowEmailsSent.map((entry) => entry.kind)).toEqual([
      'ready_for_checkin',
      'sd_refund_form_request',
    ]);

    await expect(
      page.getByRole('button', { name: 'Run check-out move (no email on Free)' })
    ).toBeVisible();
    await demoPause(page);
  });

  test('Free plan sends pet request email when pets apply', async ({ page }) => {
    setParkingScreenSuite('property-free-manual-workflow-pet');
    const parkingState = createParkingFlowState();
    const propertyState = createPropertyBookingParkingState({ linked: false });
    const workflow = await installPropertyBookingParkingMocks(page, parkingState, propertyState, {
      freePlan: true,
      bookingOverrides: {
        status: 'PENDING_DOCUMENTS',
        has_pets: true,
        pet_request_pdf_url: 'https://example.com/e2e-pet-request.pdf',
        // Send Pet request needs both files first (`petRequestSendDisabledReason`).
        pet_vaccination_url: 'https://example.com/e2e-pet-vaccination.jpg',
        pet_image_url: 'https://example.com/e2e-pet-photo.jpg',
      },
    });

    await openPropertyBookingDetail(page);
    await expect(page.getByText('Send manually', { exact: true })).toBeVisible();
    await expandAutomationTriggers(page);

    await page.getByRole('button', { name: 'Send Pet request' }).click();
    await expect(page.getByText('Pet request email sent')).toBeVisible({ timeout: 10_000 });
    await demoPause(page);
    expect(workflow.workflowEmailsSent.map((entry) => entry.kind)).toEqual(['pet_request']);
  });

  test('Run check-out move on Free toasts plan email skip', async ({ page }) => {
    setParkingScreenSuite('property-free-manual-workflow-sd-cron-skip');
    const parkingState = createParkingFlowState();
    const propertyState = createPropertyBookingParkingState({ linked: true });
    await installPropertyBookingParkingMocks(page, parkingState, propertyState, {
      freePlan: true,
      bookingOverrides: {
        status: 'READY_FOR_CHECKIN',
        need_parking: false,
      },
    });

    await openPropertyBookingDetail(page);
    await expandAutomationTriggers(page);
    await page.getByRole('button', { name: 'Run check-out move (no email on Free)' }).click();
    await expect(page.getByText(/Not sent automatically on your plan/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/Check-out & SD refund email/i)).toBeVisible();
    await demoPause(page);
  });

  test('Proceed confirm shows Free plan email hint', async ({ page }) => {
    setParkingScreenSuite('property-free-manual-workflow-confirm-hint');
    const parkingState = createParkingFlowState();
    const propertyState = createPropertyBookingParkingState({ linked: false });
    await installPropertyBookingParkingMocks(page, parkingState, propertyState, {
      freePlan: true,
      bookingOverrides: { status: 'PENDING_REVIEW', need_parking: true },
    });

    await openPropertyBookingDetail(page);
    await page
      .getByLabel(
        'I manually reviewed and confirmed that all details, documents, and receipts are correct.'
      )
      .click();
    await page.getByRole('button', { name: /Proceed to Pending Documents/i }).click();
    await expect(page.getByRole('dialog', { name: 'Proceed to Pending Documents' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByText('Workflow emails will not send automatically on your plan', { exact: false })
    ).toBeVisible();
    await demoPause(page);
  });

  test('Free plan shows Manual send badge on GAF sub-step', async ({ page }) => {
    setParkingScreenSuite('property-free-manual-workflow-gaf-badge');
    const parkingState = createParkingFlowState();
    const propertyState = createPropertyBookingParkingState({ linked: false });
    await installPropertyBookingParkingMocks(page, parkingState, propertyState, {
      freePlan: true,
      bookingOverrides: {
        status: 'PENDING_DOCUMENTS',
        gaf_request_pdf_url: 'https://example.com/e2e-gaf-request.pdf',
      },
    });

    await openPropertyBookingDetail(page);
    await expect(page.getByRole('button', { name: /Manual · send/i })).toBeVisible({
      timeout: 10_000,
    });
    await demoPause(page);
  });
});

test.describe('property booking Starter-tier workflow smoke', () => {
  test.beforeEach(({ context }) => {
    test.setTimeout(sideBySideTimeoutMs());
    context.on('page', (newPage) => {
      void (async () => {
        await newPage.waitForLoadState('domcontentloaded').catch(() => undefined);
        await demoPause(newPage);
      })();
    });
  });

  test('Paid plan does not show Send manually badge on Automation Triggers', async ({ page }) => {
    setParkingScreenSuite('property-starter-workflow-smoke');
    const parkingState = createParkingFlowState();
    const propertyState = createPropertyBookingParkingState({ linked: false });
    await installPropertyBookingParkingMocks(page, parkingState, propertyState, {
      freePlan: false,
      bookingOverrides: {
        status: 'PENDING_DOCUMENTS',
        gaf_request_pdf_url: 'https://example.com/e2e-gaf-request.pdf',
      },
    });

    await openPropertyBookingDetail(page);
    await expect(page.getByText('Send manually', { exact: true })).toHaveCount(0);
    await expect(
      page.getByText('Workflow emails are not automatic on your plan', { exact: false })
    ).toHaveCount(0);
    await demoPause(page);
  });
});
