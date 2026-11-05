/**
 * Snapshot of a property template rendered into a chat message. Stored on
 * `social_messages.template_snapshot` at send time so later template edits do
 * not rewrite message history.
 */

export type ChatTemplateSnapshot = {
  templateKey: string;
  name: string;
  category: 'standard' | 'custom';
  html: string;
  sectionImageUrl: string | null;
  propertyId: string;
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Defensive parser for rows written before a field existed or by an older build. */
export function readChatTemplateSnapshot(raw: unknown): ChatTemplateSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const templateKey = asString(row.templateKey);
  const name = asString(row.name);
  const html = typeof row.html === 'string' ? row.html : '';
  const category =
    row.category === 'custom' ? 'custom' : row.category === 'standard' ? 'standard' : null;
  const propertyId = asString(row.propertyId);
  if (!templateKey || !name || !html.trim() || !category || !propertyId) return null;
  return {
    templateKey,
    name,
    category,
    html,
    sectionImageUrl: asString(row.sectionImageUrl) || null,
    propertyId,
  };
}
