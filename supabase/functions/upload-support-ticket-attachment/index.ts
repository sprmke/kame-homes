/**
 * upload-support-ticket-attachment — screenshot/video ahead of submit.
 * Host: path under org id. Guest: path under guest/{userId}.
 */

import { createClient } from '../_shared/supabaseJs.ts';

import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { resolveSupportTicketScope } from '../_shared/supportTicketScope.ts';
import { assertWithinUploadLimit } from '../_shared/uploadLimits.ts';
import { SUPPORT_TICKET_ATTACHMENT_MIME } from '../_shared/supportTicketAttachments.ts';

const BUCKET = 'support-ticket-attachments';

serveAuthenticated('upload-support-ticket-attachment', async (req, user) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  // Durable per-user upload rate limit. Plan: docs/workflow/for-testing/captcha-anti-spam-hardening.md
  const limited = await rateLimitGate(req, {
    scope: 'upload-support-ticket-attachment',
    identity: identityFromRequest(req, user),
    limit: 30,
    windowSec: 600,
  });
  if (limited) return limited;

  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return jsonError(req, 'file is required', 400);
  }

  const mime = (file.type || '').toLowerCase();
  if (!SUPPORT_TICKET_ATTACHMENT_MIME.has(mime)) {
    return jsonError(req, 'File must be JPEG, PNG, WebP, HEIC, MP4, or MOV', 400);
  }
  assertWithinUploadLimit(file, mime.startsWith('video/') ? 'video' : 'image');

  const scope = await resolveSupportTicketScope(req, {
    orgSlug: formData.get('orgSlug') ? String(formData.get('orgSlug')) : null,
    orgId: formData.get('orgId') ? String(formData.get('orgId')) : null,
    propertyId: formData.get('propertyId') ? String(formData.get('propertyId')) : null,
    parkingId: formData.get('parkingId') ? String(formData.get('parkingId')) : null,
  });

  const safeName =
    String(file.name ?? 'upload')
      .replace(/[^\w.\-() ]+/g, '_')
      .slice(0, 120) || 'upload';
  const root = scope.org?.id ?? `guest`;
  const storagePath = `${root}/${scope.user.id}/${crypto.randomUUID()}-${safeName}`;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: mime });

  if (uploadError) {
    return jsonError(req, `Upload failed: ${uploadError.message}`, 500);
  }

  return jsonSuccess(req, {
    attachment: {
      name: safeName,
      mimeType: mime,
      size: file.size,
      path: storagePath,
    },
  });
});
