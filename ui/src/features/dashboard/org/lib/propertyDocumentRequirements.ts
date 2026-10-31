import type {
  DocumentApprovalSource,
  DocumentRequirement,
  DocumentTriggerCondition,
  RequestPdfTemplateId,
} from '@/features/dashboard/bookings/lib/documentRequirements';

export const DOCUMENT_TRIGGER_CONDITIONS: DocumentTriggerCondition[] = [
  'always',
  'has_pets',
  'need_parking',
];

export const DOCUMENT_APPROVAL_SOURCES: DocumentApprovalSource[] = ['manual', 'email-listener'];

/**
 * Binding a row to a template is what makes the orchestrator generate the request
 * PDF and send the request email for it (`requirementMatchesPdfTemplate`). An
 * unbound row is tracked as a checklist step only.
 */
export const DOCUMENT_PDF_TEMPLATES: RequestPdfTemplateId[] = ['gaf', 'pet'];

/** Sentinel for the Select — Radix cannot hold an empty string value. */
export const DOCUMENT_PDF_TEMPLATE_NONE = 'none';

export const DOCUMENT_TRIGGER_CONDITION_LABELS: Record<DocumentTriggerCondition, string> = {
  always: 'Always required',
  has_pets: 'Guest has pets',
  need_parking: 'Guest needs parking',
};

export const DOCUMENT_APPROVAL_SOURCE_LABELS: Record<DocumentApprovalSource, string> = {
  manual: 'Manual (admin marks complete)',
  'email-listener': 'Email listener (auto-approve)',
};

export const DOCUMENT_PDF_TEMPLATE_LABELS: Record<RequestPdfTemplateId, string> = {
  gaf: 'GAF request form',
  pet: 'Pet request form',
};

export function isRequestPdfTemplateId(value: unknown): value is RequestPdfTemplateId {
  return (
    typeof value === 'string' && DOCUMENT_PDF_TEMPLATES.includes(value as RequestPdfTemplateId)
  );
}

export function documentRequirementsOverrideEqual(
  a: DocumentRequirement[] | null,
  b: DocumentRequirement[] | null
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Per-row field ids: `document-requirement-${index}-label`. */
export function documentRequirementLabelFieldErrors(
  list: DocumentRequirement[] | null
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (list === null) return errors;
  list.forEach((req, index) => {
    if (!req.label.trim()) {
      errors[`document-requirement-${index}-label`] = 'Enter a document label';
    }
  });
  return errors;
}

function withNormalizedOrder(list: DocumentRequirement[]): DocumentRequirement[] {
  return list.map((req, index) => ({ ...req, order: index + 1 }));
}

function nextRequirementId(existing: DocumentRequirement[]): string {
  const usedIds = new Set(existing.map((req) => req.id));
  let n = existing.length + 1;
  while (usedIds.has(`custom-${n}`)) n += 1;
  return `custom-${n}`;
}

export function createDocumentRequirement(existing: DocumentRequirement[]): DocumentRequirement {
  return {
    id: nextRequirementId(existing),
    label: '',
    order: existing.length + 1,
    pdfTemplateId: null,
    approvalSource: 'manual',
    triggerCondition: 'always',
    calendarIcon: null,
  };
}

export function addDocumentRequirement(list: DocumentRequirement[]): DocumentRequirement[] {
  return withNormalizedOrder([...list, createDocumentRequirement(list)]);
}

export function removeDocumentRequirement(
  list: DocumentRequirement[],
  index: number
): DocumentRequirement[] {
  return withNormalizedOrder(list.filter((_, i) => i !== index));
}

export function moveDocumentRequirement(
  list: DocumentRequirement[],
  index: number,
  direction: -1 | 1
): DocumentRequirement[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  const moved = next[index]!;
  next[index] = next[target]!;
  next[target] = moved;
  return withNormalizedOrder(next);
}

export function updateDocumentRequirement(
  list: DocumentRequirement[],
  index: number,
  patch: Partial<DocumentRequirement>
): DocumentRequirement[] {
  return list.map((req, i) => (i === index ? { ...req, ...patch } : req));
}
