import { createContext, useContext, type ReactNode } from 'react';

const SearchAllContext = createContext<(() => void) | null>(null);

export function ChatComposerSearchAllProvider({
  onSearchAll,
  children,
}: {
  onSearchAll: () => void;
  children: ReactNode;
}) {
  return <SearchAllContext.Provider value={onSearchAll}>{children}</SearchAllContext.Provider>;
}

export function useChatComposerSearchAll(): (() => void) | null {
  return useContext(SearchAllContext);
}
