/**
 * Reserved org/property display names — keep in sync with
 * ui/src/lib/validation/reservedDisplayNames.ts
 *
 * Blocks hosts from registering general Azure North / "Official" names, including
 * evasion via extra punctuation or spacing between characters.
 */

export const RESERVED_DISPLAY_NAME_MESSAGE = 'This name is reserved and cannot be used';

/** Lowercase letters and digits only — strips spaces, punctuation, symbols. */
export function collapseDisplayNameAlphanumeric(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Word token "official" anywhere in the display name. */
function hasOfficialToken(input: string): boolean {
  return /\bofficial\b/i.test(input.trim());
}

const RESERVED_COLLAPSED_EXACT = new Set([
  'azurenorth',
  'azurenorthresidence',
  'azurenorthresidences',
  'azureofficial',
  'azurenorthofficial',
  'azurenorthresidenceofficial',
]);

export function getReservedDisplayNameViolation(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;

  if (hasOfficialToken(trimmed)) {
    return RESERVED_DISPLAY_NAME_MESSAGE;
  }

  const collapsed = collapseDisplayNameAlphanumeric(trimmed);
  if (RESERVED_COLLAPSED_EXACT.has(collapsed)) {
    return RESERVED_DISPLAY_NAME_MESSAGE;
  }

  return null;
}
