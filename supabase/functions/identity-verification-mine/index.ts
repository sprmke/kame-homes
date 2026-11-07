/**
 * identity-verification-mine — the signed-in subject's current identity verdict.
 *
 * Used by the booking form ("use my verified identity") and the account profile card.
 * Returns a masked name only. Never a document number, never a capture path.
 */

import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { redactName } from '../_shared/identitySessionService.ts';
import {
  isActiveIdentityVerdict,
  type IdentityFlag,
  type IdentityVerdict,
} from '../_shared/identityVerification.ts';

type Row = {
  id: string;
  verdict: IdentityVerdict;
  method: string;
  document_type: string | null;
  full_name: string | null;
  signature_valid: boolean;
  liveness_grade: string | null;
  face_match_verdict: string | null;
  flags: IdentityFlag[];
  verified_at: string | null;
  expires_at: string | null;
};

serveAuthenticated('identity-verification-mine', async (req, user) => {
  requireHttpMethod(req, 'GET');

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('identity_verifications')
    .select(
      'id, verdict, method, document_type, full_name, signature_valid, liveness_grade, face_match_verdict, flags, verified_at, expires_at'
    )
    .eq('guest_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = data as Row | null;
  if (!row || !isActiveIdentityVerdict(row.verdict)) {
    return jsonSuccess(req, { hasIdentity: false, verification: null });
  }

  const expired = row.expires_at ? Date.parse(row.expires_at) < Date.now() : false;

  return jsonSuccess(req, {
    hasIdentity: !expired,
    verification: {
      id: row.id,
      verdict: expired ? 'expired' : row.verdict,
      method: row.method,
      documentType: row.document_type,
      maskedName: row.full_name ? redactName(row.full_name) : null,
      signatureValid: row.signature_valid,
      livenessGrade: row.liveness_grade,
      faceMatchVerdict: row.face_match_verdict,
      flags: row.flags ?? [],
      verifiedAt: row.verified_at,
      expiresAt: row.expires_at,
    },
  });
});
