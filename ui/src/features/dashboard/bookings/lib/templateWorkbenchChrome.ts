/**
 * Layout classes shared by the Templates workbench and its route skeleton.
 *
 * Kept component-free so `RouteSkeletons` (eagerly loaded) can match the
 * workbench without pulling the editor chunk in with it.
 */

/** Panel chrome for the library rail and the detail pane. */
export const templatePanelClassName =
  'border-border bg-card flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border';

/** Row container: stacked below `lg`, two panes from `lg` up. */
export const templateWorkbenchShellClassName =
  'flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row lg:items-start lg:gap-5 xl:gap-6';

/**
 * Desktop rail sizing. `self-start` + `max-h-full` makes the panel hug its rows
 * instead of stretching to the editor's height — a short list left a tall empty
 * card below the last template. The inner list still scrolls once the rows pass
 * the available height, so a property with many folders stays reachable.
 */
export const templateRailPanelClassName =
  'lg:w-[18rem] lg:shrink-0 lg:self-start lg:max-h-full xl:w-[19rem]';

/**
 * The editor is the work surface, so it keeps the column's full height even
 * though `items-start` lets the rail hug its rows.
 */
export const templateDetailPanelClassName = 'lg:self-stretch';
