/**
 * Closed guest-receptionist tool allowlist shared by voice and text.
 * Handlers only read guest-safe public / own-booking fields (never finance, other guests, or credentials).
 */

import type { ToolDeclaration } from './ai/llmTools.ts';
import type { DevelopmentGuestContextDto } from './developmentGuestInfo.ts';
import {
  loadGuestSafeAvailabilityContext,
  loadGuestSafeDevelopmentContext,
  loadGuestSafePropertyContext,
  type PropertyGuestContextDto,
} from './inboxAiGuestContext.ts';
import { createServiceClient } from './orgAuth.ts';
import { loadPublicParkingBySlug } from './parkingScope.ts';
import { manilaTodayYmd } from './calendarAvailabilityManila.ts';
import { computeDefaultBookingRateFromDefaults, loadPropertyPricing } from './propertyPricing.ts';
import { guestStayGuidePath } from './publicGuestPaths.ts';
import {
  loadGuestStayGuideByToken,
  loadGuestStayGuidePreview,
  STAY_GUIDE_PLAN_ACCESS_DENIED,
  type StayGuideSectionDto,
} from './guestStayGuide.ts';
import { buildGuestTripPayload } from './guestTrip.ts';

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
    return `As of ${availability.asOfDate}, there are no blocked dates on record for the near term. Check the booking calendar for exact availability.`;
  }
  const upcoming = availability.blockedRanges
    .slice(0, 5)
    .map((range) => `${range.checkIn} to ${range.checkOut}`)
    .join('; ');
  return `As of ${availability.asOfDate}, these date ranges are already booked: ${upcoming}. Other dates are open. Check the booking calendar to confirm.`;
}

function renderPoolAnswer(development: DevelopmentGuestContextDto | null): string {
  if (!development) {
    return 'Pool information is not listed for this property. Ask the host team to confirm.';
  }
  const parts: string[] = [];
  if (development.poolFee != null) {
    parts.push(`The pool fee is ${development.poolFee} pesos`);
  }
  if (development.poolSchedule) {
    parts.push(`Pool schedule: ${development.poolSchedule}`);
  }
  if (parts.length === 0) {
    return 'Pool information is not listed for this development. Ask the host team to confirm.';
  }
  return parts.join('. ') + '.';
}

