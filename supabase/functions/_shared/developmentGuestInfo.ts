/**
 * Guest-safe development/residence facts for AI grounding.
 * Resolves property.residence_name → developments row.
 */

import type { SupabaseClient } from './supabaseJs.ts';
import { parseDocumentRequirements } from './documentRequirements.ts';
import { trimOrEmpty } from './stringUtils.ts';

export type DevelopmentGuestGuide = {
  id: string;
  title: string;
  content: string;
};

/** Keep in sync with ui/src/features/dashboard/super-admin/lib/developmentGuestInfo.ts */
export const AZURE_NORTH_RESIDENCE_NAME = 'Azure North Residences';
export const DEFAULT_AZURE_NORTH_POOL_FEE = 200;
export const DEFAULT_AZURE_NORTH_POOL_SCHEDULE = '7 AM to 7 PM. Maintenance every Tuesday.';

function isAzureNorthResidence(developmentName: string): boolean {
  return developmentName.trim().toLowerCase() === AZURE_NORTH_RESIDENCE_NAME.toLowerCase();
}

function mergeDevelopmentPoolSettings(
  developmentName: string,
  poolFee: number | null,
  poolSchedule: string
): { poolFee: number | null; poolSchedule: string } {
  if (!isAzureNorthResidence(developmentName)) {
    return { poolFee, poolSchedule };
  }
  return {
    poolFee: poolFee ?? DEFAULT_AZURE_NORTH_POOL_FEE,
    poolSchedule: poolSchedule.trim() || DEFAULT_AZURE_NORTH_POOL_SCHEDULE,
  };
}

export type DevelopmentGuestContextDto = {
  name: string;
  developerName: string | null;
  description: string | null;
  locationLabel: string;
  amenities: string[];
  poolFee: number | null;
  poolSchedule: string;
  guestRequirements: string;
  guestGuides: DevelopmentGuestGuide[];
  importantInfo: string;
  documentRequirementLabels: string[];
};

function readString(settings: Record<string, unknown>, key: string): string {
  const value = settings[key];
  return typeof value === 'string' ? value.trim() : '';
}

