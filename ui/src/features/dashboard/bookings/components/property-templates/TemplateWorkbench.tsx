import * as React from 'react';

import {
  TemplateLibraryRail,
  type TemplateRailHandlers,
  type TemplateRailPermissions,
} from '@/features/dashboard/bookings/components/property-templates/TemplateLibraryRail';
import { useAdminLayoutFillMain } from '@/features/dashboard/bookings/lib/adminLayoutFillMain';
import type {
  TemplateCategoryFilter,
  TemplateLibraryGroup,
} from '@/features/dashboard/bookings/lib/templateLibrary';
import {
  templateDetailPanelClassName,
  templatePanelClassName,
  templateRailPanelClassName,
  templateWorkbenchShellClassName,
} from '@/features/dashboard/bookings/lib/templateWorkbenchChrome';

import { cn } from '@/lib/utils';

type TemplateWorkbenchProps = {
  groups: TemplateLibraryGroup[];
  /** Highlighted rail row. Null on phone, where the list is the whole page. */
  selectedKey: string | null;
  onSelect: (templateKey: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  categoryFilter: TemplateCategoryFilter;
  onCategoryFilterChange: (filter: TemplateCategoryFilter) => void;
  /** Below `lg`: rows navigate instead of highlighting, and only one panel renders. */
  isMobile: boolean;
  /** Phone only: show the editor in place of the list. */
  showDetail: boolean;
  permissions: TemplateRailPermissions;
  handlers: TemplateRailHandlers;
  detail: React.ReactNode;
  overlayRemeasureKey?: string | number | boolean;
};

/**
 * Two-pane template workbench: a searchable library rail beside one live editor.
 *
 * Desktop keeps both panels visible. Below `lg` the rail is the page and opening a
 * template replaces it, so the phone gets real navigation instead of one long
 * column of editors. Panels are branched in JS rather than hidden with classes, so
 * the phone list never mounts an off-screen editor.
 */
export function TemplateWorkbench({
  groups,
  selectedKey,
  onSelect,
  query,
  onQueryChange,
  categoryFilter,
  onCategoryFilterChange,
  isMobile,
  showDetail,
  permissions,
  handlers,
  detail,
  overlayRemeasureKey,
}: TemplateWorkbenchProps) {
  useAdminLayoutFillMain(true);

  const rail = (
    <aside
      aria-label="Templates"
      className={cn(templatePanelClassName, isMobile ? 'flex-1' : templateRailPanelClassName)}
    >
      <div className="flex min-h-0 flex-1 flex-col p-2">
        <TemplateLibraryRail
          groups={groups}
          selectedKey={selectedKey}
          onSelect={onSelect}
          query={query}
          onQueryChange={onQueryChange}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={onCategoryFilterChange}
          variant={isMobile ? 'list' : 'rail'}
          permissions={permissions}
          handlers={handlers}
          overlayRemeasureKey={overlayRemeasureKey}
        />
      </div>
    </aside>
  );

  const detailPanel = (
    <section
      aria-label="Template editor"
      className={cn(templatePanelClassName, 'flex-1', templateDetailPanelClassName)}
    >
      {detail}
    </section>
  );

  return (
    <div className={templateWorkbenchShellClassName}>
      {isMobile ? (
        showDetail ? (
          detailPanel
        ) : (
          rail
        )
      ) : (
        <>
          {rail}
          {detailPanel}
        </>
      )}
    </div>
  );
}
