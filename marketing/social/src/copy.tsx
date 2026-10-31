import { createContext, useContext } from 'react';

/**
 * Shared UI strings baked into layouts (CTA pill, carousel chrome, offer end card).
 * English is the default; a language set wraps its compositions in `CopyProvider`.
 */
export interface StudioCopy {
  cta: string;
  swipe: string;
  howItWorks: string;
  stepOf: (n: number, total: number) => string;
  /** Closing slide of a feature carousel, two lines, second is the accent. */
  tryFree: string[];
  /** Offer end card headline, two lines, second is the accent. */
  offer: string[];
  offerSub: string;
}

export const englishCopy: StudioCopy = {
  cta: 'Start free',
  swipe: 'Swipe',
  howItWorks: 'How it works',
  stepOf: (n, total) => `Step ${n} of ${total}`,
  tryFree: ['Try it', 'free today.'],
  offer: ['Start free.', 'Set up today.'],
  offerSub: 'No card to start · Works on your phone · Cancel anytime',
};

const CopyCtx = createContext<StudioCopy>(englishCopy);

export const CopyProvider = CopyCtx.Provider;

export function useCopy(): StudioCopy {
  return useContext(CopyCtx);
}
