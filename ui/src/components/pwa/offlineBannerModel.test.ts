import { describe, expect, it } from 'vitest';

import { offlineBannerModel } from '@/components/pwa/offlineBannerModel';

describe('offlineBannerModel', () => {
  it('hides a syncing flag when nothing is queued', () => {
    expect(
      offlineBannerModel({ status: 'online', pendingCount: 0, failedCount: 0, syncing: true })
    ).toEqual({ visible: false, interactive: false, label: '' });
  });

  it('shows a count while real changes are syncing', () => {
    expect(
      offlineBannerModel({ status: 'online', pendingCount: 2, failedCount: 0, syncing: true })
    ).toMatchObject({ visible: true, interactive: true, label: 'Syncing 2' });
  });

  it('stays available offline even with an empty outbox', () => {
    expect(
      offlineBannerModel({ status: 'offline', pendingCount: 0, failedCount: 0, syncing: false })
    ).toMatchObject({ visible: true, interactive: false, label: 'Offline. Showing saved data' });
  });
});
