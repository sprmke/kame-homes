import { expect, test } from '@playwright/test';

import { mockEdgeFunctions } from '../../shared/interceptEdge';

const PROPERTY_SLUG = 'solea-mactan';

test.describe('@ci stay guide token smoke', () => {
  test('invalid token shows unavailable message', async ({ page }) => {
    await mockEdgeFunctions(page, [
      {
        name: 'get-guest-stay-guide',
        status: 404,
        body: {
          success: false,
          error: 'This guide is not available. Please use the link from your check-in email.',
        },
      },
    ]);

    await page.goto(`/properties/${PROPERTY_SLUG}/stay-guide?token=invalid-token`);
    await expect(
      page.getByText('This guide is not available. Please use the link from your check-in email.')
    ).toBeVisible({ timeout: 20_000 });
  });

  test('host plan without the stay guide shows a host-contact message', async ({ page }) => {
    await mockEdgeFunctions(page, [
      {
        name: 'get-guest-stay-guide',
        status: 403,
        body: {
          success: false,
          error: "This stay guide isn't available. Contact your host if you need it.",
        },
      },
    ]);

    await page.goto(`/properties/${PROPERTY_SLUG}/stay-guide?token=valid-token`);
    await expect(
      page.getByText("This stay guide isn't available. Contact your host if you need it.")
    ).toBeVisible({ timeout: 20_000 });
  });

  test('valid token mock renders stay guide content', async ({ page }) => {
    await mockEdgeFunctions(page, [
      {
        name: 'get-guest-stay-guide',
        body: {
          success: true,
          data: {
            property: {
              slug: PROPERTY_SLUG,
              name: 'Solea Mactan',
              brandColor: '#0f766e',
              logoUrl: null,
              locationLabel: 'Cebu',
              towerAndUnit: 'Tower 1 / 1204',
              location: {
                address: 'Mactan',
                city: 'Lapu-Lapu',
                province: 'Cebu',
                country: 'PH',
                zipCode: null,
                latitude: null,
                longitude: null,
                placeId: null,
                mapsUrl: null,
              },
              heroImageUrl: null,
              galleryImages: [],
              images: [],
            },
            booking: {
              guestName: 'Maria Santos',
              checkInDate: '09-10-2026',
              checkOutDate: '09-12-2026',
              checkInTime: '2:00 PM',
              checkOutTime: '12:00 PM',
              needParking: false,
              hasPets: false,
            },
            contact: {
              phone: '09171234567',
              email: 'host@example.com',
              facebookUrl: '',
              airbnbUrl: '',
            },
            host: {
              name: 'Kame Homes',
              avatarUrl: null,
              organizationName: 'Kame Homes PH',
            },
            sections: [],
            checkInDocuments: [],
            validUntil: '2099-12-31T00:00:00.000Z',
            todayManila: '2026-09-10',
            templateKey: 'showcase-monolith',
            sectionConfig: {
              version: 2,
              palette: 'default',
              typography: 'default',
              motion: 'default',
              sections: [],
            },
          },
        },
      },
    ]);

    await page.goto(`/properties/${PROPERTY_SLUG}/stay-guide?token=valid-e2e-token`);
    await expect(page.getByText('Maria Santos')).toBeVisible({ timeout: 20_000 });
  });
});
