/**
 * When the host already asked to mark a maintenance item done, the model often lists
 * then emits a "Mark complete" chip instead of propose_update_maintenance_item.
 * Resolve a unique open item from this turn's list results so the handler can propose.
 */

export function parseMarkMaintenanceDoneQuery(message: string): string | null {
  const text = message.trim();
  const match = text.match(
    /\bmark(?:ing)?(?:\s+the)?\s+(.+?)\s+(?:as\s+)?(?:done|complete(?:d)?)\b/i
  );
  if (!match) return null;
  const query = match[1].replace(/^(the|a|an)\s+/i, '').trim();
  return query || null;
}

export function pickOpenMaintenanceItem(
  toolResults: unknown[],
  query: string
): { id: string; label: string } | null {
  const needle = query.trim().toLowerCase();
  if (!needle) return null;
  const open: Array<{ id: string; label: string }> = [];
  for (const result of toolResults) {
    if (!Array.isArray(result)) continue;
    for (const row of result) {
      if (!row || typeof row !== 'object') continue;
      const rec = row as Record<string, unknown>;
      const id = typeof rec.id === 'string' ? rec.id : '';
      const label = typeof rec.label === 'string' ? rec.label : '';
      if (!id || !label) continue;
      if (rec.completedAt) continue;
      open.push({ id, label });
    }
  }
  const hits = open.filter((item) => {
    const label = item.label.toLowerCase();
    return label.includes(needle) || needle.includes(label);
  });
  if (hits.length === 1) return hits[0];
  const exact = hits.filter((item) => item.label.toLowerCase() === needle);
  return exact.length === 1 ? exact[0] : null;
}
