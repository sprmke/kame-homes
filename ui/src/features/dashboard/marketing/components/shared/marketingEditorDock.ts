/**
 * Layout constants for the mobile Marketing Studio editor dock
 * (`MarketingEditorMobileToolbar`), which floats above the app bottom tab bar.
 */

/**
 * Content clearance below the floating editor dock **and** the app bottom tab bar.
 * Apply on an editor's inner scrollport whenever the studio shell doesn't already
 * clip its content above the two stacked docks (e.g. flex-fill editors like the
 * page editor).
 */
export const marketingEditorScrollClearanceClassName =
  'max-lg:pb-[calc(9.5rem+env(safe-area-inset-bottom,0px))]';
