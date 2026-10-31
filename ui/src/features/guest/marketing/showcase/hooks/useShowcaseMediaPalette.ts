import { useEffect, useMemo, useState } from 'react';

import {
  generateShowcaseMediaPalette,
  type ShowcaseMediaPalette,
} from '@/features/guest/marketing/showcase/lib/showcaseMediaPalette';

type State = {
  palette: ShowcaseMediaPalette | null;
  loading: boolean;
};

export function useShowcaseMediaPalette(urls: string[], enabled: boolean): State {
  const signature = useMemo(() => urls.join('|'), [urls]);
  const [state, setState] = useState<State>({ palette: null, loading: false });

  useEffect(() => {
    if (!enabled || urls.length === 0) {
      setState({ palette: null, loading: false });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));

    void generateShowcaseMediaPalette(urls).then((palette) => {
      if (cancelled) return;
      setState({ palette, loading: false });
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, signature, urls]);

  return state;
}
