export type OfflineBannerStatus = 'online' | 'offline' | 'degraded';

export type OfflineBannerModel = {
  visible: boolean;
  /** Opens the sync list. Only when something is actually queued or failed. */
  interactive: boolean;
  label: string;
};

/**
 * The strip is for connectivity and queued changes. A background drain of an
 * empty outbox is not a control: that state was a "Syncing" pill whose sheet
 * had nothing to show.
 */
export function offlineBannerModel(input: {
  status: OfflineBannerStatus;
  pendingCount: number;
  failedCount: number;
  syncing: boolean;
}): OfflineBannerModel {
  const { status, pendingCount, failedCount, syncing } = input;
  const hasQueue = pendingCount > 0 || failedCount > 0;

  let label = '';
  if (status === 'offline') {
    label =
      pendingCount > 0
        ? `Offline. ${pendingCount} change${pendingCount === 1 ? '' : 's'} saved`
        : 'Offline. Showing saved data';
  } else if (status === 'degraded') {
    label = 'No internet. Retrying';
  } else if (failedCount > 0) {
    label = `${failedCount} change${failedCount === 1 ? '' : 's'} failed`;
  } else if (syncing && pendingCount > 0) {
    label = `Syncing ${pendingCount}`;
  } else if (pendingCount > 0) {
    label = `${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to sync`;
  }

  return {
    visible: status !== 'online' || hasQueue,
    interactive: hasQueue,
    label,
  };
}
