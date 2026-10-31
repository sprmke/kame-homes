/**
 * Live local assistant harness — real Supabase auth + real Gemini (no chat mocks).
 * Requires `./dev.sh` or local Supabase + `GEMINI_API_KEY(S)` in supabase/.env.local.
 */

import path from 'node:path';

import { expect, type APIRequestContext, type Page } from '@playwright/test';

import {
  installLocalParkingHostSession,
  signInLocalParkingHost,
} from '../../parking/shared/parkingLiveLocalHarness';

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export const ASSISTANT_LIVE_ORG_SLUG = 'kame-homes';
export const ASSISTANT_LIVE_PROPERTY_SLUG = 'kame-home';

export const assistantLivePaths = {
  bookings: `/org/${ASSISTANT_LIVE_ORG_SLUG}/property/${ASSISTANT_LIVE_PROPERTY_SLUG}/bookings`,
  bookingDetail: (bookingId: string) =>
    `/org/${ASSISTANT_LIVE_ORG_SLUG}/property/${ASSISTANT_LIVE_PROPERTY_SLUG}/bookings/${bookingId}`,
} as const;

const FIXTURE_PNG = path.resolve(process.cwd(), 'ui/public/icons/pwa-192.png');
const FIXTURE_PDF = path.resolve(process.cwd(), 'ui/e2e/fixtures/minimal-gaf.pdf');

