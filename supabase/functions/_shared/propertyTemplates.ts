/**
 * Property template registry — built-in standard + email template keys,
 * default HTML content, and DB merge helpers.
 */

import { createClient } from './supabaseJs.ts';
import { PROPERTY_TEMPLATE_PLACEHOLDERS_REFERENCE } from './propertyTemplatePlaceholders.ts';
import { normalizeBlockLevelPlaceholdersInHtml } from './normalizeBlockLevelPlaceholders.ts';
import { normalizeEmailCalloutPlaceholders } from './normalizeEmailCalloutPlaceholders.ts';

export type PropertyTemplateCategory = 'standard' | 'email' | 'custom';

export type PropertyTemplateKey =
  | 'house-rules'
  | 'check-in-instructions'
  | 'check-out-instructions'
  | 'parking-reminders'
  | 'email-gaf-request'
  | 'email-pet-request'
  | 'email-parking-request'
  | 'email-new-booking-request'
  | 'email-booking-acknowledgement'
  | 'email-ready-for-checkin'
  | 'email-sd-refund-form-request';

export type PropertyTemplateDefinition = {
  key: PropertyTemplateKey;
  label: string;
  description: string;
  category: Exclude<PropertyTemplateCategory, 'custom'>;
  defaultContent: string;
  /** Maps to `loadEmailTemplate` slug when preview uses the full design shell. */
  previewTemplateSlug?: string;
};

export type PropertyTemplateRow = {
  id: string;
  property_id: string;
  template_key: string;
  category: PropertyTemplateCategory;
  name: string | null;
  content: string;
  section_image_url: string | null;
  folder_id: string | null;
  updated_at: string;
};

export type PropertyTemplateFolderRow = {
  id: string;
  property_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
};

export type PropertyTemplateFolderDto = {
  id: string;
  name: string;
  position: number;
  /** How many custom templates currently sit in this folder. */
  templateCount: number;
};

export type PropertyTemplateDto = {
  templateKey: string;
  name: string;
  category: PropertyTemplateCategory;
  content: string;
  defaultContent: string;
  isDefault: boolean;
  description: string | null;
  previewTemplateSlug: string | null;
  sectionImageUrl: string | null;
  /** Custom templates only: the host folder holding this template, or null when ungrouped. */
  folderId: string | null;
  updatedAt: string | null;
};

