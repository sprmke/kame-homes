import { expect, test } from '@playwright/test';

import { mockEdgeFunctions } from '../../shared/interceptEdge';

const BOOKING_ID = 'guest-review-e2e-booking-001';

const BASE_BOOKING_DATA = {
  bookingId: BOOKING_ID,
  primary_guest_name: 'Maria Santos',
  guest_phone_number: '09171234567',
  security_deposit: 3000,
  check_in_date: '09-10-2026',
  check_out_date: '09-12-2026',
  vouchers_enabled: false,
  next_stay_voucher_code: null,
  next_stay_voucher_amount: null,
  can_edit_review: true,
  review_draft: null,
};

const PAYMENT_INFO_MOCK = {
  name: 'get-guest-payment-info',
  body: { success: true, data: { emailLogoUrl: '', brandColor: '#0f766e' } },
};

test.describe('@ci guest write review', () => {
  test('submit stays disabled until all 6 categories are rated', async ({ page }) => {
    await mockEdgeFunctions(page, [
      { name: 'get-sd-form', body: { success: true, data: BASE_BOOKING_DATA } },
      PAYMENT_INFO_MOCK,
    ]);

    await page.goto(`/properties/solea-mactan/sd-form?bookingId=${BOOKING_ID}`);
    await expect(page.getByRole('heading', { name: 'SD Refund Form' })).toBeVisible({
      timeout: 20_000,
    });

    const submitBtn = page.getByRole('button', { name: /submit review/i });
    await expect(submitBtn).toBeDisabled();

    // Overall rating alone is not enough — all 6 categories are required (D9).
    await page
      .getByRole('radiogroup', { name: 'Overall rating' })
      .getByRole('radio', { name: '5 stars' })
      .click();
    await expect(submitBtn).toBeDisabled();

    const categoryGroups = [
      'Cleanliness rating',
      'Accuracy rating',
      'Check-in rating',
      'Communication rating',
      'Location rating',
      'Value rating',
    ];
    for (const groupName of categoryGroups.slice(0, -1)) {
      await page
        .getByRole('radiogroup', { name: groupName })
        .getByRole('radio', { name: '5 stars' })
        .click();
      await expect(submitBtn).toBeDisabled();
    }
    // Rating the final category completes the requirement.
    const lastGroup = categoryGroups[categoryGroups.length - 1];
    await page
      .getByRole('radiogroup', { name: lastGroup })
      .getByRole('radio', { name: '5 stars' })
      .click();
    await expect(submitBtn).toBeEnabled();
  });

  test('Not now skips the review without submitting (D3/D4)', async ({ page }) => {
    let submitReviewCalls = 0;
    await mockEdgeFunctions(page, [
      { name: 'get-sd-form', body: { success: true, data: BASE_BOOKING_DATA } },
      PAYMENT_INFO_MOCK,
      {
        name: 'submit-guest-review',
        handler: async (route) => {
          submitReviewCalls += 1;
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, error: 'should not be called' }),
          });
        },
      },
    ]);

    await page.goto(`/properties/solea-mactan/sd-form?bookingId=${BOOKING_ID}`);
    await expect(page.getByRole('heading', { name: 'SD Refund Form' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('button', { name: 'Not now' }).click();

    // No vouchers for this booking → skip goes straight to the refund method step.
    await expect(
      page.getByText(/choose how you.?d like to receive your security deposit refund/i)
    ).toBeVisible({ timeout: 10_000 });
    expect(submitReviewCalls).toBe(0);
  });

  test('Not now with vouchers on still reaches the voucher step', async ({ page }) => {
    await mockEdgeFunctions(page, [
      {
        name: 'get-sd-form',
        body: { success: true, data: { ...BASE_BOOKING_DATA, vouchers_enabled: true } },
      },
      PAYMENT_INFO_MOCK,
    ]);

    await page.goto(`/properties/solea-mactan/sd-form?bookingId=${BOOKING_ID}`);
    await expect(page.getByRole('heading', { name: 'SD Refund Form' })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: 'Not now' }).click();
    await expect(page.getByRole('button', { name: 'Claim it!' })).toBeVisible({ timeout: 10_000 });
  });

  test('closed window shows a read-only message, not the form', async ({ page }) => {
    await mockEdgeFunctions(page, [
      {
        name: 'get-sd-form',
        body: {
          success: true,
          data: {
            ...BASE_BOOKING_DATA,
            can_edit_review: false,
            review_draft: null,
          },
        },
      },
      PAYMENT_INFO_MOCK,
    ]);

    await page.goto(`/properties/solea-mactan/sd-form?bookingId=${BOOKING_ID}`);
    await expect(page.getByText('Review window closed')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /submit review/i })).toHaveCount(0);
    // A closed window must never block the refund.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(
      page.getByText(/choose how you.?d like to receive your security deposit refund/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test('a saved draft can continue to the refund without re-saving', async ({ page }) => {
    let submitCalls = 0;
    await mockEdgeFunctions(page, [
      {
        name: 'get-sd-form',
        body: {
          success: true,
          data: {
            ...BASE_BOOKING_DATA,
            guest_review_submitted: true,
            can_edit_review: true,
            review_draft: {
              status: 'submitted',
              starRating: 4,
              categoryRatings: {
                cleanliness: 4,
                accuracy: 4,
                check_in: 4,
                communication: 4,
                location: 4,
                value: 4,
              },
              reviewText: 'Nice view.',
              privateNote: null,
              feedbackTags: [],
              mediaUrls: [],
            },
          },
        },
      },
      PAYMENT_INFO_MOCK,
      {
        name: 'submit-guest-review',
        handler: async (route) => {
          submitCalls += 1;
          await route.fulfill({ status: 500, body: '{}' });
        },
      },
    ]);

    await page.goto(`/properties/solea-mactan/sd-form?bookingId=${BOOKING_ID}`);
    await expect(page.getByLabel('Feedback')).toHaveValue('Nice view.', { timeout: 20_000 });
    const continueBtn = page.getByRole('button', { name: 'Continue' });
    await expect(continueBtn).toBeEnabled();
    // Editing the draft locks Continue until the change is saved.
    await page.getByLabel('Feedback').fill('Nice view. Quiet too.');
    await expect(continueBtn).toBeDisabled();
    await page.getByLabel('Feedback').fill('Nice view.');
    await continueBtn.click();
    await expect(
      page.getByText(/choose how you.?d like to receive your security deposit refund/i)
    ).toBeVisible({ timeout: 10_000 });
    expect(submitCalls).toBe(0);
  });

  test('unpublished draft pre-fills and can be saved again', async ({ page }) => {
    let submitCalls = 0;
    await mockEdgeFunctions(page, [
      {
        name: 'get-sd-form',
        body: {
          success: true,
          data: {
            ...BASE_BOOKING_DATA,
            guest_review_submitted: true,
            can_edit_review: true,
            review_draft: {
              status: 'submitted',
              starRating: 5,
              categoryRatings: {
                cleanliness: 5,
                accuracy: 5,
                check_in: 5,
                communication: 5,
                location: 5,
                value: 5,
              },
              reviewText: 'Quiet nights.',
              privateNote: null,
              feedbackTags: [],
              mediaUrls: [],
            },
          },
        },
      },
      PAYMENT_INFO_MOCK,
      {
        name: 'submit-guest-review',
        handler: async (route) => {
          submitCalls += 1;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: { submitted: true, wasEdit: true } }),
          });
        },
      },
    ]);

    await page.goto(`/properties/solea-mactan/sd-form?bookingId=${BOOKING_ID}`);
    await expect(page.getByRole('heading', { name: 'SD Refund Form' })).toBeVisible({
      timeout: 20_000,
    });
    // Returning-guest skip is for submitted reviews that already have a voucher;
    // with only a draft, the form stays on step 1 for edit-until-published.
    await expect(page.getByLabel('Feedback')).toHaveValue('Quiet nights.');
    await page.getByRole('button', { name: 'Save review' }).click();
    await expect(page.getByText('Thanks for your review')).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText(/choose how you.?d like to receive your security deposit refund/i)
    ).toBeVisible({
      timeout: 10_000,
    });
    expect(submitCalls).toBe(1);
  });
});
