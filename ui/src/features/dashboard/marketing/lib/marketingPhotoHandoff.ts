/**
 * Hands an AI Studio photo to the next Posts draft ("Use in a post") without putting the
 * URL in the address bar. Consumed once by the Posts editor on its first load.
 */
let pending: string | null = null;

export function setPendingMarketingPhoto(url: string | null): void {
  pending = url;
}

export function takePendingMarketingPhoto(): string | null {
  const url = pending;
  pending = null;
  return url;
}
