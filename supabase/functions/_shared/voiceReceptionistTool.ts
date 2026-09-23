/**
 * getPropertyFact tool boundary for the voice receptionist — the hard security boundary
 * (see .superpowers/sdd/2026-07-30-ai-voice-receptionist Architecture §1). Even if a guest
 * tampers with the locked system instructions, this allowlist is the only path to data,
 * and it only ever reads the same guest-safe fields as the text-AI inbox context.
 */

import {
  loadGuestSafeAvailabilityContext,
  loadGuestSafeDevelopmentContext,
  loadGuestSafePropertyContext,
  type PropertyGuestContextDto,
} from './inboxAiGuestContext.ts';
import type { DevelopmentGuestContextDto } from './developmentGuestInfo.ts';
import { createServiceClient } from './orgAuth.ts';
import { computeDefaultBookingRateFromDefaults, loadPropertyPricing } from './propertyPricing.ts';

function findAmenityMatching(amenities: string[], pattern: RegExp): string | null {
  return amenities.find((amenity) => pattern.test(amenity)) ?? null;
}

function mergedAmenities(
  property: PropertyGuestContextDto,
  development: DevelopmentGuestContextDto | null
): string[] {
  const set = new Set<string>();
  for (const amenity of property.amenities) set.add(amenity);
  for (const amenity of development?.amenities ?? []) set.add(amenity);
  return [...set];
}

async function renderAvailabilityAnswer(propertyId: string): Promise<string> {
  const availability = await loadGuestSafeAvailabilityContext(propertyId);
  if (availability.blockedRanges.length === 0) {
    return `As of ${availability.asOfDate}, there are no blocked dates on record for the near term — check the booking calendar for exact availability.`;
  }
  const upcoming = availability.blockedRanges
    .slice(0, 5)
    .map((range) => `${range.checkIn} to ${range.checkOut}`)
    .join('; ');
  return `As of ${availability.asOfDate}, these date ranges are already booked: ${upcoming}. Other dates are open — check the booking calendar to confirm.`;
}

function renderPoolAnswer(development: DevelopmentGuestContextDto | null): string {
  if (!development) {
    return 'Pool information is not listed for this property — ask the host team to confirm.';
  }
  const parts: string[] = [];
  if (development.poolFee != null) {
    parts.push(`The pool fee is ${development.poolFee} pesos`);
  }
  if (development.poolSchedule) {
    parts.push(`Pool schedule: ${development.poolSchedule}`);
  }
  if (parts.length === 0) {
    return 'Pool information is not listed for this development — ask the host team to confirm.';
  }
  return parts.join('. ') + '.';
}

function renderRequirementsAnswer(development: DevelopmentGuestContextDto | null): string {
  if (!development) {
    return 'Building requirements are not listed — ask the host team to confirm.';
  }
  const parts: string[] = [];
  if (development.guestRequirements) {
    parts.push(development.guestRequirements);
  }
  if (development.documentRequirementLabels.length > 0) {
    parts.push(
      `Required documents for stays here: ${development.documentRequirementLabels.join(', ')}.`
    );
  }
  if (parts.length === 0) {
    return 'No specific building requirements are listed.';
  }
  return parts.join(' ');
}

function renderGuidesAnswer(development: DevelopmentGuestContextDto | null): string {
  if (!development || development.guestGuides.length === 0) {
    return 'No development guides are listed — ask the host team to confirm.';
  }
  return development.guestGuides.map((guide) => `${guide.title}: ${guide.content}`).join(' ');
}

export function sanitizeVoiceToolFact(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/<\s*\/?\s*(system|developer|tool|assistant|user)[^>]*>/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 1_500);
}

/**
 * Builds a guest-safe answer for an allowlisted topic. Every field read here comes from
 * `loadGuestSafePropertyContext` / `loadGuestSafeAvailabilityContext` — the same DTOs the
 * text-AI inbox uses, which explicitly never include finance, maintenance, or guest PII.
 */
