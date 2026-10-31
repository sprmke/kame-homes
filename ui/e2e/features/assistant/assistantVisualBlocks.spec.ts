import { expect, test } from '@playwright/test';

import {
  installAssistantConfirmMocks,
  openAssistantPanel,
  queueAssistantChatBlocks,
  sendAssistantMessage,
} from './shared/assistantConfirmHarness';

test.describe('AI assistant visual blocks @ci', () => {
  test('chart, calendar, and carousel render at 375px', async ({ page }) => {
    queueAssistantChatBlocks([
      { type: 'text', text: 'October occupancy is up versus last month.' },
      {
        type: 'chart',
        title: 'Occupancy',
        kind: 'bar',
        series: [
          {
            name: 'occupancy',
            points: [
              { x: 'Jul', y: 62 },
              { x: 'Aug', y: 71 },
              { x: 'Sep', y: 68 },
              { x: 'Oct', y: 80 },
            ],
          },
        ],
        tableAlt: {
          columns: ['Month', 'Occupancy'],
          rows: [
            { Month: 'Jul', Occupancy: 62 },
            { Month: 'Aug', Occupancy: 71 },
            { Month: 'Sep', Occupancy: 68 },
            { Month: 'Oct', Occupancy: 80 },
          ],
        },
      },
      {
        type: 'calendar',
        title: 'October',
        month: '2026-10',
        days: [
          { date: '2026-10-01', state: 'available' },
          { date: '2026-10-02', state: 'booked' },
          { date: '2026-10-03', state: 'blocked' },
        ],
        legend: [
          { state: 'available', label: 'Open' },
          { state: 'booked', label: 'Booked' },
        ],
      },
      {
        type: 'carousel',
        title: 'Templates',
        items: [
          {
            type: 'entity_card',
            entityType: 'marketing_template',
            id: 'tpl-1',
            title: 'Weekend promo',
            subtitle: 'Design',
            facts: [{ label: 'Platform', value: 'Instagram' }],
          },
          {
            type: 'entity_card',
            entityType: 'marketing_template',
            id: 'tpl-2',
            title: 'Holiday calendar',
            subtitle: 'Calendar',
            facts: [{ label: 'Platform', value: 'Facebook' }],
          },
        ],
      },
    ]);
    await installAssistantConfirmMocks(page);
    await openAssistantPanel(page);
    await sendAssistantMessage(page, 'Show occupancy, October, and templates.');

    const panel = page.getByRole('dialog', { name: 'AI Assistant' });
    await expect(panel.getByTestId('assistant-chart-block')).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByTestId('assistant-calendar-block')).toBeVisible();
    await expect(panel.getByTestId('assistant-carousel-block')).toBeVisible();

    await page.setViewportSize({ width: 375, height: 812 });
    await expect(panel.getByTestId('assistant-chart-block')).toBeVisible();
    await expect(panel.getByTestId('assistant-calendar-block')).toBeVisible();
    await expect(panel.getByTestId('assistant-carousel-block')).toBeVisible();

    const chartBox = await panel.getByTestId('assistant-chart-block').boundingBox();
    expect(chartBox).toBeTruthy();
    expect(chartBox!.width).toBeGreaterThan(240);
    expect(chartBox!.width).toBeLessThanOrEqual(375);
  });
});
