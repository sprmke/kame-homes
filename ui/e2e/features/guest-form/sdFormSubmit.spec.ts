import { expect, test } from '@playwright/test';

import { mockEdgeFunctions } from '../../shared/interceptEdge';

const BOOKING_ID = 'sd-form-e2e-booking-001';

test.describe('@ci sd form submit smoke', () => {
  test('READY_FOR_CHECKOUT guest can load SD refund form', async ({ page }) => {
    await mockEdgeFunctions(page, [
      {
        name: 'get-sd-form',
        body: {
          success: true,
          data: {
            bookingId: BOOKING_ID,
            primary_guest_name: 'Maria Santos',
            guest_phone_number: '09171234567',
            security_deposit: 3000,
            check_in_date: '09-10-2026',
            check_out_date: '09-12-2026',
            vouchers_enabled: false,
            next_stay_voucher_code: null,
            next_stay_voucher_amount: null,
          },
        },
      },
      {
        name: 'get-guest-payment-info',
        body: {
          success: true,
          data: {
            emailLogoUrl: '',
            brandColor: '#0f766e',
          },
        },
      },
    ]);

    await page.goto(`/properties/solea-mactan/sd-form?bookingId=${BOOKING_ID}`);
    await expect(page.getByRole('heading', { name: 'SD Refund Form' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Maria Santos')).toBeVisible();
  });
});
