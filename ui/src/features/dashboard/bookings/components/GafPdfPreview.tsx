import { AdminPdfZoomPreview } from '@/features/dashboard/bookings/components/AdminPdfZoomPreview';
import type { GafDetailsValues } from '@/features/dashboard/bookings/lib/gafDefaults';
import { renderGafPdfPreview } from '@/features/dashboard/bookings/lib/gafPdfPreview';

type GafPdfPreviewProps = {
  details: GafDetailsValues;
  signatureUrl?: string | null;
  className?: string;
};

export function GafPdfPreview({ details, signatureUrl, className }: GafPdfPreviewProps) {
  return (
    <AdminPdfZoomPreview
      className={className}
      pageAltPrefix="GAF preview"
      renderPdfBytes={() => renderGafPdfPreview(details, signatureUrl)}
      refreshDeps={[
        details.gafUnitOwner,
        details.gafTowerAndUnitNumber,
        details.gafGuestsOnsiteContactPerson,
        details.gafOwnerContactNumber,
        signatureUrl,
      ]}
    />
  );
}
