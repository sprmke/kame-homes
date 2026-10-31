import { expect, test } from '@playwright/test';

import {
  assistantLivePanel,
  assistantLivePaths,
  attachAssistantLivePdf,
  attachAssistantLivePhoto,
  ensureAssistantLivePrerequisites,
  installAssistantLiveHostSession,
  loadAnyActiveBookingId,
  loadInstagramConnectionId,
  loadMetaInboxConversationId,
  loadOrg,
  loadPendingDocumentsBookingId,
  loadPropertyId,
  loadWebInboxConversationId,
  openAssistantLivePanel,
  pauseBetweenLiveAssistantTurns,
  sendAssistantLiveMessage,
  waitForAssistantLiveReply,
} from './shared/assistantLiveLocalHarness';

test.describe.configure({ mode: 'default' });

test.describe('@live AI assistant live local — §11–13 browser + Gemini', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(
      process.env.PLAYWRIGHT_ASSISTANT_LIVE !== '1',
      'Set PLAYWRIGHT_ASSISTANT_LIVE=1 with local Supabase + GEMINI_API_KEY(S).'
    );
    await ensureAssistantLivePrerequisites(request);
  });

  test.afterEach(async ({ context: _context }, testInfo) => {
    // Skip cooldown after failures so retries / remaining serial tests start sooner.
    if (testInfo.status !== 'passed') return;
    await pauseBetweenLiveAssistantTurns();
  });

  test('§12.3 plan snapshot read in panel (no confirm card)', async ({ page, request }) => {
    test.setTimeout(180_000);
    await installAssistantLiveHostSession(page, request);
    await openAssistantLivePanel(page);
    await sendAssistantLiveMessage(page, 'What plan are we on and which features does it include?');
    await waitForAssistantLiveReply(page);

    const panel = assistantLivePanel(page);
    await expect(panel.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
    await expect(panel.getByText(/pro|plan|subscription|feature/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('§13.2 import bookings deep-link in panel', async ({ page, request }) => {
    test.setTimeout(180_000);
    await installAssistantLiveHostSession(page, request);
    await openAssistantLivePanel(page);
    await sendAssistantLiveMessage(page, 'How do I import bookings from a spreadsheet?');
    await waitForAssistantLiveReply(page);

    const panel = assistantLivePanel(page);
    await expect(panel.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
    await expect(panel.getByText(/import|spreadsheet|csv|bookings/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(panel.getByRole('button', { name: /go to bookings/i })).toBeVisible();
  });

  test('§13.1 Telegram settings deep-link (read-only, no confirm)', async ({ page, request }) => {
    test.setTimeout(180_000);
    await installAssistantLiveHostSession(page, request);
    await openAssistantLivePanel(page);
    await sendAssistantLiveMessage(page, 'How do I turn on Telegram for marketing?');
    await waitForAssistantLiveReply(page);

    const panel = assistantLivePanel(page);
    await expect(panel.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Send', exact: true })).toHaveCount(0);
    await expect(panel.getByText(/telegram|notification/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('§11.3 org logo attach + Confirm in panel', async ({ page, request }) => {
    test.setTimeout(180_000);
    await installAssistantLiveHostSession(page, request);
    await openAssistantLivePanel(page);
    await attachAssistantLivePhoto(page);
    await sendAssistantLiveMessage(page, 'Set this as our organization team logo.');
    await waitForAssistantLiveReply(page);

    const panel = assistantLivePanel(page);
    const confirm = panel.getByRole('button', { name: 'Confirm', exact: true });
    await expect(confirm).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByText(/logo|organization/i).first()).toBeVisible();
    await confirm.click();
    await expect(confirm).toHaveCount(0, { timeout: 60_000 });
  });

  test('§11.4 GCash QR stage shows Confirm + OTP copy (no Payment settings bypass)', async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    await installAssistantLiveHostSession(page, request);
    await openAssistantLivePanel(page);
    await attachAssistantLivePhoto(page);
    await sendAssistantLiveMessage(page, 'Stage this as the property GCash QR.');
    await waitForAssistantLiveReply(page);

    const panel = assistantLivePanel(page);
    await expect(panel.getByText(/OTP|Payment settings/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(panel.getByRole('button', { name: 'Confirm', exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Send', exact: true })).toHaveCount(0);
  });

  test('§11.2 workflow email shows destructive Send confirm on booking detail', async ({
    page,
    request,
  }) => {
    test.setTimeout(300_000);
    const org = await loadOrg(request);
    const propertyId = await loadPropertyId(request, org.id);
    const bookingId = await loadAnyActiveBookingId(request, propertyId);
    test.skip(!bookingId, 'No active booking in local seed for workflow email test');

    await installAssistantLiveHostSession(page, request);
    await openAssistantLivePanel(page, assistantLivePaths.bookingDetail(bookingId!));
    await sendAssistantLiveMessage(page, 'Send the booking acknowledgement email for this stay.');
    await waitForAssistantLiveReply(page);

    const panel = assistantLivePanel(page);
    await expect(panel.getByText(/sends or publishes for real/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(panel.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
  });

  test('§11.1 compound GAF apply + mark-complete shows Confirm on booking detail', async ({
    page,
    request,
  }) => {
    test.setTimeout(300_000);
    const org = await loadOrg(request);
    const propertyId = await loadPropertyId(request, org.id);
    const bookingId = await loadPendingDocumentsBookingId(request, propertyId);
    test.skip(!bookingId, 'No PENDING_DOCUMENTS booking in local seed');

    await installAssistantLiveHostSession(page, request);
    await openAssistantLivePanel(page, assistantLivePaths.bookingDetail(bookingId!));
    // Establish conversation before attach so Known facts + path resolution are stable.
    await sendAssistantLiveMessage(page, 'What documents are still missing on this booking?');
    await waitForAssistantLiveReply(page);
    await attachAssistantLivePdf(page);
    await sendAssistantLiveMessage(page, 'Apply this as the approved GAF and mark GAF complete.');
    await waitForAssistantLiveReply(page);

    const panel = assistantLivePanel(page);
    await expect(panel.getByText(/GAF|approved gaf|mark.*complete/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(panel.getByRole('button', { name: 'Confirm', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(panel.getByRole('button', { name: 'Send', exact: true })).toHaveCount(0);
  });

  test('§12.1 Meta inbox attachment refusal in panel', async ({ page, request }) => {
    test.setTimeout(300_000);
    const org = await loadOrg(request);
    const metaConversationId = await loadMetaInboxConversationId(request, org.id);
    test.skip(!metaConversationId, 'No Facebook/Instagram inbox thread in local seed');

    await installAssistantLiveHostSession(page, request);
    await openAssistantLivePanel(page);
    await attachAssistantLivePhoto(page);
    await sendAssistantLiveMessage(
      page,
      `Send this screenshot to the guest in Meta inbox thread ${metaConversationId} with a short note.`
    );
    await waitForAssistantLiveReply(page);

    const panel = assistantLivePanel(page);
    await expect(
      panel.getByText(/website chat|text only|Messenger|Instagram|Attachments are only/i).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByRole('button', { name: 'Send', exact: true })).toHaveCount(0);
  });

  test('§12.1 web inbox attachment shows Send confirm', async ({ page, request }) => {
    test.setTimeout(300_000);
    const org = await loadOrg(request);
    const propertyId = await loadPropertyId(request, org.id);
    const webConversationId = await loadWebInboxConversationId(request, propertyId);
    test.skip(!webConversationId, 'No website chat thread in local seed');

    await installAssistantLiveHostSession(page, request);
    await openAssistantLivePanel(page);
    await attachAssistantLivePhoto(page);
    await sendAssistantLiveMessage(
      page,
      `Send this screenshot to the guest in website chat thread ${webConversationId} with a short note.`
    );
    await waitForAssistantLiveReply(page);

    const panel = assistantLivePanel(page);
    await expect(panel.getByText(/sends or publishes for real/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(panel.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
  });

  test('§13.3 Meta publish from chat attachment shows Send confirm', async ({ page, request }) => {
    test.setTimeout(300_000);
    const org = await loadOrg(request);
    const connectionId = await loadInstagramConnectionId(request, org.id);
    test.skip(!connectionId, 'No connected Instagram channel in local seed');

    await installAssistantLiveHostSession(page, request);
    await openAssistantLivePanel(page);
    await attachAssistantLivePhoto(page);
    await sendAssistantLiveMessage(
      page,
      `Publish this image to Instagram as a post with caption Test from assistant using connection ${connectionId}.`
    );
    await waitForAssistantLiveReply(page);

    const panel = assistantLivePanel(page);
    await expect(
      panel.getByText(/sends or publishes for real|instagram|publish/i).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
  });

  test('§12.2 support ticket create shows Confirm card', async ({ page, request }) => {
    test.setTimeout(300_000);
    await installAssistantLiveHostSession(page, request);
    await openAssistantLivePanel(page);
    await attachAssistantLivePhoto(page);
    await sendAssistantLiveMessage(
      page,
      'File a bug report with subject Assistant e2e live test and attach this screenshot.'
    );
    await waitForAssistantLiveReply(page);

    const panel = assistantLivePanel(page);
    await expect(panel.getByText(/support ticket|bug report/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(panel.getByRole('button', { name: 'Confirm', exact: true })).toBeVisible();
  });
});
