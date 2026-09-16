/**
 * Resolve parking scope for admin edge handlers (org-owner access v1).
 */

import {
  createServiceClient,
  type OrgAccessContext,
  type ParkingRow,
  type ParkingTeamAccessContext,
  serializeParking,
  verifyOrgAccess,
  verifyParkingTeamAccess,
} from './orgAuth.ts';
import { loadParkingPricing } from './parkingPricing.ts';
import { loadResolvedBrandColorByParkingId } from './parkingBranding.ts';
import {
  readParkingHeightClearanceM,
  readParkingSpaceLengthM,
  readParkingSpaceWidthM,
} from './parkingDimensionDefaults.ts';
import { formatCheckTime12h } from './publicPropertyService.ts';
import { isListingRecommendedBadge, resolveListingAuthorization } from './listingAuthorization.ts';
import type { OrgPermissionParam } from './orgTeamPermissions.ts';

export type ParkingAccessContext = OrgAccessContext & {
  parking: ReturnType<typeof serializeParking>;
  parkingRow: ParkingRow;
};

export function readParkingIdFromUrl(url: URL): string | null {
  const id = url.searchParams.get('parking_id')?.trim() ?? '';
  return id || null;
}

export function readParkingSlugFromUrl(url: URL): string | null {
  const slug =
    url.searchParams.get('parking')?.trim() ?? url.searchParams.get('parkingSlug')?.trim() ?? '';
  return slug || null;
}

export async function resolveOrganizationIdForParking(parkingId: string): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('parkings')
    .select('organization_id')
    .eq('id', parkingId)
    .maybeSingle();
  if (error || !data?.organization_id) {
    throw new Error('Parking not found');
  }
  return data.organization_id as string;
}

/** All parking slot ids belonging to an organization (org bookings list scope). */
export async function listParkingIdsForOrganization(orgId: string): Promise<string[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('parkings').select('id').eq('organization_id', orgId);
  if (error) {
    throw new Error(`list org parkings failed: ${error.message}`);
  }
  return (data ?? []).map((row) => String(row.id));
}

/** Ensures a booking row belongs to the resolved parking slot (admin mutations). */
export async function verifyBookingBelongsToParking(
  bookingId: string,
  parkingId: string
): Promise<void> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('guest_submissions')
    .select('parking_id')
    .eq('id', bookingId)
    .maybeSingle();
  if (error || !data) {
    throw new Error('Booking not found');
  }
  if (data.parking_id && data.parking_id !== parkingId) {
    throw new Error('Booking does not belong to this parking slot');
  }
  if (!data.parking_id) {
    throw new Error('Booking is not a parking reservation');
  }
}

async function loadParkingRow(scope: {
  parkingId?: string;
  parkingSlug?: string;
}): Promise<ParkingRow | null> {
  const supabase = createServiceClient();
  if (scope.parkingId) {
    const { data } = await supabase
      .from('parkings')
      .select('*')
      .eq('id', scope.parkingId)
      .maybeSingle();
    return (data as ParkingRow | null) ?? null;
  }
  if (scope.parkingSlug) {
    const { data } = await supabase
      .from('parkings')
      .select('*')
      .eq('slug', scope.parkingSlug)
      .maybeSingle();
    return (data as ParkingRow | null) ?? null;
  }
  return null;
}

