/** Mirrors `ui/src/features/guest-form/lib/guestCounts.ts` — keep adult/child rules in sync. */

export const ADULT_MIN_AGE = 18;
export const AZURE_CHILD_MAX_AGE = 3;
export const AZURE_MAX_ADULTS = 4;
export const FIFTH_PARTY_GUEST_MAX_AGE = AZURE_CHILD_MAX_AGE;
export const MAX_GUESTS = 5;

export type GuestSlot = {
  name?: string | null;
  age?: unknown;
};

function parseGuestAge(age: unknown): number | null {
  if (age == null || age === '') return null;
  const n = Number(age);
  return Number.isFinite(n) ? n : null;
}

function isGeneralChildAge(age: number): boolean {
  return age < ADULT_MIN_AGE;
}

function isAzureChildAge(age: number): boolean {
  return age <= AZURE_CHILD_MAX_AGE;
}

/** General rule: guests under 18 = child. Named slots only. */
export function computeGuestCounts(guests: GuestSlot[]): {
  adults: number;
  children: number;
} {
  let adults = 0;
  let children = 0;

  for (const guest of guests) {
    const name = guest.name?.trim();
    if (!name) continue;

    const age = parseGuestAge(guest.age);
    if (age == null) continue;

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

/** Azure occupancy counts — guest form validation only. */
export function computeAzureGuestCountsByAge(guests: GuestSlot[]): {
  adults: number;
  children: number;
} {
  let adults = 0;
  let children = 0;

  for (const guest of guests) {
    const age = parseGuestAge(guest.age);
    if (age == null) continue;

    if (isAzureChildAge(age)) {
      children += 1;
    } else {
      adults += 1;
    }
  }

  return { adults, children };
}

export type PropertyGuestCapacity = {
  maxAdults: number;
  maxChildren: number;
};

/** Property-scoped party rules enforced on public guest form submit only. */
export function assertPropertyGuestPartyRules(
  guests: GuestSlot[],
  capacity: PropertyGuestCapacity
): void {
  const partySize = getActivePartySize(guests);

  if (partySize === MAX_GUESTS) {
    const fifthAge = parseGuestAge(guests[MAX_GUESTS - 1]?.age);
    if (fifthAge != null && fifthAge > FIFTH_PARTY_GUEST_MAX_AGE) {
      throw new Error(`The 5th guest must be ${FIFTH_PARTY_GUEST_MAX_AGE} years old or younger`);
    }
  }

  const activeGuests = guests.filter((guest) => {
    const age = parseGuestAge(guest.age);
    return guest.name?.trim() || age != null;
  });

  const occupancyCounts = computeAzureGuestCountsByAge(activeGuests);

  if (
    occupancyCounts.adults > capacity.maxAdults ||
    occupancyCounts.children > capacity.maxChildren
  ) {
    const childLabel = capacity.maxChildren === 1 ? 'child' : 'children';
    throw new Error(
      `Please note that this unit allows a maximum of ${capacity.maxAdults} adults and ${capacity.maxChildren} ${childLabel} in the unit and at the swimming pool.`
    );
  }
}

export function getActivePartySize(guests: GuestSlot[]): number {
  let highest = 1;
  guests.forEach((guest, index) => {
    const age = parseGuestAge(guest.age);
    if (guest.name?.trim() || age != null) {
      highest = Math.max(highest, index + 1);
    }
  });
  return Math.min(MAX_GUESTS, highest);
}

/** Azure party rules enforced on public guest form submit only. */
export function assertAzureGuestPartyRules(guests: GuestSlot[]): void {
  const partySize = getActivePartySize(guests);

  if (partySize === MAX_GUESTS) {
    const fifthAge = parseGuestAge(guests[MAX_GUESTS - 1]?.age);
    if (fifthAge != null && fifthAge > FIFTH_PARTY_GUEST_MAX_AGE) {
      throw new Error(`The 5th guest must be ${FIFTH_PARTY_GUEST_MAX_AGE} years old or younger`);
    }
  }

  const azureCounts = computeAzureGuestCountsByAge(
    guests.filter((guest) => {
      const age = parseGuestAge(guest.age);
      return guest.name?.trim() || age != null;
    })
  );

  if (azureCounts.adults > AZURE_MAX_ADULTS) {
    throw new Error(
      'Please note that Azure only allows a maximum of 4 adults and 1 child in the unit and at the swimming pool. Please enter age 3 or below for the 5th guest.'
    );
  }
}

export function guestPartySlotsFromFormData(formData: FormData): GuestSlot[] {
  const primaryGuestName = (formData.get('primaryGuestName') as string)?.trim() || '';
  const guest2Name = (formData.get('guest2Name') as string)?.trim() || '';
  const guest3Name = (formData.get('guest3Name') as string)?.trim() || '';
  const guest4Name = (formData.get('guest4Name') as string)?.trim() || '';
  const guest5Name = (formData.get('guest5Name') as string)?.trim() || '';

  return [
    { name: primaryGuestName, age: formData.get('primaryGuestAge') },
    { name: guest2Name, age: formData.get('guest2Age') },
    { name: guest3Name, age: formData.get('guest3Age') },
    { name: guest4Name, age: formData.get('guest4Age') },
    { name: guest5Name, age: formData.get('guest5Age') },
  ];
}
