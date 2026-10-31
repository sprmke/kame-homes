/** Guests aged 18+ count as adults everywhere except Azure occupancy checks on the guest form. */
export const ADULT_MIN_AGE = 18;

/** Valid government ID required for guests 18 and above. */
export const VALID_ID_MIN_AGE = ADULT_MIN_AGE;

/** Primary guest must be an adult — minors cannot be the primary guest. */
export const PRIMARY_GUEST_MIN_AGE = ADULT_MIN_AGE;

/** Default age pre-filled on guest age inputs. */
export const DEFAULT_GUEST_AGE = PRIMARY_GUEST_MIN_AGE;

/** Building occupancy rule: ages at or below this count as a child for capacity limits. */
export const OCCUPANCY_CHILD_MAX_AGE = 3;

/** @deprecated Use OCCUPANCY_CHILD_MAX_AGE */
export const AZURE_CHILD_MAX_AGE = OCCUPANCY_CHILD_MAX_AGE;

/** Max/default age for the overflow party guest when adults are already at capacity. */
export const FIFTH_PARTY_GUEST_MAX_AGE = OCCUPANCY_CHILD_MAX_AGE;

/** @deprecated Use property maxAdults from get-guest-payment-info */
export const AZURE_MAX_ADULTS = 4;

export const MAX_GUESTS = 5;

export type PropertyGuestCapacity = {
  maxAdults: number;
  maxChildren: number;
};

export const DEFAULT_PROPERTY_GUEST_CAPACITY: PropertyGuestCapacity = {
  maxAdults: AZURE_MAX_ADULTS,
  maxChildren: 1,
};

export function buildGuestLimitMessage(
  capacity: PropertyGuestCapacity,
  partySize = 0,
  maxPartySlots = MAX_GUESTS
): string {
  const childLabel = capacity.maxChildren === 1 ? 'child' : 'children';
  const base = `Please note that this unit allows a maximum of ${capacity.maxAdults} adults and ${capacity.maxChildren} ${childLabel} in the unit and at the swimming pool.`;
  const maxPartySize = Math.min(capacity.maxAdults + capacity.maxChildren, maxPartySlots);
  if (partySize >= maxPartySize && capacity.maxChildren > 0) {
    return `${base} Please enter age ${OCCUPANCY_CHILD_MAX_AGE} or below for the ${maxPartySize}${maxPartySize === 1 ? 'st' : maxPartySize === 2 ? 'nd' : maxPartySize === 3 ? 'rd' : 'th'} guest when adults are at capacity.`;
  }
  return base;
}

/** @deprecated Use buildGuestLimitMessage with property capacity */
export const AZURE_ADULT_LIMIT_MESSAGE = buildGuestLimitMessage(
  DEFAULT_PROPERTY_GUEST_CAPACITY,
  MAX_GUESTS
);

/** Default age when adding a guest on the public guest form (overflow slot → child age). */
export function getDefaultAgeForGuestFormPartyGuest(
  partyPosition: number,
  partySize: number,
  capacity: PropertyGuestCapacity = DEFAULT_PROPERTY_GUEST_CAPACITY
): number {
  if (isPartyOverflowGuest(partyPosition, partySize, capacity)) {
    return FIFTH_PARTY_GUEST_MAX_AGE;
  }
  return DEFAULT_GUEST_AGE;
}

/** @deprecated Use getDefaultAgeForGuestFormPartyGuest on the public guest form only. */
export function getDefaultAgeForPartyGuest(partyPosition: number, partySize: number): number {
  return getDefaultAgeForGuestFormPartyGuest(partyPosition, partySize);
}

/** Active party size = highest slot with a name or age (1–5). */
export function getActivePartySize(guests: GuestSlotValues[]): number {
  return getInitialVisibleGuestCount(guests);
}

/** True for the last party slot when adults are at capacity and a child slot is expected. */
export function isPartyOverflowGuest(
  partyPosition: number,
  partySize: number,
  capacity: PropertyGuestCapacity = DEFAULT_PROPERTY_GUEST_CAPACITY,
  maxPartySlots = MAX_GUESTS
): boolean {
  const maxPartySize = Math.min(capacity.maxAdults + capacity.maxChildren, maxPartySlots);
  return partySize === maxPartySize && partyPosition === maxPartySize && capacity.maxChildren > 0;
}

/** @deprecated Use isPartyOverflowGuest */
export function isPartyFifthGuest(partyPosition: number, partySize: number): boolean {
  return isPartyOverflowGuest(partyPosition, partySize, DEFAULT_PROPERTY_GUEST_CAPACITY);
}

