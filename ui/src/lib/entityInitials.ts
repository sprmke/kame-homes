/** 1–2 letter initials from an org / listing / person name. */
export function entityInitials(name: string, fallback = '?'): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

/** Logos smaller than this are treated as broken placeholders (e.g. 1×1 seed PNGs). */
export const MIN_ENTITY_LOGO_PX = 8;

export function isUsableLogoNaturalSize(width: number, height: number): boolean {
  return width >= MIN_ENTITY_LOGO_PX && height >= MIN_ENTITY_LOGO_PX;
}
