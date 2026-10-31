import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  findThreadSearchMatches,
  type ChatSearchMatch,
  type ChatSearchMessage,
} from '@/lib/chat/chatThreadSearch';

export function useChatThreadSearch(messages: ChatSearchMessage[]) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const matches = useMemo(() => findThreadSearchMatches(messages, query), [messages, query]);
  const trimmedQuery = query.trim();

  useEffect(() => {
    setActiveIndex(0);
  }, [trimmedQuery]);

  useEffect(() => {
    if (matches.length === 0) {
      setActiveIndex(0);
      return;
    }
    if (activeIndex >= matches.length) {
      setActiveIndex(matches.length - 1);
    }
  }, [activeIndex, matches.length]);

  const activeMatch: ChatSearchMatch | null = matches[activeIndex] ?? null;

  const goNext = useCallback(() => {
    if (!matches.length) return;
    setActiveIndex((index) => (index + 1) % matches.length);
  }, [matches.length]);

  const goPrev = useCallback(() => {
    if (!matches.length) return;
    setActiveIndex((index) => (index - 1 + matches.length) % matches.length);
  }, [matches.length]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, []);

  const openSearch = useCallback(() => {
    setOpen(true);
  }, []);

  return {
    open,
    setOpen,
    openSearch,
    close,
    query,
    setQuery,
    trimmedQuery,
    matches,
    activeIndex,
    activeMatch,
    activeMessageId: activeMatch?.messageId ?? null,
    goNext,
    goPrev,
  };
}

export type ChatThreadSearchController = ReturnType<typeof useChatThreadSearch>;
