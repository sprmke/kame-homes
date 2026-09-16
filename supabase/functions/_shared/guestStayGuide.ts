/**
 * Guest stay guide — per-booking token, validity window, and template-backed page payload.
 */

import { createClient } from './supabaseJs.ts';

import { resolveAppSettings } from './appSettings.ts';
import { loadAuthUserProfile } from './authUserProfile.ts';
import { linkGuestBookingsByEmail } from './guestProfileService.ts';
import type { AuthenticatedUser } from './orgAuth.ts';
import { manilaTodayYmd, normalizeBookingDateToYmd } from './calendarAvailabilityManila.ts';
import { resolveStayGuideTemplateKey } from './customPages.ts';
import { guestBookingEmailLinkPlaceholderExtras } from './guestBookingEmailLinks.ts';
import { loadGuestFacingContactInfo } from './guestContactInfo.ts';
import { getPublicPageConfigOrDefault, type StayGuideConfig } from './publicPageConfigs.ts';
import { loadPropertyEmailBranding } from './propertyEmailBranding.ts';
import {
  applyPropertyTemplatePlaceholders,
  buildBookingPlaceholderVars,
  prepareConfigurableEmailBodyHtml,
} from './propertyTemplateEmail.ts';
import {
  getBuiltinPropertyTemplate,
  resolvePropertyTemplateContent,
  type PropertyTemplateKey,
} from './propertyTemplates.ts';
import { loadPublicPropertyById } from './publicPropertyService.ts';
import { guestStayGuidePath } from './publicGuestPaths.ts';
import { resolvePropertySlugById } from './propertyScope.ts';
import { extractLeadingSectionHeading } from './stayGuideContent.ts';
import {
  loadStayGuideCheckInDocuments,
  type StayGuideCheckInDocumentDto,
} from './stayGuideCheckInDocuments.ts';
import type { GuestSubmission } from './types.ts';

export const STAY_GUIDE_STANDARD_SECTION_KEYS = [
  'check-in-instructions',
  'house-rules',
  'parking-reminders',
  'check-out-instructions',
] as const satisfies readonly PropertyTemplateKey[];

export type StayGuideSectionKey = (typeof STAY_GUIDE_STANDARD_SECTION_KEYS)[number];

const STAY_GUIDE_ALLOWED_STATUSES = new Set([
  'READY_FOR_CHECKIN',
  'READY_FOR_CHECKOUT',
  'PENDING_SD_REFUND',
  'COMPLETED',
]);

export function isStayGuideEligibleStatus(status: string | null | undefined): boolean {
  return STAY_GUIDE_ALLOWED_STATUSES.has(String(status ?? '').trim());
}

function readExistingStayGuideToken(booking: GuestSubmission): string {
  return String((booking as { stay_guide_token?: string | null }).stay_guide_token ?? '').trim();
}

async function persistStayGuideAccess(
  bookingId: string,
  token: string,
  window: { validFrom: string; validUntil: string }
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('guest_submissions')
    .update({
      stay_guide_token: token,
      stay_guide_valid_from: window.validFrom,
      stay_guide_valid_until: window.validUntil,
    })
    .eq('id', bookingId);

  if (error) {
    console.error('[guestStayGuide] persistStayGuideAccess:', error);
    throw new Error('Failed to save stay guide token');
  }
}

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

function addDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

/** Manila midnight on check-in day through end of day after check-out. */
export function computeStayGuideValidityWindow(
  checkInDate: string,
  checkOutDate: string
): { validFrom: string; validUntil: string } | null {
  const checkInYmd = normalizeBookingDateToYmd(checkInDate);
  const checkOutYmd = normalizeBookingDateToYmd(checkOutDate);
  if (!checkInYmd || !checkOutYmd || checkInYmd >= checkOutYmd) return null;

  const graceEndYmd = addDaysYmd(checkOutYmd, 1);
  return {
    validFrom: `${checkInYmd}T00:00:00+08:00`,
    validUntil: `${graceEndYmd}T23:59:59+08:00`,
  };
}

function generateStayGuideToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function isStayGuideAccessActive(row: {
  stay_guide_valid_from?: string | null;
  stay_guide_valid_until?: string | null;
  status?: string | null;
}): boolean {
  const status = String(row.status ?? '').trim();
  if (!STAY_GUIDE_ALLOWED_STATUSES.has(status)) return false;

  const fromRaw = row.stay_guide_valid_from;
  const untilRaw = row.stay_guide_valid_until;
  if (!fromRaw || !untilRaw) return false;

  const now = Date.now();
  const fromMs = new Date(fromRaw).getTime();
  const untilMs = new Date(untilRaw).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(untilMs)) return false;
  return now >= fromMs && now <= untilMs;
}

/** Issue or refresh stay-guide access when a booking reaches READY_FOR_CHECKIN. Preserves existing token. */
export async function ensureGuestStayGuideToken(booking: GuestSubmission): Promise<string | null> {
  const bookingId = String(booking.id ?? '').trim();
  const propertyId = String(booking.property_id ?? '').trim();
  if (!bookingId || !propertyId) return null;
  if (!isStayGuideEligibleStatus(booking.status as string)) return null;

  const window = computeStayGuideValidityWindow(
    String(booking.check_in_date ?? ''),
    String(booking.check_out_date ?? '')
  );
  if (!window) return null;

  const token = readExistingStayGuideToken(booking) || generateStayGuideToken();
  await persistStayGuideAccess(bookingId, token, window);
  return token;
}

/** Recompute valid_from/until when stay dates change; keeps the same token. */
export async function refreshGuestStayGuideAccessWindow(
  booking: GuestSubmission
): Promise<string | null> {
  const bookingId = String(booking.id ?? '').trim();
  if (!bookingId) return null;

  const existingToken = readExistingStayGuideToken(booking);
  if (!existingToken) return null;
  if (!isStayGuideEligibleStatus(booking.status as string)) return existingToken;

  const window = computeStayGuideValidityWindow(
    String(booking.check_in_date ?? ''),
    String(booking.check_out_date ?? '')
  );
  if (!window) return existingToken;

  await persistStayGuideAccess(bookingId, existingToken, window);
  return existingToken;
}

/** Admin: issue token for RFCI+ bookings that predate the feature or lost token. */
export async function issueGuestStayGuideAccess(booking: GuestSubmission): Promise<{
  token: string;
  url: string;
  validUntil: string;
} | null> {
  if (!isStayGuideEligibleStatus(booking.status as string)) return null;

  const token = (await ensureGuestStayGuideToken(booking)) ?? readExistingStayGuideToken(booking);
  if (!token) return null;

  const url = await buildGuestStayGuideUrl(booking, token);
  if (!url) return null;

  const window = computeStayGuideValidityWindow(
    String(booking.check_in_date ?? ''),
    String(booking.check_out_date ?? '')
  );

  return {
    token,
    url,
    validUntil: window?.validUntil ?? '',
  };
}

