/**
 * Mocked assistant confirm-card harness — manual guide §11–13 UI subset (no Gemini).
 */

import { expect, type Page } from '@playwright/test';

import type { ChatBlock } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

import {
  installPropertyTeamRbacMocks,
  openPropertyDashboard,
  queueAssistantChatBlocksForMocks,
  teamRbacPaths,
} from '../../team/shared/propertyTeamRbacHarness';

export function queueAssistantChatBlocks(blocks: ChatBlock[]) {
  queueAssistantChatBlocksForMocks(blocks);
}

export async function installAssistantConfirmMocks(page: Page) {
  await installPropertyTeamRbacMocks(page, 'full_access', { assistantEnabled: true });
}

function assistantDialog(page: Page) {
  return page.getByRole('dialog', { name: 'AI Assistant' });
}

export async function openAssistantPanel(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openPropertyDashboard(page);
  await expect(page.getByRole('button', { name: 'Open AI assistant' })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Open AI assistant' }).click();
  const panel = assistantDialog(page);
  await expect(panel).toBeVisible({ timeout: 20_000 });
  await expect(panel.getByRole('heading', { name: 'AI Assistant' })).toBeVisible({
    timeout: 20_000,
  });
}

export async function sendAssistantMessage(page: Page, message: string) {
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
  await expect(userBubble).toBeVisible({ timeout: 15_000 });
}

export function actionConfirmationBlock(input: {
  actionId: string;
  toolName: string;
  summary: string;
  isExternalSend?: boolean;
  details?: Array<{ label: string; value: string }>;
}): ChatBlock {
  return {
    type: 'action_confirmation',
    actionId: input.actionId,
    toolName: input.toolName,
    riskTier: 'tier2_confirmed',
    summary: input.summary,
    details: input.details ?? [],
    status: 'proposed',
    isExternalSend: input.isExternalSend,
  };
}

export { teamRbacPaths };
