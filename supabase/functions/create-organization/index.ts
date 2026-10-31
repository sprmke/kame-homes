/**
 * create-organization — POST creates org (caller = owner) + optional first property/parking.
 * Auth: verifyAuthenticatedUser (any Google sign-in).
 */

import {
  allocateOrganizationSlug,
  allocateParkingSlug,
  allocatePropertySlug,
  createServiceClient,
  serializeOrganization,
  serializeParking,
  serializeProperty,
} from '../_shared/orgAuth.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import {
  DUPLICATE_ORGANIZATION_NAME_MESSAGE,
  findOrganizationNameConflict,
} from '../_shared/orgNameConflict.ts';
import {
  DUPLICATE_PROPERTY_NAME_MESSAGE,
  findPropertyNameConflict,
} from '../_shared/propertyNameConflict.ts';
import { getReservedDisplayNameViolation } from '../_shared/reservedDisplayNames.ts';
import {
  validateOrgContactSettingsFields,
  validateOrgDescription,
} from '../_shared/orgSettingsValidation.ts';
import { readOrgVerificationFromSettings } from '../_shared/orgVerification.ts';
import {
  DUPLICATE_TOWER_UNIT_MESSAGE,
  parsePropertyTowerUnitFromBody,
} from '../_shared/propertyTowerUnit.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import {
  DUPLICATE_PARKING_SLOT_MESSAGE,
  findParkingSlotConflict,
  parseParkingSlotFromBody,
} from '../_shared/parkingSlotUnit.ts';
import { seedParkingSettings } from '../_shared/parkingSettingsSeed.ts';
import { assignDefaultOrgPlanIfConfigured } from '../_shared/defaultOrgPlan.ts';
import {
  maintenanceModeResponse,
  signupsDisabledResponse,
} from '../_shared/platformSettingsCache.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { seedOrgSettings } from '../_shared/orgSettingsSeed.ts';
import { seedOrgTeamTemplates } from '../_shared/orgTeamTemplates.ts';
import { seedPropertySettings } from '../_shared/propertySettingsSeed.ts';
import { seedPropertyTeamTemplates } from '../_shared/propertyTeamTemplates.ts';

function parseHostModes(body: Record<string, unknown>): string[] {
  if (Array.isArray(body.hostModes)) {
    return body.hostModes
      .filter((m): m is string => typeof m === 'string')
      .map((m) => m.trim().toLowerCase())
      .filter((m) => m === 'property' || m === 'parking');
  }
  return [];
}