function renderRequirementsAnswer(development: DevelopmentGuestContextDto | null): string {
  if (!development) {
    return 'Building requirements are not listed. Ask the host team to confirm.';
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

export function sanitizeVoiceToolFact(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/<\s*\/?\s*(system|developer|tool|assistant|user)[^>]*>/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 1_500);
}

export function htmlToPlain(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stayGuideSectionsToSpokenText(
  sections: Array<Pick<StayGuideSectionDto, 'displayHeading' | 'label' | 'html'>>
): string {
  const parts = sections
    .map((section) => {
      const heading = (section.displayHeading || section.label || '').trim();
      const text = htmlToPlain(section.html ?? '').slice(0, 400);
      if (!text) return null;
      return heading ? `${heading}: ${text}` : text;
    })
    .filter((part): part is string => Boolean(part))
    .slice(0, 4);
  return parts.join(' ');
}

export type GuestRichCard =
  | { kind: 'map'; href: string; label: string }
  | { kind: 'table'; title?: string; columns: string[]; rows: string[][] }
  | { kind: 'checklist'; title?: string; items: string[] };

export function serializeGuestRichCard(
  card: GuestRichCard | null | undefined,
  spokenText: string
): string {
  const lead = spokenText.trim();
  if (!card) return lead;
  if (card.kind === 'map' && card.href.trim()) {
    return lead ? `${lead}\n${card.href.trim()}` : card.href.trim();
  }
  if (card.kind === 'table') {
    const columns = card.columns.map((c) => c.replace(/\|/g, ' '));
    const header = `| ${columns.join(' | ')} |`;
    const sep = `| ${columns.map(() => '---').join(' | ')} |`;
    const rows = card.rows
      .slice(0, 8)
      .map((row) => `| ${row.map((cell) => String(cell).replace(/\|/g, ' ')).join(' | ')} |`)
      .join('\n');
    const table = `${header}\n${sep}\n${rows}`;
    return lead ? `${lead}\n\n${table}` : table;
  }
  if (card.kind === 'checklist' && card.items.length > 0) {
    const list = card.items
      .slice(0, 8)
      .map((item) => `- ${item.replace(/\s+/g, ' ').trim()}`)
      .join('\n');
    return lead ? `${lead}\n${list}` : list;
  }
  return lead;
}

/** Flatten a web rich reply to Meta-safe prose (URLs kept, fences dropped). */
export function flattenGuestRichReply(text: string): string {
  const withoutFences = text.replace(/```[\s\S]*?```/g, (block) =>
    block
      .replace(/```[a-zA-Z0-9_-]*\n?/, '')
      .replace(/```$/, '')
      .trim()
  );
  return withoutFences
    .replace(/\|/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2_000);
}

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
        : 'Wifi details are not listed. Ask the host team to confirm.';
    }
    case 'pool':
      return renderPoolAnswer(development);
    case 'parking':
      return property.pricing.parkingRateGuest != null
        ? `Guest parking is available for ${property.pricing.parkingRateGuest} pesos. Ask the host team to arrange it.`
        : 'Parking is not listed for this property. Ask the host team to confirm.';
    case 'pets':
      return property.pricing.petFee != null
        ? `Pets are welcome with a ${property.pricing.petFee} pesos pet fee.`
        : 'Pet policy is not listed for this property. Ask the host team to confirm.';
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
      return 'Use the stay guide during an active stay for wifi, access, and house details.';
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

export const GUEST_RECEPTIONIST_TOOL_NAMES = [
  'get_property_facts',
  'check_dates',
  'get_inquiry_price',
  'get_my_stay',
  'get_stay_guide',
  'handoff_to_host',
  'get_parking_facts',
  'get_directions',
] as const;

export type GuestReceptionistToolName = (typeof GUEST_RECEPTIONIST_TOOL_NAMES)[number];
export type VoiceReceptionistToolName = GuestReceptionistToolName;

export type GuestReceptionistAction = {
  type:
    | 'open_text_chat'
    | 'open_booking'
    | 'open_calendar'
    | 'open_stay_guide'
    | 'open_property'
    | 'open_trip'
    | 'open_map';
  label: string;
  url: string;
};

export type GuestReceptionistToolResult = {
  spokenText: string;
  actions: GuestReceptionistAction[];
  richCard?: GuestRichCard | null;
};

export type VoiceToolResult = {
  spokenText: string;
  actions: Array<{
    type: 'open_text_chat' | 'open_booking' | 'open_calendar' | 'open_stay_guide' | 'open_property';
    label: string;
    url: string;
  }>;
};

const VOICE_ACTION_TYPES = new Set([
  'open_text_chat',
  'open_booking',
  'open_calendar',
  'open_stay_guide',
  'open_property',
]);

export function toVoiceToolResult(result: GuestReceptionistToolResult): VoiceToolResult {
  return {
    spokenText: result.spokenText,
    actions: result.actions
      .map((action) =>
        action.type === 'open_trip'
          ? { ...action, type: 'open_booking' as const }
          : action.type === 'open_map'
            ? { ...action, type: 'open_property' as const }
            : action
      )
      .filter((action) => VOICE_ACTION_TYPES.has(action.type))
      .map((action) => ({
        type: action.type as VoiceToolResult['actions'][number]['type'],
        label: action.label,
        url: action.url,
      })),
  };
}

export const GUEST_RECEPTIONIST_TOOL_DECLARATIONS: ToolDeclaration[] = [
  {
    name: 'get_property_facts',
    description: 'Get a current public property fact that is not already in Known facts.',
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string', enum: [...VOICE_PROPERTY_FACT_TOPICS] },
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
        checkIn: { type: 'string', description: 'YYYY-MM-DD or a weekday such as Friday' },
        checkOut: { type: 'string', description: 'YYYY-MM-DD or a weekday' },
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
        checkIn: { type: 'string', description: 'YYYY-MM-DD or a weekday such as Friday' },
        checkOut: {
          type: 'string',
          description: 'YYYY-MM-DD, a weekday, or omit when nights is set',
        },
        nights: { type: 'number', description: 'Length of stay when checkOut is omitted' },
      },
      required: ['checkIn'],
    },
  },
  {
    name: 'get_my_stay',
    description: "Get the signed-in guest's own booking status, next step, and trip path.",
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_stay_guide',
    description:
      'Get the property stay guide (wifi, access, house manual) during a verified active stay.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'handoff_to_host',
    description: 'Offer the guest a safe switch to text chat with the host.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_parking_facts',
    description: 'Get public parking slot facts (rate, size, access hours) for this listing.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_directions',
    description: 'Get the public address and map link for the property or parking slot.',
    parameters: { type: 'object', properties: {} },
  },
];

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

