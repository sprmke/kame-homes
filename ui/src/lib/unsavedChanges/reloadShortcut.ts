/**
 * Keyboard refresh shortcuts the app can intercept before the browser unloads.
 * Browsers do not allow a custom prompt on `beforeunload`, so the provider catches
 * these keys while a form is dirty and shows the app's own confirmation instead.
 * The toolbar reload button cannot be intercepted and still uses the native prompt.
 */
export function isReloadShortcut(input: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
}): boolean {
  if (input.key === 'F5') return true;
  return Boolean((input.metaKey || input.ctrlKey) && input.key.toLowerCase() === 'r');
}