const BUILTIN_TEMPLATES: PropertyTemplateDefinition[] = [
  {
    key: 'house-rules',
    label: 'House Rules',
    description: 'Set rules and guidelines for guests during their stay.',
    category: 'standard',
    defaultContent: `<h2>House Rules</h2>
<p>Welcome to our property! Please follow these guidelines to ensure a pleasant stay:</p>
<ul>
<li><strong>No smoking</strong> inside the property</li>
<li><strong>No parties or events</strong> without prior approval</li>
<li><strong>Quiet hours</strong> from 10 PM to 8 AM</li>
<li><strong>Pets</strong> allowed with prior approval and additional fee</li>
<li><strong>Maximum occupancy</strong> must be respected</li>
</ul>
<p>Please treat the property with care and respect. Any damages will be deducted from the security deposit.</p>`,
  },
  {
    key: 'check-in-instructions',
    label: 'Check-in Instructions',
    description: 'Provide detailed instructions for guest check-in process.',
    category: 'standard',
    defaultContent: `<h2>Check-in Instructions</h2>
<p>Welcome! Here's everything you need to know for your check-in:</p>
<h3>Check-in Time</h3>
<p>Standard check-in time is <strong>2:00 PM</strong>. Early check-in may be available upon request.</p>
<h3>Getting Access</h3>
<ol>
<li>Upon arrival, proceed to the building lobby</li>
<li>Check in at the front desk with your valid ID</li>
<li>Collect your keys and parking pass (if applicable)</li>
</ol>
<h3>Self Check-in (After Hours)</h3>
<p>For late arrivals, use the lockbox code sent to your email. The lockbox is located near the main entrance.</p>`,
  },
  {
    key: 'check-out-instructions',
    label: 'Check-out Instructions',
    description: 'Guide guests through the check-out process.',
    category: 'standard',
    defaultContent: `<h2>Check-out Instructions</h2>
<p>Thank you for staying with us! Please follow these steps for check-out:</p>
<h3>Check-out Time</h3>
<p>Standard check-out time is <strong>11:00 AM</strong>. Late check-out may be available upon request.</p>
<h3>Before You Leave</h3>
<ul>
<li>Return all keys to the front desk or lockbox</li>
<li>Dispose of trash in designated bins</li>
<li>Ensure all windows and doors are locked</li>
<li>Turn off all lights and air conditioning</li>
<li>Check for personal belongings</li>
</ul>`,
  },
  {
    key: 'parking-reminders',
    label: 'Parking Reminders',
    description: 'Important information about parking regulations and procedures.',
    category: 'standard',
    defaultContent: `<h2>Parking Reminders</h2>
<p>Important information about parking at our property:</p>
<h3>Parking Registration</h3>
<p>All vehicles must be registered with building security. Please provide:</p>
<ul>
<li>Vehicle plate number</li>
<li>Vehicle make/model</li>
<li>Vehicle color</li>
</ul>
<h3>Parking Rules</h3>
<ul>
<li>Park only in designated guest parking areas</li>
<li>Display your parking pass visibly on your dashboard</li>
<li>Do not park in reserved or handicap spaces without proper permits</li>
</ul>`,
  },
  {
    key: 'email-gaf-request',
    label: 'GAF Request',
    description: 'Request email sent to building admin for guest registration approval.',
    category: 'email',
    previewTemplateSlug: 'gaf-request',
    defaultContent: `<p>{{urgent_notice}}</p>
<p>{{update_notice}}</p>
<p>Good day,</p>
<p>Kindly review the Guest Advise Form (GAF) request for <strong>{{tower_and_unit_number}}</strong>, dated from <strong>{{check_in_date}} to {{check_out_date}}</strong>, for your approval.</p>
<p>Please let me know if you need any additional information.</p>
<p>Thank you for your assistance.</p>
<p>{{email_signature_section}}</p>`,
  },
  {
    key: 'email-pet-request',
    label: 'Pet Request',
    description: 'Request email sent to building admin for pet approval.',
    category: 'email',
    previewTemplateSlug: 'pet-request',
    defaultContent: `<p>{{urgent_notice}}</p>
<p>{{update_notice}}</p>
<p>Good day,</p>
<p>May we kindly request approval for our guest to bring a pet during their stay at <strong>{{tower_and_unit_number}}</strong> from <strong>{{check_in_date}}</strong> to <strong>{{check_out_date}}</strong>.</p>
<p>{{pet_details_section}}</p>
<p>{{pet_attachments_section}}</p>
<p>Please let us know if you need any additional information or documentation.</p>
<p>Thank you for your consideration.</p>
<p>{{email_signature_section}}</p>`,
  },
  {
    key: 'email-parking-request',
    label: 'Parking Request',
    description: 'Request email sent to building admin for parking registration.',
    category: 'email',
    previewTemplateSlug: 'parking-broadcast',
    defaultContent: `<p>{{urgent_notice}}</p>
<p>{{update_notice}}</p>
<p>Good day,</p>
<p>We have a guest checking in <strong>{{tower_and_unit_number}}</strong> and they need a parking slot.</p>
<p>{{booking_vehicle_copy}}</p>
<p>{{parking_reply_callout_section}}</p>
<p>{{email_signature_section}}</p>`,
  },
  {
    key: 'email-new-booking-request',
    label: 'New Booking Request',
    description: 'Owner alert when a guest submits a new booking form.',
    category: 'email',
    previewTemplateSlug: 'new-booking-request',
    defaultContent: `<p>{{urgent_notice}}</p>
<p>A new booking request has been submitted. Please <strong>review and approve as soon as possible</strong>.</p>
<p>{{new_booking_detail_tables}}</p>
<p>{{downpayment_receipt_ai_section}}</p>
<p>{{booking_link_cta}}</p>`,
  },
  {
    key: 'email-booking-acknowledgement',
    label: 'Booking Acknowledgement',
    description: 'Guest email after admin proceeds to pending documents.',
    category: 'email',
    previewTemplateSlug: 'booking-acknowledgement',
    defaultContent: `<p>{{booking_acknowledgement_flow_section}}</p>
<p>Thank you for choosing {{property_name}}. We look forward to hosting you!</p>
<p>{{email_signature_section}}</p>`,
  },
  {
    key: 'email-ready-for-checkin',
    label: 'Ready for Check-in',
    description: 'Guest email with check-in details and payment breakdown.',
    category: 'email',
    previewTemplateSlug: 'ready-for-checkin',
    defaultContent: `<p>Dear <strong>{{guest_facebook_name}}</strong>,</p>
<p>Your Guest Advise Form (GAF) has been approved and your booking is now confirmed. We look forward to hosting you.</p>
<p>{{ready_for_checkin_booking_summary_section}}</p>
<p>{{payment_breakdown_section}}</p>
<p>{{gcash_payment_section}}</p>
<p>{{document_reminders_section}}</p>
<p>{{stay_guide_cta_section}}</p>
<p>{{ready_for_checkin_contact_section}}</p>
<p>{{email_signature_section}}</p>`,
  },
  {
    key: 'email-sd-refund-form-request',
    label: 'SD Refund Form Request',
    description: 'Guest email with check-out checklist and security deposit refund form link.',
    category: 'email',
    previewTemplateSlug: 'sd-refund-form-request',
    defaultContent: `<p>Hi <strong>{{guest_facebook_name}}</strong>,</p>
<p>Thank you for staying with us! We hope you had a wonderful stay! Please follow the check-out instructions below. After that, please open and fill out the SD refund form so that we can process your refund.</p>
<p>{{sd_refund_checklist_section}}</p>
<p>{{sd_refund_details_section}}</p>`,
  },
];