function shiftYmdUtc(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function manilaWeekdayIndex(ymd: string): number {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 4, 0, 0)).getUTCDay();
}

/** YYYY-MM-DD, MM-DD-YYYY, today/tomorrow, or a weekday relative to Manila today. */
export function resolveRelativeStayYmd(raw: string, todayYmd = manilaTodayYmd()): string | null {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const mdY = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (mdY) return `${mdY[3]}-${mdY[1]}-${mdY[2]}`;
  const lower = value.toLowerCase();
  if (lower === 'today') return todayYmd;
  if (lower === 'tomorrow') return shiftYmdUtc(todayYmd, 1);
  const week = lower.match(
    /^(this |next )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/
  );
  if (!week) return null;
  const want = WEEKDAYS.indexOf(week[2] as (typeof WEEKDAYS)[number]);
  let delta = (want - manilaWeekdayIndex(todayYmd) + 7) % 7;
  if (delta === 0) delta = 7;
  return shiftYmdUtc(todayYmd, delta);
}

/** "How much for 3 nights starting Friday?" */
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Compact stay range for guest tables. Same month: "23 to 26 Oct 2026". */
export function formatGuestStayRangeLabel(checkIn: string, checkOut: string): string {
  const [y1, m1, d1] = checkIn.split('-').map(Number);
  const [y2, m2, d2] = checkOut.split('-').map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return `${checkIn} to ${checkOut}`;
  const mon1 = MONTHS_SHORT[m1 - 1];
  const mon2 = MONTHS_SHORT[m2 - 1];
  if (y1 === y2 && m1 === m2) return `${d1} to ${d2} ${mon1} ${y1}`;
  if (y1 === y2) return `${d1} ${mon1} to ${d2} ${mon2} ${y1}`;
  return `${d1} ${mon1} ${y1} to ${d2} ${mon2} ${y2}`;
}

export function parseGuestRelativePriceAsk(
  text: string,
  todayYmd = manilaTodayYmd()
): { checkIn: string; checkOut: string; nights: number } | null {
  const match = text.match(
    /(\d+)\s*nights?\s+(?:starting|from|beginning)\s+(today|tomorrow|(?:this |next )?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday))/i
  );
  if (!match) return null;
  const nights = Number(match[1]);
  const checkIn = resolveRelativeStayYmd(match[2], todayYmd);
  if (!checkIn || !Number.isFinite(nights) || nights < 1 || nights > 90) return null;
  return { checkIn, checkOut: shiftYmdUtc(checkIn, nights), nights };
}

