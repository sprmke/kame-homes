import {
  PROPERTY_PLACEHOLDER_KEYS_BY_TEMPLATE,
  placeholderTokenForKey,
} from '@/features/dashboard/bookings/lib/templatePlaceholderCatalog';

function templateSupportsPlaceholder(templateKey: string, placeholderKey: string): boolean {
  return PROPERTY_PLACEHOLDER_KEYS_BY_TEMPLATE[templateKey]?.includes(placeholderKey) ?? false;
}

function extractExclusiveParagraph(
  html: string,
  placeholderKey: string
): { paragraph: string | null; rest: string } {
  const regex = new RegExp(`<p(\\s[^>]*)?>\\s*\\{\\{${placeholderKey}\\}\\}\\s*<\\/p>`, 'i');
  const match = html.match(regex);
  if (!match?.[0]) {
    return { paragraph: null, rest: html };
  }
  return {
    paragraph: match[0],
    rest: html.replace(match[0], ''),
  };
}

/**
 * Move {{urgent_notice}} / {{update_notice}} above the salutation.
 * Optionally insert missing callout placeholders for preview/editor parity.
 */
export function normalizeEmailCalloutPlaceholders(
  html: string,
  templateKey: string,
  options?: { ensureMissing?: boolean }
): string {
  let rest = html.trim();
  const prefixParts: string[] = [];

  for (const key of ['urgent_notice', 'update_notice'] as const) {
    if (!templateSupportsPlaceholder(templateKey, key)) continue;

    const { paragraph, rest: nextRest } = extractExclusiveParagraph(rest, key);
    rest = nextRest.trim();

    if (paragraph) {
      prefixParts.push(paragraph);
    } else if (options?.ensureMissing) {
      prefixParts.push(`<p>${placeholderTokenForKey(key)}</p>`);
    }
  }

  if (prefixParts.length === 0) return html;

  return `${prefixParts.join('')}${rest}`;
}