function serviceHeaders(extra?: Record<string, string>) {
  return {
    apikey: LOCAL_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${LOCAL_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

type OrgRow = { id: string; owner_id: string };
type PropertyRow = { id: string };

export async function loadOrg(request: APIRequestContext): Promise<OrgRow> {
  const res = await request.get(
    `${LOCAL_SUPABASE_URL}/rest/v1/organizations?slug=eq.${ASSISTANT_LIVE_ORG_SLUG}&select=id,owner_id`,
    { headers: serviceHeaders() }
  );
  expect(res.ok()).toBeTruthy();
  const rows = (await res.json()) as OrgRow[];
  expect(rows.length).toBeGreaterThan(0);
  return rows[0]!;
}

export async function loadPropertyId(request: APIRequestContext, orgId: string): Promise<string> {
  const res = await request.get(
    `${LOCAL_SUPABASE_URL}/rest/v1/properties?organization_id=eq.${orgId}&slug=eq.${ASSISTANT_LIVE_PROPERTY_SLUG}&select=id`,
    { headers: serviceHeaders() }
  );
  expect(res.ok()).toBeTruthy();
  const rows = (await res.json()) as PropertyRow[];
  expect(rows.length).toBeGreaterThan(0);
  return rows[0]!.id;
}

/** Enable kill switches, Pro plan, and reset quotas for live assistant turns. */
export async function ensureAssistantLivePrerequisites(request: APIRequestContext): Promise<void> {
  const org = await loadOrg(request);
  const propertyId = await loadPropertyId(request, org.id);

  const proRes = await request.get(
    `${LOCAL_SUPABASE_URL}/rest/v1/pricing_plans?code=eq.pro&select=id`,
    { headers: serviceHeaders() }
  );
  expect(proRes.ok()).toBeTruthy();
  const proPlans = (await proRes.json()) as Array<{ id: string }>;
  expect(proPlans.length).toBeGreaterThan(0);
  const proPlanId = proPlans[0]!.id;

  const slotRes = await request.get(
    `${LOCAL_SUPABASE_URL}/rest/v1/org_subscription_properties?property_id=eq.${propertyId}&select=org_subscription_id`,
    { headers: serviceHeaders() }
  );
  expect(slotRes.ok()).toBeTruthy();
  const slots = (await slotRes.json()) as Array<{ org_subscription_id: string }>;
  expect(slots.length).toBeGreaterThan(0);

  await request.patch(
    `${LOCAL_SUPABASE_URL}/rest/v1/org_subscriptions?id=eq.${slots[0]!.org_subscription_id}`,
    {
      headers: serviceHeaders({ Prefer: 'return=minimal' }),
      data: { plan_id: proPlanId, status: 'active' },
    }
  );

  await request.patch(`${LOCAL_SUPABASE_URL}/rest/v1/ai_platform_global_settings?id=eq.1`, {
    headers: serviceHeaders({ Prefer: 'return=minimal' }),
    data: { enabled: true, enforce_quotas: false, allowed_features: ['dashboard_assistant'] },
  });

  await request.post(`${LOCAL_SUPABASE_URL}/rest/v1/ai_platform_org_settings`, {
    headers: serviceHeaders({ Prefer: 'resolution=merge-duplicates' }),
    data: {
      organization_id: org.id,
      enabled: true,
      daily_credit_limit: 10_000,
      monthly_credit_limit: 100_000,
      updated_by: org.owner_id,
    },
  });

  await request.delete(
    `${LOCAL_SUPABASE_URL}/rest/v1/ai_platform_usage_daily?organization_id=eq.${org.id}`,
    { headers: serviceHeaders() }
  );
  await request.delete(
    `${LOCAL_SUPABASE_URL}/rest/v1/ai_dashboard_assistant_usage_daily?organization_id=eq.${org.id}`,
    { headers: serviceHeaders() }
  );

  await request.patch(
    `${LOCAL_SUPABASE_URL}/rest/v1/ai_dashboard_assistant_global_settings?id=eq.true`,
    {
      headers: serviceHeaders({ Prefer: 'return=minimal' }),
      data: { enabled: true, updated_by: org.owner_id },
    }
  );

  await request.post(`${LOCAL_SUPABASE_URL}/rest/v1/ai_dashboard_assistant_org_settings`, {
    headers: serviceHeaders({ Prefer: 'resolution=merge-duplicates' }),
    data: {
      organization_id: org.id,
      enabled: true,
      disabled_property_ids: [],
      daily_message_limit: 100,
      monthly_message_limit: 2000,
      daily_write_action_limit: 50,
      updated_by: org.owner_id,
    },
  });
}

export async function loadPendingDocumentsBookingId(
  request: APIRequestContext,
  propertyId: string
): Promise<string | null> {
  const res = await request.get(
    `${LOCAL_SUPABASE_URL}/rest/v1/guest_submissions?property_id=eq.${propertyId}&status=eq.PENDING_DOCUMENTS&select=id&limit=1`,
    { headers: serviceHeaders() }
  );
  if (!res.ok()) return null;
  const rows = (await res.json()) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

export async function loadAnyActiveBookingId(
  request: APIRequestContext,
  propertyId: string
): Promise<string | null> {
  const res = await request.get(
    `${LOCAL_SUPABASE_URL}/rest/v1/guest_submissions?property_id=eq.${propertyId}&status=not.in.(CANCELLED,COMPLETED)&select=id&limit=1`,
    { headers: serviceHeaders() }
  );
  if (!res.ok()) return null;
  const rows = (await res.json()) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

export async function loadWebInboxConversationId(
  request: APIRequestContext,
  propertyId: string
): Promise<string | null> {
  const res = await request.get(
    `${LOCAL_SUPABASE_URL}/rest/v1/social_conversations?property_id=eq.${propertyId}&platform=eq.web&select=id&limit=1`,
    { headers: serviceHeaders() }
  );
  if (!res.ok()) return null;
  const rows = (await res.json()) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

export async function loadMetaInboxConversationId(
  request: APIRequestContext,
  orgId: string
): Promise<string | null> {
  const res = await request.get(
    `${LOCAL_SUPABASE_URL}/rest/v1/social_conversations?organization_id=eq.${orgId}&platform=in.(facebook,instagram)&select=id,platform&limit=1`,
    { headers: serviceHeaders() }
  );
  if (!res.ok()) return null;
  const rows = (await res.json()) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

export async function loadInstagramConnectionId(
  request: APIRequestContext,
  orgId: string
): Promise<string | null> {
  const res = await request.get(
    `${LOCAL_SUPABASE_URL}/rest/v1/social_channel_connections?organization_id=eq.${orgId}&platform=eq.instagram&status=eq.connected&select=id&limit=1`,
    { headers: serviceHeaders() }
  );
  if (!res.ok()) return null;
  const rows = (await res.json()) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

export async function installAssistantLiveHostSession(page: Page, request: APIRequestContext) {
  const session = await signInLocalParkingHost(request);
  await page.addInitScript(
    ({ authStorageKey, e2eStorageKey, authSession, orgSlug, propertySlug }) => {
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
      window.localStorage.setItem('kame-last-property-slug', propertySlug);
      window.localStorage.setItem('kame-last-tenant-kind', 'property');
    },
    {
      authStorageKey: 'sb-127-auth-token',
      e2eStorageKey: 'kame:e2e-admin-session',
      authSession: session,
      orgSlug: ASSISTANT_LIVE_ORG_SLUG,
      propertySlug: ASSISTANT_LIVE_PROPERTY_SLUG,
    }
  );
}

export async function openAssistantLivePanel(page: Page, pagePath = assistantLivePaths.bookings) {
  await page.setViewportSize({ width: 1280, height: 900 });
  const fab = page.getByRole('button', { name: 'Open AI assistant' });
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(pagePath, { waitUntil: 'domcontentloaded' });
    // Bookings shell heading — avoid waiting forever on a stuck auth skeleton.
    await page
      .getByRole('heading', { name: /Bookings/i })
      .first()
      .waitFor({ state: 'visible', timeout: 45_000 })
      .catch(() => undefined);
    if (await fab.isVisible().catch(() => false)) break;
    if (attempt === 0) await new Promise((r) => setTimeout(r, 2_000));
  }
  await expect(fab).toBeVisible({ timeout: 60_000 });
  await fab.click();
  const panel = assistantDialog(page);
  await expect(panel).toBeVisible({ timeout: 20_000 });
  await expect(panel.getByRole('heading', { name: 'AI Assistant' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(panel.getByText(/\d+\/\d+/)).toBeVisible({ timeout: 60_000 });
  await panel
    .getByRole('button', { name: 'Start new conversation' })
    .click()
    .catch(() => undefined);
}

function assistantDialog(page: Page) {
  return page.getByRole('dialog', { name: 'AI Assistant' });
}

export async function sendAssistantLiveMessage(page: Page, message: string) {
  const panel = assistantDialog(page);
  await expect(panel).toBeVisible({ timeout: 10_000 });
  const composer = panel.getByRole('textbox', { name: 'Message' });
  await composer.click();
  await composer.fill('');
  await composer.pressSequentially(message, { delay: 5 });
  await expect(composer).toHaveValue(message, { timeout: 5_000 });
  const send = panel.getByRole('button', { name: 'Send message' });
  await expect(send).toBeEnabled({ timeout: 10_000 });
  await send.click();
  const userBubble = panel.getByText(message).first();
  if (!(await userBubble.isVisible().catch(() => false))) {
    await composer.press('Enter');
  }
  await expect(userBubble).toBeVisible({ timeout: 20_000 });
}

export async function waitForAssistantLiveReply(page: Page) {
  const panel = assistantDialog(page);
  await panel
    .getByLabel(/Assistant is thinking|Assistant is working on your request/i)
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 })
    .catch(() => undefined);
  await panel
    .getByLabel(/Assistant is thinking|Assistant is working on your request/i)
    .first()
    .waitFor({ state: 'hidden', timeout: 180_000 })
    .catch(() => undefined);

  const outcome = await expect
    .poll(
      async () => {
        if (
          await panel
            .getByText(/exceeded your current quota|Quota exceeded for metric/i)
            .isVisible()
            .catch(() => false)
        ) {
          return 'quota' as const;
        }
        if (
          await panel
            .locator('.rounded-bl-md')
            .first()
            .isVisible()
            .catch(() => false)
        ) {
          return 'reply' as const;
        }
        if (
          await panel
            .getByRole('button', { name: 'Confirm', exact: true })
            .isVisible()
            .catch(() => false)
        ) {
          return 'confirm' as const;
        }
        if (
          await panel
            .getByRole('button', { name: 'Send', exact: true })
            .isVisible()
            .catch(() => false)
        ) {
          return 'send' as const;
        }
        // External-send warn copy also uses text-destructive — exclude it.
        const streamError = panel
          .locator('p.text-destructive')
          .filter({ hasNotText: /sends or publishes for real/i });
        if (
          await streamError
            .first()
            .isVisible()
            .catch(() => false)
        ) {
          return 'error' as const;
        }
        return null;
      },
      { timeout: 60_000 }
    )
    .not.toBeNull()
    .then(async () => {
      if (
        await panel
          .getByText(/exceeded your current quota|Quota exceeded for metric/i)
          .isVisible()
          .catch(() => false)
      ) {
        return 'quota' as const;
      }
      const streamError = panel
        .locator('p.text-destructive')
        .filter({ hasNotText: /sends or publishes for real/i });
      if (
        await streamError
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        return 'error' as const;
      }
      return 'ok' as const;
    });

  if (outcome === 'quota') {
    throw new Error(
      'Gemini API quota exceeded. Wait and re-run, set GEMINI_MODEL_OVERRIDE_DASHBOARD_ASSISTANT ' +
        'to a model with headroom (e.g. gemini-3.5-flash-lite), or use a paid GEMINI_API_KEY.'
    );
  }
  if (outcome === 'error') {
    const streamError = panel
      .locator('p.text-destructive')
      .filter({ hasNotText: /sends or publishes for real/i });
    const msg = (await streamError.first().textContent())?.trim() || 'Assistant stream error';
    throw new Error(msg);
  }
}

/** Free-tier Gemini rate limit — space serial live tests apart. */
export async function pauseBetweenLiveAssistantTurns(ms = 45_000): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function attachAssistantLivePhoto(page: Page) {
  const panel = assistantDialog(page);
  await panel.getByRole('button', { name: 'Attach' }).click();
  await panel.getByText('Photo', { exact: true }).click();
  await panel
    .locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]')
    .setInputFiles(FIXTURE_PNG);
  await expect(panel.getByText('pwa-192.png')).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape').catch(() => undefined);
}

export async function attachAssistantLivePdf(page: Page) {
  const panel = assistantDialog(page);
  await panel.getByRole('button', { name: 'Attach' }).click();
  await panel.getByText('File', { exact: true }).click();
  await panel
    .locator('input[type="file"][accept="application/pdf,image/jpeg,image/png,image/webp"]')
    .setInputFiles(FIXTURE_PDF);
  await expect(panel.getByText('minimal-gaf.pdf')).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape').catch(() => undefined);
}

export function assistantLivePanel(page: Page) {
  return assistantDialog(page);
}

export { signInLocalParkingHost, installLocalParkingHostSession };