const BUILTIN_BY_KEY = new Map(BUILTIN_TEMPLATES.map((t) => [t.key, t]));

export function listBuiltinPropertyTemplates(): PropertyTemplateDefinition[] {
  return [...BUILTIN_TEMPLATES];
}

export function getBuiltinPropertyTemplate(key: string): PropertyTemplateDefinition | undefined {
  return BUILTIN_BY_KEY.get(key as PropertyTemplateKey);
}

export function isBuiltinPropertyTemplateKey(key: string): boolean {
  return BUILTIN_BY_KEY.has(key as PropertyTemplateKey);
}

export function isCustomTemplateKey(key: string): boolean {
  return key.startsWith('custom-');
}

const MAX_TEMPLATE_CONTENT_LENGTH = 120_000;
const MAX_CUSTOM_TEMPLATE_NAME_LENGTH = 120;
const MAX_CUSTOM_TEMPLATES = 20;

export function validateTemplateContent(content: string): string | null {
  if (typeof content !== 'string') return 'Content must be a string';
  if (content.length > MAX_TEMPLATE_CONTENT_LENGTH) {
    return `Content must be at most ${MAX_TEMPLATE_CONTENT_LENGTH} characters`;
  }
  return null;
}

function normalizeStoredTemplateContent(content: string, templateKey?: string): string {
  let out = normalizeBlockLevelPlaceholdersInHtml(content);
  if (templateKey) {
    out = normalizeEmailCalloutPlaceholders(out, templateKey, {
      ensureMissing: true,
    });
  }
  return out;
}

export function validateCustomTemplateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Template name is required';
  if (trimmed.length > MAX_CUSTOM_TEMPLATE_NAME_LENGTH) {
    return `Name must be at most ${MAX_CUSTOM_TEMPLATE_NAME_LENGTH} characters`;
  }
  return null;
}

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

export async function getPropertyTemplateRow(
  propertyId: string,
  templateKey: string
): Promise<PropertyTemplateRow | null> {
  const { data, error } = await supabaseAdmin()
    .from('property_template_contents')
    .select('*')
    .eq('property_id', propertyId)
    .eq('template_key', templateKey)
    .maybeSingle();

  if (error) {
    console.error('[propertyTemplates] getPropertyTemplateRow:', error);
    throw new Error('Failed to load property template');
  }
  return (data as PropertyTemplateRow | null) ?? null;
}

