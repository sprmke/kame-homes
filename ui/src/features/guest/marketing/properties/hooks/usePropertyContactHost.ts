import { useCallback } from 'react';

export type UsePropertyContactHostOptions = {
  propertySlug: string;
  onContactHost: () => void;
};

export function usePropertyContactHost({
  propertySlug,
  onContactHost,
}: UsePropertyContactHostOptions) {
  const contactHost = useCallback(() => {
    if (!propertySlug.trim()) return;
    onContactHost();
  }, [propertySlug, onContactHost]);

  return { contactHost };
}
