/**
 * Shared property template image upload — used by upload-property-template-asset and AI assistant.
 */

import { createClient } from './supabaseJs.ts';
import {
  getBuiltinPropertyTemplate,
  isBuiltinPropertyTemplateKey,
  upsertPropertyTemplateRow,
} from './propertyTemplates.ts';
import { assertWithinUploadLimit } from './uploadLimits.ts';
import { formatPublicUrl } from './utils.ts';

const BUCKET = 'app-settings-assets';
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const STANDARD_KEYS = new Set([
  'house-rules',
  'check-in-instructions',
  'check-out-instructions',
  'parking-reminders',
]);

export type TemplateAssetType = 'section_image' | 'inline_image';

export type ApplyTemplateAssetInput = {
  propertyId: string;
  assetType: TemplateAssetType;
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
  templateKey?: string;
};

export type ApplyTemplateAssetResult = {
  url: string;
  bucket: string;
  path: string;
  templateKey: string | null;
  replacedExisting: boolean;
  label: string;
};

export async function applyPropertyTemplateAssetFromBytes(
  input: ApplyTemplateAssetInput
): Promise<ApplyTemplateAssetResult> {
  if (input.assetType !== 'section_image' && input.assetType !== 'inline_image') {
    throw new Error(`Invalid assetType: "${input.assetType}"`);
  }

  const templateKey = (input.templateKey ?? '').trim();
  if (input.assetType === 'section_image') {
    if (!templateKey || !isBuiltinPropertyTemplateKey(templateKey)) {
      throw new Error('templateKey is required for section_image');
    }
    const builtin = getBuiltinPropertyTemplate(templateKey);
    if (!builtin || builtin.category !== 'standard') {
      throw new Error('Section images are only supported for standard templates');
    }
    if (!STANDARD_KEYS.has(templateKey)) {
      throw new Error('Unknown standard template key');
    }
  }

  const mime = (input.mimeType || '').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error('File must be JPEG, PNG, or WebP');
  }

  const file = new File([input.bytes], input.fileName || 'image.jpg', { type: mime });
  assertWithinUploadLimit(file, 'image');

  const ext = input.fileName.includes('.')
    ? `.${input.fileName.split('.').pop()?.toLowerCase()}`
    : mime === 'image/png'
      ? '.png'
      : mime === 'image/webp'
        ? '.webp'
        : '.jpg';

  const storagePath =
    input.assetType === 'section_image'
      ? `template-section/${input.propertyId}/${templateKey}${ext}`
      : `template-inline/${input.propertyId}/${crypto.randomUUID()}${ext}`;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let replacedExisting = false;
  if (input.assetType === 'section_image') {
    const { data: existing } = await supabase
      .from('property_template_contents')
      .select('section_image_url')
      .eq('property_id', input.propertyId)
      .eq('template_key', templateKey)
      .maybeSingle();
    replacedExisting = Boolean(
      typeof existing?.section_image_url === 'string' && existing.section_image_url.trim()
    );
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: true, contentType: mime });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const safePublicUrl = formatPublicUrl(publicUrl);

  if (input.assetType === 'section_image') {
    const builtin = getBuiltinPropertyTemplate(templateKey)!;
    const { data: existing } = await supabase
      .from('property_template_contents')
      .select('content')
      .eq('property_id', input.propertyId)
      .eq('template_key', templateKey)
      .maybeSingle();

    await upsertPropertyTemplateRow({
      propertyId: input.propertyId,
      templateKey,
      category: 'standard',
      content: String(existing?.content ?? builtin.defaultContent),
      sectionImageUrl: safePublicUrl,
    });
  }

  return {
    url: safePublicUrl,
    bucket: BUCKET,
    path: storagePath,
    templateKey: templateKey || null,
    replacedExisting,
    label:
      input.assetType === 'section_image'
        ? `Section image (${templateKey})`
        : 'Inline template image',
  };
}
