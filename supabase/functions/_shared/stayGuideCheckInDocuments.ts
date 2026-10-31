/**
 * Guest Stay Guide — approved check-in documents (GAF, pet, parking, custom PDFs).
 */

import {
  requirementApplies,
  requirementDocKind,
  requirementNeedsApprovedPdf,
  resolveDocumentRequirements,
  type DocumentRequirement,
} from './documentRequirements.ts';
import { readDocumentCompletions } from './statusMachine.ts';
import { formatPublicUrl } from './utils.ts';
import type { GuestSubmission } from './types.ts';

export type StayGuideCheckInDocumentKind = 'gaf' | 'pet' | 'parking' | 'other';

export type StayGuideCheckInDocumentDto = {
  id: string;
  label: string;
  kind: StayGuideCheckInDocumentKind;
  status: 'ready' | 'pending';
  url: string | null;
  /** Admin preview only — UI shows ready chrome without a real file. */
  isPreviewSample?: boolean;
};

function guestFacingRequirementLabel(req: DocumentRequirement): string {
  const kind = requirementDocKind(req);
  if (kind === 'gaf') return 'Approved GAF';
  if (kind === 'pet') return 'Approved pet form';
  const trimmed = req.label.replace(/\s*request\s*$/i, '').trim();
  return trimmed || req.label;
}

function normalizeDocUrl(raw: string | null | undefined): string | null {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return null;
  const formatted = formatPublicUrl(trimmed).trim();
  return formatted || null;
}

export function buildStayGuideCheckInDocuments(
  booking: GuestSubmission,
  requirements: DocumentRequirement[]
): StayGuideCheckInDocumentDto[] {
  const docs: StayGuideCheckInDocumentDto[] = [];
  const completions = readDocumentCompletions(booking);

  for (const req of requirements) {
    if (!requirementApplies(req, booking)) continue;
    if (!requirementNeedsApprovedPdf(req)) continue;

    const url = normalizeDocUrl(completions[req.id]?.approvedPdfUrl);
    docs.push({
      id: req.id,
      label: guestFacingRequirementLabel(req),
      kind: requirementDocKind(req),
      status: url ? 'ready' : 'pending',
      url,
    });
  }

  if (booking.need_parking) {
    const url = normalizeDocUrl(booking.parking_endorsement_url);
    docs.push({
      id: 'parking-endorsement',
      label: 'Parking endorsement',
      kind: 'parking',
      status: url ? 'ready' : 'pending',
      url,
    });
  }

  return docs;
}

/** Mixed ready/pending samples so page-editor preview shows both states. */
export function applyStayGuideCheckInDocumentPreviewSamples(
  docs: StayGuideCheckInDocumentDto[]
): StayGuideCheckInDocumentDto[] {
  if (docs.length === 0) {
    return [
      {
        id: 'gaf',
        label: 'Approved GAF',
        kind: 'gaf',
        status: 'ready',
        url: null,
        isPreviewSample: true,
      },
      {
        id: 'parking-endorsement',
        label: 'Parking endorsement',
        kind: 'parking',
        status: 'pending',
        url: null,
      },
    ];
  }

  return docs.map((doc, index) => {
    if (index === 0) {
      return {
        ...doc,
        status: 'ready',
        url: null,
        isPreviewSample: true,
      };
    }
    return {
      ...doc,
      status: 'pending',
      url: null,
      isPreviewSample: undefined,
    };
  });
}

export async function loadStayGuideCheckInDocuments(
  propertyId: string,
  booking: GuestSubmission,
  options?: { previewSamples?: boolean }
): Promise<StayGuideCheckInDocumentDto[]> {
  const requirements = await resolveDocumentRequirements(propertyId);
  const docs = buildStayGuideCheckInDocuments(booking, requirements);
  if (options?.previewSamples) {
    return applyStayGuideCheckInDocumentPreviewSamples(docs);
  }
  return docs;
}
