import {
  AZURE_NORTH_PARKING_LEVELS,
  AZURE_NORTH_PARKING_TOWERS,
} from '@/features/dashboard/org/lib/parkingResidences';
import { DEFAULT_RESIDENCE_NAME } from '@/features/dashboard/org/lib/propertyConstants';
import { PROPERTY_RESIDENCES } from '@/features/dashboard/org/lib/propertyResidences';

export type OrgDevelopment = {
  /** Stored as `residence_name` on properties and parkings */
  name: string;
  propertyTowers: readonly string[];
  parkingTowers: readonly string[];
  parkingLevels: readonly string[];
};

/** Supported developments for org asset onboarding — extend when new residences ship */
export const ORG_DEVELOPMENTS: readonly OrgDevelopment[] = [
  {
    name: DEFAULT_RESIDENCE_NAME,
    propertyTowers: PROPERTY_RESIDENCES[0]!.towers,
    parkingTowers: AZURE_NORTH_PARKING_TOWERS,
    parkingLevels: AZURE_NORTH_PARKING_LEVELS,
  },
] as const;

export const DEFAULT_DEVELOPMENT_NAME = ORG_DEVELOPMENTS[0]!.name;

export function getOrgDevelopmentNames(): string[] {
  return ORG_DEVELOPMENTS.map((entry) => entry.name);
}

export function getOrgDevelopment(name: string): OrgDevelopment | undefined {
  const normalized = name.trim();
  return ORG_DEVELOPMENTS.find((entry) => entry.name === normalized);
}

export function isKnownOrgDevelopment(name: string): boolean {
  return Boolean(getOrgDevelopment(name));
}

export function getPropertyTowersForDevelopment(name: string): readonly string[] {
  return getOrgDevelopment(name)?.propertyTowers ?? [];
}

export function getParkingTowersForDevelopment(name: string): readonly string[] {
  return getOrgDevelopment(name)?.parkingTowers ?? [];
}

export function getParkingLevelsForDevelopment(name: string): readonly string[] {
  return getOrgDevelopment(name)?.parkingLevels ?? [];
}
