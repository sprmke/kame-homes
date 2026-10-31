import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  fetchGuestProfile,
  GUEST_PROFILE_QUERY_KEY,
  patchGuestProfile,
  uploadGuestProfileAvatar,
  type GuestProfilePatch,
} from '@/features/guest/account/lib/guestAccountApi';
import { useGuestSession } from '@/features/guest/auth/hooks/useGuestSession';

export function useGuestProfile(options?: { enabled?: boolean }) {
  const { status } = useGuestSession();
  const enabled = (options?.enabled ?? true) && status === 'authenticated';

  return useQuery({
    queryKey: GUEST_PROFILE_QUERY_KEY,
    queryFn: fetchGuestProfile,
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useGuestProfileMutations() {
  const queryClient = useQueryClient();

  const updateProfile = useMutation({
    mutationFn: (patch: GuestProfilePatch) => patchGuestProfile(patch),
    onSuccess: (data) => {
      queryClient.setQueryData(GUEST_PROFILE_QUERY_KEY, data);
      toast.success('Saved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not save profile.');
    },
  });

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => uploadGuestProfileAvatar(file),
    onSuccess: async (result) => {
      await patchGuestProfile({ avatarUrl: result.avatarUrl });
      await queryClient.invalidateQueries({ queryKey: GUEST_PROFILE_QUERY_KEY });
      toast.success('Photo updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not upload photo.');
    },
  });

  return { updateProfile, uploadAvatar };
}
