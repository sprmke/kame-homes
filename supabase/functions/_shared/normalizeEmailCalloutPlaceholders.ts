import {
  EMAIL_TEMPLATES_WITH_UPDATE_NOTICE,
  EMAIL_TEMPLATES_WITH_URGENT_CALLOUT,
} from './propertyTemplateEmailSections.ts';

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

/** Move callout placeholders above the salutation; optionally insert missing tokens. */
export function normalizeEmailCalloutPlaceholders(
  html: string,
  templateKey: string,
  options?: { ensureMissing?: boolean }
): string {
  let rest = html.trim();
  const prefixParts: string[] = [];

  const callouts: Array<{ key: string; supported: boolean }> = [
    {
      key: 'urgent_notice',
      supported: EMAIL_TEMPLATES_WITH_URGENT_CALLOUT.has(templateKey),
    },
    {
      key: 'update_notice',
      supported: EMAIL_TEMPLATES_WITH_UPDATE_NOTICE.has(templateKey),
    },
  ];

  for (const { key, supported } of callouts) {
    if (!supported) continue;

    const { paragraph, rest: nextRest } = extractExclusiveParagraph(rest, key);
    rest = nextRest.trim();

    if (paragraph) {
      prefixParts.push(paragraph);
    } else if (options?.ensureMissing) {
      prefixParts.push(`<p>{{${key}}}</p>`);
    }
  }

  if (prefixParts.length === 0) return html;

  return `${prefixParts.join('')}${rest}`;
}
