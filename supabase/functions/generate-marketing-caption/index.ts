/**
 * generate-marketing-caption — AI caption suggestions for Content Studio.
 */

import { z } from 'zod';

import { generateMarketingCaption } from '../_shared/marketingCaptionAi.ts';
import { aiErrorResponse } from '../_shared/ai/aiErrorResponse.ts';
import { boundedText, parseAiRequestBody } from '../_shared/ai/requestInput.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { createServiceClient, requirePropertyPermissionAndFeature } from '../_shared/orgAuth.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const CaptionRequest = z.object({
  platform: z.enum(['facebook', 'instagram']).catch('facebook'),
  postType: z.enum(['post', 'story']).catch('post'),
  contentHint: boundedText(500).optional(),
  nightlyRate: boundedText(40).optional(),
  availabilityText: boundedText(200).optional(),
});

serveAuthenticated('generate-marketing-caption', async (req, user) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const limited = await rateLimitGate(req, {
    scope: 'generate-marketing-caption',
    identity: identityFromRequest(req, user),
    limit: 20,
    windowSec: 3600,
  });
  if (limited) return limited;

  let propertyId: string;
  let actorUserId: string;
  try {
    const scoped = await resolveScopedPropertyAccess(req, 'marketing.generate:add');
    propertyId = scoped.property.id;
    const access = await requirePropertyPermissionAndFeature(
      req,
      propertyId,
      'marketing.generate:add',
      'aiMarketingGeneration'
    );
    actorUserId = access.user.id;
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const { platform, postType, contentHint, nightlyRate, availabilityText } = parseAiRequestBody(
    CaptionRequest,
    await readJsonBody(req)
  );

  const sb = createServiceClient();
  const { data: propertyRow, error } = await sb
    .from('properties')
    .select('name, organization_id')
    .eq('id', propertyId)
    .maybeSingle();

  if (error) return jsonError(req, error.message, 500);
  if (!propertyRow?.name || !propertyRow.organization_id) {
    return jsonError(req, 'Property not found', 404);
  }

  try {
    const caption = await generateMarketingCaption({
      organizationId: String(propertyRow.organization_id),
      propertyId,
      propertyName: String(propertyRow.name),
      platform,
      postType,
      contentHint,
      nightlyRate,
      availabilityText,
      actorUserId,
      actorType: 'staff',
    });
    return jsonSuccess(req, { caption });
  } catch (err) {
    return aiErrorResponse(req, err, 'generate-marketing-caption');
  }
});
