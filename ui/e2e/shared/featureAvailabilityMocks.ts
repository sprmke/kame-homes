import type { Page } from '@playwright/test';

import { mockEdgeFunctions } from './interceptEdge';

type MockEntry = {
  key: string;
  available?: boolean;
  reason?: string;
  message?: string;
  source?: 'self' | 'parent';
};

export function featureAvailabilityBody(entries: MockEntry[]) {
  const now = new Date().toISOString();
  return {
    success: true,
    data: {
      serverNow: now,
      entries: entries.map((entry) => ({
        key: entry.key,
        available: entry.available ?? false,
        bypassed: false,
        reason: entry.reason ?? 'maintenance',
        message: entry.message ?? "We're working on this right now. It'll be back soon.",
        expectedBackAt: null,
        source: entry.source ?? 'self',
        showBanner: true,
        updatedAt: now,
      })),
    },
  };
}

/** Register after property/org harness mocks so this handler runs first and falls through otherwise. */
export async function mockFeatureAvailability(page: Page, offKeys: string[]) {
  await mockEdgeFunctions(page, [
    {
      name: 'get-feature-availability',
      body: featureAvailabilityBody(offKeys.map((key) => ({ key }))),
    },
  ]);
}
