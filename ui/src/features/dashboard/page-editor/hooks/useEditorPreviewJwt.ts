import { useEffect, useState } from 'react';

import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

/** `null` while the session JWT is loading. Empty string if it cannot be read. */
export function useEditorPreviewJwt(): string | null {
  const [jwt, setJwt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSessionJwt()
      .then((token) => {
        if (!cancelled) setJwt(token);
      })
      .catch(() => {
        if (!cancelled) setJwt('');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return jwt;
}
