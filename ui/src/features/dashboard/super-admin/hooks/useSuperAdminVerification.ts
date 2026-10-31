import { useCallback } from 'react';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

type SendOtpResult = {
  challengeId: string;
  emailMasked: string;
  expiresAt: string;
};

type VerifyOtpResult = {
  verificationToken: string;
  /** Epoch ms when the sudo token stops being accepted. */
  expiresAt: number;
};

export function useSuperAdminVerification() {
  const sendOtp = useCallback(
    (gatedAction?: string): Promise<SendOtpResult> =>
      callEdgeFunction<SendOtpResult>('super-admin-verification', {
        method: 'POST',
        body: JSON.stringify({ action: 'send_otp', gatedAction: gatedAction ?? null }),
      }),
    []
  );

  const verifyOtp = useCallback(
    (challengeId: string, code: string): Promise<VerifyOtpResult> =>
      callEdgeFunction<VerifyOtpResult>('super-admin-verification', {
        method: 'POST',
        body: JSON.stringify({ action: 'verify_otp', challengeId, code }),
      }),
    []
  );

  return { sendOtp, verifyOtp };
}
