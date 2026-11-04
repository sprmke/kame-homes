import { expect, test } from '@playwright/test';

import {
  actionPlanBlock,
  actionPlanStep,
  installAssistantConfirmMocks,
  openAssistantPanel,
  queueAssistantChatBlocks,
  sendAssistantMessage,
} from './shared/assistantConfirmHarness';

test.describe('AI assistant plan card - Phase 3 approve/untick/partial-failure', () => {
  test('approving every step marks the plan Completed', async ({ page }) => {
    queueAssistantChatBlocks([
      { type: 'text', text: 'Here is the plan for your 2 asks.' },
      actionPlanBlock({
        planId: 'plan-e2e-001',
        steps: [
          actionPlanStep({
            stepId: 'step-1',
            stepIndex: 0,
            toolName: 'propose_block_property_dates',
            summary: 'Block Dec 24-26 on Azure North 1204.',
          }),
          actionPlanStep({
            stepId: 'step-2',
            stepIndex: 1,
            toolName: 'propose_update_property_base_rate',
            summary: 'Raise the weekend rate 10% to ₱4,620.',
          }),
        ],
      }),
    ]);
    await installAssistantConfirmMocks(page);
    await openAssistantPanel(page);
    await sendAssistantMessage(page, 'Block Dec 24-26 and raise the weekend rate 10%.');

    const panel = page.getByRole('dialog', { name: 'AI Assistant' });
    await expect(panel.getByText('2 steps to review')).toBeVisible({ timeout: 15_000 });
    await expect(
      panel.getByText('Block Dec 24-26 on Azure North 1204.', { exact: false })
    ).toBeVisible();
    await expect(
      panel.getByText('Raise the weekend rate 10% to ₱4,620.', { exact: false })
    ).toBeVisible();

    const approve = panel.getByRole('button', { name: /Approve selected/ });
    await expect(approve).toBeEnabled();
    await approve.click();

    await expect(panel.getByText('Completed')).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByRole('button', { name: /Approve selected/ })).toHaveCount(0);
  });

  test('unticking a step excludes it and Approve selected count drops', async ({ page }) => {
    queueAssistantChatBlocks([
      actionPlanBlock({
        planId: 'plan-e2e-002',
        steps: [
          actionPlanStep({
            stepId: 'step-1',
            stepIndex: 0,
            toolName: 'propose_block_property_dates',
            summary: 'Block Dec 24-26 on Azure North 1204.',
          }),
          actionPlanStep({
            stepId: 'step-2',
            stepIndex: 1,
            toolName: 'propose_update_property_base_rate',
            summary: 'Raise the weekend rate 10% to ₱4,620.',
          }),
        ],
      }),
    ]);
    await installAssistantConfirmMocks(page);
    await openAssistantPanel(page);
    await sendAssistantMessage(page, 'Block Dec 24-26 and raise the weekend rate 10%.');

    const panel = page.getByRole('dialog', { name: 'AI Assistant' });
    await expect(panel.getByText('2 steps to review')).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByRole('button', { name: 'Approve selected (2)' })).toBeVisible();

    await panel.getByRole('checkbox', { name: /Include step 2/ }).uncheck();
    await expect(panel.getByRole('button', { name: 'Approve selected (1)' })).toBeVisible();

    await panel.getByRole('button', { name: 'Approve selected (1)' }).click();
    await expect(panel.getByText('Completed')).toBeVisible({ timeout: 15_000 });
  });

  test('a step that fails during confirm marks the plan Partly failed and keeps the error visible', async ({
    page,
  }) => {
    queueAssistantChatBlocks([
      actionPlanBlock({
        planId: 'plan-e2e-003',
        steps: [
          actionPlanStep({
            stepId: 'step-1',
            stepIndex: 0,
            toolName: 'propose_block_property_dates',
            summary: 'Block Dec 24-26 on Azure North 1204.',
          }),
          actionPlanStep({
            stepId: 'step-2',
            stepIndex: 1,
            toolName: 'propose_send_inbox_reply',
            summary: 'Message the Garcia booking.',
            forceFail: true,
            forceFailMessage: 'Could not reach the inbox thread. Try again from Inbox.',
          }),
        ],
      }),
    ]);
    await installAssistantConfirmMocks(page);
    await openAssistantPanel(page);
    await sendAssistantMessage(
      page,
      'Block Dec 24-26 and message the Garcia booking to let them know.'
    );

    const panel = page.getByRole('dialog', { name: 'AI Assistant' });
    await expect(panel.getByText('2 steps to review')).toBeVisible({ timeout: 15_000 });
    await panel.getByRole('button', { name: 'Approve selected (2)' }).click();

    await expect(panel.getByText('Partly failed')).toBeVisible({ timeout: 15_000 });
    await expect(
      panel.getByText('Could not reach the inbox thread. Try again from Inbox.', { exact: false })
    ).toBeVisible();
    await expect(
      panel.getByText('Block Dec 24-26 on Azure North 1204.', { exact: false })
    ).toBeVisible();
  });

  test('Cancel denies the whole plan without executing any step', async ({ page }) => {
    queueAssistantChatBlocks([
      actionPlanBlock({
        planId: 'plan-e2e-004',
        steps: [
          actionPlanStep({
            stepId: 'step-1',
            stepIndex: 0,
            toolName: 'propose_block_property_dates',
            summary: 'Block Dec 24-26 on Azure North 1204.',
          }),
        ],
      }),
    ]);
    await installAssistantConfirmMocks(page);
    await openAssistantPanel(page);
    await sendAssistantMessage(page, 'Block Dec 24-26.');

    const panel = page.getByRole('dialog', { name: 'AI Assistant' });
    await expect(panel.getByText('1 step to review')).toBeVisible({ timeout: 15_000 });
    await panel.getByRole('button', { name: 'Cancel' }).click();

    await expect(panel.getByText('Cancelled')).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByRole('button', { name: /Approve selected/ })).toHaveCount(0);
  });
});