export async function answerGuestSafeVoiceTopic(
  propertyId: string,
  topicKey: string
): Promise<string> {
  const property = await loadGuestSafePropertyContext(propertyId);
  if (!property) {
    throw new Error('Property not found');
  }
  const development = await loadGuestSafeDevelopmentContext(property.residenceName);
  const amenities = mergedAmenities(property, development);

  switch (topicKey) {
    case 'checkin':
      return `Check-in is at ${property.checkInTime}. Self check-in: ${property.selfCheckIn ? 'yes' : 'no'}.`;
    case 'checkout':
      return `Check-out is at ${property.checkOutTime}.`;
    case 'wifi': {
      const wifiAmenity = findAmenityMatching(amenities, /wifi|internet/i);
      return wifiAmenity
        ? `Wifi is included: ${wifiAmenity}.`
        : 'Wifi details are not listed — ask the host team to confirm.';
    }
    case 'pool':
      return renderPoolAnswer(development);
    case 'parking':
      return property.pricing.parkingRateGuest != null
        ? `Guest parking is available for ${property.pricing.parkingRateGuest} pesos — ask the host team to arrange it.`
        : 'Parking is not listed for this property — ask the host team to confirm.';
    case 'pets':
      return property.pricing.petFee != null
        ? `Pets are welcome with a ${property.pricing.petFee} pesos pet fee.`
        : 'Pet policy is not listed for this property — ask the host team to confirm.';
    case 'pricing': {
      let answer =
        `Weekday rate is ${property.pricing.weekdayNightlyRate} pesos per night, weekend rate is ${property.pricing.weekendNightlyRate} pesos per night.` +
        (property.pricing.securityDeposit != null
          ? ` Security deposit is ${property.pricing.securityDeposit} pesos.`
          : '');
      if (development?.poolFee != null) {
        answer += ` Pool fee is ${development.poolFee} pesos.`;
      }
      return answer;
    }
    case 'availability':
      return renderAvailabilityAnswer(propertyId);
    case 'payment':
      return property.paymentMethodsSummary;
    case 'cancellation':
      return `${property.cancellationPolicyTitle}. ${property.cancellationPolicyDescription}`;
    case 'location': {
      const developmentLocation = development?.locationLabel?.trim();
      const base = `${property.address || property.locationLabel}.`;
      const developmentLine = developmentLocation ? ` Development: ${developmentLocation}.` : '';
      const mapLine = property.mapsUrl ? ` Map: ${property.mapsUrl}` : '';
      return `${base}${developmentLine}${mapLine}`;
    }
    case 'houseRules':
      return property.houseRules.length
        ? `House rules: ${property.houseRules.join('; ')}.`
        : 'No specific house rules are listed.';
    case 'requirements':
      return renderRequirementsAnswer(development);
    case 'guides':
      return renderGuidesAnswer(development);
    case 'capacity':
      return `This property sleeps up to ${property.maxGuests} guests, with ${property.bedrooms} bedroom(s) and ${property.bathrooms} bathroom(s).`;
    case 'amenities':
      return amenities.length
        ? `Amenities include: ${amenities.join(', ')}.`
        : 'No amenities are listed for this property.';
    case 'overview':
    default: {
      const developmentName = development?.name ?? property.residenceName;
      const developmentLine = developmentName ? ` in ${developmentName}` : '';
      const extraInfo = development?.importantInfo ? ` ${development.importantInfo}` : '';
      return `${property.name} is located in ${property.locationLabel}${developmentLine}, sleeps up to ${property.maxGuests} guests, with check-in at ${property.checkInTime} and check-out at ${property.checkOutTime}.${extraInfo}`;
    }
  }
}

export const VOICE_PROPERTY_FACT_TOPICS = [
  'checkin',
  'checkout',
  'pool',
  'parking',
  'pets',
  'payment',
  'cancellation',
  'location',
  'houseRules',
  'requirements',
  'capacity',
  'amenities',
  'overview',
] as const;

export type VoicePropertyFactTopic = (typeof VOICE_PROPERTY_FACT_TOPICS)[number];
export type VoiceReceptionistToolName =
  | 'get_property_facts'
  | 'check_dates'
  | 'get_inquiry_price'
  | 'get_my_stay'
  | 'get_stay_guide'
  | 'handoff_to_host';

export type VoiceToolResult = {
  spokenText: string;
  actions: Array<{
    type: 'open_text_chat' | 'open_booking' | 'open_calendar' | 'open_stay_guide' | 'open_property';
    label: string;
    url: string;
  }>;
};

