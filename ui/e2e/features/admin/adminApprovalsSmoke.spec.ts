import { expect, test } from '@playwright/test';

import { installAdminApprovalsMocks, mockPendingOrgApproval } from './shared/adminApprovalsHarness';

test.describe('@ci super admin approvals', () => {
  test('approvals queue shell renders with mocked pending row', async ({ page }) => {
    await installAdminApprovalsMocks(page);
    const listReady = page.waitForResponse(
      (res) =>
        res.url().includes('/functions/v1/list-super-admin-approvals') &&
        !res.url().includes('summary=true') &&
        res.ok()
    );
    await page.goto('/admin/approvals');
    await listReady;
    await expect(page.getByRole('heading', { name: 'Approvals' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByPlaceholder(/Search approvals/i)).toBeVisible();
    await expect(page.getByText(mockPendingOrgApproval.organizationName)).toBeVisible();
  });
});
