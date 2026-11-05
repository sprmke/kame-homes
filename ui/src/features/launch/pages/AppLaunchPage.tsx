import { useEffect, useRef, useState } from 'react';

import { Navigate, useSearchParams } from 'react-router-dom';

import { resolvePostSignInPath } from '@/features/dashboard/org/lib/postSignInRouting';
import {
  getLastOrgSlug,
  getLastParkingSlug,
  getLastPropertySlug,
  getLastTenantKind,
} from '@/features/dashboard/org/lib/tenantPaths';

import {
  decideSignedInLaunch,
  decideSignedOutLaunch,
  parseLaunchShortcut,
  type LaunchDecision,
} from '@/features/launch/lib/launchRouting';

import { PageLoadingFallback } from '@/components/routing/RouteFallback';
import { manilaTodayIso } from '@/lib/date/manilaPeriod';
import { hasHostInstall, markHostInstall, recordSession } from '@/lib/pwa/installMemory';
import { pwaTelemetry } from '@/lib/pwa/pwaTelemetry';
import { supabase } from '@/lib/supabase/client';

type OrgRow = {
  slug: string;
  accessKind?: string;
  hostModes?: string[];
  settings?: Record<string, unknown>;
  planLimited?: boolean;
};

type OrgCapabilities = {
  organizations: OrgRow[];
  isSuperAdmin?: boolean;
};

/** Last tenant this device opened — the offline cold-start fallback. */
function lastKnownDashboardPath(): string | null {
  const orgSlug = getLastOrgSlug();
  const kind = getLastTenantKind();
  if (!orgSlug || !kind) return null;
  if (kind === 'parking') {
    const slug = getLastParkingSlug();
    return slug ? `/org/${orgSlug}/parking/${slug}` : null;
  }
  const slug = getLastPropertySlug();
  return slug ? `/org/${orgSlug}/property/${slug}` : null;
}

/**
 * `/app` — the launch resolver.
 *
 * Manifest `start_url`, every manifest shortcut, and the installed-app re-open all
 * land here so the destination is decided once, with the session, in one place.
 *
 * Renders no UI of its own beyond the loading state; it always ends in a
 * `<Navigate>` (or an offline notice when there is nothing to show).
 */
export function AppLaunchPage() {
  const [searchParams] = useSearchParams();
  const shortcut = parseLaunchShortcut(searchParams.get('shortcut'));
  const source = searchParams.get('source');
  const [decision, setDecision] = useState<LaunchDecision | null>(null);
  const [offlineFallback, setOfflineFallback] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      recordSession();

      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        setDecision(decideSignedOutLaunch(shortcut, source, hasHostInstall()));
        return;
      }

      try {
        const { callEdgeFunction } = await import('@/features/dashboard/org/lib/edgeClient');
        const capabilities = await callEdgeFunction<OrgCapabilities>('list-organizations');
        const organizations = capabilities.organizations ?? [];
        const hasOrganization = organizations.length > 0;
        if (hasOrganization) markHostInstall();

        const resolvedHostPath = hasOrganization ? await resolvePostSignInPath('/org') : null;
        setDecision(
          decideSignedInLaunch({
            viewer: {
              hasOrganization,
              isSuperAdmin: capabilities.isSuperAdmin === true,
            },
            resolvedHostPath,
            shortcut,
            todayIso: manilaTodayIso(),
          })
        );
      } catch {
        // Session invalid, network down, or the edge function is unavailable.
        // An installed host app must still open its last dashboard rather than a
        // blank screen; everything else falls back to the public landing.
        const last = lastKnownDashboardPath();
        if (last && (navigator.onLine === false || hasHostInstall())) {
          pwaTelemetry('launch-offline-fallback');
          setDecision({ kind: 'navigate', path: last });
          setOfflineFallback(true);
          return;
        }
        if (navigator.onLine === false) {
          setOfflineFallback(true);
          return;
        }
        // A signed-in session the server rejected: treat it as signed out but keep
        // the host-login return path so the next sign-in resumes the launch.
        setDecision(decideSignedOutLaunch(shortcut, source, true));
      }
    })();
  }, [shortcut, source]);

  if (decision) return <Navigate to={decision.path} replace />;

  if (offlineFallback) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-6 text-center">
        <p className="text-muted-foreground text-sm">
          You&apos;re offline. Open the app again when you have a connection.
        </p>
      </div>
    );
  }

  return <PageLoadingFallback />;
}
