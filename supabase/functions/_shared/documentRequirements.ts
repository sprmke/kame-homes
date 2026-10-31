/**
 * Per-property document requirement lists for PENDING_DOCUMENTS sub-steps.
 * Override on app_settings; residence-type default on developments.settings.workflowDefaults.
 */

import { createClient } from './supabaseJs.ts';
import { trimOrEmpty } from './stringUtils.ts';

export type DocumentApprovalSource = 'manual' | 'email-listener' | 'none';
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

const APPROVAL_SOURCES: DocumentApprovalSource[] = ['manual', 'email-listener', 'none'];
const TRIGGER_CONDITIONS: DocumentTriggerCondition[] = ['always', 'has_pets', 'need_parking'];

export const DEFAULT_DOCUMENT_REQUIREMENTS: DocumentRequirement[] = [
  {
    id: 'gaf',
    label: 'GAF Request',
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

  if (!isApprovalSource(entry.approvalSource)) return null;
  if (!isTriggerCondition(entry.triggerCondition)) return null;

  return {
    id,
    label,
    order,
    pdfTemplateId: parseOptionalStringOrNull(entry.pdfTemplateId),
    approvalSource: entry.approvalSource,
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

function bookingFlagTrue(value: unknown): boolean {
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
      return bookingFlagTrue(booking.has_pets);
    case 'need_parking':
      return bookingFlagTrue(booking.need_parking);
    default:
      return false;
  }
}

export type RequestPdfTemplateId = 'gaf' | 'pet';

export function requirementMatchesPdfTemplate(
  req: DocumentRequirement,
  templateId: RequestPdfTemplateId
): boolean {
  return req.pdfTemplateId === templateId || req.id === templateId;
}

/** True when an applicable requirement uses the GAF or pet PDF template (id or pdfTemplateId). */
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

/** GAF/pet substeps need an approved PDF on file before mark-complete or proceed. */
export function requirementNeedsApprovedPdf(req: DocumentRequirement): boolean {
  return requirementDocKind(req) !== 'other';
}

async function loadDocumentRequirementsOverride(propertyId: string): Promise<unknown> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const { data, error } = await supabase
    .from('app_settings')
    .select('document_requirements_override')
    .eq('property_id', propertyId)
    .maybeSingle();

  if (error) {
    console.warn('[documentRequirements] override load failed:', error.message);
    return null;
  }

  return data?.document_requirements_override ?? null;
}

async function loadPropertyResidenceName(propertyId: string): Promise<string> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const { data, error } = await supabase
    .from('properties')
    .select('residence_name')
    .eq('id', propertyId)
    .maybeSingle();

  if (error) {
    console.warn('[documentRequirements] residence load failed:', error.message);
    return '';
  }

  return trimOrEmpty(data?.residence_name as string | null | undefined);
}

async function loadDevelopmentDocumentRequirements(residenceName: string): Promise<unknown> {
  const name = trimOrEmpty(residenceName);
  if (!name) return null;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const { data, error } = await supabase
    .from('developments')
    .select('settings')
    .eq('name', name)
    .maybeSingle();

  if (error) {
    console.warn('[documentRequirements] development load failed:', error.message);
    return null;
  }

  const settings = data?.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;

  const workflowDefaults = (settings as Record<string, unknown>).workflowDefaults;
  if (
    !workflowDefaults ||
    typeof workflowDefaults !== 'object' ||
    Array.isArray(workflowDefaults)
  ) {
    return null;
  }

  return (workflowDefaults as Record<string, unknown>).documentRequirements ?? null;
}

/** Residence-type default → `DEFAULT_DOCUMENT_REQUIREMENTS` — ignores property override. */
export async function resolveResidenceDefaultDocumentRequirements(
  propertyId: string
): Promise<DocumentRequirement[]> {
  const residenceName = await loadPropertyResidenceName(propertyId);
  const developmentRaw = await loadDevelopmentDocumentRequirements(residenceName);
  if (developmentRaw !== null && developmentRaw !== undefined) {
    return mergeDocumentRequirements(developmentRaw);
  }

  return DEFAULT_DOCUMENT_REQUIREMENTS.map((req) => ({ ...req }));
}

export async function resolveDocumentRequirements(
  propertyId: string
): Promise<DocumentRequirement[]> {
  const override = await loadDocumentRequirementsOverride(propertyId);
  if (override !== null && override !== undefined && Array.isArray(override)) {
    const parsed = parseDocumentRequirements(override);
    return parsed ?? [];
  }

  return resolveResidenceDefaultDocumentRequirements(propertyId);
}
