import { useCallback, useMemo } from 'react';

import { useLocation, useSearchParams } from 'react-router-dom';

import {
  NOTIFICATIONS_HUB_VIEW_PARAM,
  resolveNotificationsHubView,
  type NotificationsHubView,
} from '@/features/dashboard/notifications/lib/notificationsPaths';

export type NotificationsHubController = {
  view: NotificationsHubView;
  setView: (view: NotificationsHubView) => void;
};

type Options = {
  /** Tenant-validated `?module=` value, so an unknown module does not force the Telegram view. */
  module: string | null;
};

/**
 * `?view=` state for the Notifications hub tabs, with the legacy `?section=` /
 * `#section-activity` and `?module=` deep links still landing on the right view.
 *
 * Switching replaces the entry so Back leaves the page instead of walking the
 * tabs the host just clicked through.
 */
export function useNotificationsHubView({ module }: Options): NotificationsHubController {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const view = useMemo(
    () =>
      resolveNotificationsHubView({
        view: searchParams.get(NOTIFICATIONS_HUB_VIEW_PARAM),
        module,
        section: searchParams.get('section'),
        hash: location.hash,
      }),
    [searchParams, module, location.hash]
  );

  const setView = useCallback(
    (next: NotificationsHubView) => {
      const params = new URLSearchParams(searchParams);
      params.set(NOTIFICATIONS_HUB_VIEW_PARAM, next);
      /* Drop the legacy deep-link params so they cannot fight the explicit view. */
      params.delete('section');
      if (next !== 'telegram') params.delete('module');
      setSearchParams(params, { replace: true, preventScrollReset: true });
    },
    [searchParams, setSearchParams]
  );

  return { view, setView };
}
