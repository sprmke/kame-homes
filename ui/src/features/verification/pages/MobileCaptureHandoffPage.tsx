import { useParams } from 'react-router-dom';

import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { usePageTitle } from '@/lib/pageTitle';

import { IdentityCaptureFlow } from '../components/IdentityCaptureFlow';
import { useIdentitySessionOnce } from '../hooks/useIdentitySession';

/**
 * `/verify/:sessionToken` — the phone's page after scanning the desktop QR.
 *
 * Standalone by design: no bottom tab bar, no marketing shell. Same call as
 * `PayParkingPage`: one job, one screen, dismiss when done.
 */
export function MobileCaptureHandoffPage() {
  const { sessionToken = '' } = useParams<{ sessionToken: string }>();
  usePageTitle('Verify your ID');

  const session = useIdentitySessionOnce(sessionToken || null);

  const expired =
    session.data?.expired === true ||
    session.data?.status === 'expired' ||
    session.data?.status === 'failed';

  return (
    <div className="bg-muted/30 min-h-dvh">
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="text-primary h-5 w-5" aria-hidden />
          <span className="text-sm font-semibold">Identity check</span>
        </div>

        <Card>
          <CardContent className="p-4">
            {session.isLoading && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Loader2 className="text-primary h-6 w-6 animate-spin" aria-hidden />
                <p className="text-muted-foreground text-sm">Opening</p>
              </div>
            )}

            {session.isError && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <AlertCircle className="text-destructive h-6 w-6" aria-hidden />
                <p className="text-sm font-medium">This link is not valid</p>
                <p className="text-muted-foreground text-xs">
                  Start again on your computer and scan the new QR code.
                </p>
              </div>
            )}

            {session.data && expired && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <AlertCircle className="text-destructive h-6 w-6" aria-hidden />
                <p className="text-sm font-medium">This link expired</p>
                <p className="text-muted-foreground text-xs">
                  Start again on your computer and scan the new QR code.
                </p>
              </div>
            )}

            {session.data && !expired && session.data.status === 'completed' && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <ShieldCheck className="h-7 w-7 text-emerald-500" aria-hidden />
                <p className="text-sm font-semibold">Already done</p>
                <p className="text-muted-foreground text-xs">You can close this page.</p>
              </div>
            )}

            {session.data && !expired && session.data.status !== 'completed' && (
              <IdentityCaptureFlow
                token={sessionToken}
                subjectKind={session.data.subjectKind}
                onComplete={() => {
                  session.refetch().catch(() => {});
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
