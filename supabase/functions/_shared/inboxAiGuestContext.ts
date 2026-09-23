/**
 * Guest-safe property/org facts for inbox AI grounding.
 * Mirrors publicPropertyService projections — never exposes finance, maintenance, or guest PII.
 */

import { serializeGuestPaymentInfo } from './appSettings.ts';
import { listAvailableCheckIns, manilaTodayYmd } from './calendarAvailabilityManila.ts';
import {
  collectDevelopmentPricingValues,
  loadGuestSafeDevelopmentContextByName,
  renderDevelopmentGuestFacts,
  type DevelopmentGuestContextDto,
} from './developmentGuestInfo.ts';
import type { PropertyPaymentMethod } from './paymentMethods.ts';
import { createServiceClient } from './orgAuth.ts';
import { computeDefaultBookingRateFromDefaults, loadPropertyPricing } from './propertyPricing.ts';
import { loadPublicPropertyById } from './publicPropertyService.ts';
import { resolvePublicGuestAppOrigin } from './publicAppOrigin.ts';
import { resolveOrganizationIdForProperty } from './propertyScope.ts';

const AVAILABILITY_HORIZON_DAYS = 180;

export type OrgGuestContextDto = {
  organizationName: string;
  properties: Array<{ id: string; slug: string; name: string; locationLabel: string }>;
};

export type PropertyGuestContextDto = {
  name: string;
  locationLabel: string;
  address: string;
  city: string;
  province: string | null;
  residenceName: string | null;
  towerAndUnit: string | null;
  floors: number;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  checkInTime: string;
  checkOutTime: string;
  selfCheckIn: boolean;
  amenities: string[];
  houseRules: string[];
  cancellationPolicyTitle: string;
  cancellationPolicyDescription: string;
  paymentMethodsSummary: string;
  paymentAccountNumbers: string[];
  mapsUrl: string | null;
  calendarUrl: string | null;
  pricing: {
    weekdayNightlyRate: number;
    weekendNightlyRate: number;
    securityDeposit: number | null;
    petFee: number | null;
    parkingRateGuest: number | null;
    holidayRules: Array<{ name: string; startDate: string; endDate: string; percentage: number }>;
  };
  guestFormUrl: string | null;
};

export type AvailabilityGuestContextDto = {
  blockedRanges: Array<{ checkIn: string; checkOut: string }>;
  asOfDate: string;
};

export type AiGroundingBundle = {
  factsText: string;
  guardContext: {
    pricingValues: number[];
    otherGuestNames: string[];
    allowedAccountNumbers: string[];
  };
};

export type GuestSafeQuickReply = {
  title: string;
  body: string;
};

type PropertyListRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  settings: Record<string, unknown> | null;
  address: string | null;
};

function readString(settings: Record<string, unknown>, key: string): string {
  const value = settings[key];
  return typeof value === 'string' ? value.trim() : '';
}

function buildLocationLabel(city: string, province: string, country: string): string {
  const parts = [city, province, country].filter(Boolean);
  return parts.join(', ') || country || 'Philippines';
}

function normalizeDate(dateStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [month, day, year] = dateStr.split('-');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return dateStr;
}

function parseMMDDYYYY(dateStr: string): Date | null {
  try {
    const [month, day, year] = dateStr.split('-');
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  } catch {
    return null;
  }
}

