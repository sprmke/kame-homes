import { DEFAULT_RESIDENCE_NAME } from '@/features/dashboard/org/lib/propertyConstants';

export type PropertyResidence = {
  name: string;
  towers: readonly string[];
};

export const PROPERTY_RESIDENCES: readonly PropertyResidence[] = [
  {
    name: DEFAULT_RESIDENCE_NAME,
    towers: ['Monaco', 'Bali', 'Barbados'],
  },
] as const;

export function getPropertyResidenceNames(): string[] {
  return PROPERTY_RESIDENCES.map((entry) => entry.name);
}

export function isKnownResidence(residenceName: string): boolean {
  const normalized = residenceName.trim();
  return PROPERTY_RESIDENCES.some((entry) => entry.name === normalized);
}

export function getTowersForResidence(residenceName: string): readonly string[] {
  const normalized = residenceName.trim();
  const match = PROPERTY_RESIDENCES.find((entry) => entry.name === normalized);
  return match?.towers ?? [];
}

export function isTowerInResidence(tower: string, residenceName: string): boolean {
  return getTowersForResidence(residenceName).includes(tower);
}

export function isCondoPropertyType(type: string): boolean {
  return type.trim().toLowerCase() === 'condo';
}

export const ALL_PROPERTY_TOWERS = [
  ...new Set(PROPERTY_RESIDENCES.flatMap((entry) => [...entry.towers])),
] as const;

export const DEFAULT_PROPERTY_TOWER = 'Monaco' as const;
