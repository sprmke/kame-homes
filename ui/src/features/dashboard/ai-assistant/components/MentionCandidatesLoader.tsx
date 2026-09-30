import { useEffect, useMemo } from 'react';

import { useAssistantContextCatalog } from '@/features/dashboard/ai-assistant/hooks/useAssistantContextCatalog';
import type { AttachedContextItem } from '@/features/dashboard/ai-assistant/lib/attachedContext';
import { rankMentionCandidates } from '@/features/dashboard/ai-assistant/lib/composerTriggers';

export type MentionCandidate = {
  item: AttachedContextItem;
  subtitle?: string;
};

type Props = {
  query: string;
  onChange: (candidates: MentionCandidate[], loading: boolean) => void;
};

/**
 * Mounted only while an `@` token is active, so the context catalog (bookings, team, finance, …)
 * is fetched on demand, the same data the context picker uses. Reports ranked candidates upward.
 */
export function MentionCandidatesLoader({ query, onChange }: Props) {
  const { groups, isLoading } = useAssistantContextCatalog();

  const candidates = useMemo(() => {
    const flat = groups.flatMap((group) =>
      group.items.map((entry) => ({
        entry: { item: entry.item, subtitle: entry.subtitle ?? group.label } as MentionCandidate,
        label: entry.item.label,
        keywords: [entry.keywords, entry.subtitle ?? '', entry.meta ?? '', group.label].join(' '),
      }))
    );
    return rankMentionCandidates(flat, query, 8);
  }, [groups, query]);

  useEffect(() => {
    onChange(candidates, isLoading);
  }, [candidates, isLoading, onChange]);

  return null;
}
