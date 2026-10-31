import type { Page, Route } from '@playwright/test';

import { seedSupabaseAuthSession } from '../../shared/authSeam';
import { mockEdgeFunctions } from '../../shared/interceptEdge';

import { FEATURE_AVAILABILITY_CATALOG } from '@/lib/featureAvailability/featureAvailabilityCatalog';
import { resolveFeatureAvailability } from '@/lib/featureAvailability/resolveFeatureAvailability';
import type { FeatureAvailabilityOverrideRow } from '@/lib/featureAvailability/resolveFeatureAvailability';

type PutBody = {
  featureKey?: string;
  isEnabled?: boolean;
  reason?: string;
  message?: string | null;
  expectedBackAt?: string | null;
  autoRestore?: boolean;
  showBanner?: boolean;
  superAdminBypass?: boolean;
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export async function installFeatureAvailabilityAdminMocks(page: Page) {
  const overrides: FeatureAvailabilityOverrideRow[] = [];
  const putBodies: PutBody[] = [];

  await seedSupabaseAuthSession(page, 'host');
  await mockEdgeFunctions(page, [
    {
      name: 'list-organizations',
      body: { success: true, data: { organizations: [], isSuperAdmin: true } },
    },
    {
      name: 'feature-availability',
      handler: async (route) => {
        const method = route.request().method();
        if (method === 'GET') {
          const resolved = resolveFeatureAvailability(
            FEATURE_AVAILABILITY_CATALOG,
            overrides,
            new Date()
          );
          await json(route, {
            success: true,
            data: {
              catalog: FEATURE_AVAILABILITY_CATALOG,
              overrides,
              resolved: Object.fromEntries(resolved),
              unusedKeys: [],
            },
          });
          return;
        }
        if (method === 'PUT') {
          const body = JSON.parse(route.request().postData() ?? '{}') as PutBody;
          putBodies.push(body);
          const now = new Date().toISOString();
          const featureKey = body.featureKey ?? '';
          const isEnabled = body.isEnabled === true;
          const row: FeatureAvailabilityOverrideRow & {
            disabled_at: string | null;
            updated_by: string | null;
            updated_at: string;
          } = {
            feature_key: featureKey,
            is_enabled: isEnabled,
            reason: isEnabled ? null : (body.reason ?? 'maintenance'),
            message: isEnabled ? null : (body.message ?? null),
            expected_back_at: isEnabled ? null : (body.expectedBackAt ?? null),
            auto_restore: body.autoRestore ?? false,
            show_banner: body.showBanner ?? false,
            super_admin_bypass: body.superAdminBypass ?? true,
            disabled_at: isEnabled ? null : now,
            updated_by: 'super-admin-e2e',
            updated_at: now,
          };
          const idx = overrides.findIndex((o) => o.feature_key === featureKey);
          if (idx >= 0) overrides[idx] = row;
          else overrides.push(row);
          await json(route, { success: true, data: { override: row } });
          return;
        }
        await route.continue();
      },
    },
  ]);

  return { putBodies, overrides };
}
