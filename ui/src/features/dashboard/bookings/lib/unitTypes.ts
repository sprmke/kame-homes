/** Client mirror of `supabase/functions/_shared/unitTypes.ts` — keep in sync. */

export type DevelopmentUnitType = {
  id: string;
  label: string;
  bedrooms: number;
  bathrooms: number;
  maxAdults: number;
  maxChildren: number;
};

export const AZURE_NORTH_RESIDENCE_NAME = 'Azure North Residences';

export const DEFAULT_AZURE_NORTH_UNIT_TYPES: DevelopmentUnitType[] = [
  { id: 'studio', label: 'Studio', bedrooms: 1, bathrooms: 1, maxAdults: 4, maxChildren: 1 },
  { id: '1br', label: '1 bedroom', bedrooms: 1, bathrooms: 1, maxAdults: 6, maxChildren: 2 },
  { id: '2br', label: '2 bedroom', bedrooms: 2, bathrooms: 1, maxAdults: 8, maxChildren: 3 },
];

export const GENERIC_UNIT_TYPES: DevelopmentUnitType[] = [
  {
    id: 'standard',
    label: 'Standard',
    bedrooms: 1,
    bathrooms: 1,
    maxAdults: 4,
    maxChildren: 2,
  },
];

function trimOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readNonNegativeNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function readPositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

export function defaultUnitTypesForResidence(residenceName: string): DevelopmentUnitType[] {
  const normalized = residenceName.trim().toLowerCase();
  if (normalized === AZURE_NORTH_RESIDENCE_NAME.toLowerCase()) {
    return DEFAULT_AZURE_NORTH_UNIT_TYPES.map((entry) => ({ ...entry }));
  }
  return GENERIC_UNIT_TYPES.map((entry) => ({ ...entry }));
}

export function parseUnitTypes(raw: unknown): DevelopmentUnitType[] | null {
  if (!Array.isArray(raw)) return null;

  const parsed: DevelopmentUnitType[] = [];
  const seenIds = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

    const record = item as Record<string, unknown>;
    const id = trimOrEmpty(record.id);
    const label = trimOrEmpty(record.label);
    if (!id || !label) return null;
    if (seenIds.has(id)) return null;
    seenIds.add(id);

    const bedrooms = readNonNegativeNumber(record.bedrooms, 1);
    const bathrooms = readNonNegativeNumber(record.bathrooms, 1);
    const maxAdults = readPositiveInt(record.maxAdults, 0);
    const maxChildren = readPositiveInt(record.maxChildren, 0);
    if (maxAdults < 1) return null;

    parsed.push({ id, label, bedrooms, bathrooms, maxAdults, maxChildren });
  }

  return parsed.length > 0 ? parsed : null;
}

export function mergeUnitTypes(raw: unknown, residenceName: string): DevelopmentUnitType[] {
  const parsed = parseUnitTypes(raw);
  if (parsed) return parsed;
  return defaultUnitTypesForResidence(residenceName);
}

export function findUnitTypeById(
  unitTypes: DevelopmentUnitType[],
  unitTypeId: string
): DevelopmentUnitType | undefined {
  const normalized = unitTypeId.trim();
  if (!normalized) return undefined;
  return unitTypes.find((entry) => entry.id === normalized);
}

export function resolveUnitTypeIdFromCapacity(
  unitTypes: DevelopmentUnitType[],
  maxAdults: number,
  maxChildren: number
): string {
  const match = unitTypes.find(
    (entry) => entry.maxAdults === maxAdults && entry.maxChildren === maxChildren
  );
  return match?.id ?? unitTypes[0]?.id ?? '';
}

export function validateUnitTypes(unitTypes: DevelopmentUnitType[]): string | null {
  if (unitTypes.length === 0) return 'Add at least one unit type';
  for (const entry of unitTypes) {
    if (!entry.id.trim()) return 'Each unit type needs an id';
    if (!entry.label.trim()) return 'Each unit type needs a label';
    if (entry.bedrooms < 0) return `${entry.label}: bedrooms cannot be negative`;
    if (entry.bathrooms < 0) return `${entry.label}: bathrooms cannot be negative`;
    if (entry.maxAdults < 1) return `${entry.label}: max adults must be at least 1`;
    if (entry.maxChildren < 0) return `${entry.label}: max children cannot be negative`;
  }
  const ids = unitTypes.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) return 'Unit type ids must be unique';
  return null;
}

export function slugifyUnitTypeId(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'unit-type';
}

export function addUnitType(list: DevelopmentUnitType[], label: string): DevelopmentUnitType[] {
  const baseId = slugifyUnitTypeId(label);
  let id = baseId;
  let suffix = 2;
  while (list.some((entry) => entry.id === id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  return [
    ...list,
    {
      id,
      label: label.trim(),
      bedrooms: 1,
      bathrooms: 1,
      maxAdults: 4,
      maxChildren: 1,
    },
  ];
}

export function updateUnitType(
  list: DevelopmentUnitType[],
  id: string,
  patch: Partial<
    Pick<DevelopmentUnitType, 'label' | 'bedrooms' | 'bathrooms' | 'maxAdults' | 'maxChildren'>
  >
): DevelopmentUnitType[] {
  return list.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));
}

export function removeUnitType(list: DevelopmentUnitType[], id: string): DevelopmentUnitType[] {
  return list.filter((entry) => entry.id !== id);
}

export function applyUnitTypeDefaultsToProfile(
  unitType: DevelopmentUnitType
): Pick<DevelopmentUnitType, 'bedrooms' | 'bathrooms' | 'maxAdults' | 'maxChildren'> {
  return {
    bedrooms: unitType.bedrooms,
    bathrooms: unitType.bathrooms,
    maxAdults: unitType.maxAdults,
    maxChildren: unitType.maxChildren,
  };
}
