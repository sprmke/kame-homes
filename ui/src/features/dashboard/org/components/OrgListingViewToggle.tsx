import { LayoutGrid, List, Table2 } from 'lucide-react';

import type { OrgListingViewMode } from '@/features/dashboard/org/lib/orgListingViewMode';

import { AdminListViewMenu } from '@/components/navigation/AdminListViewMenu';
import {
  AdminViewToggle,
  type AdminViewToggleOption,
} from '@/components/navigation/AdminViewToggle';

export const ORG_LISTING_VIEW_OPTIONS: AdminViewToggleOption<OrgListingViewMode>[] = [
  { value: 'table', label: 'Table', Icon: Table2 },
  { value: 'grid', label: 'Grid', Icon: LayoutGrid },
  { value: 'list', label: 'List', Icon: List },
];

type Props = {
  value: OrgListingViewMode;
  onChange: (next: OrgListingViewMode) => void;
  hideTableView?: boolean;
  className?: string;
  ariaLabel?: string;
};

function hideValues(hideTableView: boolean): OrgListingViewMode[] {
  return hideTableView ? ['table'] : [];
}

export function OrgListingViewToggle({
  value,
  onChange,
  hideTableView = false,
  className,
  ariaLabel = 'Choose listing view',
}: Props) {
  return (
    <AdminViewToggle
      value={value}
      onChange={onChange}
      options={ORG_LISTING_VIEW_OPTIONS}
      hideValues={hideValues(hideTableView)}
      className={className}
      ariaLabel={ariaLabel}
    />
  );
}

export function OrgListingViewMenu({
  value,
  onChange,
  hideTableView = false,
  className,
  ariaLabel = 'Choose listing view',
}: Props) {
  return (
    <AdminListViewMenu
      value={value}
      onChange={onChange}
      options={ORG_LISTING_VIEW_OPTIONS}
      hideValues={hideValues(hideTableView)}
      className={className}
      ariaLabel={ariaLabel}
    />
  );
}