export function parseVoiceStayRange(args: Record<string, unknown>): {
  checkIn: string;
  checkOut: string;
  nights: number;
} {
  const today = manilaTodayYmd();
  let checkIn = resolveRelativeStayYmd(String(args.checkIn ?? ''), today);
  let checkOut = resolveRelativeStayYmd(String(args.checkOut ?? ''), today);
  const nightsArg = Number(args.nights);
  if (checkIn && !checkOut && Number.isFinite(nightsArg) && nightsArg >= 1 && nightsArg <= 90) {
    checkOut = shiftYmdUtc(checkIn, Math.trunc(nightsArg));
  }
  if (!checkIn || !checkOut) {
    throw new Error('A valid stay of 1 to 90 nights is required');
  }
  const nights = Math.round(
    (Date.parse(`${checkOut}T12:00:00+08:00`) - Date.parse(`${checkIn}T12:00:00+08:00`)) /
      86_400_000
  );
  if (nights < 1 || nights > 90) {
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

function mapsUrlFromCoords(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `https://maps.google.com/?q=${lat},${lng}`;
}

async function loadOwnBooking(propertyId: string, guestUserId: string) {
  const { data, error } = await createServiceClient()
    .from('guest_submissions')
    .select('*')
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

async function loadParkingPublic(parkingId: string) {
  const { data, error } = await createServiceClient()
    .from('parkings')
    .select('slug')
    .eq('id', parkingId)
    .maybeSingle();
  if (error || !data?.slug) return null;
  return loadPublicParkingBySlug(String(data.slug));
}

function emptyResult(spokenText: string): GuestReceptionistToolResult {
  return { spokenText: sanitizeVoiceToolFact(spokenText), actions: [], richCard: null };
}

export async function executeGuestReceptionistTool(input: {
  name: GuestReceptionistToolName;
  args: Record<string, unknown>;
  propertyId: string | null;
  parkingId?: string | null;
  guestUserId: string | null;
}): Promise<GuestReceptionistToolResult> {
  const actions: GuestReceptionistAction[] = [];
  const propertyId = input.propertyId?.trim() || null;
  const parkingId = input.parkingId?.trim() || null;
  const guestUserId = input.guestUserId?.trim() || null;

  if (input.name === 'get_property_facts') {
    if (!propertyId) return emptyResult('Property details are not available in this chat.');
    const topic = String(input.args.topic ?? '') as VoicePropertyFactTopic;
    if (!VOICE_PROPERTY_FACT_TOPICS.includes(topic)) throw new Error('Unsupported property fact');
    const slug = await loadPropertySlug(propertyId);
    if (slug) {
      actions.push({
        type: 'open_property',
        label: 'View property',
        url: `/properties/${encodeURIComponent(slug)}`,
      });
    }
    return {
      spokenText: sanitizeVoiceToolFact(await answerGuestSafeVoiceTopic(propertyId, topic)),
      actions,
    };
  }

  if (input.name === 'check_dates') {
    if (!propertyId) return emptyResult('I can only check dates for a property listing.');
    const { checkIn, checkOut } = parseVoiceStayRange(input.args);
    const availability = await loadGuestSafeAvailabilityContext(propertyId);
    const horizonEnd = new Date(`${availability.asOfDate}T00:00:00Z`);
    horizonEnd.setUTCDate(horizonEnd.getUTCDate() + 180);
    if (checkIn < availability.asOfDate || checkOut > horizonEnd.toISOString().slice(0, 10)) {
      return emptyResult(
        'I can check dates within the next 180 days. For other dates, message the host.'
      );
    }
    const blocked = availability.blockedRanges.some(
      (range) => checkIn < range.checkOut && checkOut > range.checkIn
    );
    const slug = await loadPropertySlug(propertyId);
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
    if (!propertyId) return emptyResult('I can only quote a stay for a property listing.');
    const { checkIn, checkOut, nights } = parseVoiceStayRange(input.args);
    const pricing = await loadPropertyPricing(propertyId);
    const total = computeDefaultBookingRateFromDefaults(
      new Date(`${checkIn}T00:00:00+08:00`),
      new Date(`${checkOut}T00:00:00+08:00`),
      nights,
      pricing,
      pricing
    );
    if (total == null) {
      return emptyResult('I could not calculate that stay total. Please check the booking page.');
    }
    const slug = await loadPropertySlug(propertyId);
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
      richCard: {
        kind: 'table',
        columns: ['Dates', 'Nights', 'Total'],
        rows: [[formatGuestStayRangeLabel(checkIn, checkOut), String(nights), `${total} pesos`]],
      },
    };
  }

  if (input.name === 'get_my_stay' || input.name === 'get_stay_guide') {
    if (!propertyId || !guestUserId) {
      return emptyResult('I could not find a booking for this property.');
    }
    const booking = await loadOwnBooking(propertyId, guestUserId);
    if (!booking) {
      return emptyResult('I could not find a booking for this property.');
    }
    if (input.name === 'get_my_stay') {
      const slug = await loadPropertySlug(propertyId);
      const bookingId = String(booking.id ?? '');
      if (slug && bookingId) {
        actions.push({
          type: 'open_trip',
          label: 'View stay',
          url: `/properties/${encodeURIComponent(slug)}/trip?bookingId=${encodeURIComponent(bookingId)}`,
        });
      } else {
        actions.push({ type: 'open_booking', label: 'View stay', url: '/account/stays' });
      }
      let spoken = `Your booking is ${String(booking.status).replaceAll('_', ' ').toLowerCase()}, from ${booking.check_in_date} to ${booking.check_out_date}.`;
      let richCard: GuestRichCard | null = null;
      try {
        const trip = await buildGuestTripPayload({ booking, issueAccessToken: false });
        const pending: string[] = [];
        if (trip) {
          for (const doc of trip.documents) {
            if (doc.status === 'pending') pending.push(doc.label);
          }
          if (trip.payment.amountDue != null && trip.payment.amountDue > 0) {
            pending.push(`Balance due ${trip.payment.amountDue} pesos`);
          }
          if (trip.actions.sdFormAvailable) pending.push('Security deposit refund form');
        }
        if (pending.length > 0) {
          spoken = `${spoken} Next: ${pending[0]}.`;
          richCard = { kind: 'checklist', title: 'Next steps', items: pending };
        }
      } catch (err) {
        console.warn('[guestReceptionistTools] get_my_stay trip payload:', err);
      }
      return { spokenText: sanitizeVoiceToolFact(spoken), actions, richCard };
    }

    const availability = await loadGuestSafeAvailabilityContext(propertyId);
    const checkIn = normalizeBookingDate(booking.check_in_date);
    const checkOut = normalizeBookingDate(booking.check_out_date);
    if (
      !checkIn ||
      !checkOut ||
      availability.asOfDate < checkIn ||
      availability.asOfDate > checkOut
    ) {
      return emptyResult('Stay-guide details are available only during your active stay.');
    }

    const token = String(booking.stay_guide_token ?? '').trim();
    let sections: StayGuideSectionDto[] = [];
    try {
      const byToken = token ? await loadGuestStayGuideByToken(token) : null;
      if (byToken && byToken !== STAY_GUIDE_PLAN_ACCESS_DENIED) {
        sections = byToken.sections;
      } else {
        const preview = await loadGuestStayGuidePreview(propertyId);
        sections = preview?.sections ?? [];
      }
    } catch (err) {
      console.warn('[guestReceptionistTools] get_stay_guide:', err);
    }
    const spoken =
      stayGuideSectionsToSpokenText(sections) ||
      'The stay guide for this listing is not published yet. Message the host.';
    const slug = await loadPropertySlug(propertyId);
    if (slug && token) {
      actions.push({
        type: 'open_stay_guide',
        label: 'Open stay guide',
        url: guestStayGuidePath('', slug, token),
      });
    } else if (slug) {
      actions.push({
        type: 'open_stay_guide',
        label: 'Open stay guide',
        url: `/properties/${encodeURIComponent(slug)}/stay-guide`,
      });
    }
    return { spokenText: sanitizeVoiceToolFact(spoken), actions };
  }

  if (input.name === 'get_parking_facts') {
    if (parkingId) {
      const parking = await loadParkingPublic(parkingId);
      if (!parking) return emptyResult('Parking details are not listed. Message the host.');
      const parts = [
        `${parking.name}, slot ${parking.slotLabel}.`,
        parking.ratePerNight != null ? `Nightly rate ${parking.ratePerNight} pesos.` : null,
        parking.checkInTime ? `Entry from ${parking.checkInTime}.` : null,
        parking.checkOutTime ? `Exit by ${parking.checkOutTime}.` : null,
        parking.spaceLengthM && parking.spaceWidthM
          ? `Space about ${parking.spaceLengthM} by ${parking.spaceWidthM} meters.`
          : null,
      ].filter(Boolean);
      if (parking.slug) {
        actions.push({
          type: 'open_property',
          label: 'View parking',
          url: `/parkings/${encodeURIComponent(parking.slug)}`,
        });
      }
      return {
        spokenText: sanitizeVoiceToolFact(parts.join(' ') || 'Parking details are not listed.'),
        actions,
      };
    }
    if (propertyId) {
      return {
        spokenText: sanitizeVoiceToolFact(await answerGuestSafeVoiceTopic(propertyId, 'parking')),
        actions,
      };
    }
    return emptyResult('Parking details are not listed. Message the host.');
  }

  if (input.name === 'get_directions') {
    if (parkingId) {
      const parking = await loadParkingPublic(parkingId);
      if (!parking) return emptyResult('The address is not listed. Message the host.');
      const address = [parking.address, parking.city].filter(Boolean).join(', ');
      const href = mapsUrlFromCoords(parking.latitude, parking.longitude);
      if (href) {
        actions.push({ type: 'open_map', label: 'Open map', url: href });
      }
      return {
        spokenText: sanitizeVoiceToolFact(
          address ? `The parking is at ${address}.` : 'The address is not listed. Message the host.'
        ),
        actions,
        richCard: href ? { kind: 'map', href, label: parking.name } : null,
      };
    }
    if (propertyId) {
      const property = await loadGuestSafePropertyContext(propertyId);
      if (!property) return emptyResult('The address is not listed. Message the host.');
      const address =
        [property.address, property.city].filter(Boolean).join(', ') || property.locationLabel;
      const href = property.mapsUrl?.trim() || null;
      if (href) {
        actions.push({ type: 'open_map', label: 'Open map', url: href });
      }
      const slug = await loadPropertySlug(propertyId);
      if (slug) {
        actions.push({
          type: 'open_property',
          label: 'View property',
          url: `/properties/${encodeURIComponent(slug)}`,
        });
      }
      return {
        spokenText: sanitizeVoiceToolFact(
          address
            ? `The property is at ${address}.`
            : 'The address is not listed. Message the host.'
        ),
        actions,
        richCard: href ? { kind: 'map', href, label: property.name } : null,
      };
    }
    return emptyResult('The address is not listed. Message the host.');
  }

  const propertySlug = propertyId ? await loadPropertySlug(propertyId) : null;
  actions.push({
    type: 'open_text_chat',
    label: 'Message host',
    url: propertySlug
      ? `/account/messages?property=${encodeURIComponent(propertySlug)}`
      : '/account/messages',
  });
  return { spokenText: 'You can message the host now.', actions };
}

export async function executeVoiceReceptionistTool(input: {
  name: VoiceReceptionistToolName;
  args: Record<string, unknown>;
  propertyId: string;
  guestUserId: string;
}): Promise<VoiceToolResult> {
  const result = await executeGuestReceptionistTool({
    name: input.name,
    args: input.args,
    propertyId: input.propertyId,
    parkingId: null,
    guestUserId: input.guestUserId,
  });
  return toVoiceToolResult(result);
}
