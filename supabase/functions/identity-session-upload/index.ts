/**
 * identity-session-upload — one capture file for an in-progress session.
 *
 * Auth: the handoff token. Multipart body: `t`, `kind`, `file`, optional `index` (liveness
 * frames). Files land in the private `identity-captures` bucket under the session's own
 * prefix; the path is validated on submit so a token cannot point the pipeline elsewhere.
 */

import { antiSpamGate } from '../_shared/antiSpam.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { assertUploadMatchesBytes } from '../_shared/sniffMime.ts';
import { assertWithinUploadLimit } from '../_shared/uploadLimits.ts';
import {
  identitySessionTokenFromRequest,
  verifyIdentitySessionToken,
} from '../_shared/identitySessionToken.ts';
import {
  IDENTITY_CAPTURE_BUCKET,
  IDENTITY_CAPTURE_KINDS,
  expireSessionIfStale,
  identityCaptureStorageKey,
  isSubmittable,
  loadSessionByToken,
  markCaptured,
  updateSessionStep,
  type IdentityCaptureKind,
} from '../_shared/identitySessionService.ts';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const MAX_LIVENESS_FRAMES = 8;

function extensionFor(mime: string): 'jpg' | 'png' | 'webp' {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

servePublic('identity-session-upload', async (req) => {
  requireHttpMethod(req, 'POST');

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonError(req, 'Expected a multipart upload', 400);
  }

  const blocked = await antiSpamGate(req, formData, {
    scope: 'identity-session',
    heuristics: false,
    captcha: false,
    rateLimit: { limit: 40, windowSec: 60 },
  });
  if (blocked) return blocked;

  const token = identitySessionTokenFromRequest(req, formData);
  const verified = await verifyIdentitySessionToken(token);
  if (!verified.ok) return jsonError(req, 'This link is not valid.', 401);

  const supabase = createServiceClient();
  const loaded = await loadSessionByToken(supabase, verified.sessionId, token ?? '');
  if (!loaded) return jsonError(req, 'This link is not valid.', 401);

  const session = await expireSessionIfStale(supabase, loaded);
  if (!isSubmittable(session.status)) {
    return jsonError(req, 'This session is no longer accepting captures.', 409);
  }

  const kindRaw = (formData.get('kind')?.toString() ?? '').trim();
  if (!(IDENTITY_CAPTURE_KINDS as readonly string[]).includes(kindRaw)) {
    return jsonError(req, 'Unknown capture kind', 400);
  }
  const kind = kindRaw as IdentityCaptureKind;

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return jsonError(req, 'file is required', 400);

  const mime = (file.type || '').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return jsonError(req, 'Photos must be JPEG, PNG, WebP, HEIC, or HEIF', 400);
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
    assertUploadMatchesBytes(bytes, mime, ALLOWED_MIME);
  } catch (error) {
    return jsonError(req, (error as Error).message, 400);
  }
  try {
    assertWithinUploadLimit(file, 'document');
  } catch (error) {
    return jsonError(req, (error as Error).message, 400);
  }

  let index: number | undefined;
  if (kind === 'liveness_frame') {
    const rawIndex = Number(formData.get('index') ?? '');
    if (!Number.isInteger(rawIndex) || rawIndex < 0 || rawIndex >= MAX_LIVENESS_FRAMES) {
      return jsonError(req, 'Invalid frame index', 400);
    }
    index = rawIndex;
  }

  const path = identityCaptureStorageKey({ session, kind, index, extension: extensionFor(mime) });

  const { error: uploadError } = await supabase.storage
    .from(IDENTITY_CAPTURE_BUCKET)
    .upload(path, file, { upsert: true, contentType: mime, cacheControl: '300' });

  if (uploadError) {
    console.error('[identity-session-upload]', uploadError.message);
    return jsonError(req, 'Upload failed', 500);
  }

  await updateSessionStep(supabase, session.id, 'captured');
  await markCaptured(supabase, session.id);

  return jsonSuccess(req, { path, kind }, undefined, 'mutation');
});
