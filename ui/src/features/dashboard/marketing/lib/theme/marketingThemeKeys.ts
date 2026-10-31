/**
 * Theme keys. Built-in themes live in code and are addressed by text keys;
 * themes a host saves are rows addressed by UUID. Saved items store the key in
 * `marketing_templates.theme_key` (NULL = made before themes → Property colors).
 */

export const BUILTIN_PROPERTY_COLORS_THEME_KEY = 'property-colors';
const STARTER_PREFIX = 'starter:';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MarketingThemeKeyRef =
  | { kind: 'property-colors' }
  | { kind: 'starter'; starterId: string }
  | { kind: 'custom'; id: string };

export function starterThemeKey(starterId: string): string {
  return `${STARTER_PREFIX}${starterId}`;
}

export function parseMarketingThemeKey(
  key: string | null | undefined
): MarketingThemeKeyRef | null {
  if (!key || key === BUILTIN_PROPERTY_COLORS_THEME_KEY) return { kind: 'property-colors' };
  if (key.startsWith(STARTER_PREFIX)) {
    const starterId = key.slice(STARTER_PREFIX.length);
    return starterId ? { kind: 'starter', starterId } : null;
  }
  if (UUID_RE.test(key)) return { kind: 'custom', id: key };
  return null;
}
