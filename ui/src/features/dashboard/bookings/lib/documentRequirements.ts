/**
 * Client mirror of `supabase/functions/_shared/documentRequirements.ts` types +
 * default list + applicability check. No async resolve here — the UI receives
 * the resolved per-property list from the booking/settings payload (Task 5–6).
 *
 * ⚠️  Keep in sync with the server file when either changes.
 */

export type DocumentApprovalSource = 'manual' | 'email-listener';
export type DocumentTriggerCondition = 'always' | 'has_pets' | 'need_parking';

export type DocumentRequirement = {
  id: string;
  label: string;
  order: number;
  pdfTemplateId: string | null;
  approvalSource: DocumentApprovalSource;
  triggerCondition: DocumentTriggerCondition;
  calendarIcon: string | null;
};

export type DocumentRequirementCompletion = {
  completedAt: string | null;
  approvedPdfUrl: string | null;
};

export const DEFAULT_DOCUMENT_REQUIREMENTS: DocumentRequirement[] = [
  {
    id: 'gaf',
    label: 'GAF Approval',
    order: 1,
    pdfTemplateId: 'gaf',
    approvalSource: 'email-listener',
    triggerCondition: 'always',
    calendarIcon: null,
  },
  {
    id: 'pet',
    label: 'Pet Approval',
    order: 2,
    pdfTemplateId: 'pet',
    approvalSource: 'email-listener',
    triggerCondition: 'has_pets',
    calendarIcon: '🐶',
  },
];

function flagTrue(value: unknown): boolean {
  return value === true || value === 'true';
}

export function requirementApplies(
  req: DocumentRequirement,
  booking: { has_pets?: unknown; need_parking?: unknown }
): boolean {
  switch (req.triggerCondition) {
    case 'always':
      return true;
    case 'has_pets':
      return flagTrue(booking.has_pets);
    case 'need_parking':
      return flagTrue(booking.need_parking);
    default:
      return false;
  }
}

const APPROVAL_SOURCES: DocumentApprovalSource[] = ['manual', 'email-listener'];
const TRIGGER_CONDITIONS: DocumentTriggerCondition[] = ['always', 'has_pets', 'need_parking'];

function isApprovalSource(value: unknown): value is DocumentApprovalSource {
  return typeof value === 'string' && APPROVAL_SOURCES.includes(value as DocumentApprovalSource);
}

function isTriggerCondition(value: unknown): value is DocumentTriggerCondition {
  return (
    typeof value === 'string' && TRIGGER_CONDITIONS.includes(value as DocumentTriggerCondition)
  );
}

function parseOptionalStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : null;
}

function parseRequirementEntry(raw: unknown): DocumentRequirement | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const entry = raw as Record<string, unknown>;

  const id = typeof entry.id === 'string' ? entry.id.trim() : '';
  if (!id) return null;

  const label = typeof entry.label === 'string' ? entry.label.trim() : '';
  if (!label) return null;

  const order =
    typeof entry.order === 'number' && Number.isFinite(entry.order) ? entry.order : null;
  if (order === null) return null;

  if (!isTriggerCondition(entry.triggerCondition)) return null;

  const rawApproval = entry.approvalSource;
  const approvalSource = rawApproval === 'none' ? 'manual' : rawApproval;
  if (!isApprovalSource(approvalSource)) return null;

  return {
    id,
    label,
    order,
    pdfTemplateId: parseOptionalStringOrNull(entry.pdfTemplateId),
    approvalSource,
    triggerCondition: entry.triggerCondition,
    calendarIcon: parseOptionalStringOrNull(entry.calendarIcon),
  };
}

export function parseDocumentRequirements(raw: unknown): DocumentRequirement[] | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .map(parseRequirementEntry)
    .filter((req): req is DocumentRequirement => req !== null)
    .sort((a, b) => a.order - b.order);
}

export function mergeDocumentRequirements(raw: unknown): DocumentRequirement[] {
  if (raw === null || raw === undefined) {
    return DEFAULT_DOCUMENT_REQUIREMENTS.map((req) => ({ ...req }));
  }
  const parsed = parseDocumentRequirements(raw);
  if (parsed === null) {
    return DEFAULT_DOCUMENT_REQUIREMENTS.map((req) => ({ ...req }));
  }
  return parsed;
}

export type RequestPdfTemplateId = 'gaf' | 'pet';

export function requirementMatchesPdfTemplate(
  req: DocumentRequirement,
  templateId: RequestPdfTemplateId
): boolean {
  return req.pdfTemplateId === templateId || req.id === templateId;
}

export function hasApplicableDocumentPdfTemplate(
  requirements: DocumentRequirement[],
  booking: { has_pets?: unknown; need_parking?: unknown },
  templateId: RequestPdfTemplateId
): boolean {
  return requirements.some(
    (req) => requirementApplies(req, booking) && requirementMatchesPdfTemplate(req, templateId)
  );
}

export type RequirementDocKind = 'gaf' | 'pet' | 'other';

export function requirementDocKind(
  requirement: DocumentRequirement | undefined,
  sub?: string
): RequirementDocKind {
  const subKey = (sub ?? requirement?.id ?? '').trim().toLowerCase();
  if (subKey === 'gaf' || subKey === 'pending_gaf') return 'gaf';
  if (subKey === 'pet' || subKey === 'pending_pet_request') return 'pet';
  if (!requirement) return 'other';
  if (requirementMatchesPdfTemplate(requirement, 'gaf')) return 'gaf';
  if (requirementMatchesPdfTemplate(requirement, 'pet')) return 'pet';
  const label = requirement.label.trim().toLowerCase();
  if (label.includes('gaf')) return 'gaf';
  if (label.includes('pet')) return 'pet';
  return 'other';
}

export function requirementNeedsApprovedPdf(req: DocumentRequirement): boolean {
  return requirementDocKind(req) !== 'other';
}