function collectPricingValues(pricing: PropertyGuestContextDto['pricing']): number[] {
  const values = [
    pricing.weekdayNightlyRate,
    pricing.weekendNightlyRate,
    pricing.securityDeposit,
    pricing.petFee,
    pricing.parkingRateGuest,
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  const rates = [pricing.weekdayNightlyRate, pricing.weekendNightlyRate].filter(Number.isFinite);
  for (let nights = 1; nights <= 30; nights += 1) {
    for (const rate of rates) {
      values.push(rate * nights);
    }
  }

  return [...new Set(values.map((value) => Math.round(value * 100) / 100))];
}

function parseFlexibleDate(dateStr: string): Date | null {
  const normalized = normalizeDate(dateStr.trim());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const [year, month, day] = normalized.split('-').map((part) => parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(year, month - 1, day);
}

function addDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function normalizeAccountDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function formatPaymentMethodsForAi(methods: PropertyPaymentMethod[]): {
  summary: string;
  accountNumbers: string[];
} {
  const accountNumbers: string[] = [];

  if (methods.length === 0) {
    return {
      summary: 'Payment methods: share the booking form for payment steps.',
      accountNumbers,
    };
  }

  const parts = methods.map((method) => {
    const primary = method.isPrimary ? ', primary' : '';
    const name = method.accountName.trim();
    const number = method.accountNumber.trim();
    const digits = normalizeAccountDigits(number);
    if (digits.length >= 8) accountNumbers.push(digits);

    if (name && number) {
      return `${method.provider}${primary}: ${name} · ${number}`;
    }
    if (number) return `${method.provider}${primary}: ${number}`;
    return `${method.provider}${primary}`;
  });

  const acceptsCash = methods.some((method) => /cash/i.test(method.provider));
  let summary = `Payment methods for downpayment/balance: ${parts.join('; ')}.`;
  if (!acceptsCash) {
    summary += ' Cash is not configured — use the listed digital/bank options.';
  }

  return { summary, accountNumbers };
}

function templateMatchesPlatform(
  templatePlatform: string | null,
  conversationPlatform: string
): boolean {
  if (!templatePlatform) return true;
  if (conversationPlatform === 'web') return true;
  return templatePlatform === conversationPlatform;
}

export async function loadGuestSafeQuickReplies(
  orgId: string,
  platform?: string | null
): Promise<GuestSafeQuickReply[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('social_reply_templates')
    .select('title, body_text, platform, is_active, sort_order')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.warn('[inboxAiGuestContext] quick replies load failed:', error.message);
    return [];
  }

  const conversationPlatform = (platform ?? '').trim() || 'web';
  return (data ?? [])
    .filter((row) =>
      templateMatchesPlatform((row.platform as string | null) ?? null, conversationPlatform)
    )
    .map((row) => ({
      title: String(row.title ?? '').trim(),
      body: String(row.body_text ?? '').trim(),
    }))
    .filter((row) => row.title && row.body);
}

function renderQuickReplyFacts(replies: GuestSafeQuickReply[]): string {
  if (replies.length === 0) {
    return 'Quick reply snippets: none configured.';
  }

  return (
    'Quick reply snippets (fallback when property facts do not cover the question; prefer property facts when both exist):\n' +
    replies.map((reply) => `- ${reply.title}: ${reply.body}`).join('\n')
  );
}

function isStayAvailable(
  checkIn: string,
  checkOut: string,
  blockedRanges: Array<{ checkIn: string; checkOut: string }>
): boolean {
  return !blockedRanges.some((range) =>
    stayRangesOverlap(checkIn, checkOut, range.checkIn, range.checkOut)
  );
}

function renderImmediateAvailabilityFacts(availability: AvailabilityGuestContextDto): string[] {
  const today = availability.asOfDate;
  const tomorrow = addDaysYmd(today, 1);
  const dayAfter = addDaysYmd(today, 2);

  const lines = [
    `Today (Asia/Manila): ${today}`,
    `Check-in today for 1 night (${today} to ${tomorrow}): ${
      isStayAvailable(today, tomorrow, availability.blockedRanges) ? 'Available' : 'NOT available'
    }`,
    `Check-in today for 2 nights (${today} to ${dayAfter}): ${
      isStayAvailable(today, dayAfter, availability.blockedRanges) ? 'Available' : 'NOT available'
    }`,
  ];

  const blockedNights = new Set<string>();
  for (const range of availability.blockedRanges) {
    let cur = range.checkIn;
    while (cur < range.checkOut) {
      blockedNights.add(cur);
      cur = addDaysYmd(cur, 1);
    }
  }
  const nextOpen = listAvailableCheckIns(blockedNights, today, 7);
  if (nextOpen.length > 0) {
    lines.push(`Next available check-in dates (1-night stays): ${nextOpen.join(', ')}`);
  }

  return lines;
}

/** Occupied stay is [checkIn, checkOut) — check-out day allows same-day turnover. */
function stayRangesOverlap(
  inquiryCheckIn: string,
  inquiryCheckOut: string,
  blockedCheckIn: string,
  blockedCheckOut: string
): boolean {
  return inquiryCheckIn < blockedCheckOut && blockedCheckIn < inquiryCheckOut;
}

function appendPricingValues(values: number[], extra: number[]): number[] {
  return [...new Set([...values, ...extra].map((value) => Math.round(value * 100) / 100))];
}

async function renderInquiryFacts(
  propertyId: string,
  inquiryCheckIn: string,
  inquiryCheckOut: string
): Promise<{ lines: string[]; extraPricingValues: number[] }> {
  const checkIn = normalizeDate(inquiryCheckIn);
  const checkOut = normalizeDate(inquiryCheckOut);
  const checkInDate = parseFlexibleDate(checkIn);
  const checkOutDate = parseFlexibleDate(checkOut);

  if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) {
    return {
      lines: [
        `Inquiry dates: ${checkIn} to ${checkOut} (invalid range — ask guest to confirm dates)`,
      ],
      extraPricingValues: [],
    };
  }

  const availability = await loadGuestSafeAvailabilityContext(propertyId);
  const blocked = availability.blockedRanges.some((range) =>
    stayRangesOverlap(checkIn, checkOut, range.checkIn, range.checkOut)
  );

  const pricingFull = await loadPropertyPricing(propertyId);
  const nights = Math.round(
    (checkOutDate.getTime() - checkInDate.getTime()) / (24 * 60 * 60 * 1000)
  );
  const total = computeDefaultBookingRateFromDefaults(
    checkInDate,
    checkOutDate,
    nights,
    {
      weekdayNightlyRate: pricingFull.weekdayNightlyRate,
      weekendNightlyRate: pricingFull.weekendNightlyRate,
    },
    {
      dateOverrides: pricingFull.dateOverrides,
      holidayRules: pricingFull.holidayRules,
      smartRecommendations: pricingFull.smartRecommendations,
    }
  );

  const lines = [
    `Inquiry dates: ${checkIn} to ${checkOut} (${nights} night${nights === 1 ? '' : 's'})`,
    `Inquiry availability: ${blocked ? 'NOT available (overlaps an existing booking)' : 'Available based on current bookings'}`,
  ];
  const extraPricingValues: number[] = [];
  if (total != null) {
    lines.push(`Estimated stay total for inquiry dates (PHP): ${total}`);
    extraPricingValues.push(total);
  }

  return { lines, extraPricingValues };
}

