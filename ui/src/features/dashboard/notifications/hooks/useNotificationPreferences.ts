import { useCallback } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  fetchNotificationPreferences,
  NOTIFICATION_PREFERENCES_QUERY_KEY,
  saveNotificationPreferences,
  type NotificationPreferences,
} from '@/features/dashboard/notifications/lib/notificationPreferences';

/**
 * Instant-save preferences. Toggles have no Save button: each change writes once
 * and the previous value comes back if the request fails.
 */
export function useNotificationPreferences() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY,
    queryFn: fetchNotificationPreferences,
    staleTime: 5 * 60_000,
  });

  const save = useMutation({
    mutationFn: saveNotificationPreferences,
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY });
      const previous = qc.getQueryData<NotificationPreferences>(NOTIFICATION_PREFERENCES_QUERY_KEY);
      qc.setQueryData(NOTIFICATION_PREFERENCES_QUERY_KEY, next);
      return { previous };
    },
    onError: (err, _next, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(NOTIFICATION_PREFERENCES_QUERY_KEY, ctx.previous);
      }
      toast.error(err instanceof Error ? err.message : "Couldn't save preferences.");
    },
    onSuccess: (saved) => {
      qc.setQueryData(NOTIFICATION_PREFERENCES_QUERY_KEY, saved);
    },
  });

  const update = useCallback(
    (patch: Partial<NotificationPreferences>) => {
      const current =
        qc.getQueryData<NotificationPreferences>(NOTIFICATION_PREFERENCES_QUERY_KEY) ??
        DEFAULT_NOTIFICATION_PREFERENCES;
      save.mutate({ ...current, ...patch });
    },
    [qc, save]
  );

  return {
    preferences: query.data ?? DEFAULT_NOTIFICATION_PREFERENCES,
    loading: query.isPending,
    saving: save.isPending,
    update,
  };
}
