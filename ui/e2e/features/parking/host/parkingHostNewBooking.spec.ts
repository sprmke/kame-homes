import { expect, test } from '@playwright/test';

import {
  createParkingFlowState,
  fillGuestParkingRegistrationForm,
  installParkingFlowMocks,
  parkingFlowPaths,
} from '../shared/parkingFlowHarness';
import { setParkingScreenSuite } from '../shared/parkingScreenCapture';

test.describe('parking host-assisted booking', () => {
  test('host can create a parking booking from the dashboard modal', async ({ page }) => {
    setParkingScreenSuite('host-new-booking');
    const state = createParkingFlowState();
    await installParkingFlowMocks(page, state);

    await page.goto(parkingFlowPaths.hostBookings);
    await page.getByRole('button', { name: 'New booking' }).click();
    await expect(page.getByText('New Parking Booking')).toBeVisible();

    await fillGuestParkingRegistrationForm(page, {
      guestName: 'Alex Rivera',
      email: 'alex@example.com',
      phone: '09179876543',
      unitNumber: 'Tower 1 - 1802',
      requireDateEntry: true,
    });
    await page.getByRole('button', { name: 'Submit request' }).click();

    await expect(page.getByText('Booking created')).toBeVisible();
    await expect(page.getByText('Alex Rivera')).toBeVisible();
    expect(state.lastSubmitBody?.primaryGuestName).toBe('Alex Rivera');
  });
});
