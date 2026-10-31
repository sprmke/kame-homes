import type { WorkflowAssetType } from '@/features/dashboard/bookings/hooks/useUploadBookingAsset';
import {
  requirementDocKind,
  type DocumentRequirement,
} from '@/features/dashboard/bookings/lib/documentRequirements';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import {
  PARKING_NESTED_KEY,
  readDocumentCompletions,
  type PendingDocNestedKey,
} from '@/features/dashboard/bookings/lib/workflow';

export type DocApprovalAssetType = Extract<WorkflowAssetType, 'approved_gaf' | 'approved_pet'>;

export function pendingDocStepApprovalAsset(
  sub: PendingDocNestedKey,
  requirements: DocumentRequirement[]
): DocApprovalAssetType | null {
  if (sub === PARKING_NESTED_KEY) return null;
  const requirement = requirements.find((req) => req.id === sub);
  const kind = requirementDocKind(requirement, sub);
  if (kind === 'gaf') return 'approved_gaf';
  if (kind === 'pet') return 'approved_pet';
  return null;
}

export function pendingDocStepUsesApprovalModal(
  sub: PendingDocNestedKey,
  requirements: DocumentRequirement[]
): boolean {
  return pendingDocStepApprovalAsset(sub, requirements) !== null;
}

export function approvedPdfUrlForDocStep(
  booking: BookingRow,
  sub: PendingDocNestedKey,
  requirements: DocumentRequirement[]
): string | null {
  const assetType = pendingDocStepApprovalAsset(sub, requirements);
  if (!assetType) return null;

  const completions = readDocumentCompletions(booking);
  const fromMap = completions[sub]?.approvedPdfUrl?.trim();
  if (fromMap) return fromMap;

  const legacy =
    assetType === 'approved_gaf'
      ? booking.approved_gaf_pdf_url?.trim()
      : booking.approved_pet_pdf_url?.trim();
  return legacy || null;
}

export function approvedPdfUploadLabel(assetType: DocApprovalAssetType): string {
  return assetType === 'approved_gaf' ? 'Approved GAF' : 'Approved pet form';
}
