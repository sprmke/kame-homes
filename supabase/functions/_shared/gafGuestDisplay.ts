/** Ages at or below this count as children on the GAF guest list. */
const GAF_CHILD_MAX_AGE = 3;

function formatAgeLabelForGaf(age: number): string {
  return age === 1 ? '1 year old' : `${age} years old`;
}

/**
 * Guest names on the GAF PDF append the age in parentheses when the guest is
 * {@link GAF_CHILD_MAX_AGE} years old or younger — e.g. "Mateo Manlulu (3 years old)".
 */
export function formatGafGuestDisplayName(
  name: string | undefined | null,
  age: number | undefined | null
): string | undefined {
  const trimmed = name?.trim();
  if (!trimmed) return undefined;

  const numericAge = age != null ? Number(age) : Number.NaN;
  if (Number.isFinite(numericAge) && numericAge <= GAF_CHILD_MAX_AGE) {
    return `${trimmed} (${formatAgeLabelForGaf(numericAge)})`;
  }

  return trimmed;
}
