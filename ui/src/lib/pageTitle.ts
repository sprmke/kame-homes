import { useEffect } from 'react';

export {
  APP_TITLE,
  PLATFORM_APP_NAME,
  appPageTitle,
  publicPageTitle,
} from '@/lib/platformBranding';

/**
 * Sets `document.title` when the page renders.
 * Pass `undefined` to skip the effect while data is loading (the shell or
 * index.html fallback will remain visible).
 */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    if (title === undefined) return;
    document.title = title;
  }, [title]);
}

/** Build a page title for an org-level dashboard page. */
export function orgPageTitle(orgName: string, pageName: string): string {
  return `${orgName} - ${pageName}`;
}

/** Build a page title for a public property-scoped page. */
export function propertyPublicPageTitle(propertyName: string, pageName: string): string {
  return `${propertyName} - ${pageName}`;
}

/** Build a page title for a property-level dashboard page. */
export function propertyDashboardPageTitle(propertyName: string, pageName: string): string {
  return `${propertyName} - ${pageName}`;
}

/** Build a page title for a parking-level dashboard page. */
export function parkingDashboardPageTitle(
  orgName: string,
  parkingName: string,
  pageName: string
): string {
  return `${orgName} - ${parkingName} - ${pageName}`;
}
