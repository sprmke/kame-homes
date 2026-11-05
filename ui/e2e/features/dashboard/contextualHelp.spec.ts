import { expect, test } from '@playwright/test';

import {
  installPropertyTeamRbacMocks,
  teamRbacPaths,
} from '../team/shared/propertyTeamRbacHarness';

/**
 * Contextual help behavior on a real settings surface. P0 wires every existing
 * `FieldLabel` hint through `InfoHint`, so this covers the touch bug that made
 * the `?` affordance unusable on phones and tablets.
 */
const PROPERTY_NAME_HINT = 'About Property Name';

test.describe('@ci contextual help', () => {
  test.beforeEach(async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
  });

  test('opens on hover, pins on click, and closes with Esc', async ({ page }) => {
    await page.goto(teamRbacPaths.settings);

    const trigger = page.getByRole('button', { name: PROPERTY_NAME_HINT });
    await expect(trigger).toBeVisible();

    const triggerBoxBefore = await trigger.boundingBox();
    const nameInputBoxBefore = await page.locator('#property-name').boundingBox();

    await trigger.hover();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toContainText('This is the name guests will see');

    // The hint must not grow the label row or move the field.
    const triggerBoxAfter = await trigger.boundingBox();
    const nameInputBoxAfter = await page.locator('#property-name').boundingBox();
    expect(triggerBoxAfter?.y).toBeCloseTo(triggerBoxBefore?.y ?? 0, 1);
    expect(triggerBoxAfter?.height).toBeCloseTo(triggerBoxBefore?.height ?? 0, 1);
    expect(nameInputBoxAfter?.y).toBeCloseTo(nameInputBoxBefore?.y ?? 0, 1);

    await trigger.click();
    await expect(tooltip).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(tooltip).toHaveCount(0);
  });

  test('keyboard opens with Enter and closes with Esc', async ({ page }) => {
    await page.goto(teamRbacPaths.settings);

    const trigger = page.getByRole('button', { name: PROPERTY_NAME_HINT });
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('tooltip')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  });

  test('clicking a hint inside the form does not submit it', async ({ page }) => {
    await page.goto(teamRbacPaths.settings);

    const trigger = page.getByRole('button', { name: PROPERTY_NAME_HINT });
    await expect(trigger).toBeVisible();

    const saveButton = page.getByRole('button', { name: 'Save Changes' });
    await expect(saveButton).toBeVisible();

    await trigger.click();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await expect(page).toHaveURL(new RegExp('/settings$'));

    // The form is still in edit mode, not mid-submit or reset.
    await expect(trigger).toBeVisible();
    await expect(saveButton).toBeVisible();
  });
});

test.describe('@smoke contextual help on touch', () => {
  test.use({ hasTouch: true });

  test('opens on tap and closes on an outside tap', async ({ page }) => {
    await installPropertyTeamRbacMocks(page, 'full_access');
    await page.goto(teamRbacPaths.settings);

    const trigger = page.getByRole('button', { name: PROPERTY_NAME_HINT });
    await expect(trigger).toBeVisible();

    await trigger.tap();
    await expect(page.getByRole('tooltip')).toContainText('This is the name guests will see');

    // The panel stays inside the viewport and never runs off either edge.
    const viewportWidth = page.viewportSize()?.width ?? 0;
    const tooltipBox = await page.getByRole('tooltip').boundingBox();
    expect(tooltipBox?.x ?? 0).toBeGreaterThanOrEqual(0);
    expect((tooltipBox?.x ?? 0) + (tooltipBox?.width ?? 0)).toBeLessThanOrEqual(viewportWidth + 1);

    await page.getByRole('heading', { level: 1 }).first().tap();

    await expect(page.getByRole('tooltip')).toHaveCount(0);
  });
});
