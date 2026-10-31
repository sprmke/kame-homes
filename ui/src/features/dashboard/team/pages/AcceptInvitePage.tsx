import { useCallback, useMemo, useState } from 'react';

import { useNavigate, useSearchParams } from 'react-router-dom';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';
import { isPlatformSeedMediaUrl } from '@/features/dashboard/lib/storedMediaDisplay';
import { ORGANIZATIONS_QUERY_KEY } from '@/features/dashboard/org/hooks/useOrganizations';
import {
  getLastPropertySlug,
  orgDashboardPath,
  parkingDashboardPath,
  propertyDashboardPath,
  setLastParkingContext,
  setLastTenantContext,
} from '@/features/dashboard/org/lib/tenantPaths';
import { ORG_ACCESS_QUERY_KEY } from '@/features/dashboard/team/hooks/useOrgPermissions';
import { ORG_TEAM_QUERY_KEY } from '@/features/dashboard/team/hooks/useOrgTeam';
import { PARKING_ACCESS_QUERY_KEY } from '@/features/dashboard/team/hooks/useParkingPermissions';
import { PARKING_TEAM_QUERY_KEY } from '@/features/dashboard/team/hooks/useParkingTeam';
import { PROPERTY_ACCESS_QUERY_KEY } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import { PROPERTY_TEAM_QUERY_KEY } from '@/features/dashboard/team/hooks/usePropertyTeam';
import {
  acceptOrgInvite,
  acceptParkingInvite,
  acceptPropertyInvite,
  fetchTeamInvitePreview,
  type TeamInvitePreview,
} from '@/features/dashboard/team/lib/acceptInviteApi';

import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { TeamLogoMark } from '@/components/branding/TeamLogoMark';
import { RouteGuardSkeleton } from '@/components/skeletons/AdminSkeletons';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { supabase } from '@/lib/supabase/client';

function resolveInviteLogoUrl(logoUrl: string): string | null {
  const trimmed = logoUrl.trim();
  if (!trimmed || isPlatformSeedMediaUrl(trimmed)) return null;
  return trimmed;
}

function acceptInvitePath(token: string, scope?: string | null) {
  const params = new URLSearchParams({ token });
  if (scope === 'org') params.set('scope', 'org');
  if (scope === 'parking') params.set('scope', 'parking');
  if (scope === 'property') params.set('scope', 'property');
  return `/accept-invite?${params.toString()}`;
}

