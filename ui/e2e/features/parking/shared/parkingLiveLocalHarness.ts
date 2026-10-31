import { expect, type APIRequestContext, type Page } from '@playwright/test';

import { captureParkingScreen } from './parkingScreenCapture';

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
const LOCAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const LOCAL_HOST_EMAIL = 'sprmke.dev@gmail.com';
const LOCAL_HOST_PASSWORD = 'local-test-only-pw-123!';
const SUPABASE_AUTH_STORAGE_KEY = 'sb-127-auth-token';
const E2E_ADMIN_SESSION_STORAGE_KEY = 'kame:e2e-admin-session';

export const liveParkingFlowPaths = {
  hostBookings: '/org/kame-homes/parking/monaco-level-2-slot-27/bookings',
} as const;

export const liveParkingFlowLabels = {
  guestName: 'Guest name',
  email: 'Email',
  phone: 'Phone',
  unitNumber: 'Unit',
  vehicleType: 'Vehicle type',
  submit: 'Submit request',
  accept: 'Accept',
  accessInstructions: 'Access instructions',
} as const;

type LocalAuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in: number;
  token_type: string;
  user: {
    id: string;
    email?: string;
    user_metadata?: {
      full_name?: string;
      name?: string;
    };
  };
};

export type LiveParkingGuestSeed = {
  guestFormPath: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  unitNumber: string;
  carPlateNumber: string;
  carBrandModel: string;
  carColor: string;
  endorsementNote: string;
};

export function createLiveParkingGuestSeed(): LiveParkingGuestSeed {
  const now = Date.now();
  const nonce = `${now}`;
  const checkIn = new Date(now + (35 + (now % 7)) * 24 * 60 * 60 * 1000);
  const checkOut = new Date(checkIn.getTime() + 2 * 24 * 60 * 60 * 1000);
  const formatDate = (value: Date) => value.toISOString().slice(0, 10);

  return {
    checkInDate: formatDate(checkIn),
    checkOutDate: formatDate(checkOut),
    guestFormPath: `/parkings/monaco-level-2-slot-27/form?checkInDate=${formatDate(checkIn)}&checkOutDate=${formatDate(checkOut)}`,
    guestName: `Playwright Local ${nonce}`,
    guestEmail: `playwright-local-${nonce}@example.com`,
    guestPhone: '09171239999',
    unitNumber: 'Monaco 2604',
    carPlateNumber: `PW-${nonce.slice(-4)}`,
    carBrandModel: 'Toyota Vios',
    carColor: 'Gray',
    endorsementNote: `Local live endorsement ${nonce}`,
  };
}

export function buildLiveParkingHostBookingsPath(seed: LiveParkingGuestSeed): string {
  return `${liveParkingFlowPaths.hostBookings}?from=${seed.checkInDate}&to=${seed.checkOutDate}&view=table`;
}

export async function signInLocalParkingHost(
  request: APIRequestContext
): Promise<LocalAuthSession> {
  const response = await request.post(`${LOCAL_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: {
      apikey: LOCAL_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    data: {
      email: LOCAL_HOST_EMAIL,
      password: LOCAL_HOST_PASSWORD,
    },
  });

  expect(response.ok()).toBeTruthy();
  return (await response.json()) as LocalAuthSession;
}

export async function installLocalParkingHostSession(page: Page, session: LocalAuthSession) {
  await page.addInitScript(
    ({ authStorageKey, e2eStorageKey, authSession, orgSlug, parkingSlug }) => {
      window.localStorage.setItem(authStorageKey, JSON.stringify(authSession));
      window.localStorage.setItem(
        e2eStorageKey,
        JSON.stringify({
          accessToken: authSession.access_token,
          refreshToken: authSession.refresh_token,
          userId: authSession.user.id,
          email: authSession.user.email ?? 'sprmke.dev@gmail.com',
          name:
            authSession.user.user_metadata?.full_name ??
            authSession.user.user_metadata?.name ??
            'Playwright Host',
        })
      );
      window.localStorage.setItem('kame-last-org-slug', orgSlug);
      window.localStorage.setItem('kame-last-parking-slug', parkingSlug);
      window.localStorage.setItem('kame-last-tenant-kind', 'parking');
    },
    {
      authStorageKey: SUPABASE_AUTH_STORAGE_KEY,
      e2eStorageKey: E2E_ADMIN_SESSION_STORAGE_KEY,
      authSession: session,
      orgSlug: 'kame-homes',
      parkingSlug: 'monaco-level-2-slot-27',
    }
  );
}

export async function cleanupLiveParkingBookings(request: APIRequestContext, guestEmail: string) {
  const response = await request.fetch(
    `${LOCAL_SUPABASE_URL}/rest/v1/guest_submissions?guest_email=eq.${encodeURIComponent(guestEmail)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${LOCAL_SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  expect(response.ok()).toBeTruthy();
}

export async function submitLiveGuestParkingRequest(page: Page, seed: LiveParkingGuestSeed) {
  await page.goto(seed.guestFormPath);
  await captureParkingScreen(page, 'guest-form', { role: 'guest' });
  await page.getByLabel(liveParkingFlowLabels.guestName).fill(seed.guestName);
  await page.getByLabel(liveParkingFlowLabels.email).fill(seed.guestEmail);
  await page.getByLabel(liveParkingFlowLabels.phone).fill(seed.guestPhone);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel(liveParkingFlowLabels.unitNumber).fill(seed.unitNumber);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel(liveParkingFlowLabels.vehicleType).click();
  await page.getByRole('option', { name: 'Car' }).click();
  await page.getByLabel('Plate').fill(seed.carPlateNumber);
  await page.getByLabel('Brand / model').fill(seed.carBrandModel);
  await page.getByLabel('Color').fill(seed.carColor);
  await page.getByRole('button', { name: liveParkingFlowLabels.submit }).click();
  await captureParkingScreen(page, 'guest-submit-success', { role: 'guest' });
  await expect(page).toHaveURL(/\/parkings\/requests\/[^/]+$/);
  await captureParkingScreen(page, 'guest-waiting', { role: 'guest' });
}
