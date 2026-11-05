/**
 * Pure provenance planning for `help_center_faqs`.
 *
 * The sync owns `origin = 'synced'` rows only. This module decides, from the
 * curated doc and the current synced rows, which rows to insert, update, or
 * prune. It deliberately never sees manual rows, so a super-admin FAQ cannot
 * be deleted by a docs sync.
 */

import type { CuratedFaq } from './supportContent.ts';

export type SyncedFaqRow = {
  id: string;
  content_key: string | null;
  category: string;
  question: string;
  is_published: boolean;
};

export type FaqWritePlan = {
  inserts: Array<Record<string, unknown>>;
  updates: Array<{ id: string; values: Record<string, unknown> }>;
  pruneIds: string[];
};

export function planSyncedFaqWrites(faqs: CuratedFaq[], rows: SyncedFaqRow[]): FaqWritePlan {
  const byKey = new Map(
    rows.filter((row) => row.content_key).map((row) => [row.content_key!, row])
  );
  const byQuestion = new Map(rows.map((row) => [`${row.category}\u0000${row.question}`, row]));

  const inserts: Array<Record<string, unknown>> = [];
  const updates: Array<{ id: string; values: Record<string, unknown> }> = [];
  const currentKeys = new Set<string>();
  const usedRowIds = new Set<string>();

  for (const faq of faqs) {
    currentKeys.add(faq.contentKey);
    const existingRow =
      byKey.get(faq.contentKey) ?? byQuestion.get(`${faq.category}\u0000${faq.question}`) ?? null;

    const values = {
      category: faq.category,
      question: faq.question,
      answer: faq.answer,
      sort_order: faq.order,
      source_route_guide_path: faq.source,
      audience: faq.audience,
      origin: 'synced' as const,
      content_key: faq.contentKey,
    };

    if (existingRow) {
      usedRowIds.add(existingRow.id);
      // Preserve a super-admin unpublish across syncs.
      updates.push({
        id: existingRow.id,
        values: { ...values, is_published: existingRow.is_published },
      });
    } else {
      inserts.push({ ...values, is_published: true });
    }
  }

  const pruneIds = rows
    .filter((row) => !usedRowIds.has(row.id))
    .filter((row) => !row.content_key || !currentKeys.has(row.content_key))
    .map((row) => row.id);

  return { inserts, updates, pruneIds };
}
