export type InboxPinnedSnippet = {
  id: string;
  title: string;
  bodyText: string;
};

export const INBOX_PINNED_SNIPPETS_MAX = 5;

function normalizeSnippet(raw: unknown): InboxPinnedSnippet | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? '').trim();
  const title = String(row.title ?? '').trim();
  const bodyText = String(row.bodyText ?? row.body_text ?? '').trim();
  if (!id || !title || !bodyText) return null;
  if (title.length > 80) return null;
  if (bodyText.length > 2000) return null;
  return { id, title, bodyText };
}

export function readInboxPinnedSnippets(
  settings: Record<string, unknown> | null | undefined
): InboxPinnedSnippet[] {
  const raw = settings?.inboxPinnedSnippets;
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeSnippet)
    .filter((row): row is InboxPinnedSnippet => row !== null)
    .slice(0, INBOX_PINNED_SNIPPETS_MAX);
}

export function newInboxPinnedSnippetId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `snippet-${Date.now()}`;
}