export async function resolveAdminParkingId(req: Request): Promise<string> {
  const url = new URL(req.url);
  const parkingId = readParkingIdFromUrl(url);
  if (parkingId) return parkingId;
  throw new Response(JSON.stringify({ success: false, error: 'parking_id is required' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function resolveScopedParkingAccess(
  req: Request,
  requiredPermission: OrgPermissionParam = 'org.parkings:manage'
): Promise<ParkingAccessContext> {
  const url = new URL(req.url);
  const parkingId = readParkingIdFromUrl(url);
  const parkingSlug = readParkingSlugFromUrl(url);

  if (!parkingId && !parkingSlug) {
    throw new Response(
      JSON.stringify({ success: false, error: 'parking_id or parking slug is required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const parkingRow = await loadParkingRow({
    parkingId: parkingId ?? undefined,
    parkingSlug: parkingSlug ?? undefined,
  });
  if (!parkingRow) {
    throw new Response(JSON.stringify({ success: false, error: 'Parking not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const orgAccess = await verifyOrgAccess(
    req,
    { orgId: parkingRow.organization_id },
    requiredPermission
  );
  return {
    ...orgAccess,
    parking: serializeParking(parkingRow),
    parkingRow,
  };
}

/** Read parking team access without a specific permission gate. */
export async function resolveParkingTeamAccessContext(
  req: Request,
  explicitParkingId?: string | null
): Promise<ParkingTeamAccessContext> {
  const url = new URL(req.url);
  const parkingId = explicitParkingId?.trim() || readParkingIdFromUrl(url);
  if (!parkingId) {
    throw new Response(JSON.stringify({ success: false, error: 'parking_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return verifyParkingTeamAccess(req, parkingId);
}

export async function loadPublicParkingBySlug(slug: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('parkings')
    .select('*, organizations!inner(slug, name, settings)')
    .eq('slug', slug)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (error || !data) return null;

  const parkingId = data.id as string;
  const pricing = await loadParkingPricing(parkingId);

  const org = data.organizations as { slug: string; name: string; settings?: unknown };
  const orgSettings =
    org.settings && typeof org.settings === 'object' && !Array.isArray(org.settings)
      ? (org.settings as Record<string, unknown>)
      : {};
  const settings = (data.settings ?? {}) as Record<string, unknown>;
  const images = Array.isArray(settings.images) ? settings.images : [];
  const features = Array.isArray(settings.features) ? settings.features : [];

  const readString = (key: string): string => {
    const value = settings[key];
    return typeof value === 'string' ? value.trim() : '';
  };
  const readCoord = (key: string): number | null => {
    const value = settings[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };

  const city = readString('city');
  const province = readString('province') || null;
  const country = readString('country') || 'Philippines';
  const description = readString('description') || readString('notes') || null;
  const brandColor = await loadResolvedBrandColorByParkingId(parkingId);
  const checkInRaw = readString('checkInTime') || '14:00';
  const checkOutRaw = readString('checkOutTime') || '12:00';

  return {
    id: data.id as string,
    slug: data.slug as string,
    name: data.name as string,
    residenceName: data.residence_name as string | null,
    tower: data.tower as string | null,
    level: data.level as string | null,
    slotLabel: data.slot_label as string,
    parkingType: data.parking_type as string,
    ratePerNight: pricing.weekdayNightlyRate,
    brandColor,
    description,
    spaceLengthM: readParkingSpaceLengthM(settings),
    spaceWidthM: readParkingSpaceWidthM(settings),
    heightClearanceM: readParkingHeightClearanceM(settings),
    checkInTime: formatCheckTime12h(checkInRaw),
    checkOutTime: formatCheckTime12h(checkOutRaw),
    pricing: {
      weekdayNightlyRate: pricing.weekdayNightlyRate,
      weekendNightlyRate: pricing.weekendNightlyRate,
      dateOverrides: pricing.dateOverrides,
      currency: 'PHP',
    },
    coverImage: typeof settings.coverImage === 'string' ? settings.coverImage : (images[0] ?? null),
    images,
    features,
    notes: description,
    address: readString('address'),
    city,
    province,
    country,
    zipCode: readString('zipCode') || null,
    latitude: readCoord('latitude'),
    longitude: readCoord('longitude'),
    placeId: readString('placeId') || null,
    orgSlug: org.slug,
    orgName: org.name,
    recommendedBadge: isListingRecommendedBadge(
      resolveListingAuthorization(settings, orgSettings, 'parking')
    ),
  };
}