export async function listPropertyTemplateRows(propertyId: string): Promise<PropertyTemplateRow[]> {
  const { data, error } = await supabaseAdmin()
    .from('property_template_contents')
    .select('*')
    .eq('property_id', propertyId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[propertyTemplates] listPropertyTemplateRows:', error);
    throw new Error('Failed to load property templates');
  }
  return (data ?? []) as PropertyTemplateRow[];
}

export async function upsertPropertyTemplateRow(input: {
  propertyId: string;
  templateKey: string;
  category: PropertyTemplateCategory;
  name?: string | null;
  content: string;
  sectionImageUrl?: string | null;
  /** Custom templates only; built-ins always live in their fixed section. */
  folderId?: string | null;
}): Promise<PropertyTemplateRow> {
  const patch: Record<string, unknown> = {
    property_id: input.propertyId,
    template_key: input.templateKey,
    category: input.category,
    content: normalizeStoredTemplateContent(input.content, input.templateKey),
    updated_at: new Date().toISOString(),
  };
  /*
   * Only write `name` when the caller supplied one. An unconditional
   * `name: input.name ?? null` wiped the stored name on every content save,
   * which left custom templates displaying their raw `custom-<uuid>` key.
   */
  if (input.name !== undefined) {
    patch.name = input.name?.trim() || null;
  }
  if (input.sectionImageUrl !== undefined) {
    patch.section_image_url = input.sectionImageUrl?.trim() || null;
  }
  if (input.folderId !== undefined) {
    patch.folder_id = input.category === 'custom' ? input.folderId : null;
  }

  const { data, error } = await supabaseAdmin()
    .from('property_template_contents')
    .upsert(patch, { onConflict: 'property_id,template_key' })
    .select('*')
    .single();

  if (error || !data) {
    console.error('[propertyTemplates] upsertPropertyTemplateRow:', error);
    throw new Error('Failed to save property template');
  }
  return data as PropertyTemplateRow;
}

export async function deletePropertyTemplateRow(
  propertyId: string,
  templateKey: string
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('property_template_contents')
    .delete()
    .eq('property_id', propertyId)
    .eq('template_key', templateKey);

  if (error) {
    console.error('[propertyTemplates] deletePropertyTemplateRow:', error);
    throw new Error('Failed to delete property template');
  }
}

export async function countCustomTemplates(propertyId: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from('property_template_contents')
    .select('*', { count: 'exact', head: true })
    .eq('property_id', propertyId)
    .like('template_key', 'custom-%');

  if (error) {
    console.error('[propertyTemplates] countCustomTemplates:', error);
    throw new Error('Failed to count custom templates');
  }
  return count ?? 0;
}

/** Saved row for a custom template (`custom-*` keys are never built-in). */
export async function resolveCustomTemplateRow(
  propertyId: string,
  templateKey: string
): Promise<{ content: string; name: string } | null> {
  const { data, error } = await supabaseAdmin()
    .from('property_template_contents')
    .select('content, name')
    .eq('property_id', propertyId)
    .eq('template_key', templateKey)
    .maybeSingle();

  if (error) {
    console.error('[propertyTemplates] resolveCustomTemplateRow:', error);
    throw new Error('Failed to load custom template content');
  }
  if (!data?.content?.trim()) return null;

  return {
    content: normalizeStoredTemplateContent(String(data.content), templateKey),
    name: data.name?.trim() || 'Custom template',
  };
}

/** Resolved HTML body for a built-in or saved property template. */
export async function resolvePropertyTemplateContent(
  propertyId: string | undefined,
  templateKey: PropertyTemplateKey
): Promise<{
  content: string;
  label: string;
  sectionImageUrl: string | null;
  updatedAt: string | null;
}> {
  const builtin = getBuiltinPropertyTemplate(templateKey);
  if (!builtin) {
    throw new Error(`Unknown property template key: ${templateKey}`);
  }

  if (propertyId) {
    const { data, error } = await supabaseAdmin()
      .from('property_template_contents')
      .select('content, section_image_url, updated_at')
      .eq('property_id', propertyId)
      .eq('template_key', templateKey)
      .maybeSingle();

    if (error) {
      console.error('[propertyTemplates] resolvePropertyTemplateContent:', error);
      throw new Error('Failed to load property template content');
    }

    if (data?.content != null && String(data.content).trim()) {
      return {
        content: normalizeStoredTemplateContent(String(data.content), templateKey),
        label: builtin.label,
        sectionImageUrl: String(data.section_image_url ?? '').trim() || null,
        updatedAt: data.updated_at ? String(data.updated_at) : null,
      };
    }
  }

  return {
    content: builtin.defaultContent,
    label: builtin.label,
    sectionImageUrl: null,
    updatedAt: null,
  };
}