function splitGuestNames(raw: string | null | undefined): string[] {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return [];
  return trimmed
    .split(/[\s,/&]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

export async function loadGuestSafeOrgContext(orgId: string): Promise<OrgGuestContextDto> {
  const sb = createServiceClient();
  const [{ data: orgRow }, { data: propertyRows, error }] = await Promise.all([
    sb.from('organizations').select('name, settings').eq('id', orgId).maybeSingle(),
    sb
      .from('properties')
      .select('id, slug, name, status, settings, address')
      .eq('organization_id', orgId)
      .eq('status', 'ACTIVE')
      .order('name'),
  ]);

  if (error) {
    console.error('[inboxAiGuestContext] load org properties:', error.message);
    throw new Error('Failed to load organization properties');
  }

  const orgSettings = (orgRow?.settings ?? {}) as Record<string, unknown>;
  const organizationName =
    readString(orgSettings, 'contactName') || String(orgRow?.name ?? '').trim() || 'our team';

  const properties = ((propertyRows ?? []) as PropertyListRow[]).map((row) => {
    const settings = (row.settings ?? {}) as Record<string, unknown>;
    const city = readString(settings, 'city');
    const province = readString(settings, 'province');
    const country = readString(settings, 'country') || 'Philippines';
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      locationLabel: buildLocationLabel(city, province, country) || row.address?.trim() || row.name,
    };
  });

  return { organizationName, properties };
}

export async function loadGuestSafeDevelopmentContext(
  residenceName: string | null | undefined
): Promise<DevelopmentGuestContextDto | null> {
  const name = String(residenceName ?? '').trim();
  if (!name) return null;
  const sb = createServiceClient();
  return loadGuestSafeDevelopmentContextByName(sb, name);
}

export async function loadGuestSafePropertyContext(
  propertyId: string
): Promise<PropertyGuestContextDto | null> {
  const detail = await loadPublicPropertyById(propertyId);
  if (!detail) return null;

  const [pricingFull, paymentInfo] = await Promise.all([
    loadPropertyPricing(propertyId),
    serializeGuestPaymentInfo(propertyId),
  ]);
  const origin = resolvePublicGuestAppOrigin();
  const guestFormUrl = detail.slug
    ? `${origin}/form?property=${encodeURIComponent(detail.slug)}`
    : null;
  const calendarUrl = detail.slug
    ? `${origin}/properties/${encodeURIComponent(detail.slug)}/calendar`
    : null;
  const paymentFormatted = formatPaymentMethodsForAi(paymentInfo.paymentMethods);

  return {
    name: detail.name,
    locationLabel: detail.locationLabel,
    address: detail.address,
    city: detail.city,
    province: detail.province,
    residenceName: detail.residenceName,
    towerAndUnit: detail.towerAndUnit,
    floors: detail.floors,
    bedrooms: detail.bedrooms,
    bathrooms: detail.bathrooms,
    maxGuests: detail.maxGuests,
    checkInTime: detail.checkInTime,
    checkOutTime: detail.checkOutTime,
    selfCheckIn: detail.selfCheckIn,
    amenities: detail.amenities,
    houseRules: detail.houseRules.map((rule) => rule.text),
    cancellationPolicyTitle: detail.cancellationPolicy.title,
    cancellationPolicyDescription: detail.cancellationPolicy.description,
    paymentMethodsSummary: paymentFormatted.summary,
    paymentAccountNumbers: paymentFormatted.accountNumbers,
    mapsUrl: detail.mapsUrl,
    calendarUrl,
    pricing: {
      weekdayNightlyRate: detail.pricing.weekdayNightlyRate,
      weekendNightlyRate: detail.pricing.weekendNightlyRate,
      securityDeposit: detail.pricing.securityDeposit,
      petFee: detail.pricing.petFee,
      parkingRateGuest: detail.pricing.parkingRateGuest,
      holidayRules: pricingFull.holidayRules.map((rule) => ({
        name: rule.name,
        startDate: rule.startDate,
        endDate: rule.endDate,
        percentage: rule.percentage,
      })),
    },
    guestFormUrl,
  };
}

export async function loadGuestSafeAvailabilityContext(
  propertyId: string
): Promise<AvailabilityGuestContextDto> {
  const sb = createServiceClient();
  const todayYmd = manilaTodayYmd();
  const todayStart = parseFlexibleDate(todayYmd);
  if (!todayStart) {
    throw new Error('Failed to resolve Manila date');
  }
  const horizonEnd = new Date(todayStart);
  horizonEnd.setDate(horizonEnd.getDate() + AVAILABILITY_HORIZON_DAYS);

  const horizonEndYmd = addDaysYmd(todayYmd, AVAILABILITY_HORIZON_DAYS);
  const { data: bookings, error } = await sb
    .from('guest_submissions')
    .select('check_in_date, check_out_date, status')
    .eq('property_id', propertyId)
    .neq('status', 'CANCELLED')
    .lte('check_in_date_sql', horizonEndYmd)
    .gte('check_out_date_sql', todayYmd);

  if (error) {
    console.error('[inboxAiGuestContext] load availability:', error.message);
    throw new Error('Failed to load availability');
  }

  const blockedRanges =
    bookings
      ?.map((booking) => {
        const checkOutRaw = String(booking.check_out_date ?? '');
        const checkOutDate =
          parseMMDDYYYY(checkOutRaw) ?? parseFlexibleDate(normalizeDate(checkOutRaw));
        if (!checkOutDate || checkOutDate < todayStart) return null;
        const checkIn = normalizeDate(String(booking.check_in_date ?? ''));
        const checkOut = normalizeDate(checkOutRaw);
        if (!checkIn || !checkOut) return null;
        const checkInDate =
          parseFlexibleDate(checkIn) ?? parseMMDDYYYY(String(booking.check_in_date ?? ''));
        if (checkInDate && checkInDate > horizonEnd) return null;
        return { checkIn, checkOut };
      })
      .filter((range): range is { checkIn: string; checkOut: string } => range !== null) ?? [];

  return {
    blockedRanges,
    asOfDate: todayYmd,
  };
}

async function loadOtherGuestNamesForGuard(
  orgId: string,
  propertyId: string | null,
  participantName: string | null
): Promise<string[]> {
  const sb = createServiceClient();
  let propertyIds: string[] = [];

  if (propertyId) {
    propertyIds = [propertyId];
  } else {
    const { data: propertyRows } = await sb
      .from('properties')
      .select('id')
      .eq('organization_id', orgId)
      .eq('status', 'ACTIVE');
    propertyIds = (propertyRows ?? []).map((row) => row.id as string);
  }

  if (propertyIds.length === 0) return [];

  const { data, error } = await sb
    .from('guest_submissions')
    .select('primary_guest_name, guest_facebook_name')
    .in('property_id', propertyIds)
    .neq('status', 'CANCELLED')
    .limit(200);
  if (error) {
    console.warn('[inboxAiGuestContext] guest name guard load failed:', error.message);
    return [];
  }

  const participantTokens = new Set(
    splitGuestNames(participantName).map((name) => name.toLowerCase())
  );
  const names = new Set<string>();

  for (const row of data ?? []) {
    for (const token of [
      ...splitGuestNames(row.primary_guest_name as string | null),
      ...splitGuestNames(row.guest_facebook_name as string | null),
    ]) {
      const lower = token.toLowerCase();
      if (participantTokens.has(lower)) continue;
      names.add(token);
    }
  }

  return [...names];
}

function renderPropertyFacts(property: PropertyGuestContextDto): string {
  const lines = [
    `Property: ${property.name}`,
    `Location: ${property.locationLabel}`,
    `Address: ${property.address || property.locationLabel}`,
    `City: ${property.city}${property.province ? `, ${property.province}` : ''}`,
  ];

  if (property.residenceName) {
    lines.push(`Residence / building: ${property.residenceName}`);
  }
  if (property.towerAndUnit) {
    lines.push(`Tower & unit: ${property.towerAndUnit}`);
  }
  if (property.floors > 0) {
    lines.push(`Floor level: ${property.floors}`);
  }
  if (property.mapsUrl) {
    lines.push(`Map link: ${property.mapsUrl}`);
  }

  lines.push(
    `Capacity: ${property.maxGuests} guests, ${property.bedrooms} bed, ${property.bathrooms} bath`,
    `Check-in: ${property.checkInTime}; Check-out: ${property.checkOutTime}`,
    `Self check-in: ${property.selfCheckIn ? 'Yes' : 'No'}`,
    property.paymentMethodsSummary,
    `Weekday nightly rate (PHP): ${property.pricing.weekdayNightlyRate}`,
    `Weekend nightly rate (PHP): ${property.pricing.weekendNightlyRate}`
  );

  if (property.pricing.securityDeposit != null) {
    lines.push(`Security deposit (PHP): ${property.pricing.securityDeposit}`);
  }
  if (property.pricing.petFee != null) {
    lines.push(`Pet fee (PHP): ${property.pricing.petFee}`);
  }
  if (property.pricing.parkingRateGuest != null) {
    lines.push(`Guest parking rate (PHP): ${property.pricing.parkingRateGuest}`);
  }
  if (property.pricing.holidayRules.length > 0) {
    lines.push(
      'Holiday rate adjustments: ' +
        property.pricing.holidayRules
          .map(
            (rule) => `${rule.name} (${rule.startDate} to ${rule.endDate}, +${rule.percentage}%)`
          )
          .join('; ')
    );
  }
  if (property.amenities.length > 0) {
    lines.push(`Amenities: ${property.amenities.join(', ')}`);
  }
  if (property.houseRules.length > 0) {
    lines.push(`House rules: ${property.houseRules.join('; ')}`);
  }
  lines.push(
    `Cancellation policy: ${property.cancellationPolicyTitle}. ${property.cancellationPolicyDescription}`
  );
  if (property.calendarUrl) {
    lines.push(`Availability calendar: ${property.calendarUrl}`);
  }
  if (property.guestFormUrl) {
    lines.push(`Booking form: ${property.guestFormUrl}`);
  }

  return lines.join('\n');
}

async function appendDevelopmentFactsForProperty(
  lines: string[],
  pricingValues: number[],
  residenceName: string | null
): Promise<number[]> {
  const development = await loadGuestSafeDevelopmentContext(residenceName);
  if (!development) return pricingValues;
  lines.push(renderDevelopmentGuestFacts(development));
  return appendPricingValues(pricingValues, collectDevelopmentPricingValues(development));
}

function renderAvailabilityFacts(availability: AvailabilityGuestContextDto): string {
  const immediate = renderImmediateAvailabilityFacts(availability);
  const blockedLine =
    availability.blockedRanges.length === 0
      ? `Blocked stay ranges (next ${AVAILABILITY_HORIZON_DAYS} days from ${availability.asOfDate}): none on record.`
      : `Blocked stay ranges (check-in to check-out, next ${AVAILABILITY_HORIZON_DAYS} days from ${availability.asOfDate}): ${availability.blockedRanges
          .slice(0, 40)
          .map((range) => `${range.checkIn} to ${range.checkOut}`)
          .join('; ')}`;

  return [...immediate, blockedLine].join('\n');
}

export async function buildAiGroundingFacts(
  orgId: string,
  propertyId: string | null,
  options?: {
    participantName?: string | null;
    inquiryCheckIn?: string | null;
    inquiryCheckOut?: string | null;
    platform?: string | null;
    /** Cap quick-reply snippets (voice prompts should stay small). */
    maxQuickReplies?: number;
  }
): Promise<AiGroundingBundle> {
  const org = await loadGuestSafeOrgContext(orgId);
  const quickRepliesRaw = await loadGuestSafeQuickReplies(orgId, options?.platform ?? null);
  const maxQr = options?.maxQuickReplies;
  const quickReplies =
    typeof maxQr === 'number' && maxQr >= 0 ? quickRepliesRaw.slice(0, maxQr) : quickRepliesRaw;
  const lines = [`Organization: ${org.organizationName}`];

  let property: PropertyGuestContextDto | null = null;
  let pricingValues: number[] = [];
  let allowedAccountNumbers: string[] = [];
  let scopedPropertyId: string | null = propertyId;

  if (propertyId) {
    try {
      const propertyOrgId = await resolveOrganizationIdForProperty(propertyId);
      if (propertyOrgId !== orgId) {
        scopedPropertyId = null;
      } else {
        property = await loadGuestSafePropertyContext(propertyId);
        if (property) {
          lines.push(renderPropertyFacts(property));
          pricingValues = collectPricingValues(property.pricing);
          allowedAccountNumbers = property.paymentAccountNumbers;
          pricingValues = await appendDevelopmentFactsForProperty(
            lines,
            pricingValues,
            property.residenceName
          );
          const availability = await loadGuestSafeAvailabilityContext(propertyId);
          lines.push(renderAvailabilityFacts(availability));
        } else {
          scopedPropertyId = null;
        }
      }
    } catch {
      scopedPropertyId = null;
    }
  }

  if (!property) {
    if (org.properties.length === 0) {
      lines.push('Active properties: none listed.');
    } else if (org.properties.length === 1) {
      const only = org.properties[0]!;
      scopedPropertyId = only.id;
      const singleProperty = await loadGuestSafePropertyContext(only.id);
      if (singleProperty) {
        lines.push(renderPropertyFacts(singleProperty));
        pricingValues = collectPricingValues(singleProperty.pricing);
        allowedAccountNumbers = singleProperty.paymentAccountNumbers;
        pricingValues = await appendDevelopmentFactsForProperty(
          lines,
          pricingValues,
          singleProperty.residenceName
        );
        const availability = await loadGuestSafeAvailabilityContext(only.id);
        lines.push(renderAvailabilityFacts(availability));
      }
    } else {
      lines.push(
        'Active properties (ask guest which one if unclear): ' +
          org.properties.map((entry) => `${entry.name} (${entry.locationLabel})`).join('; ')
      );
    }
  }

  const otherGuestNames = await loadOtherGuestNamesForGuard(
    orgId,
    scopedPropertyId ?? (org.properties.length === 1 ? (org.properties[0]?.id ?? null) : null),
    options?.participantName ?? null
  );

  const inquiryCheckIn = options?.inquiryCheckIn?.trim() || null;
  const inquiryCheckOut = options?.inquiryCheckOut?.trim() || null;
  if (scopedPropertyId && inquiryCheckIn && inquiryCheckOut) {
    const inquiry = await renderInquiryFacts(scopedPropertyId, inquiryCheckIn, inquiryCheckOut);
    lines.push(...inquiry.lines);
    pricingValues = appendPricingValues(pricingValues, inquiry.extraPricingValues);
  }

  lines.push(renderQuickReplyFacts(quickReplies));

  return {
    factsText: lines.join('\n'),
    guardContext: {
      pricingValues,
      otherGuestNames,
      allowedAccountNumbers,
    },
  };
}
