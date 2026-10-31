import { FileCheck2 } from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import type { DocumentRequirement } from '@/features/dashboard/bookings/lib/documentRequirements';
import { DocumentRequirementsListEditor } from '@/features/dashboard/org/components/document-requirements/DocumentRequirementsListEditor';

type Props = {
  list: DocumentRequirement[];
  disabled?: boolean;
  resolveFieldError?: (fieldId: string) => string | null;
  markFieldInteracted?: (fieldId: string) => void;
  onChange: (next: DocumentRequirement[]) => void;
};

export function DevelopmentDocumentRequirementsSection({
  list,
  disabled = false,
  resolveFieldError,
  markFieldInteracted,
  onChange,
}: Props) {
  return (
    <AdminSection
      id="document-requirements"
      title="Document Requirements"
      icon={FileCheck2}
      description="Documents required before a booking reaches Ready for check-in. Applies to all properties in this development."
    >
      <DocumentRequirementsListEditor
        list={list}
        disabled={disabled}
        resolveFieldError={resolveFieldError}
        markFieldInteracted={markFieldInteracted}
        onChange={onChange}
      />
    </AdminSection>
  );
}
