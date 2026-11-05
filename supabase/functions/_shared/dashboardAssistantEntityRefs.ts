/**
 * Working memory (Phase 4): compact per-turn references to the bookings, threads, and items a
 * tool result touched, persisted on the assistant message and replayed as "Known from earlier in
 * this chat" facts so the agent doesn't re-ask or re-search for an id it already has.
 *
 * Built generically off this codebase's existing `hostLabel` + id-field convention (every
 * assistant tool already returns a host-facing label next to the row's id) instead of a per-tool
 * mapping, so a new tool is covered automatically as long as it follows the same convention.
 */

export type EntityRef = {
  kind: string;
  id: string;
  label: string;
  digest?: string;
  toolName?: string;
};

const MAX_DEPTH = 3;
const MAX_REFS_PER_CALL = 20;
export const MAX_KNOWN_FACTS = 8;

/** id-field name -> entity kind, and the reverse for prompting the model which param to pass. */
const ID_KEY_TO_KIND: Record<string, string> = {
  bookingId: 'booking',
  conversationId: 'inbox_thread',
  threadId: 'inbox_thread',
  parkingId: 'parking',
  templateKey: 'template',
  memberId: 'team_member',
};

const KIND_TO_ID_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(ID_KEY_TO_KIND).map(([key, kind]) => [kind, key])
);

/** Fallback when the id field is the generic `id` — resolved from the tool that produced it. */
const TOOL_NAME_KIND: Record<string, string> = {
  list_maintenance_items: 'maintenance_item',
  propose_update_maintenance_item: 'maintenance_item',
  propose_delete_maintenance_item: 'maintenance_item',
  list_finance_line_items: 'finance_line_item',
  propose_update_finance_line_item: 'finance_line_item',
  propose_delete_finance_line_item: 'finance_line_item',
  list_support_tickets: 'support_ticket',
  get_support_ticket: 'support_ticket',
  propose_create_support_ticket: 'support_ticket',
  propose_reply_support_ticket: 'support_ticket',
  propose_reopen_support_ticket: 'support_ticket',
};

function digestFor(rec: Record<string, unknown>): string | undefined {
  const parts: string[] = [];
  if (typeof rec.statusLabel === 'string' && rec.statusLabel) parts.push(rec.statusLabel);
  if (typeof rec.checkIn === 'string' && rec.checkIn) parts.push(`check-in ${rec.checkIn}`);
  if (typeof rec.checkOut === 'string' && rec.checkOut) parts.push(`check-out ${rec.checkOut}`);
  if (typeof rec.scheduledOn === 'string' && rec.scheduledOn) {
    parts.push(`scheduled ${rec.scheduledOn}`);
  }
  if (rec.completedAt) parts.push('completed');
  if (typeof rec.balanceDue === 'number') parts.push(`balance due ${rec.balanceDue}`);
  if (typeof rec.amount === 'number') parts.push(`amount ${rec.amount}`);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function entityFromRecord(rec: Record<string, unknown>, toolName: string): EntityRef | null {
  const hostLabel = typeof rec.hostLabel === 'string' ? rec.hostLabel.trim() : '';
  if (!hostLabel) return null;
  for (const key of Object.keys(ID_KEY_TO_KIND)) {
    const value = rec[key];
    if (typeof value === 'string' && value) {
      return {
        kind: ID_KEY_TO_KIND[key]!,
        id: value,
        label: hostLabel,
        digest: digestFor(rec),
        toolName,
      };
    }
  }
  if (typeof rec.id === 'string' && rec.id) {
    const kind = TOOL_NAME_KIND[toolName];
    if (kind) {
      return { kind, id: rec.id, label: hostLabel, digest: digestFor(rec), toolName };
    }
  }
  return null;
}

/** Pure, defensive scan of a tool result for entity-shaped records — never throws. */
export function extractEntityRefs(toolName: string, data: unknown): EntityRef[] {
  const out: EntityRef[] = [];
  const seen = new Set<string>();

  function visit(value: unknown, depth: number): void {
    if (depth > MAX_DEPTH || out.length >= MAX_REFS_PER_CALL) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const rec = value as Record<string, unknown>;
    const ref = entityFromRecord(rec, toolName);
    if (ref) {
      const key = `${ref.kind}:${ref.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(ref);
      }
      // A matched entity's own nested arrays (statusHistory, documents, messages) are not
      // separately interesting — stop descending once a row resolves to an entity.
      return;
    }
    for (const nested of Object.values(rec)) visit(nested, depth + 1);
  }

  try {
    visit(data, 0);
  } catch {
    return [];
  }
  return out;
}

/** Later refs win on a kind:id collision — most recent mention of the same entity wins. */
export function dedupeEntityRefs(refs: readonly EntityRef[]): EntityRef[] {
  const map = new Map<string, EntityRef>();
  for (const ref of refs) map.set(`${ref.kind}:${ref.id}`, ref);
  return [...map.values()];
}

/** Keeps the most recent `limit` refs (assumes oldest-first input). */
export function capEntityRefs(refs: readonly EntityRef[], limit = MAX_KNOWN_FACTS): EntityRef[] {
  return refs.length <= limit ? [...refs] : refs.slice(refs.length - limit);
}

/** Safe runtime parse of the persisted `entity_refs` jsonb column — never throws. */
export function parseEntityRefs(raw: unknown): EntityRef[] {
  if (!Array.isArray(raw)) return [];
  const out: EntityRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    if (
      typeof rec.kind !== 'string' ||
      typeof rec.id !== 'string' ||
      typeof rec.label !== 'string'
    ) {
      continue;
    }
    out.push({
      kind: rec.kind,
      id: rec.id,
      label: rec.label,
      digest: typeof rec.digest === 'string' ? rec.digest : undefined,
      toolName: typeof rec.toolName === 'string' ? rec.toolName : undefined,
    });
  }
  return out;
}

/** System-prompt appendix — the model can reuse an id directly instead of re-searching for it. */
export function formatKnownFactsSection(refs: readonly EntityRef[]): string {
  if (refs.length === 0) return '';
  const lines = refs.map((ref) => {
    const idKey = KIND_TO_ID_KEY[ref.kind] ?? 'id';
    const digestNote = ref.digest ? ` (${ref.digest})` : '';
    return `- ${ref.label}${digestNote} [${idKey}: ${ref.id}]`;
  });
  return `\n\nKnown from earlier in this chat (reuse these ids directly - only re-look-up if the host asks for fresh data):\n${lines.join('\n')}`;
}
