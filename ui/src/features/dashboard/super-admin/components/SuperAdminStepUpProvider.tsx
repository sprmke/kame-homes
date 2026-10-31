import { type ReactNode, useEffect, useRef, useState } from 'react';

import { registerSuperAdminStepUp } from '@/features/dashboard/org/lib/edgeClient';
import { SuperAdminOtpDialog } from '@/features/dashboard/super-admin/components/SuperAdminOtpDialog';

type PendingRequest = { action?: string; message?: string };

/**
 * Bridges the edge client's step-up hook to a rendered OTP dialog. Any gated `/admin/*`
 * mutation that comes back with `SUPERADMIN_OTP_REQUIRED` pauses here until the super admin
 * verifies (or cancels); the original request is then retried once by the edge client.
 * Concurrent 401s share a single dialog.
 */
export function SuperAdminStepUpProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<PendingRequest | null>(null);
  const resolvers = useRef<((verified: boolean) => void)[]>([]);

  useEffect(() => {
    registerSuperAdminStepUp(
      (ctx) =>
        new Promise<boolean>((resolve) => {
          resolvers.current.push(resolve);
          setRequest((current) => current ?? { action: ctx.action, message: ctx.message });
        })
    );
    return () => registerSuperAdminStepUp(null);
  }, []);

  const settle = (verified: boolean) => {
    const pending = resolvers.current;
    resolvers.current = [];
    setRequest(null);
    pending.forEach((resolve) => resolve(verified));
  };

  return (
    <>
      {children}
      <SuperAdminOtpDialog
        open={request !== null}
        gatedAction={request?.action}
        onCancel={() => settle(false)}
        onVerified={() => settle(true)}
      />
    </>
  );
}