export { MAX_CUSTOM_TEMPLATES };

function rowToDto(
  row: PropertyTemplateRow,
  builtin?: PropertyTemplateDefinition
): PropertyTemplateDto {
  const defaultContent = builtin?.defaultContent ?? '';
  return {
    templateKey: row.template_key,
    name: row.name?.trim() || builtin?.label || row.template_key,
    category: row.category,
    content: normalizeStoredTemplateContent(row.content, row.template_key),
    defaultContent,
    isDefault: row.content === defaultContent,
    description: builtin?.description ?? null,
    previewTemplateSlug: builtin?.previewTemplateSlug ?? null,
    sectionImageUrl: String(row.section_image_url ?? '').trim() || null,
    folderId: row.category === 'custom' ? (row.folder_id ?? null) : null,
    updatedAt: row.updated_at,
  };
}

function builtinToDto(builtin: PropertyTemplateDefinition): PropertyTemplateDto {
  return {
    templateKey: builtin.key,
    name: builtin.label,
    category: builtin.category,
    content: builtin.defaultContent,
    defaultContent: builtin.defaultContent,
    isDefault: true,
    description: builtin.description,
    previewTemplateSlug: builtin.previewTemplateSlug ?? null,
    sectionImageUrl: null,
    folderId: null,
    updatedAt: null,
  };
}

export async function serializePropertyTemplatesForAdmin(propertyId: string): Promise<{
  templates: PropertyTemplateDto[];
  placeholdersReference: string[];
  folders: PropertyTemplateFolderDto[];
}> {
  const rows = await listPropertyTemplateRows(propertyId);
  const rowByKey = new Map(rows.map((r) => [r.template_key, r]));

  const templates: PropertyTemplateDto[] = BUILTIN_TEMPLATES.map((builtin) => {
    const row = rowByKey.get(builtin.key);
    if (!row) return builtinToDto(builtin);
    return rowToDto(row, builtin);
  });

  for (const row of rows) {
    if (!isCustomTemplateKey(row.template_key)) continue;
    templates.push(rowToDto(row));
  }

  const folderRows = await listPropertyTemplateFolders(propertyId);
  const countByFolder = new Map<string, number>();
  for (const template of templates) {
    if (!template.folderId) continue;
    countByFolder.set(template.folderId, (countByFolder.get(template.folderId) ?? 0) + 1);
  }

  return {
    templates,
    placeholdersReference: [...PROPERTY_TEMPLATE_PLACEHOLDERS_REFERENCE],
    folders: folderRows.map((row) => ({
      id: row.id,
      name: row.name,
      position: row.position,
      templateCount: countByFolder.get(row.id) ?? 0,
    })),
  };
}

export const MAX_TEMPLATE_FOLDERS = 20;
const MAX_TEMPLATE_FOLDER_NAME_LENGTH = 40;

export function validateTemplateFolderName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Folder name is required';
  if (trimmed.length > MAX_TEMPLATE_FOLDER_NAME_LENGTH) {
    return `Folder name must be at most ${MAX_TEMPLATE_FOLDER_NAME_LENGTH} characters`;
  }
  return null;
}