/** Signed-in guest: active stay-guide URL for a property booking, if any. */
export async function resolveGuestStayGuideUrlForProperty(
  user: AuthenticatedUser,
  propertyId: string
): Promise<string | null> {
  const trimmedPropertyId = propertyId.trim();
  if (!trimmedPropertyId) return null;

  const sb = supabaseAdmin();
  await linkGuestBookingsByEmail(sb, user);

  const email = user.email.trim().toLowerCase();
  const { data: rows, error } = await sb
    .from('guest_submissions')
    .select(
      'id, property_id, status, check_in_date, check_out_date, stay_guide_token, stay_guide_valid_from, stay_guide_valid_until'
    )
    .eq('property_id', trimmedPropertyId)
    .or(`guest_user_id.eq.${user.id},and(guest_user_id.is.null,guest_email.eq.${email})`)
    .order('check_in_date', { ascending: false })
    .limit(20);

  if (error) {
    console.warn('[guestStayGuide] resolveGuestStayGuideUrlForProperty:', error.message);
    return null;
  }

  for (const row of rows ?? []) {
    if (!isStayGuideEligibleStatus(row.status as string)) continue;

    const booking = row as GuestSubmission;
    const existingToken = readExistingStayGuideToken(booking);
    let token = existingToken;

    // Eligible but missing token/window (e.g. RFCI before token issuance) — issue, then re-check window.
    if (!isStayGuideAccessActive(booking)) {
      token = (await ensureGuestStayGuideToken(booking)) ?? existingToken;
      if (!token) continue;
      const window = computeStayGuideValidityWindow(
        String(booking.check_in_date ?? ''),
        String(booking.check_out_date ?? '')
      );
      if (!window) continue;
      const withWindow = {
        ...booking,
        stay_guide_token: token,
        stay_guide_valid_from: window.validFrom,
        stay_guide_valid_until: window.validUntil,
        status: booking.status,
      };
      if (!isStayGuideAccessActive(withWindow)) continue;
    } else if (!token) {
      const issued = await ensureGuestStayGuideToken(booking);
      if (!issued) continue;
      token = issued;
    }

    const url = await buildGuestStayGuideUrl(booking, token);
    if (url) return url;
  }

  return null;
}

export async function buildGuestStayGuideUrl(
  booking: GuestSubmission,
  token: string
): Promise<string | null> {
  const propertyId = String(booking.property_id ?? '').trim();
  if (!propertyId || !token.trim()) return null;

  const propertySlug = await resolvePropertySlugById(propertyId);
  if (!propertySlug) return null;

  const settings = await resolveAppSettings(propertyId);
  return guestStayGuidePath(settings.publicGuestAppOrigin, propertySlug, token);
}

export type StayGuideSectionDto = {
  key: StayGuideSectionKey;
  label: string;
  displayHeading: string;
  html: string;
  imageUrl: string | null;
  /** ISO timestamp from template row — used to cache-bust fixed storage paths. */
  imageUpdatedAt: string | null;
};

export type GuestStayGuideDto = {
  property: {
    slug: string;
    name: string;
    brandColor: string;
    logoUrl: string | null;
    locationLabel: string;
    towerAndUnit: string | null;
    location: {
      address: string;
      city: string;
      province: string | null;
      country: string;
      zipCode: string | null;
      latitude: number | null;
      longitude: number | null;
      placeId: string | null;
      mapsUrl: string | null;
    };
    heroImageUrl: string | null;
    galleryImages: string[];
    images: string[];
  };
  booking: {
    guestName: string;
    checkInDate: string;
    checkOutDate: string;
    checkInTime: string;
    checkOutTime: string;
    needParking: boolean;
    hasPets: boolean;
  };
  contact: {
    phone: string;
    email: string;
    facebookUrl: string;
    airbnbUrl: string;
  };
  host: {
    name: string;
    avatarUrl: string | null;
    organizationName: string;
  };
  sections: StayGuideSectionDto[];
  /** Approved check-in papers for this booking (GAF, pet, parking, custom). */
  checkInDocuments: StayGuideCheckInDocumentDto[];
  validUntil: string;
  todayManila: string;
  templateKey: string;
  /** Section visibility/order/style — defaults when no host config row exists. */
  sectionConfig: StayGuideConfig;
};