/** Normalize RHF / Zod age input — empty must not coerce to 0. */
export function preprocessGuestAgeInput(value: unknown): unknown {
  if (value === '' || value === null || value === undefined) return undefined;
  if (typeof value === 'number' && Number.isNaN(value)) return undefined;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Cleared ages use `null` in form state — `undefined` makes RHF fall back to
 * defaultValues (e.g. primary guest snaps back to 18).
 */
export function parseGuestAgeInputChange(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits === '') return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatGuestAgeInputValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number' && !Number.isNaN(value)) return String(value);
  return '';
}

function exceedsAdultLimit(adults: number, maxAdults: number): boolean {
  return adults > maxAdults;
}

function exceedsChildLimit(children: number, maxChildren: number): boolean {
  return children > maxChildren;
}

/** Show guest-limit guidance when occupancy counts exceed property capacity or party is full. */
export function shouldShowGuestLimitMessage(
  occupancyAdultCount: number,
  occupancyChildCount: number,
  capacity: PropertyGuestCapacity,
  partySize = 0,
  maxPartySlots = MAX_GUESTS
): boolean {
  const maxPartySize = Math.min(capacity.maxAdults + capacity.maxChildren, maxPartySlots);
  if (partySize >= maxPartySize) return true;
  return (
    exceedsAdultLimit(occupancyAdultCount, capacity.maxAdults) ||
    exceedsChildLimit(occupancyChildCount, capacity.maxChildren)
  );
}

/** @deprecated Use shouldShowGuestLimitMessage */
export function shouldShowAzureAdultLimitMessage(azureAdultCount: number, partySize = 0): boolean {
  return shouldShowGuestLimitMessage(
    azureAdultCount,
    0,
    DEFAULT_PROPERTY_GUEST_CAPACITY,
    partySize
  );
}

/** General rule: under 18 = child. */
function isGeneralChildAge(age: number): boolean {
  return age < ADULT_MIN_AGE;
}

/** Azure occupancy rule: age 3 and below = child. Guest form capacity checks only. */
function isOccupancyChildAge(age: number): boolean {
  return age <= OCCUPANCY_CHILD_MAX_AGE;
}

export function requiresValidId(age: number): boolean {
  return age >= VALID_ID_MIN_AGE;
}

export type GuestSlotValues = {
  name?: string;
  age?: number | null;
};

/** Count adults/children using the general 18+ rule (named guests only). */
export function computeGuestCounts(guests: GuestSlotValues[]): {
  adults: number;
  children: number;
} {
  let adults = 0;
  let children = 0;

  for (const guest of guests) {
    const name = guest.name?.trim();
    if (!name) continue;

    const age = guest.age;
    if (age == null || Number.isNaN(age)) continue;

    if (isGeneralChildAge(age)) {
      children += 1;
    } else {
      adults += 1;
    }
  }

  return {
    adults: Math.max(adults, 1),
    children,
  };
}

/** Occupancy counts from ages alone — public guest form validation/banner only. */
export function computeOccupancyGuestCountsByAge(guests: Array<{ age?: number | null }>): {
  adults: number;
  children: number;
} {
  let adults = 0;
  let children = 0;

  for (const guest of guests) {
    const age = guest.age;
    if (age == null || Number.isNaN(age)) continue;

    if (isOccupancyChildAge(age)) {
      children += 1;
    } else {
      adults += 1;
    }
  }

  return { adults, children };
}

/** @deprecated Use computeOccupancyGuestCountsByAge */
export function computeAzureGuestCountsByAge(guests: Array<{ age?: number | null }>): {
  adults: number;
  children: number;
} {
  return computeOccupancyGuestCountsByAge(guests);
}

/** @deprecated Use computeAzureGuestCountsByAge on the guest form; computeGuestCounts elsewhere. */
export function computeGuestCountsByAge(guests: Array<{ age?: number | null }>): {
  adults: number;
  children: number;
} {
  return computeAzureGuestCountsByAge(guests);
}

export type BookingGuestAgeFields = {
  primary_guest_name?: string | null;
  primary_guest_age?: number | null;
  guest2_name?: string | null;
  guest2_age?: number | null;
  guest3_name?: string | null;
  guest3_age?: number | null;
  guest4_name?: string | null;
  guest4_age?: number | null;
  guest5_name?: string | null;
  guest5_age?: number | null;
  number_of_adults?: number | null;
  number_of_children?: number | null;
};

