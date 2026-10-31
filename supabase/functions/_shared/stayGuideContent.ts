/**
 * Stay guide HTML helpers — leading heading extraction for section cards.
 */

/** Strip the first top-level h1–h3 so the section card title is not duplicated. */
export function extractLeadingSectionHeading(html: string): {
  heading: string | null;
  bodyHtml: string;
} {
  const trimmed = html.trim();
  const match = trimmed.match(/^<h([1-3])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/i);
  if (!match) return { heading: null, bodyHtml: html };

  const heading = match[2]
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const bodyHtml = trimmed.slice(match[0].length).trim();
  if (!heading) return { heading: null, bodyHtml: html };
  return { heading, bodyHtml };
}
