import { Link } from 'react-router-dom';

import { ExternalLink } from 'lucide-react';

import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';

type Props = {
  orgSlug: string;
  propertySlug: string;
};

/** Cross-link for Settings sections whose fields are also editable (same data) in Public Pages → Property → Edit. */
export function PublicPagesCrossLink({ orgSlug, propertySlug }: Props) {
  return (
    <Link
      to={propertySectionPath(orgSlug, propertySlug, 'public-pages')}
      className="text-primary inline-flex items-center gap-1 text-xs font-semibold hover:underline"
    >
      Also in Public Pages
      <ExternalLink className="size-3 shrink-0" aria-hidden />
    </Link>
  );
}
