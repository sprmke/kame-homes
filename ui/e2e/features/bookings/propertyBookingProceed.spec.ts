import { expect, test } from '@playwright/test';

import {
  expectNoPageHorizontalOverflow,
  expectNoUnnamedInteractiveControls,
} from '../../shared/layoutAssertions';
import {
  createParkingFlowState,
  installParkingFlowMocks,
} from '../parking/shared/parkingFlowHarness';
import {
  createPropertyBookingParkingState,
  createPropertyBookingWorkflowState,
  installPropertyBookingParkingMocks,
  propertyBookingParkingPaths,
} from '../parking/shared/propertyBookingParkingHarness';

test.describe('@smoke @ci property booking workflow proceed', () => {
  test('host can open booking detail in pending review', async ({ page }) => {
    const parkingState = createParkingFlowState();
    const propertyState = createPropertyBookingParkingState({ linked: false });
    const workflow = createPropertyBookingWorkflowState({
      bookingOverrides: { status: 'PENDING_REVIEW' },
    });

    await installParkingFlowMocks(page, parkingState);
    await installPropertyBookingParkingMocks(page, parkingState, propertyState, {
      bookingOverrides: workflow.booking,
    });

    await page.goto(propertyBookingParkingPaths.bookingDetail);
    await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Pending Review/i).first()).toBeVisible({ timeout: 15_000 });
    await expectNoPageHorizontalOverflow(page);
    await expectNoUnnamedInteractiveControls(page);
  });

  test('host can proceed PENDING_REVIEW to PENDING_DOCUMENTS on paid plan', async ({ page }) => {
    const parkingState = createParkingFlowState();
    const propertyState = createPropertyBookingParkingState({ linked: false });
    const workflow = await installPropertyBookingParkingMocks(page, parkingState, propertyState, {
      freePlan: false,
      bookingOverrides: { status: 'PENDING_REVIEW', need_parking: false },
    });

    await page.goto(propertyBookingParkingPaths.bookingDetail);
    await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
      timeout: 20_000,
    });

    await page
      .getByLabel(
        'I manually reviewed and confirmed that all details, documents, and receipts are correct.'
      )
      .click();

    await expect(page.getByRole('button', { name: /Proceed to Pending Documents/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: /Proceed to Pending Documents/i }).click();

    const confirm = page.getByRole('button', { name: 'Confirm' });
    await expect(confirm).toBeVisible({ timeout: 10_000 });
    await confirm.click();

    await expect(page.getByText(/Pending Documents/i).first()).toBeVisible({ timeout: 15_000 });
    expect(workflow.lastTransition?.toStatus).toBe('PENDING_DOCUMENTS');
    expect(workflow.booking.status).toBe('PENDING_DOCUMENTS');
  });
});
