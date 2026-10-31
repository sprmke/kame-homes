import { expect, test } from '@playwright/test';

import {
  actionConfirmationBlock,
  installAssistantConfirmMocks,
  openAssistantPanel,
  queueAssistantChatBlocks,
  sendAssistantMessage,
} from './shared/assistantConfirmHarness';

test.describe('AI assistant confirm cards — §11–13 UI subset', () => {
  test('§11.2 workflow email shows destructive Send confirm (external_send)', async ({ page }) => {
    queueAssistantChatBlocks([
      { type: 'text', text: 'I can send the booking acknowledgement for this stay.' },
      actionConfirmationBlock({
        actionId: 'action-workflow-email-001',
        toolName: 'propose_send_workflow_email',
        summary: 'Send booking acknowledgement email for Maria Santos — Mar 12–15.',
        isExternalSend: true,
        details: [{ label: 'Kind', value: 'booking_acknowledgement' }],
      }),
    ]);
    await installAssistantConfirmMocks(page);
    await openAssistantPanel(page);
    await sendAssistantMessage(page, 'Send the booking acknowledgement email for this stay.');

    await expect(page.getByText(/sends or publishes for real/i)).toBeVisible({ timeout: 15_000 });
    const panel = page.getByRole('dialog');
    await expect(panel.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
  });

  test('§11.1 booking attachment overwrite shows Confirm (not Send)', async ({ page }) => {
    queueAssistantChatBlocks([
      actionConfirmationBlock({
        actionId: 'action-booking-attach-001',
        toolName: 'propose_apply_booking_attachment',
        summary:
          'Apply chat file as Approved GAF on Maria Santos — Mar 12–15. This will replace the file already on the booking. Then mark GAF as complete.',
        details: [
          { label: 'Asset', value: 'Approved GAF' },
          { label: 'File', value: 'approved-gaf.pdf' },
        ],
      }),
    ]);
    await installAssistantConfirmMocks(page);
    await openAssistantPanel(page);
    await sendAssistantMessage(page, 'Apply this as the approved GAF and mark GAF complete.');

    await expect(page.getByText(/replace the file already on the booking/i)).toBeVisible({
      timeout: 15_000,
    });
    const panel = page.getByRole('dialog');
    await expect(panel.getByRole('button', { name: 'Confirm', exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Send', exact: true })).toHaveCount(0);
  });

  test('§12.2 support ticket create shows Confirm card', async ({ page }) => {
    queueAssistantChatBlocks([
      actionConfirmationBlock({
        actionId: 'action-support-ticket-001',
        toolName: 'propose_create_support_ticket',
        summary: 'Create support ticket: Assistant test',
        details: [{ label: 'Category', value: 'Bug report' }],
      }),
    ]);
    await installAssistantConfirmMocks(page);
    await openAssistantPanel(page);
    await sendAssistantMessage(page, 'File a bug report with subject Assistant test.');

    await expect(page.getByText(/Create support ticket/i)).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true })
    ).toBeVisible();
  });

  test('§12.1 Meta inbox attachment refusal surfaces in chat', async ({ page }) => {
    queueAssistantChatBlocks([
      {
        type: 'text',
        text: 'Attachments are only supported for website chat — send text only on Messenger or Instagram.',
      },
    ]);
    await installAssistantConfirmMocks(page);
    await openAssistantPanel(page);
    await sendAssistantMessage(page, 'Send this screenshot to the guest in a Messenger thread.');

    await expect(
      page.getByRole('dialog').getByText(/Attachments are only supported for website chat/i)
    ).toBeVisible({ timeout: 15_000 });
  });

  test('§12.1 web inbox attachment shows destructive Send confirm', async ({ page }) => {
    queueAssistantChatBlocks([
      {
        type: 'text',
        text: 'I can send this screenshot to the guest in the website chat thread.',
      },
      actionConfirmationBlock({
        actionId: 'action-inbox-reply-001',
        toolName: 'propose_send_inbox_reply',
        summary: 'Send this reply: "Here is the screenshot." + 1 file(s)',
        isExternalSend: true,
        details: [{ label: 'Attachments', value: '1 file' }],
      }),
    ]);
    await installAssistantConfirmMocks(page);
    await openAssistantPanel(page);
    await sendAssistantMessage(
      page,
      'Send this screenshot to the guest in the website chat thread with a short note.'
    );

    await expect(page.getByText(/sends or publishes for real/i)).toBeVisible({ timeout: 15_000 });
    const panel = page.getByRole('dialog');
    await expect(panel.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
  });

  test('§11.4 GCash QR stage confirm mentions OTP / Payment settings', async ({ page }) => {
    queueAssistantChatBlocks([
      actionConfirmationBlock({
        actionId: 'action-gcash-qr-001',
        toolName: 'propose_stage_gcash_qr',
        summary:
          'Stage “gcash-qr.png” as a property GCash QR image. This does not save payment settings — you must still open Payment settings and confirm with the email verification code (OTP).',
        details: [
          { label: 'File', value: 'gcash-qr.png' },
          { label: 'OTP required', value: 'Yes — Payment settings' },
        ],
      }),
    ]);
    await installAssistantConfirmMocks(page);
    await openAssistantPanel(page);
    await sendAssistantMessage(page, 'Use this image as the property GCash QR.');

    await expect(page.getByText(/OTP|Payment settings/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true })
    ).toBeVisible();
  });

  test('§13.3 Meta publish from chat attachment shows destructive Send confirm', async ({
    page,
  }) => {
    queueAssistantChatBlocks([
      {
        type: 'text',
        text: 'I can publish this image to Instagram as a post.',
      },
      actionConfirmationBlock({
        actionId: 'action-meta-publish-001',
        toolName: 'propose_publish_to_meta',
        summary:
          'Publish to instagram post: "Test from assistant" — media: chat file meta-publish.jpg',
        isExternalSend: true,
        details: [
          { label: 'Type', value: 'instagram_post' },
          { label: 'Media', value: 'meta-publish.jpg' },
        ],
      }),
    ]);
    await installAssistantConfirmMocks(page);
    await openAssistantPanel(page);
    await sendAssistantMessage(
      page,
      'Publish this image to Instagram as a post with caption Test from assistant.'
    );

    await expect(page.getByText(/sends or publishes for real/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/chat file meta-publish\.jpg/i)).toBeVisible();
    const panel = page.getByRole('dialog');
    await expect(panel.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
  });
});