async function resolveSectionHtml(
  propertyId: string,
  templateKey: StayGuideSectionKey,
  booking: GuestSubmission,
  publicOrigin: string
): Promise<{
  label: string;
  displayHeading: string;
  html: string;
  sectionImageUrl: string | null;
  updatedAt: string | null;
}> {
  const { content, label, sectionImageUrl, updatedAt } = await resolvePropertyTemplateContent(
    propertyId,
    templateKey
  );
  const settings = await resolveAppSettings(propertyId);
  const branding = await loadPropertyEmailBranding(propertyId);
  const propertySlug = (await resolvePropertySlugById(propertyId)) ?? '';
  const bookingId = String(booking.id ?? '').trim();
  const guestLinkExtras =
    bookingId && propertySlug
      ? await guestBookingEmailLinkPlaceholderExtras({
          origin: settings.publicGuestAppOrigin,
          propertySlug,
          bookingId,
        })
      : { property_slug: propertySlug, form_url: '', sd_form_url: '', review_url: '' };

  const placeholderVars = buildBookingPlaceholderVars(
    booking,
    settings,
    guestLinkExtras,
    branding
  );

  const withPlaceholders = applyPropertyTemplatePlaceholders(content, placeholderVars);
  const prepared = prepareConfigurableEmailBodyHtml(withPlaceholders, publicOrigin);
  const { heading, bodyHtml } = extractLeadingSectionHeading(prepared);
  return {
    label,
    displayHeading: heading || label,
    html: heading ? bodyHtml : prepared,
    sectionImageUrl,
    updatedAt,
  };
}

type GalleryMediaItem = {
  url: string;
  type: string;
  isPrimary?: boolean;
  order: number;
};

function pickGalleryImages(media: GalleryMediaItem[], images: string[]): string[] {
  const fromMedia = media
    .filter((item) => item.type === 'image' && item.url.trim())
    .sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return a.order - b.order;
    })
    .map((item) => item.url.trim());

  const seen = new Set<string>();
  const merged: string[] = [];
  for (const url of [...fromMedia, ...images.map((u) => u.trim())]) {
    if (url && !seen.has(url)) {
      seen.add(url);
      merged.push(url);
    }
  }
  return merged.slice(0, 12);
}

/** Prefer primary gallery photo; avoids arbitrary first row (often screenshots). */
function pickStayGuideHeroImage(media: GalleryMediaItem[], images: string[]): string | null {
  const gallery = pickGalleryImages(media, images);
  return gallery[0] ?? null;
}

type GuestFacingHostProfile = {
  name: string;
  avatarUrl: string | null;
  organizationName: string;
};

/** Prefer assigned property/org team members over settings contact or org owner. */
async function loadGuestFacingHostProfile(
  propertyId: string,
  fallback: {
    organizationName: string;
    ownerName: string;
    ownerAvatarUrl: string | null;
    orgLogoUrl: string | null;
  }
): Promise<GuestFacingHostProfile> {
  const supabase = supabaseAdmin();
  const organizationName = fallback.organizationName.trim();

  const { data: propertyRow, error: propertyError } = await supabase
    .from('properties')
    .select('organization_id')
    .eq('id', propertyId)
    .maybeSingle();

  if (propertyError) {
    console.warn('[guestStayGuide] loadGuestFacingHostProfile property:', propertyError.message);
  }

  const orgId = String(propertyRow?.organization_id ?? '').trim();
  if (!orgId) {
    return buildGuestFacingHostFallback(fallback);
  }

  const { data: orgRow, error: orgError } = await supabase
    .from('organizations')
    .select('owner_id')
    .eq('id', orgId)
    .maybeSingle();

  if (orgError) {
    console.warn('[guestStayGuide] loadGuestFacingHostProfile org:', orgError.message);
  }

  const ownerId = String(orgRow?.owner_id ?? '').trim();

  const { data: propertyMembers, error: propertyMembersError } = await supabase
    .from('property_members')
    .select('user_id')
    .eq('property_id', propertyId)
    .eq('status', 'active')
    .order('assigned_at', { ascending: true });

  if (propertyMembersError) {
    console.warn(
      '[guestStayGuide] loadGuestFacingHostProfile property_members:',
      propertyMembersError.message
    );
  }

  for (const member of propertyMembers ?? []) {
    const userId = String(member.user_id ?? '').trim();
    if (!userId || (ownerId && userId === ownerId)) continue;
    const profile = await loadAuthUserProfile(supabase, userId);
    const name = profile.name.trim();
    if (name) {
      return {
        name,
        avatarUrl: profile.avatarUrl || fallback.orgLogoUrl,
        organizationName,
      };
    }
  }

  const { data: orgMembers, error: orgMembersError } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .order('assigned_at', { ascending: true });

  if (orgMembersError) {
    console.warn(
      '[guestStayGuide] loadGuestFacingHostProfile organization_members:',
      orgMembersError.message
    );
  }

  for (const member of orgMembers ?? []) {
    const userId = String(member.user_id ?? '').trim();
    if (!userId || (ownerId && userId === ownerId)) continue;
    const profile = await loadAuthUserProfile(supabase, userId);
    const name = profile.name.trim();
    if (name) {
      return {
        name,
        avatarUrl: profile.avatarUrl || fallback.orgLogoUrl,
        organizationName,
      };
    }
  }

  return buildGuestFacingHostFallback(fallback);
}