/** Postgres unique-violation on the per-property folder name index. */
function isDuplicateFolderName(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

export async function listPropertyTemplateFolders(
  propertyId: string
): Promise<PropertyTemplateFolderRow[]> {
  const { data, error } = await supabaseAdmin()
    .from('property_template_folders')
    .select('*')
    .eq('property_id', propertyId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[propertyTemplates] listPropertyTemplateFolders:', error);
    throw new Error('Failed to load template folders');
  }
  return (data ?? []) as PropertyTemplateFolderRow[];
}

export async function countPropertyTemplateFolders(propertyId: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from('property_template_folders')
    .select('*', { count: 'exact', head: true })
    .eq('property_id', propertyId);

  if (error) {
    console.error('[propertyTemplates] countPropertyTemplateFolders:', error);
    throw new Error('Failed to count template folders');
  }
  return count ?? 0;
}

export class DuplicateTemplateFolderNameError extends Error {
  constructor() {
    super('A folder with that name already exists');
  }
}

export async function createPropertyTemplateFolder(input: {
  propertyId: string;
  name: string;
}): Promise<PropertyTemplateFolderRow> {
  const existing = await listPropertyTemplateFolders(input.propertyId);
  const nextPosition = existing.reduce((max, row) => Math.max(max, row.position), -1) + 1;

  const { data, error } = await supabaseAdmin()
    .from('property_template_folders')
    .insert({
      property_id: input.propertyId,
      name: input.name.trim(),
      position: nextPosition,
    })
    .select('*')
    .single();

  if (isDuplicateFolderName(error)) throw new DuplicateTemplateFolderNameError();
  if (error || !data) {
    console.error('[propertyTemplates] createPropertyTemplateFolder:', error);
    throw new Error('Failed to create template folder');
  }
  return data as PropertyTemplateFolderRow;
}

export async function renamePropertyTemplateFolder(input: {
  propertyId: string;
  folderId: string;
  name: string;
}): Promise<PropertyTemplateFolderRow | null> {
  const { data, error } = await supabaseAdmin()
    .from('property_template_folders')
    .update({ name: input.name.trim(), updated_at: new Date().toISOString() })
    .eq('property_id', input.propertyId)
    .eq('id', input.folderId)
    .select('*')
    .maybeSingle();

  if (isDuplicateFolderName(error)) throw new DuplicateTemplateFolderNameError();
  if (error) {
    console.error('[propertyTemplates] renamePropertyTemplateFolder:', error);
    throw new Error('Failed to rename template folder');
  }
  return (data as PropertyTemplateFolderRow | null) ?? null;
}

/** Templates in the folder are kept; the FK drops them back to the ungrouped section. */
export async function deletePropertyTemplateFolder(
  propertyId: string,
  folderId: string
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('property_template_folders')
    .delete()
    .eq('property_id', propertyId)
    .eq('id', folderId);

  if (error) {
    console.error('[propertyTemplates] deletePropertyTemplateFolder:', error);
    throw new Error('Failed to delete template folder');
  }
}

export async function propertyTemplateFolderExists(
  propertyId: string,
  folderId: string
): Promise<boolean> {
  const { count, error } = await supabaseAdmin()
    .from('property_template_folders')
    .select('*', { count: 'exact', head: true })
    .eq('property_id', propertyId)
    .eq('id', folderId);

  if (error) {
    console.error('[propertyTemplates] propertyTemplateFolderExists:', error);
    throw new Error('Failed to load template folder');
  }
  return (count ?? 0) > 0;
}

/** Renames or re-files one host-owned template row without touching its content. */
export async function updateCustomTemplateRow(input: {
  propertyId: string;
  templateKey: string;
  name?: string;
  category?: PropertyTemplateCategory;
  folderId?: string | null;
}): Promise<PropertyTemplateRow | null> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.category !== undefined) {
    patch.category = input.category;
    if (input.category !== 'custom') {
      patch.folder_id = null;
    } else if (input.folderId !== undefined) {
      patch.folder_id = input.folderId;
    }
  } else if (input.folderId !== undefined) {
    patch.folder_id = input.folderId;
  }

  const { data, error } = await supabaseAdmin()
    .from('property_template_contents')
    .update(patch)
    .eq('property_id', input.propertyId)
    .eq('template_key', input.templateKey)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[propertyTemplates] updateCustomTemplateRow:', error);
    throw new Error('Failed to update template');
  }
  return (data as PropertyTemplateRow | null) ?? null;
}
