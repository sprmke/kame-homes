import { useCallback } from 'react';

import { useGuestAuth } from '@/features/guest/auth/context/GuestAuthContext';
import { useIsPropertySaved } from '@/features/guest/marketing/properties/hooks/useSavedPropertySlugsQuery';
import { useSavePropertyMutation } from '@/features/guest/marketing/properties/hooks/useSavePropertyMutation';

export function usePropertySave(propertySlug: string) {
  const slug = propertySlug.trim();
  const { requireGuestAuth } = useGuestAuth();
  const saved = useIsPropertySaved(slug);
  const { mutateAsync, isPending, variables } = useSavePropertyMutation();

  const isPendingForSlug = isPending && variables?.propertySlug === slug;

  const toggleSave = useCallback(
    (event?: React.MouseEvent) => {
      event?.preventDefault();
      event?.stopPropagation();
      if (!slug) return;

      const nextSaved = !saved;

      requireGuestAuth(
        () => {
          void mutateAsync({ propertySlug: slug, saved: nextSaved });
        },
        nextSaved ? { resume: { type: 'save_property', propertySlug: slug } } : undefined
      );
    },
    [slug, saved, requireGuestAuth, mutateAsync]
  );

  return {
    isSaved: saved,
    toggleSave,
    isPending: isPendingForSlug,
  };
}