export const VOICE_RECEPTIONIST_TOOL_DECLARATIONS = [
  {
    functionDeclarations: [
      {
        name: 'get_property_facts',
        description: 'Get a current public property fact that is not already in Known facts.',
        parameters: {
          type: 'object',
          properties: {
            topic: { type: 'string', enum: VOICE_PROPERTY_FACT_TOPICS },
          },
          required: ['topic'],
        },
      },
      {
        name: 'check_dates',
        description: 'Check exact property availability for requested dates.',
        parameters: {
          type: 'object',
          properties: {
            checkIn: { type: 'string', description: 'YYYY-MM-DD' },
            checkOut: { type: 'string', description: 'YYYY-MM-DD' },
          },
          required: ['checkIn', 'checkOut'],
        },
      },
      {
        name: 'get_inquiry_price',
        description: 'Get the current public lodging total for exact dates.',
        parameters: {
          type: 'object',
          properties: {
            checkIn: { type: 'string', description: 'YYYY-MM-DD' },
            checkOut: { type: 'string', description: 'YYYY-MM-DD' },
          },
          required: ['checkIn', 'checkOut'],
        },
      },
      {
        name: 'get_my_stay',
        description: "Get the signed-in guest's own booking status and stay dates.",
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'get_stay_guide',
        description: 'Get guest-visible stay guidance during a verified active stay.',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'handoff_to_host',
        description: 'Offer the guest a safe switch to text chat with the host.',
        parameters: { type: 'object', properties: {} },
      },
    ],
  },
];

export function parseVoiceStayRange(args: Record<string, unknown>): {
  checkIn: string;
  checkOut: string;
  nights: number;
} {
  const checkIn = String(args.checkIn ?? '');
  const checkOut = String(args.checkOut ?? '');
  const checkInMs = Date.parse(`${checkIn}T00:00:00Z`);
  const checkOutMs = Date.parse(`${checkOut}T00:00:00Z`);
  const nights = Math.round((checkOutMs - checkInMs) / 86_400_000);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(checkIn) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(checkOut) ||
    !Number.isFinite(checkInMs) ||
    !Number.isFinite(checkOutMs) ||
    new Date(checkInMs).toISOString().slice(0, 10) !== checkIn ||
    new Date(checkOutMs).toISOString().slice(0, 10) !== checkOut ||
    nights < 1 ||
    nights > 90
  ) {
    throw new Error('A valid stay of 1 to 90 nights is required');
  }
  return { checkIn, checkOut, nights };
}

