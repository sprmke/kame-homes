import { expect, test } from '@playwright/test';

import {
  createParkingFlowState,
  installParkingFlowMocks,
} from '../parking/shared/parkingFlowHarness';
import {
  createPropertyBookingParkingState,
  installPropertyBookingParkingMocks,
  propertyBookingParkingPaths,
} from '../parking/shared/propertyBookingParkingHarness';

test.describe('@ci property booking parking edit', () => {
  test('adding parking on Pending Documents keeps the current status', async ({ page }) => {
    const parkingState = createParkingFlowState();
    const propertyState = createPropertyBookingParkingState({ linked: false });
    const workflow = await installPropertyBookingParkingMocks(page, parkingState, propertyState, {
      freePlan: false,
      bookingOverrides: {
        status: 'PENDING_DOCUMENTS',
        need_parking: false,
        parking_completed_at: null,
        gaf_request_pdf_url: 'https://example.com/e2e-gaf-request.pdf',
      },
    });

    await page.goto(propertyBookingParkingPaths.bookingDetail);
    await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Pending Documents/i).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Add parking' }).click();

    await expect(page.getByText('Editing booking')).toBeVisible({ timeout: 10_000 });
    await page.getByLabel('Needs parking').click();
    await page.getByLabel('Plate number').fill('ABC 123');
    await page.getByLabel('Brand / model').fill('Toyota Vios');
    await page.getByLabel('Color').fill('White');

    await page.getByRole('button', { name: 'Save', exact: true }).first().click();

    // Parking is a nested step, not a re-approval: no choice dialog, status stays put.
    await expect(page.getByText('Editing booking')).toBeHidden({ timeout: 10_000 });
    await expect(
      page.getByRole('button', { name: /Save & revert to Pending Review/i })
    ).toHaveCount(0);
    await expect(page.getByText(/Pending Documents/i).first()).toBeVisible();

    expect(workflow.lastDetailsPatch?.operation).toBe('patch');
    expect(workflow.lastDetailsPatch?.revertToPendingReview).toBe(false);
    expect((workflow.lastDetailsPatch?.payload as Record<string, unknown>)?.need_parking).toBe(true);
    expect(workflow.booking.status).toBe('PENDING_DOCUMENTS');
  });
});
