/**
 * Web Share with a clipboard fallback. Progressive enhancement — every caller
 * gets *some* share affordance.
 */
export type ShareInput = {
  title?: string;
  text?: string;
  url?: string;
};

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'unavailable';

export async function shareContent(input: ShareInput): Promise<ShareOutcome> {
  const data: ShareInput = {};
  if (input.title) data.title = input.title;
  if (input.text) data.text = input.text;
  if (input.url) data.url = input.url;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (err) {
      // AbortError = user dismissed the sheet; anything else falls through to copy.
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }

  const toCopy = input.url ?? input.text ?? '';
  if (toCopy && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(toCopy);
      return 'copied';
    } catch {
      return 'unavailable';
    }
  }
  return 'unavailable';
}

export function canWebShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}
