export type DevelopmentGuestGuide = {
  id: string;
  title: string;
  content: string;
};

/** Client mirror of `supabase/functions/_shared/developmentGuestInfo.ts` pool defaults — keep in sync. */
export const AZURE_NORTH_RESIDENCE_NAME = 'Azure North Residences';
export const DEFAULT_AZURE_NORTH_POOL_FEE = 200;
export const DEFAULT_AZURE_NORTH_POOL_SCHEDULE = '7 AM to 7 PM. Maintenance every Tuesday.';

export function isAzureNorthResidence(developmentName: string): boolean {
  return developmentName.trim().toLowerCase() === AZURE_NORTH_RESIDENCE_NAME.toLowerCase();
}

export function mergeDevelopmentPoolSettings(
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

export function createGuestGuideId(): string {
  return `guide-${crypto.randomUUID().slice(0, 8)}`;
}

export function emptyGuestGuide(): DevelopmentGuestGuide {
  return { id: createGuestGuideId(), title: '', content: '' };
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

export function validateGuestGuides(guides: DevelopmentGuestGuide[]): string | null {
  for (const guide of guides) {
    if (!guide.title.trim()) return 'Each guide needs a title';
    if (!guide.content.trim()) return 'Each guide needs content';
  }
  return null;
}