function readStringArray(settings: Record<string, unknown>, key: string): string[] {
  const value = settings[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readNumberOrNull(settings: Record<string, unknown>, key: string): number | null {
  const value = settings[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export const DEVELOPMENT_GUEST_INFO_MAX_TEXT = 4000;
export const DEVELOPMENT_GUEST_GUIDE_MAX_CONTENT = 2000;
export const DEVELOPMENT_GUEST_GUIDE_MAX_TITLE = 120;

export function validateDevelopmentGuestInfoSettings(
  settings: Record<string, unknown>
): string | null {
  const guestRequirements = readString(settings, 'guestRequirements');
  const importantInfo = readString(settings, 'importantInfo');
  const poolSchedule = readString(settings, 'poolSchedule');

  if (guestRequirements.length > DEVELOPMENT_GUEST_INFO_MAX_TEXT) {
    return `Requirements must be ${DEVELOPMENT_GUEST_INFO_MAX_TEXT} characters or fewer`;
  }
  if (importantInfo.length > DEVELOPMENT_GUEST_INFO_MAX_TEXT) {
    return `Other information must be ${DEVELOPMENT_GUEST_INFO_MAX_TEXT} characters or fewer`;
  }
  if (poolSchedule.length > DEVELOPMENT_GUEST_INFO_MAX_TEXT) {
    return `Pool schedule must be ${DEVELOPMENT_GUEST_INFO_MAX_TEXT} characters or fewer`;
  }

  const guides = parseGuestGuides(settings.guestGuides);
  for (const guide of guides) {
    if (guide.title.length > DEVELOPMENT_GUEST_GUIDE_MAX_TITLE) {
      return `Guide title must be ${DEVELOPMENT_GUEST_GUIDE_MAX_TITLE} characters or fewer`;
    }
    if (guide.content.length > DEVELOPMENT_GUEST_GUIDE_MAX_CONTENT) {
      return `Guide content must be ${DEVELOPMENT_GUEST_GUIDE_MAX_CONTENT} characters or fewer`;
    }
  }

  const poolFee = readNumberOrNull(settings, 'poolFee');
  if (poolFee != null && poolFee < 0) return 'Pool fee cannot be negative';

  return null;
}

export function parseGuestGuides(value: unknown): DevelopmentGuestGuide[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const id = typeof row.id === 'string' ? row.id.trim() : '';
      const title = typeof row.title === 'string' ? row.title.trim() : '';
      const content = typeof row.content === 'string' ? row.content.trim() : '';
      if (!id || !title || !content) return null;
      return { id, title, content };
    })
    .filter((entry): entry is DevelopmentGuestGuide => entry !== null);
}

function buildLocationLabel(
  location: string | null,
  city: string | null,
  settings: Record<string, unknown>
): string {
  const address = readString(settings, 'address');
  const province = readString(settings, 'province');
  const country = readString(settings, 'country') || 'Philippines';
  const parts = [location?.trim(), city?.trim(), province, country].filter(Boolean);
  return parts.join(', ') || address || city?.trim() || '';
}

function documentRequirementLabels(settings: Record<string, unknown>): string[] {
  const workflowDefaults =
    settings.workflowDefaults && typeof settings.workflowDefaults === 'object'
      ? (settings.workflowDefaults as Record<string, unknown>)
      : null;
  const parsed = parseDocumentRequirements(workflowDefaults?.documentRequirements) ?? [];
  return parsed.map((row) => row.label.trim()).filter(Boolean);
}

export function developmentGuestContextFromRow(row: {
  name: string;
  developer_name: string | null;
  description: string | null;
  location: string | null;
  city: string | null;
  settings: Record<string, unknown> | null;
}): DevelopmentGuestContextDto {
  const settings = row.settings ?? {};
  const pool = mergeDevelopmentPoolSettings(
    row.name,
    readNumberOrNull(settings, 'poolFee'),
    readString(settings, 'poolSchedule')
  );
  return {
    name: row.name,
    developerName: row.developer_name,
    description: row.description,
    locationLabel: buildLocationLabel(row.location, row.city, settings),
    amenities: readStringArray(settings, 'amenities'),
    poolFee: pool.poolFee,
    poolSchedule: pool.poolSchedule,
    guestRequirements: readString(settings, 'guestRequirements'),
    guestGuides: parseGuestGuides(settings.guestGuides),
    importantInfo: readString(settings, 'importantInfo'),
    documentRequirementLabels: documentRequirementLabels(settings),
  };
}

export async function loadGuestSafeDevelopmentContextByName(
  supabase: SupabaseClient,
  residenceName: string
): Promise<DevelopmentGuestContextDto | null> {
  const name = trimOrEmpty(residenceName);
  if (!name) return null;

  const { data, error } = await supabase
    .from('developments')
    .select('name, developer_name, description, location, city, settings, status')
    .eq('name', name)
    .maybeSingle();

  if (error) {
    console.warn('[developmentGuestInfo] load failed:', error.message);
    return null;
  }
  if (!data || data.status === 'INACTIVE') return null;

  return developmentGuestContextFromRow(
    data as {
      name: string;
      developer_name: string | null;
      description: string | null;
      location: string | null;
      city: string | null;
      settings: Record<string, unknown> | null;
    }
  );
}

export function renderDevelopmentGuestFacts(development: DevelopmentGuestContextDto): string {
  const lines = [`Development / residence: ${development.name}`];

  if (development.developerName) {
    lines.push(`Developer: ${development.developerName}`);
  }
  if (development.locationLabel) {
    lines.push(`Development location: ${development.locationLabel}`);
  }
  if (development.description) {
    lines.push(`Development overview: ${development.description}`);
  }
  if (development.amenities.length > 0) {
    lines.push(`Development amenities: ${development.amenities.join(', ')}`);
  }
  if (development.poolFee != null) {
    lines.push(`Pool fee (PHP): ${development.poolFee}`);
  }
  if (development.poolSchedule) {
    lines.push(`Pool schedule: ${development.poolSchedule}`);
  }
  if (development.guestRequirements) {
    lines.push(`Building / residence requirements: ${development.guestRequirements}`);
  }
  if (development.documentRequirementLabels.length > 0) {
    lines.push(
      `Required documents for stays in this development: ${development.documentRequirementLabels.join('; ')}`
    );
  }
  if (development.guestGuides.length > 0) {
    lines.push(
      'Development guides:\n' +
        development.guestGuides.map((guide) => `- ${guide.title}: ${guide.content}`).join('\n')
    );
  }
  if (development.importantInfo) {
    lines.push(`Other development information: ${development.importantInfo}`);
  }

  return lines.join('\n');
}

export function collectDevelopmentPricingValues(development: DevelopmentGuestContextDto): number[] {
  const values: number[] = [];
  if (development.poolFee != null) values.push(development.poolFee);
  return values;
}