function normalizeBookingDate(value: unknown): string | null {
  const raw = String(value ?? '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : null;
}

async function loadOwnBooking(propertyId: string, guestUserId: string) {
  const { data, error } = await createServiceClient()
    .from('guest_submissions')
    .select('id, status, check_in_date, check_out_date')
    .eq('property_id', propertyId)
    .eq('guest_user_id', guestUserId)
    .neq('status', 'CANCELLED')
    .order('check_in_date_sql', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error('Failed to load guest booking');
  return data;
}

async function loadPropertySlug(propertyId: string): Promise<string | null> {
  const { data, error } = await createServiceClient()
    .from('properties')
    .select('slug')
    .eq('id', propertyId)
    .maybeSingle();
  if (error) throw new Error('Failed to load property');
  return data?.slug ? String(data.slug) : null;
}

export async function executeVoiceReceptionistTool(input: {
  name: VoiceReceptionistToolName;
  args: Record<string, unknown>;
  propertyId: string;
  guestUserId: string;
}): Promise<VoiceToolResult> {
  const actions: VoiceToolResult['actions'] = [];

  if (input.name === 'get_property_facts') {
    const topic = String(input.args.topic ?? '') as VoicePropertyFactTopic;
    if (!VOICE_PROPERTY_FACT_TOPICS.includes(topic)) throw new Error('Unsupported property fact');
    const slug = await loadPropertySlug(input.propertyId);
    if (slug) {
      actions.push({
        type: 'open_property',
        label: 'View property',
        url: `/properties/${encodeURIComponent(slug)}`,
      });
    }
    return {
      spokenText: sanitizeVoiceToolFact(await answerGuestSafeVoiceTopic(input.propertyId, topic)),
      actions,
    };
  }

  if (input.name === 'check_dates') {
    const { checkIn, checkOut } = parseVoiceStayRange(input.args);
    const availability = await loadGuestSafeAvailabilityContext(input.propertyId);
    const horizonEnd = new Date(`${availability.asOfDate}T00:00:00Z`);
    horizonEnd.setUTCDate(horizonEnd.getUTCDate() + 180);
    if (checkIn < availability.asOfDate || checkOut > horizonEnd.toISOString().slice(0, 10)) {
      return {
        spokenText:
          'I can check dates within the next 180 days. For other dates, message the host.',
        actions,
      };
    }
    const blocked = availability.blockedRanges.some(
      (range) => checkIn < range.checkOut && checkOut > range.checkIn
    );
    const slug = await loadPropertySlug(input.propertyId);
    if (slug) {
      actions.push({
        type: 'open_calendar',
        label: 'Open calendar',
        url: `/properties/${encodeURIComponent(slug)}/calendar`,
      });
    }
    return {
      spokenText: blocked
        ? 'Those dates are not available. Try different dates or message the host.'
        : `Those dates are currently available as of ${availability.asOfDate}.`,
      actions,
    };
  }

  if (input.name === 'get_inquiry_price') {
    const { checkIn, checkOut, nights } = parseVoiceStayRange(input.args);
    const pricing = await loadPropertyPricing(input.propertyId);
    const total = computeDefaultBookingRateFromDefaults(
      new Date(`${checkIn}T00:00:00+08:00`),
      new Date(`${checkOut}T00:00:00+08:00`),
      nights,
      pricing,
      pricing
    );
    if (total == null) {
      return {
        spokenText: 'I could not calculate that stay total. Please check the booking page.',
        actions,
      };
    }
    const slug = await loadPropertySlug(input.propertyId);
    if (slug) {
      const params = new URLSearchParams({ checkInDate: checkIn, checkOutDate: checkOut });
      actions.push({
        type: 'open_booking',
        label: 'Book dates',
        url: `/properties/${encodeURIComponent(slug)}/form?${params.toString()}`,
      });
    }
    return {
      spokenText: `The current lodging total is ${total} pesos. Fees or add-ons may apply.`,
      actions,
    };
  }

  if (input.name === 'get_my_stay' || input.name === 'get_stay_guide') {
    const booking = await loadOwnBooking(input.propertyId, input.guestUserId);
    if (!booking) {
      return { spokenText: 'I could not find a booking for this property.', actions };
    }
    if (input.name === 'get_my_stay') {
      actions.push({ type: 'open_booking', label: 'View stay', url: '/account/stays' });
      return {
        spokenText: `Your booking is ${String(booking.status).replaceAll('_', ' ').toLowerCase()}, from ${booking.check_in_date} to ${booking.check_out_date}.`,
        actions,
      };
    }
    const availability = await loadGuestSafeAvailabilityContext(input.propertyId);
    const checkIn = normalizeBookingDate(booking.check_in_date);
    const checkOut = normalizeBookingDate(booking.check_out_date);
    if (
      !checkIn ||
      !checkOut ||
      availability.asOfDate < checkIn ||
      availability.asOfDate > checkOut
    ) {
      return {
        spokenText: 'Stay-guide details are available only during your active stay.',
        actions,
      };
    }
    const guide = sanitizeVoiceToolFact(
      await answerGuestSafeVoiceTopic(input.propertyId, 'guides')
    );
    const slug = await loadPropertySlug(input.propertyId);
    if (slug) {
      actions.push({
        type: 'open_stay_guide',
        label: 'Open stay guide',
        url: `/properties/${encodeURIComponent(slug)}/stay-guide`,
      });
    }
    return { spokenText: guide, actions };
  }

  const propertySlug = await loadPropertySlug(input.propertyId);
  actions.push({
    type: 'open_text_chat',
    label: 'Message host',
    url: propertySlug
      ? `/account/messages?property=${encodeURIComponent(propertySlug)}`
      : '/account/messages',
  });
  return { spokenText: 'You can message the host now.', actions };
}
