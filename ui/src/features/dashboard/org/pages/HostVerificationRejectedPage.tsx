import { Link } from 'react-router-dom';

import { ShieldX } from 'lucide-react';

import { RequireAdminSignOutButton } from '@/features/dashboard/bookings/components/RequireAdmin';

import { Button } from '@/components/ui/button';

type Props = {
  organizationName?: string | null;
  rejectionReason?: string | null;
};

/**
 * Shown when Tier 1 host verification was hard-rejected (`kind: rejected`).
 * Access to the org dashboard is blocked; host may start a new application.
 */
export function HostVerificationRejectedPage({ organizationName, rejectionReason }: Props) {
  const reason = rejectionReason?.trim() || null;

  return (
    <div className="bg-background flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <div
        className="border-border bg-card w-full max-w-[min(calc(100vw-1.5rem),28rem)] rounded-xl border p-6 text-center sm:p-8"
        role="alert"
      >
        <ShieldX className="text-destructive mx-auto mb-4 size-10" aria-hidden />
        <h1 className="text-foreground text-lg font-semibold tracking-tight">
          Verification declined
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {organizationName
            ? `We're sorry. ${organizationName} did not pass host verification, so this account no longer has access to the platform.`
            : "We're sorry. This account did not pass host verification, so it no longer has access to the platform."}
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          To try again, start a new application and submit clear, complete documents that meet our
          requirements.
        </p>
        {reason ? (
          <div className="border-destructive/20 bg-destructive/5 mt-5 rounded-lg border px-3.5 py-3 text-left">
            <p className="text-destructive text-[11px] font-semibold uppercase tracking-wide">
              Reason
            </p>
            <p className="text-foreground mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
              {reason}
            </p>
          </div>
        ) : null}
        <div className="mt-6 space-y-2">
          <Button asChild className="min-h-[44px] w-full">
            <Link to="/onboarding">Start a new application</Link>
          </Button>
          <RequireAdminSignOutButton />
        </div>
      </div>
    </div>
  );
}
