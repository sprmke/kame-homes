/**
 * update-development — PATCH platform development (super admin).
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  developmentStatsByName,
  serializeDevelopment,
  type DevelopmentRow,
} from '../_shared/developmentSerialize.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { validateOptionalEmail } from '../_shared/appSettings.ts';
import { parseDocumentRequirements } from '../_shared/documentRequirements.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';
import { validatePropertyMediaArray } from '../_shared/propertyMedia.ts';
import { parseUnitTypes, validateUnitTypes } from '../_shared/unitTypes.ts';
import {
  parseGuestGuides,
  validateDevelopmentGuestInfoSettings,
} from '../_shared/developmentGuestInfo.ts';
import {
  parseHostAnnouncements,
  stampHostAnnouncementsForSave,
  validateHostAnnouncements,
} from '../_shared/hostAnnouncements.ts';

const DEVELOPMENT_TYPES = new Set([
  'CONDOMINIUM',
  'SUBDIVISION',
  'MIXED_USE',
  'TOWNHOUSE',
  'COMMERCIAL',
]);

const DEVELOPMENT_STATUSES = new Set(['ACTIVE', 'INACTIVE']);

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberOrNull(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

serveAuthenticated('update-development', async (req) => {
  requireHttpMethod(req, 'PATCH');
  await verifySuperAdminJwt(req);

  const body = await readJsonBody(req);
  const developmentId = typeof body.developmentId === 'string' ? body.developmentId.trim() : '';
  if (!developmentId) {
    return jsonError(req, 'developmentId is required');
  }

  const supabase = createServiceClient();
  const { data: existing, error: loadError } = await supabase
    .from('developments')
    .select('*')
    .eq('id', developmentId)
    .maybeSingle();

  if (loadError) {
    console.error('[update-development]', loadError.message);
    throw new Error('Failed to load development');
  }
  if (!existing) {
    return jsonError(req, 'Development not found', 404);
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  const settingsPatch: Record<string, unknown> = {
    ...((existing as DevelopmentRow).settings ?? {}),
  };
  let settingsChanged = false;

  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (name.length < 2 || name.length > 160) {
      return jsonError(req, 'Development name must be 2–160 characters');
    }
    const { data: nameConflict } = await supabase
      .from('developments')
      .select('id')
      .eq('name', name)
      .neq('id', developmentId)
      .maybeSingle();
    if (nameConflict) {
      return jsonError(req, 'A development with this name already exists', 409);
    }
    patch.name = name;
  }

  if (typeof body.slug === 'string') {
    const slug = body.slug.trim();
    if (!slug) {
      return jsonError(req, 'Slug cannot be empty');
    }
    const { data: slugConflict } = await supabase
      .from('developments')
      .select('id')
      .eq('slug', slug)
      .neq('id', developmentId)
      .maybeSingle();
    if (slugConflict) {
      return jsonError(req, 'Slug is already in use', 409);
    }
    patch.slug = slug;
  }

  if (body.developerName !== undefined) {
    patch.developer_name =
      typeof body.developerName === 'string' ? body.developerName.trim() || null : null;
  }

  if (typeof body.type === 'string') {
    if (!DEVELOPMENT_TYPES.has(body.type)) {
      return jsonError(req, 'Invalid development type');
    }
    patch.type = body.type;
  }

  if (typeof body.status === 'string') {
    if (!DEVELOPMENT_STATUSES.has(body.status)) {
      return jsonError(req, 'Invalid status');
    }
    patch.status = body.status;
  }

  if (body.location !== undefined) {
    patch.location = typeof body.location === 'string' ? body.location.trim() || null : null;
  }

  if (body.city !== undefined) {
    patch.city = typeof body.city === 'string' ? body.city.trim() || null : null;
  }

  if (body.description !== undefined) {
    patch.description =
      typeof body.description === 'string' ? body.description.trim() || null : null;
  }

  if (body.coverImageUrl !== undefined) {
    patch.cover_image_url =
      typeof body.coverImageUrl === 'string' ? body.coverImageUrl.trim() || null : null;
  }

  if (body.media !== undefined) {
    const validated = validatePropertyMediaArray(body.media);
    if (!validated.ok) {
      return jsonError(req, validated.error);
    }
    settingsPatch.media = validated.items;
    settingsPatch.images = validated.items
      .filter((item) => item.type === 'image')
      .map((item) => item.url);
    settingsChanged = true;

    const primary =
      validated.items.find((item) => item.type === 'image' && item.isPrimary) ??
      validated.items.find((item) => item.type === 'image');
    if (primary?.url) {
      patch.cover_image_url = primary.url;
    }
  }

  const settingsFields: Array<[string, unknown]> = [
    ['images', stringArray(body.images)],
    ['amenities', stringArray(body.amenities)],
    ['propertyTowers', stringArray(body.propertyTowers)],
    ['parkingTowers', stringArray(body.parkingTowers)],
    ['parkingLevels', stringArray(body.parkingLevels)],
    ['address', typeof body.address === 'string' ? body.address.trim() || null : undefined],
    ['province', typeof body.province === 'string' ? body.province.trim() || null : undefined],
    ['country', typeof body.country === 'string' ? body.country.trim() || null : undefined],
    ['zipCode', typeof body.zipCode === 'string' ? body.zipCode.trim() || null : undefined],
    ['mapsUrl', typeof body.mapsUrl === 'string' ? body.mapsUrl.trim() || null : undefined],
    ['placeId', typeof body.placeId === 'string' ? body.placeId.trim() || null : undefined],
    ['latitude', numberOrNull(body.latitude)],
    ['longitude', numberOrNull(body.longitude)],
    ['pmoEmail', typeof body.pmoEmail === 'string' ? body.pmoEmail.trim() || null : undefined],
  ];

  for (const [key, value] of settingsFields) {
    if (value === undefined) continue;
    if (key === 'pmoEmail' && typeof value === 'string' && value.trim()) {
      const err = validateOptionalEmail(value, 'PMO email');
      if (err) return jsonError(req, err);
    }
    settingsPatch[key] = value;
    settingsChanged = true;
  }

  if (body.unitTypes !== undefined) {
    const parsed = parseUnitTypes(body.unitTypes);
    if (!parsed) {
      return jsonError(req, 'Each unit type needs an id, label, and max adults');
    }
    const unitTypeError = validateUnitTypes(parsed);
    if (unitTypeError) {
      return jsonError(req, unitTypeError);
    }
    settingsPatch.unitTypes = parsed;
    settingsChanged = true;
  }

  if (body.documentRequirements !== undefined) {
    if (!Array.isArray(body.documentRequirements)) {
      return jsonError(req, 'documentRequirements must be an array');
    }
    // `parseDocumentRequirements` skips malformed entries, so compare counts and
    // reject rather than silently dropping a row the super admin still sees.
    const parsed = parseDocumentRequirements(body.documentRequirements) ?? [];
    if (parsed.length !== body.documentRequirements.length) {
      return jsonError(
        req,
        'Each document requirement needs an id, label, order, trigger, and approval source'
      );
    }
    settingsPatch.workflowDefaults = {
      ...objectOrEmpty(settingsPatch.workflowDefaults),
      documentRequirements: parsed,
    };
    settingsChanged = true;
  }

  if (body.poolFee !== undefined) {
    const poolFee = numberOrNull(body.poolFee);
    if (poolFee === undefined) {
      return jsonError(req, 'poolFee must be a number or null');
    }
    if (poolFee != null && poolFee < 0) {
      return jsonError(req, 'poolFee cannot be negative');
    }
    settingsPatch.poolFee = poolFee;
    settingsChanged = true;
  }

  if (body.poolSchedule !== undefined) {
    settingsPatch.poolSchedule =
      typeof body.poolSchedule === 'string' ? body.poolSchedule.trim() || null : null;
    settingsChanged = true;
  }

  if (body.guestRequirements !== undefined) {
    settingsPatch.guestRequirements =
      typeof body.guestRequirements === 'string' ? body.guestRequirements.trim() || null : null;
    settingsChanged = true;
  }

  if (body.importantInfo !== undefined) {
    settingsPatch.importantInfo =
      typeof body.importantInfo === 'string' ? body.importantInfo.trim() || null : null;
    settingsChanged = true;
  }

  if (body.guestGuides !== undefined) {
    if (!Array.isArray(body.guestGuides)) {
      return jsonError(req, 'guestGuides must be an array');
    }
    const parsed = parseGuestGuides(body.guestGuides);
    if (parsed.length !== body.guestGuides.length) {
      return jsonError(req, 'Each guest guide needs an id, title, and content');
    }
    settingsPatch.guestGuides = parsed;
    settingsChanged = true;
  }

  if (body.announcements !== undefined) {
    if (!Array.isArray(body.announcements)) {
      return jsonError(req, 'announcements must be an array');
    }
    const parsed = parseHostAnnouncements(body.announcements);
    if (parsed.length !== body.announcements.length) {
      return jsonError(req, 'Each announcement needs an id, title, and message');
    }
    const validationError = validateHostAnnouncements(parsed);
    if (validationError) {
      return jsonError(req, validationError);
    }
    settingsPatch.announcements = stampHostAnnouncementsForSave(
      parsed,
      parseHostAnnouncements((existing as DevelopmentRow).settings?.announcements)
    );
    settingsChanged = true;
  }

  if (settingsChanged) {
    const guestInfoError = validateDevelopmentGuestInfoSettings(settingsPatch);
    if (guestInfoError) {
      return jsonError(req, guestInfoError);
    }
    patch.settings = settingsPatch;
  }

  const { data, error } = await supabase
    .from('developments')
    .update(patch)
    .eq('id', developmentId)
    .select('*')
    .single();

  if (error) {
    console.error('[update-development]', error.message);
    throw new Error('Failed to update development');
  }

  const row = data as DevelopmentRow;
  const statsMap = await developmentStatsByName(supabase, [row.name]);

  return jsonSuccess(req, {
    development: serializeDevelopment(
      row,
      statsMap.get(row.name) ?? { propertyCount: 0, parkingCount: 0 }
    ),
  });
});