function AcceptInviteBrandHeader({ preview }: { preview: TeamInvitePreview }) {
  const logoUrl = resolveInviteLogoUrl(preview.logoUrl);

  return (
    <div className="relative mb-6 pt-12 text-center">
      <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
        <div className="bg-card shadow-elevated ring-card rounded-full p-1 ring-4">
          <TeamLogoMark
            src={logoUrl}
            name={preview.orgName}
            alt={preview.orgName}
            className="size-20 rounded-full shadow-none sm:size-[88px]"
            initialsClassName="text-2xl sm:text-3xl"
          />
        </div>
      </div>
      <p className="section-eyebrow mb-2">Team invitation</p>
      <h1 className="text-foreground text-lg font-bold tracking-tight sm:text-xl">
        {preview.orgName}
      </h1>
      {preview.kind === 'property' ? (
        <p className="text-muted-foreground mt-1 text-sm">{preview.propertyLocation}</p>
      ) : null}
      {preview.kind === 'parking' ? (
        <p className="text-muted-foreground mt-1 text-sm">{preview.parkingLocation}</p>
      ) : null}
    </div>
  );
}

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = params.get('token')?.trim() ?? '';
  const inviteScope = params.get('scope');
  const { status, email, signOut } = useAdminSession();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const redirectPath = useMemo(
    () => (token ? acceptInvitePath(token, inviteScope) : '/accept-invite'),
    [token, inviteScope]
  );

  const {
    data: preview,
    isLoading: previewLoading,
    error: previewError,
  } = useQuery({
    queryKey: ['team-invite-preview', token, inviteScope],
    queryFn: () => fetchTeamInvitePreview(token, inviteScope),
    enabled: Boolean(token),
    retry: false,
  });

  const runAccept = useCallback(async () => {
    if (inviteScope === 'org') {
      return acceptOrgInvite(token);
    }
    if (inviteScope === 'parking') {
      return acceptParkingInvite(token);
    }
    if (inviteScope === 'property') {
      return acceptPropertyInvite(token);
    }
    try {
      return await acceptPropertyInvite(token);
    } catch (propertyError) {
      try {
        return await acceptParkingInvite(token);
      } catch {
        try {
          return await acceptOrgInvite(token);
        } catch {
          throw propertyError;
        }
      }
    }
  }, [inviteScope, token]);

  const handleAccept = useCallback(async () => {
    setAccepting(true);
    setError(null);
    try {
      const result = await runAccept();
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY }),
        queryClient.invalidateQueries({
          queryKey: ORG_ACCESS_QUERY_KEY(result.orgSlug),
        }),
        queryClient.invalidateQueries({
          queryKey: [...ORG_TEAM_QUERY_KEY, result.orgSlug],
        }),
      ];
      if (result.kind === 'property') {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: PROPERTY_ACCESS_QUERY_KEY(result.propertyId),
          }),
          queryClient.invalidateQueries({
            queryKey: [...PROPERTY_TEAM_QUERY_KEY, result.propertyId],
          })
        );
      }
      if (result.kind === 'parking') {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: PARKING_ACCESS_QUERY_KEY(result.parkingId),
          }),
          queryClient.invalidateQueries({
            queryKey: [...PARKING_TEAM_QUERY_KEY, result.parkingId],
          })
        );
      }
      await Promise.all(invalidations);
      setDone(true);
      if (result.kind === 'org') {
        setLastTenantContext(result.orgSlug, getLastPropertySlug() ?? '');
        toast.success(`Joined ${result.orgName}`);
        navigate(orgDashboardPath(result.orgSlug), { replace: true });
        return;
      }
      if (result.kind === 'parking') {
        setLastParkingContext(result.orgSlug, result.parkingSlug);
        toast.success(`Joined ${result.parkingName}`);
        navigate(parkingDashboardPath(result.orgSlug, result.parkingSlug), { replace: true });
        return;
      }
      setLastTenantContext(result.orgSlug, result.propertySlug);
      toast.success(`Joined ${result.propertyName}`);
      navigate(propertyDashboardPath(result.orgSlug, result.propertySlug), {
        replace: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not accept invitation.';
      setError(message);
      setAccepting(false);
    }
  }, [navigate, queryClient, runAccept]);

  const handleGoogle = async () => {
    if (!token) return;
    setIsSigningIn(true);
    setError(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${redirectPath}`,
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setIsSigningIn(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
      setIsSigningIn(false);
    }
  };

  const handleSwitchAccount = async () => {
    setError(null);
    try {
      await signOut();
    } catch (err) {
      toast.error(friendlyToastError(err, 'Could not sign out.'));
    }
  };

  if (!token) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center px-4">
        <div className="border-border bg-card w-full max-w-[min(calc(100vw-1.5rem),24rem)] rounded-xl border p-6 text-center">
          <AlertCircle className="text-destructive mx-auto mb-3 size-8" aria-hidden />
          <p className="text-muted-foreground text-sm">This invitation link is invalid.</p>
        </div>
      </div>
    );
  }

  if (previewLoading) {
    return <RouteGuardSkeleton fullScreen />;
  }

  if (previewError || !preview) {
    const message =
      previewError instanceof Error ? previewError.message : 'This invitation link is invalid.';
    return (
      <div className="bg-background flex min-h-screen items-center justify-center px-4">
        <div className="border-border bg-card w-full max-w-[min(calc(100vw-1.5rem),24rem)] rounded-xl border p-6 text-center">
          <AlertCircle className="text-destructive mx-auto mb-3 size-8" aria-hidden />
          <p className="text-muted-foreground text-sm">{message}</p>
        </div>
      </div>
    );
  }

  if (status === 'loading' || accepting || done) {
    return (
      <div className="bg-background flex min-h-screen flex-col items-center justify-center px-4">
        <AcceptInviteBrandHeader preview={preview} />
        <div
          className="w-full max-w-xs space-y-2"
          aria-busy="true"
          aria-label="Accepting invitation"
        >
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="mx-auto h-3 w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background relative flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="border-border bg-card w-full max-w-[min(calc(100vw-1.5rem),24rem)] rounded-xl border p-6 pt-8 sm:p-8">
        <AcceptInviteBrandHeader preview={preview} />

        <h2 className="text-foreground text-base font-semibold tracking-tight">Accept invite</h2>

        {error ? (
          <div className="mt-4 space-y-3">
            <div className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2.5 rounded-xl border p-3.5">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="text-[13px] leading-snug">{error}</p>
            </div>
            {status === 'admin' ? (
              <Button
                className="min-h-[44px] w-full"
                onClick={() => void handleAccept()}
                disabled={accepting}
              >
                Try again
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {status === 'signed-out' ? (
            <GoogleSignInButton
              onClick={handleGoogle}
              loading={isSigningIn}
              disabled={isSigningIn}
            />
          ) : (
            <>
              <p className="text-muted-foreground text-sm">Signed in as {email}</p>
              <Button
                className="min-h-[44px] w-full"
                onClick={() => void handleAccept()}
                disabled={accepting}
              >
                Accept
              </Button>
              <button
                type="button"
                onClick={handleSwitchAccount}
                className="border-border text-foreground hover:bg-muted min-h-[44px] w-full rounded-xl border px-4 text-sm font-medium transition-colors"
              >
                Use a different Google account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
