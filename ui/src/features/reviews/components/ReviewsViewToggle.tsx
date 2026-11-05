import { LayoutGrid, LayoutList } from 'lucide-react';

import type { ReviewsView } from '@/features/reviews/lib/propertyReviewsApi';

import { AdminListViewMenu } from '@/components/navigation/AdminListViewMenu';
import {
  AdminViewToggle,
  type AdminViewToggleOption,
} from '@/components/navigation/AdminViewToggle';

const REVIEWS_VIEW_OPTIONS: AdminViewToggleOption<ReviewsView>[] = [
  { value: 'table', label: 'Table', Icon: LayoutList },
  { value: 'card', label: 'Card', Icon: LayoutGrid },
];

type Props = {
  value: ReviewsView;
  onChange: (next: ReviewsView) => void;
  className?: string;
  ariaLabel?: string;
};

export function ReviewsViewToggle({
  value,
  onChange,
  className,
  ariaLabel = 'Choose reviews view',
}: Props) {
  return (
    <AdminViewToggle
      value={value}
      onChange={onChange}
      options={REVIEWS_VIEW_OPTIONS}
      className={className}
      ariaLabel={ariaLabel}
    />
  );
}

/** Desktop compact view control. */
export function ReviewsViewMenu({
  value,
  onChange,
  className,
  ariaLabel = 'Choose reviews view',
}: Props) {
  return (
    <AdminListViewMenu
      value={value}
      onChange={onChange}
      options={REVIEWS_VIEW_OPTIONS}
      className={className}
      ariaLabel={ariaLabel}
    />
  );
}
