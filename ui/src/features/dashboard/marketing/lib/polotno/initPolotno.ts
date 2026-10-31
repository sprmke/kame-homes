import { setUploadFunc } from 'openpolotno/config';

let configured = false;

/**
 * One-time baseline OpenPolotno config (no Polotno cloud key). Safe to call from
 * any store, including headless thumbnail stores that never show upload UI.
 */
export function ensurePolotnoConfigured() {
  if (configured) return;
  configured = true;
  setUploadFunc(async (file: File) => URL.createObjectURL(file));
}

/**
 * Routes Polotno's own built-in Upload panel through a real persistent uploader.
 * Kame's Design editor uses its own custom Upload/Background sections today
 * (`PropertyMediaPanels.tsx`), so this is defense-in-depth: if any other Polotno
 * internal path (or a future section) ever calls the registered upload function,
 * it gets a real https URL instead of a `blob:` one that would die on reload.
 */
export function configurePolotnoUploader(uploadFn: (file: File) => Promise<string>): void {
  ensurePolotnoConfigured();
  setUploadFunc(uploadFn);
}