export function bookingGuestSlotsFromRow(row: BookingGuestAgeFields): GuestSlotValues[] {
  return [
    {
      name: row.primary_guest_name ?? undefined,
      age: row.primary_guest_age ?? undefined,
    },
    { name: row.guest2_name ?? undefined, age: row.guest2_age ?? undefined },
    { name: row.guest3_name ?? undefined, age: row.guest3_age ?? undefined },
    { name: row.guest4_name ?? undefined, age: row.guest4_age ?? undefined },
    { name: row.guest5_name ?? undefined, age: row.guest5_age ?? undefined },
  ];
}

/** Prefer recomputing from per-guest ages; fall back to stored DB counts. */
export function resolveGuestCountsFromBooking(row: BookingGuestAgeFields): {
  adults: number;
  children: number;
} {
  const slots = bookingGuestSlotsFromRow(row);
  const hasPerGuestAge = slots.some(
    (slot) => slot.name?.trim() && slot.age != null && !Number.isNaN(slot.age)
  );
  if (hasPerGuestAge) {
    return computeGuestCounts(slots);
  }
  return {
    adults: Math.max(row.number_of_adults ?? 1, 1),
    children: row.number_of_children ?? 0,
  };
}

/** How many guest cards to show when loading or seeding the form. */
export function getInitialVisibleGuestCount(guests: GuestSlotValues[]): number {
  let highest = 1;
  guests.forEach((guest, index) => {
    if (guest.name?.trim() || guest.age != null) {
      highest = Math.max(highest, index + 1);
    }
  });
  return Math.min(MAX_GUESTS, highest);
}

const PARTY_GUEST_LABELS = [
  'Primary Guest',
  'Second Guest',
  'Third Guest',
  'Fourth Guest',
  'Fifth Guest',
] as const;

export function guestPartyPositionLabel(partyPosition: number): string {
  return PARTY_GUEST_LABELS[partyPosition - 1] ?? `Guest ${partyPosition}`;
}

const ADDITIONAL_GUEST_ORDINALS = ['second', 'third', 'fourth', 'fifth'] as const;

export function additionalGuestOrdinal(index: number): string {
  return ADDITIONAL_GUEST_ORDINALS[index - 1] ?? `guest ${index + 1}`;
}

export type BookingGuestCounts = {
  adults: number;
  children: number;
};

export function resolveListingGuestCapacity(
  maxGuests: number,
  maxAdults?: number | null,
  maxChildren?: number | null
): PropertyGuestCapacity & { maxGuests: number } {
  const total = Math.max(1, maxGuests);
  if (maxAdults != null && maxAdults > 0 && maxChildren != null && maxChildren >= 0) {
    return {
      maxAdults,
      maxChildren,
      maxGuests: total,
    };
  }
  const adults = Math.min(Math.max(4, total - 1), total);
  const children = Math.max(0, total - adults);
  return { maxAdults: adults, maxChildren: children, maxGuests: total };
}

export function clampBookingGuestCounts(
  counts: BookingGuestCounts,
  capacity: PropertyGuestCapacity,
  maxGuests?: number
): BookingGuestCounts {
  const totalCap = Math.max(1, maxGuests ?? capacity.maxAdults + capacity.maxChildren);
  let adults = Math.max(1, Math.min(counts.adults, capacity.maxAdults, totalCap));
  let children = Math.max(0, Math.min(counts.children, capacity.maxChildren));

  while (adults + children > totalCap) {
    if (children > 0) {
      children -= 1;
    } else {
      adults = Math.max(1, adults - 1);
    }
  }

  return { adults, children };
}

export function canAdjustBookingGuestCount(
  key: keyof BookingGuestCounts,
  delta: number,
  counts: BookingGuestCounts,
  capacity: PropertyGuestCapacity,
  maxGuests?: number
): boolean {
  if (delta === 0) return false;
  const next = clampBookingGuestCounts(
    { ...counts, [key]: counts[key] + delta },
    capacity,
    maxGuests
  );
  return next[key] === counts[key] + delta;
}

export function adjustBookingGuestCount(
  key: keyof BookingGuestCounts,
  delta: number,
  counts: BookingGuestCounts,
  capacity: PropertyGuestCapacity,
  maxGuests?: number
): BookingGuestCounts {
  return clampBookingGuestCounts({ ...counts, [key]: counts[key] + delta }, capacity, maxGuests);
}

export function formatBookingGuestSummary(counts: BookingGuestCounts): string {
  const total = counts.adults + counts.children;
  if (counts.children === 0) {
    return `${total} guest${total === 1 ? '' : 's'}`;
  }
  const adultLabel = `${counts.adults} adult${counts.adults === 1 ? '' : 's'}`;
  const childLabel = `${counts.children} ${counts.children === 1 ? 'child' : 'children'}`;
  return `${adultLabel}, ${childLabel}`;
}
