/**
 * generate-marketing-template — AI design tokens for Marketing Content Studio.
 * Calendar MVP: returns schema-constrained tokens; UI compiles into CalendarStyles.
 */

import { generateMarketingTemplateTokens } from '../_shared/marketingTemplateGenerationAi.ts';
import {
  allowedPropertyPhotoUrls,
  generatePosterSpecs,
  loadPosterPhotos,
  POSTER_GOALS,
  type PosterFactsInput,
  type PosterGoal,
} from '../_shared/marketingPosterDirector.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { aiErrorResponse } from '../_shared/ai/aiErrorResponse.ts';
import { createServiceClient, requirePropertyPermissionAndFeature } from '../_shared/orgAuth.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

/** Context blocks are host-derived property data; clipped so they cannot flood the prompt. */
const CONTEXT_TEXT_MAX = 1_000;

serveAuthenticated('generate-marketing-template', async (req, user) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const limited = await rateLimitGate(req, {
    scope: 'generate-marketing-template',
    identity: identityFromRequest(req, user),
    limit: 15,
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

  const body = await readJsonBody(req);

  if (body.contentType === 'poster') {
    return handlePoster(req, body, propertyId, actorUserId);
  }

  const contentType =
    body.contentType === 'design' || body.contentType === 'video' || body.contentType === 'calendar'
      ? body.contentType
      : 'calendar';

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    return jsonError(req, 'Prompt is required', 400);
  }
  if (prompt.length > 500) {
    return jsonError(req, 'Prompt is too long', 400);
  }
  const includeContext =
    body.includeContext && typeof body.includeContext === 'object'
      ? (body.includeContext as Record<string, unknown>)
      : {};

  const includeAmenities = includeContext.amenities !== false;
  const includeAvailability = includeContext.availability !== false;
  const includePropertyPhoto = includeContext.propertyPhoto !== false;

  const amenitiesText =
    includeAmenities && typeof body.amenitiesText === 'string'
      ? body.amenitiesText.trim().slice(0, CONTEXT_TEXT_MAX)
      : undefined;
  const availabilityText =
    includeAvailability && typeof body.availabilityText === 'string'
      ? body.availabilityText.trim().slice(0, CONTEXT_TEXT_MAX)
      : undefined;

  const preferencesRaw =
    body.preferences && typeof body.preferences === 'object'
      ? (body.preferences as Record<string, unknown>)
      : {};
  const preferences = {
    layoutArchetype:
      typeof preferencesRaw.layoutArchetype === 'string' &&
      preferencesRaw.layoutArchetype !== 'auto'
        ? preferencesRaw.layoutArchetype.trim()
        : undefined,
    fontPairing:
      typeof preferencesRaw.fontPairing === 'string' && preferencesRaw.fontPairing !== 'auto'
        ? preferencesRaw.fontPairing.trim()
        : undefined,
    backgroundMood:
      typeof preferencesRaw.backgroundMood === 'string' && preferencesRaw.backgroundMood !== 'auto'
        ? preferencesRaw.backgroundMood.trim()
        : undefined,
    category:
      typeof preferencesRaw.category === 'string' && preferencesRaw.category !== 'auto'
        ? preferencesRaw.category.trim()
        : undefined,
  };

  const content = typeof body.content === 'string' ? body.content.trim() : undefined;
  const includeOrgLogo = includeContext.orgLogo !== false;
  const includePropertyName = includeContext.propertyName !== false;
  const includeCta = includeContext.cta !== false;

  const sb = createServiceClient();
  const { data: propertyRow, error } = await sb
    .from('properties')
    .select('name, residence_name, address, settings, organization_id')
    .eq('id', propertyId)
    .maybeSingle();

  if (error) return jsonError(req, error.message, 500);
  if (!propertyRow?.name || !propertyRow.organization_id) {
    return jsonError(req, 'Property not found', 404);
  }

  const settings = (propertyRow.settings ?? {}) as Record<string, unknown>;
  const media = Array.isArray(settings.media) ? settings.media : [];
  const hasPropertyPhoto =
    includePropertyPhoto &&
    media.some((item) => {
      if (!item || typeof item !== 'object') return false;
      const row = item as Record<string, unknown>;
      const url = typeof row.url === 'string' ? row.url.trim() : '';
      const type = typeof row.type === 'string' ? row.type : 'image';
      return Boolean(url) && type !== 'video';
    });

  const settingsAmenities = Array.isArray(settings.amenities)
    ? settings.amenities.filter((item): item is string => typeof item === 'string').slice(0, 8)
    : [];
  const resolvedAmenities =
    amenitiesText ||
    (includeAmenities && settingsAmenities.length > 0 ? settingsAmenities.join(', ') : undefined);

  const propertyLabel = [propertyRow.name, propertyRow.residence_name, propertyRow.address]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' · ');

  try {
    const result = await generateMarketingTemplateTokens({
      organizationId: String(propertyRow.organization_id),
      propertyId,
      contentType,
      prompt,
      propertyName: propertyLabel || String(propertyRow.name),
      amenitiesText: resolvedAmenities,
      availabilityText,
      hasPropertyPhoto,
      preferences,
      content,
      includeOrgLogo,
      includePropertyName,
      includeCta,
      actorUserId,
      actorType: 'staff',
    });

    return jsonSuccess(req, result);
  } catch (err) {
    return aiErrorResponse(req, err, 'generate-marketing-template');
  }
});

