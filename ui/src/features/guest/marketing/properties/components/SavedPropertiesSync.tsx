import { useEffect } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { useGuestAuth } from '@/features/guest/auth/context/GuestAuthContext';
import { useSavePropertyMutation } from '@/features/guest/marketing/properties/hooks/useSavePropertyMutation';
import { savedPropertiesQueryKeys } from '@/features/guest/marketing/properties/lib/savedPropertiesQueryKeys';

/** Clears wishlist cache on sign-out and resumes save after OAuth. */
export function SavedPropertiesSync() {
  const queryClient = useQueryClient();
  const { status, savePropertyResumeTick, savePropertyResumeSlug } = useGuestAuth();
  const { mutateAsync } = useSavePropertyMutation();

  useEffect(() => {
    if (status === 'anonymous') {
      queryClient.removeQueries({ queryKey: savedPropertiesQueryKeys.all });
    }
  }, [status, queryClient]);

  useEffect(() => {
    if (status !== 'authenticated' || !savePropertyResumeSlug || savePropertyResumeTick === 0) {
      return;
    }

    const slug = savePropertyResumeSlug.trim();
    if (!slug) return;

    void mutateAsync({ propertySlug: slug, saved: true }).catch(() => {
      /* toast handled in mutation */
    });
  }, [status, savePropertyResumeSlug, savePropertyResumeTick, mutateAsync]);

  return null;
}
