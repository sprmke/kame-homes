import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  savePropertySlug,
  unsavePropertySlug,
} from '@/features/guest/marketing/properties/lib/savedPropertiesApi';
import { savedPropertiesQueryKeys } from '@/features/guest/marketing/properties/lib/savedPropertiesQueryKeys';

import { captureAppEvent } from '@/lib/posthog/capture';

type SavePropertyVariables = {
  propertySlug: string;
  saved: boolean;
};

export function useSavePropertyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: savedPropertiesQueryKeys.all,
    mutationFn: async ({ propertySlug, saved }: SavePropertyVariables) => {
      if (saved) {
        await savePropertySlug(propertySlug);
      } else {
        await unsavePropertySlug(propertySlug);
      }
    },
    onMutate: async ({ propertySlug, saved }) => {
      await queryClient.cancelQueries({ queryKey: savedPropertiesQueryKeys.all });
      const previous = queryClient.getQueryData<string[]>(savedPropertiesQueryKeys.all) ?? [];
      const next = saved
        ? [propertySlug, ...previous.filter((slug) => slug !== propertySlug)]
        : previous.filter((slug) => slug !== propertySlug);
      queryClient.setQueryData(savedPropertiesQueryKeys.all, next);
      return { previous };
    },
    onSuccess: (_data, variables) => {
      captureAppEvent('guest_favorite_toggled', {
        on: variables.saved,
        listing_kind: 'property',
        slug: variables.propertySlug,
      });
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(savedPropertiesQueryKeys.all, context.previous);
      }
      toast.error(error instanceof Error ? error.message : 'Could not update saved property.');
    },
  });
}