function clipString(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

/**
 * contentType "poster": AI art direction for finished posts (poster archetypes).
 * Facts come from the client (the host's own listing data, already shown on their
 * dashboard) but photos are re-checked against the property's stored media.
 */
async function handlePoster(
  req: Request,
  body: Record<string, unknown>,
  propertyId: string,
  actorUserId: string
): Promise<Response> {
  const goal: PosterGoal = POSTER_GOALS.includes(body.goal as PosterGoal)
    ? (body.goal as PosterGoal)
    : 'vibe';
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (prompt.length > 500) return jsonError(req, 'Prompt is too long', 400);
  const count =
    typeof body.count === 'number' && Number.isInteger(body.count)
      ? Math.min(4, Math.max(1, body.count))
      : 4;

  const rawFacts =
    body.facts && typeof body.facts === 'object' ? (body.facts as Record<string, unknown>) : {};
  const facts: PosterFactsInput = {
    propertyName: clipString(rawFacts.propertyName, 120) ?? '',
    brandName: clipString(rawFacts.brandName, 80),
    location: clipString(rawFacts.location, 120),
    checkIn: clipString(rawFacts.checkIn, 20),
    checkOut: clipString(rawFacts.checkOut, 20),
    securityDeposit: clipString(rawFacts.securityDeposit, 30),
    nightlyRate: clipString(rawFacts.nightlyRate, 30),
    amenities: Array.isArray(rawFacts.amenities)
      ? rawFacts.amenities
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map((item) => item.trim().slice(0, 40))
          .slice(0, 30)
      : [],
  };
  const requestedPhotos = Array.isArray(body.photoUrls)
    ? body.photoUrls.filter((url): url is string => typeof url === 'string')
    : [];

  const sb = createServiceClient();
  const { data: propertyRow, error } = await sb
    .from('properties')
    .select('name, settings, organization_id')
    .eq('id', propertyId)
    .maybeSingle();
  if (error) return jsonError(req, error.message, 500);
  if (!propertyRow?.organization_id) return jsonError(req, 'Property not found', 404);
  if (!facts.propertyName) facts.propertyName = String(propertyRow.name ?? '');

  const settings = (propertyRow.settings ?? {}) as Record<string, unknown>;
  const { urls, photos } = await loadPosterPhotos(
    requestedPhotos,
    allowedPropertyPhotoUrls(settings)
  );
  const brandColor = clipString(body.brandColor, 9);

  try {
    const variants = await generatePosterSpecs({
      organizationId: String(propertyRow.organization_id),
      propertyId,
      actorUserId,
      actorType: 'staff',
      goal,
      prompt,
      facts,
      brandColor: brandColor && /^#[0-9a-f]{6}$/i.test(brandColor) ? brandColor : null,
      photos,
      count,
    });
    // photoUrls tells the client which of its photos each photoIndex refers to.
    return jsonSuccess(req, { contentType: 'poster', variants, photoUrls: urls });
  } catch (err) {
    return aiErrorResponse(req, err, 'generate-marketing-template');
  }
}
