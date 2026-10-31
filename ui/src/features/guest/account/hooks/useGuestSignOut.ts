import { useCallback } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import { toast } from 'sonner';

import { isGuestAccountPath } from '@/features/guest/account/lib/guestAccountPaths';

import { supabase } from '@/lib/supabase/client';

export function useGuestSignOut() {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(async () => {
    const leaveAccountRoute = isGuestAccountPath(location.pathname);

    if (leaveAccountRoute) {
      navigate('/', { replace: true });
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Could not sign out. Please try again.');
      return false;
    }

    return true;
  }, [location.pathname, navigate]);
}