serveAuthenticated('create-organization', async (req, user) => {
  requireHttpMethod(req, 'POST');

  const maintenance = await maintenanceModeResponse(req);
  if (maintenance) return maintenance;

  const signupsBlocked = await signupsDisabledResponse(req);
  if (signupsBlocked) return signupsBlocked;

  const limited = await rateLimitGate(req, {
    scope: 'create-organization',
    identity: identityFromRequest(req, user),
    limit: 3,
    windowSec: 86_400,
  });
  if (limited) return limited;

  const body = await readJsonBody(req);

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 2 || name.length > 120) {
    return jsonError(req, 'Organization name must be 2–120 characters');
  }

  const orgNameReserved = getReservedDisplayNameViolation(name);
  if (orgNameReserved) {
    return jsonError(req, orgNameReserved, 409);
  }

  const description = typeof body.description === 'string' ? body.description.trim() || null : null;
  if (description) {
    const descriptionErr = validateOrgDescription(description);
    if (descriptionErr) return jsonError(req, descriptionErr);
  }

  const contactName = typeof body.contactName === 'string' ? body.contactName.trim() : '';
  const contactRole = typeof body.contactRole === 'string' ? body.contactRole.trim() : '';
  const contactPhone = typeof body.contactPhone === 'string' ? body.contactPhone.trim() : '';
  if (!contactName || !contactRole || !contactPhone) {
    return jsonError(req, 'Contact name, role, and phone are required');
  }
  const contactErr = validateOrgContactSettingsFields({
    contactName,
    contactRole,
    contactPhone,
  });
  if (contactErr) return jsonError(req, contactErr);

  const hostModes = parseHostModes(body);
  const propertyName = typeof body.propertyName === 'string' ? body.propertyName.trim() : '';
  const residenceName =
    typeof body.residenceName === 'string' ? body.residenceName.trim() || null : null;

  const towerUnitParsed = parsePropertyTowerUnitFromBody(body);
  const hasTowerUnitFields =
    typeof body.tower === 'string' ||
    typeof body.unitNumber === 'string' ||
    typeof body.towerAndUnit === 'string';

  const parkingBlock =
    body.parking && typeof body.parking === 'object' && !Array.isArray(body.parking)
      ? (body.parking as Record<string, unknown>)
      : body;
  const parkingParsed = parseParkingSlotFromBody(parkingBlock);
  const hasParkingSlotFields =
    typeof parkingBlock.tower === 'string' ||
    typeof parkingBlock.level === 'string' ||
    typeof parkingBlock.slotLabel === 'string';

  const legacyPropertyFlow =
    hostModes.length === 0 && (hasTowerUnitFields || propertyName.length >= 2);
  const wantsProperty = hostModes.includes('property') || legacyPropertyFlow;
  const wantsParking =
    hostModes.includes('parking') || (hostModes.length === 0 && hasParkingSlotFields);

  const supabase = createServiceClient();

  const { data: ownedOrgs, error: ownedError } = await supabase
    .from('organizations')
    .select('id, settings')
    .eq('owner_id', user.id);
  if (ownedError) {
    console.error('[create-organization] owned org check:', ownedError.message);
    return jsonError(req, 'Failed to validate organization ownership', 500);
  }
  const blockingOwned = (ownedOrgs ?? []).filter((row) => {
    const verification = readOrgVerificationFromSettings(
      row.settings && typeof row.settings === 'object' && !Array.isArray(row.settings)
        ? (row.settings as Record<string, unknown>)
        : {}
    );
    // Hard-rejected orgs do not block starting a new application.
    return !(
      verification.baseStatus === 'rejected' && verification.baseRejectionKind === 'rejected'
    );
  });
  if (blockingOwned.length > 0) {
    return jsonError(req, 'You already own an organization', 409);
  }

  try {
    const conflict = await findOrganizationNameConflict(supabase, name);
    if (conflict) {
      return jsonError(req, DUPLICATE_ORGANIZATION_NAME_MESSAGE, 409);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Validation failed';
    return jsonError(req, msg, 500);
  }

  const resolvedHostModes = [...new Set(hostModes)];
  if (wantsProperty && !resolvedHostModes.includes('property')) resolvedHostModes.push('property');
  if (wantsParking && !resolvedHostModes.includes('parking')) resolvedHostModes.push('parking');

  const orgSlug = await allocateOrganizationSlug(supabase, name);

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      owner_id: user.id,
      name,
      slug: orgSlug,
      description,
      host_modes: resolvedHostModes,
    })
    .select('*')
    .single();

  if (orgError || !org) {
    console.error('[create-organization] insert org:', orgError?.message);
    if (orgError?.code === '23505') {
      return jsonError(req, DUPLICATE_ORGANIZATION_NAME_MESSAGE, 409);
    }
    return jsonError(req, 'Failed to create organization', 500);
  }

  const rollbackOrg = async () => {
    await supabase.from('organizations').delete().eq('id', org.id);
  };

  try {
    await seedOrgSettings(org.id as string);
    await seedOrgTeamTemplates(supabase, org.id as string);
  } catch (e) {
    console.error('[create-organization] org settings seed:', e);
    await rollbackOrg();
    return jsonError(req, 'Failed to seed organization settings', 500);
  }

  const { error: contactSettingsError } = await supabase
    .from('organizations')
    .update({
      settings: {
        contactName,
        contactRole,
        contactPhone,
      },
    })
    .eq('id', org.id);

  if (contactSettingsError) {
    console.error('[create-organization] contact settings:', contactSettingsError.message);
    await rollbackOrg();
    return jsonError(req, 'Failed to save organization contact details', 500);
  }

  let property = null;
  const createProperty =
    wantsProperty && (propertyName.length >= 2 || hasTowerUnitFields || residenceName);

  if (createProperty) {
    let tower: string | null = null;
    let unitNumber: string | null = null;
    let towerAndUnit: string | null = null;

    if (hasTowerUnitFields) {
      if (!towerUnitParsed.ok) {
        await rollbackOrg();
        return jsonError(req, towerUnitParsed.error);
      }
      tower = towerUnitParsed.tower;
      unitNumber = towerUnitParsed.unitNumber;
      towerAndUnit = towerUnitParsed.towerAndUnit;
    }

    const resolvedPropertyName =
      propertyName.length >= 2 ? propertyName : (towerAndUnit ?? residenceName ?? 'Property 1');

    const propertyNameReserved = getReservedDisplayNameViolation(resolvedPropertyName);
    if (propertyNameReserved) {
      await rollbackOrg();
      return jsonError(req, propertyNameReserved, 409);
    }

    try {
      const propertyNameConflict = await findPropertyNameConflict(supabase, resolvedPropertyName);
      if (propertyNameConflict) {
        await rollbackOrg();
        return jsonError(req, DUPLICATE_PROPERTY_NAME_MESSAGE, 409);
      }
    } catch (e) {
      await rollbackOrg();
      const msg = e instanceof Error ? e.message : 'Validation failed';
      return jsonError(req, msg, 500);
    }

    const propSlug = await allocatePropertySlug(supabase, resolvedPropertyName);

    const { data: prop, error: propError } = await supabase
      .from('properties')
      .insert({
        organization_id: org.id,
        name: resolvedPropertyName,
        slug: propSlug,
        status: 'INACTIVE',
        tower,
        unit_number: unitNumber,
        tower_and_unit: towerAndUnit,
        residence_name: residenceName,
      })
      .select('*')
      .single();

    if (propError || !prop) {
      console.error('[create-organization] insert property:', propError?.message);
      await rollbackOrg();
      if (propError?.code === '23505') {
        return jsonError(req, DUPLICATE_TOWER_UNIT_MESSAGE, 409);
      }
      return jsonError(req, 'Failed to create first property', 500);
    }

    try {
      await seedPropertySettings(prop.id as string);
      await seedPropertyTeamTemplates(supabase, prop.id as string);
    } catch (e) {
      console.error('[create-organization] property settings seed:', e);
      await rollbackOrg();
      return jsonError(req, 'Failed to seed property settings', 500);
    }

    property = serializeProperty(prop);
  }

  let parking = null;
  if (wantsParking && hasParkingSlotFields) {
    if (!parkingParsed.ok) {
      await rollbackOrg();
      return jsonError(req, parkingParsed.error);
    }

    try {
      const conflict = await findParkingSlotConflict(
        supabase,
        parkingParsed.residenceName,
        parkingParsed.tower,
        parkingParsed.level,
        parkingParsed.slotLabel
      );
      if (conflict) {
        await rollbackOrg();
        return jsonError(req, DUPLICATE_PARKING_SLOT_MESSAGE, 409);
      }
    } catch (e) {
      await rollbackOrg();
      const msg = e instanceof Error ? e.message : 'Validation failed';
      return jsonError(req, msg, 500);
    }

    const parkingName =
      typeof parkingBlock.name === 'string' && parkingBlock.name.trim().length >= 2
        ? parkingBlock.name.trim()
        : parkingParsed.slotLabel;
    const parkSlug = await allocateParkingSlug(supabase, parkingName);
    const ratePerNight =
      typeof parkingBlock.ratePerNight === 'number' && parkingBlock.ratePerNight >= 0
        ? parkingBlock.ratePerNight
        : null;

    const { data: park, error: parkError } = await supabase
      .from('parkings')
      .insert({
        organization_id: org.id,
        name: parkingName,
        slug: parkSlug,
        residence_name: parkingParsed.residenceName,
        tower: parkingParsed.tower,
        level: parkingParsed.level,
        slot_label: parkingParsed.slotLabel,
        parking_type: parkingParsed.parkingType,
        rate_per_night: ratePerNight,
        settings: { features: ['CCTV', '24/7 Security'] },
      })
      .select('*')
      .single();

    if (parkError || !park) {
      console.error('[create-organization] insert parking:', parkError?.message);
      await rollbackOrg();
      if (parkError?.code === '23505') {
        return jsonError(req, DUPLICATE_PARKING_SLOT_MESSAGE, 409);
      }
      return jsonError(req, 'Failed to create first parking', 500);
    }

    try {
      await seedParkingSettings(park.id as string, ratePerNight);
    } catch (e) {
      console.error('[create-organization] parking settings seed:', e);
      await rollbackOrg();
      return jsonError(req, 'Failed to seed parking settings', 500);
    }

    parking = serializeParking(park);
  }

  const { data: refreshedOrg } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', org.id)
    .single();

  if (property && typeof (property as { id?: string }).id === 'string') {
    await assignDefaultOrgPlanIfConfigured({
      organizationId: org.id as string,
      propertyIds: [(property as { id: string }).id],
      assignedByUserId: user.id,
    });
  }

  const actor = buildActorContext(
    'dashboard',
    { authUser: user, actorType: 'org_owner', role: 'owner' },
    req
  );
  await logActivity({
    action: 'org.created',
    organizationId: org.id,
    scope: 'org',
    actor,
    targetType: 'organization',
    targetId: org.id,
    targetLabel: name,
    metadata: { with_property: !!property, with_parking: !!parking },
  });
  if (property && typeof (property as { id?: string }).id === 'string') {
    await logActivity({
      action: 'property.created',
      organizationId: org.id,
      propertyId: (property as { id: string }).id,
      scope: 'property',
      actor,
      targetType: 'property',
      targetId: (property as { id: string }).id,
      targetLabel: (property as { name?: string }).name ?? null,
      metadata: { via: 'org_onboarding' },
    });
  }
  if (parking && typeof (parking as { id?: string }).id === 'string') {
    await logActivity({
      action: 'parking.created',
      organizationId: org.id,
      parkingId: (parking as { id: string }).id,
      scope: 'parking',
      actor,
      targetType: 'parking',
      targetId: (parking as { id: string }).id,
      targetLabel: (parking as { name?: string }).name ?? null,
      metadata: { via: 'org_onboarding' },
    });
  }

  await capturePostHogEvent('org_created', {
    logPrefix: 'create-organization',
    request: req,
    distinctId: user.id,
    properties: {
      org_id: org.id,
      with_property: Boolean(property),
      with_parking: Boolean(parking),
    },
  });
  if (property && typeof (property as { id?: string }).id === 'string') {
    await capturePostHogEvent('property_created', {
      logPrefix: 'create-organization',
      request: req,
      distinctId: user.id,
      properties: {
        org_id: org.id,
        property_id: (property as { id: string }).id,
        via: 'org_onboarding',
      },
    });
  }
  if (parking && typeof (parking as { id?: string }).id === 'string') {
    await capturePostHogEvent('parking_created', {
      logPrefix: 'create-organization',
      request: req,
      distinctId: user.id,
      properties: {
        org_id: org.id,
        parking_id: (parking as { id: string }).id,
        via: 'org_onboarding',
      },
    });
  }

  return jsonSuccess(req, {
    organization: serializeOrganization((refreshedOrg ?? org) as typeof org),
    property,
    parking,
  });
});
