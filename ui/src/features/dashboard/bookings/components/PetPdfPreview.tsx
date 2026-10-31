import { AdminPdfZoomPreview } from '@/features/dashboard/bookings/components/AdminPdfZoomPreview';
import type { PetDetailsValues } from '@/features/dashboard/bookings/lib/petDefaults';
import { renderPetPdfPreview } from '@/features/dashboard/bookings/lib/petPdfPreview';

type PetPdfPreviewProps = {
  details: PetDetailsValues;
  signatureUrl?: string | null;
  className?: string;
};

export function PetPdfPreview({ details, signatureUrl, className }: PetPdfPreviewProps) {
  return (
    <AdminPdfZoomPreview
      className={className}
      pageAltPrefix="Pet form preview"
      renderPdfBytes={() => renderPetPdfPreview(details, signatureUrl)}
      refreshDeps={[details.gafUnitOwner, details.gafTowerAndUnitNumber, signatureUrl]}
    />
  );
}