function buildGuestFacingHostFallback(fallback: {
  organizationName: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
  orgLogoUrl: string | null;
}): GuestFacingHostProfile {
  return {
    name: fallback.ownerName.trim() || fallback.organizationName.trim() || 'Host',
    avatarUrl: fallback.ownerAvatarUrl || fallback.orgLogoUrl,
    organizationName: fallback.organizationName.trim(),
  };
}

/** Sample booking for admin stay-guide preview (Templates page). */
export function buildMockStayGuideBooking(propertyId: string): GuestSubmission {
  const checkInYmd = manilaTodayYmd();
  const checkOutYmd = addDaysYmd(checkInYmd, 2);
  return {
    id: '00000000-0000-4000-8000-000000000099',
    property_id: propertyId,
    status: 'READY_FOR_CHECKIN',
    primary_guest_name: 'Jordan Santos',
    guest_facebook_name: 'Jordan Santos',
    guest_email: 'guest@example.com',
    guest_phone_number: '09171234567',
    check_in_date: checkInYmd,
    check_out_date: checkOutYmd,
    check_in_time: '14:00',
    check_out_time: '11:00',
    number_of_adults: 2,
    number_of_children: 0,
    need_parking: true,
    has_pets: true,
    pet_name: 'Milo',
    pet_type: 'Dog',
    pet_breed: 'Shih Tzu',
    pet_age: '3',
    car_plate_number: 'ABC 1234',
    car_brand_model: 'Toyota Vios',
    car_color: 'White',
    guest_special_requests: 'Late check-in around 3 PM.',
    booking_source: 'Facebook',
    security_deposit: 1500,
  } as GuestSubmission;
}

