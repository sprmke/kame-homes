import { useCallback } from 'react';

import {
  appendParkingId,
  appendPropertyId,
  useParkingIdParam,
  usePropertyIdParam,
} from '@/features/dashboard/org/lib/adminApiScope';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export type SettingsVerificationScope = 'property' | 'parking';

/** Mirrors edge `SettingsVerificationAction`. */
export type SettingsVerificationAction = 'payment_settings' | 'property_templates';

type SendOtpResult = {
  challengeId: string;
  ownerEmailMasked: string;
  expiresAt: string;
};

type VerifyOtpResult = {
  verificationToken: string;
  /** Epoch ms when the verification token expires (payment ~5m; templates sudo ~15m). */
  expiresAt: number;
};

function scopedVerificationPath(scope: SettingsVerificationScope, id: string): string {
  const params = new URLSearchParams();
  if (scope === 'property') {
    appendPropertyId(params, id);
  } else {
    appendParkingId(params, id);
  }
  return `settings-verification?${params.toString()}`;
}

export function useSettingsVerification(
  scope: SettingsVerificationScope,
  verificationAction: SettingsVerificationAction = 'payment_settings'
) {
  const propertyId = usePropertyIdParam();
  const parkingId = useParkingIdParam();
  const scopeId = scope === 'property' ? propertyId : parkingId;

  const sendOtp = useCallback(
    async (patchFingerprint: string): Promise<SendOtpResult> => {
      if (!scopeId) throw new Error('Missing listing scope');
      return callEdgeFunction<SendOtpResult>(scopedVerificationPath(scope, scopeId), {
        method: 'POST',
        body: JSON.stringify({
          action: 'send_otp',
          verificationAction,
          patchFingerprint,
        }),
      });
    },
    [scope, scopeId, verificationAction]
  );

  const verifyOtp = useCallback(
    async (challengeId: string, code: string): Promise<VerifyOtpResult> => {
      if (!scopeId) throw new Error('Missing listing scope');
      return callEdgeFunction<VerifyOtpResult>(scopedVerificationPath(scope, scopeId), {
        method: 'POST',
        body: JSON.stringify({
          action: 'verify_otp',
          challengeId,
          code,
        }),
      });
    },
    [scope, scopeId]
  );

  return { sendOtp, verifyOtp };
}