async function buildGuestStayGuidePayload(
  propertyId: string,
  booking: GuestSubmission,
  validUntil: string,
  options?: {
    includeAllStandardSections?: boolean;
    expectedPropertySlug?: string | null;
    previewCheckInDocuments?: boolean;
  }
): Promise<GuestStayGuideDto | null> {
  const property = await loadPublicPropertyById(propertyId);
  if (!property || property.status !== 'ACTIVE') return null;

  if (options?.expectedPropertySlug?.trim()) {
    const slug = options.expectedPropertySlug.trim();
    if (property.slug !== slug) return null;
  }

  const settings = await resolveAppSettings(propertyId);
  const publicOrigin = settings.publicGuestAppOrigin;
  const contact = await loadGuestFacingContactInfo(propertyId, settings);

  const sectionKeys: StayGuideSectionKey[] = STAY_GUIDE_STANDARD_SECTION_KEYS.filter((key) => {
    if (options?.includeAllStandardSections) return true;
    if (key === 'parking-reminders') return Boolean(booking.need_parking);
    return true;
  });

  const images = property.images.length > 0 ? property.images : property.media.map((m) => m.url);

  const sections: StayGuideSectionDto[] = [];
  for (const key of sectionKeys) {
    const builtin = getBuiltinPropertyTemplate(key);
    const resolved = await resolveSectionHtml(propertyId, key, booking, publicOrigin);
    sections.push({
      key,
      label: resolved.label || builtin?.label || key,
      displayHeading: resolved.displayHeading,
      html: resolved.html,
      imageUrl: resolved.sectionImageUrl?.trim() || null,
      imageUpdatedAt: resolved.updatedAt,
    });
  }

  const host = await loadGuestFacingHostProfile(propertyId, {
    organizationName: property.host.organizationName,
    ownerName: property.host.ownerName,
    ownerAvatarUrl: property.host.ownerAvatarUrl,
    orgLogoUrl: property.host.organizationLogoUrl,
  });

  const templateKey = await resolveStayGuideTemplateKey(propertyId);
  const sectionConfig = (await getPublicPageConfigOrDefault(
    propertyId,
    'stay_guide'
  )) as StayGuideConfig;

  const checkInDocuments = await loadStayGuideCheckInDocuments(propertyId, booking, {
    previewSamples: Boolean(options?.previewCheckInDocuments),
  });

  return {
    property: {
      slug: property.slug,
      name: property.name,
      brandColor: property.host.brandColor,
      logoUrl: property.host.organizationLogoUrl,
      locationLabel: property.locationLabel,
      towerAndUnit: property.towerAndUnit,
      location: {
        address: property.address,
        city: property.city,
        province: property.province,
        country: property.country,
        zipCode: property.zipCode,
        latitude: property.latitude,
        longitude: property.longitude,
        placeId: property.placeId,
        mapsUrl: property.mapsUrl,
      },
      heroImageUrl: pickStayGuideHeroImage(property.media, images),
      galleryImages: pickGalleryImages(property.media, images),
      images,
    },
    booking: {
      guestName: String(booking.primary_guest_name ?? booking.guest_facebook_name ?? '').trim(),
      checkInDate: String(booking.check_in_date ?? ''),
      checkOutDate: String(booking.check_out_date ?? ''),
      checkInTime: String(booking.check_in_time ?? ''),
      checkOutTime: String(booking.check_out_time ?? ''),
      needParking: Boolean(booking.need_parking),
      hasPets: Boolean(booking.has_pets),
    },
    contact: {
      phone: contact.contactPhone,
      email: contact.contactEmail,
      facebookUrl: contact.facebookPageUrl,
      airbnbUrl: contact.airbnbUrl,
    },
    host,
    sections,
    checkInDocuments,
    validUntil,
    todayManila: manilaTodayYmd(),
    templateKey,
    sectionConfig,
  };
}

/** Admin preview — real property + templates, sample guest booking placeholders. */
export async function loadGuestStayGuidePreview(
  propertyId: string,
  expectedPropertySlug?: string | null
): Promise<GuestStayGuideDto | null> {
  const booking = buildMockStayGuideBooking(propertyId);
  const window = computeStayGuideValidityWindow(
    String(booking.check_in_date ?? ''),
    String(booking.check_out_date ?? '')
  );
  const validUntil = window?.validUntil ?? `${addDaysYmd(manilaTodayYmd(), 30)}T23:59:59+08:00`;
  return buildGuestStayGuidePayload(propertyId, booking, validUntil, {
    includeAllStandardSections: true,
    expectedPropertySlug,
    previewCheckInDocuments: true,
  });
}

export async function loadGuestStayGuideByToken(
  token: string,
  expectedPropertySlug?: string | null
): Promise<GuestStayGuideDto | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const { data: row, error } = await supabaseAdmin()
    .from('guest_submissions')
    .select('*')
    .eq('stay_guide_token', trimmed)
    .maybeSingle();

  if (error || !row) {
    if (error) console.error('[guestStayGuide] loadGuestStayGuideByToken:', error);
    return null;
  }

  if (!isStayGuideAccessActive(row)) return null;

  const propertyId = String(row.property_id ?? '').trim();
  if (!propertyId) return null;

  const validUntil = String(row.stay_guide_valid_until ?? '');
  return buildGuestStayGuidePayload(propertyId, row as GuestSubmission, validUntil, {
    expectedPropertySlug,
  });
}
