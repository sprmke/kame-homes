/**
 * AI assistant tools: apply chat attachments to org logo, property/parking media,
 * app-settings assets (signature / reviews), and template images.
 */

import {
  assertAssistantAttachmentPathAllowed,
  downloadAssistantAttachment,
} from './assistantAttachmentApply.ts';
import {
  APP_SETTINGS_APPLY_ASSET_TYPES,
  APP_SETTINGS_APPLY_LABELS,
  appSettingsAssetPermission,
  applyAppSettingsAssetFromBytes,
  isAppSettingsApplyAssetType,
  type AppSettingsApplyAssetType,
} from './appSettingsAssetUpload.ts';
import { classifyActionRisk, type ActionRiskTier } from './dashboardAssistantRiskClassifier.ts';
import { assertActionSafeToExecute } from './dashboardAssistantSafetyGuard.ts';
import type { AttachedContextItem } from './dashboardAssistantAttachedContext.ts';
import { applyOrgTeamLogoFromBytes } from './orgTeamLogoUpload.ts';
import { createServiceClient, verifyOrgAccess, verifyPropertyAccess } from './orgAuth.ts';
import { applyParkingCoverFromBytes } from './parkingMediaUpload.ts';
import { applyPropertyMediaFromBytes } from './propertyMediaUpload.ts';
import {
  applyPropertyTemplateAssetFromBytes,
  type TemplateAssetType,
} from './propertyTemplateAssetUpload.ts';
import { resolveOrganizationIdForProperty } from './propertyScope.ts';

export type HostMediaToolContext = {
  req: Request;
  organizationId: string;
  userId: string;
  userEmail: string;
  pageContext: { propertyId?: string | null; bookingId?: string | null };
  attachedContext: AttachedContextItem[];
  isBulk: boolean;
  conversationId?: string | null;
};

export type HostMediaToolResult = {
  ok: boolean;
  error?: string;
  data?: unknown;
  riskTier?: ActionRiskTier;
  proposed?: boolean;
  auditPropertyId?: string | null;
  auditBookingId?: string | null;
};

function str(args: Record<string, unknown>, key: string): string | null {
  const v = args[key];
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t || null;
}

function bool(args: Record<string, unknown>, key: string): boolean {
  return args[key] === true;
}

function requireConversationId(ctx: HostMediaToolContext): string {
  const id = ctx.conversationId?.trim();
  if (!id) throw new Error('Conversation is required to apply attachments');
  return id;
}

function fileNameFromPath(path: string, fallback = 'attachment'): string {
  const base = path.split('/').pop()?.trim();
  return base || fallback;
}

async function loadConversationAttachment(
  ctx: HostMediaToolContext,
  attachmentPath: string
): Promise<{ path: string; bytes: Uint8Array; mimeType: string; size: number; fileName: string }> {
  const conversationId = requireConversationId(ctx);
  const attachment = await downloadAssistantAttachment({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    conversationId,
    path: attachmentPath,
  });
  return {
    ...attachment,
    fileName: fileNameFromPath(attachment.path),
  };
}

async function assertPropertyInOrg(propertyId: string, organizationId: string): Promise<void> {
  const orgId = await resolveOrganizationIdForProperty(propertyId);
  if (orgId !== organizationId) throw new Error('Property is outside this organization');
}

async function assertParkingInOrgManageable(
  ctx: HostMediaToolContext,
  parkingId: string
): Promise<void> {
  await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId }, 'org.parkings:manage');
  const supabase = createServiceClient();
  const { data: parking, error } = await supabase
    .from('parkings')
    .select('id, organization_id')
    .eq('id', parkingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!parking) throw new Error('Parking not found');
  if (parking.organization_id !== ctx.organizationId) {
    throw new Error('Parking is outside this organization');
  }
}

// ─── Org logo ────────────────────────────────────────────────────────────────

export async function toolProposeApplyOrgLogo(
  ctx: HostMediaToolContext,
  args: Record<string, unknown>
): Promise<HostMediaToolResult> {
  try {
    const attachmentPath = str(args, 'attachmentPath');
    if (!attachmentPath) {
      return { ok: false, error: 'attachmentPath is required' };
    }
    const conversationId = requireConversationId(ctx);
    assertAssistantAttachmentPathAllowed(attachmentPath, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      conversationId,
    });

    await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId }, 'org.settings.basic:edit');

    const meta = await loadConversationAttachment(ctx, attachmentPath);
    const tier = classifyActionRisk({
      toolName: 'propose_apply_org_logo',
      targetBookingId: null,
      targetPropertyId: null,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: ctx.isBulk,
    });

    return {
      ok: true,
      proposed: true,
      riskTier: tier,
      auditPropertyId: null,
      data: {
        summary: `Set organization logo from “${meta.fileName}”. This replaces the current logo if one is already set.`,
        payload: {
          attachmentPath,
          fileName: meta.fileName,
          mimeType: meta.mimeType,
        },
        details: [
          { label: 'File', value: meta.fileName },
          { label: 'Target', value: 'Organization logo' },
        ],
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeApplyOrgLogo(
  ctx: HostMediaToolContext,
  payload: Record<string, unknown>
): Promise<HostMediaToolResult> {
  try {
    const attachmentPath = str(payload, 'attachmentPath');
    if (!attachmentPath) return { ok: false, error: 'attachmentPath is required' };
    const conversationId = requireConversationId(ctx);
    assertAssistantAttachmentPathAllowed(attachmentPath, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      conversationId,
    });
    await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId }, 'org.settings.basic:edit');
    await assertActionSafeToExecute({
      toolName: 'propose_apply_org_logo',
      targetBookingId: null,
      targetPropertyId: null,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const file = await loadConversationAttachment(ctx, attachmentPath);
    const result = await applyOrgTeamLogoFromBytes({
      organizationId: ctx.organizationId,
      bytes: file.bytes,
      mimeType: file.mimeType,
      fileName: file.fileName,
    });

    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: null,
      data: {
        url: result.url,
        replacedExisting: result.replacedExisting,
        message: result.replacedExisting
          ? 'Organization logo replaced.'
          : 'Organization logo updated.',
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Property media ──────────────────────────────────────────────────────────

export async function toolProposeApplyPropertyMedia(
  ctx: HostMediaToolContext,
  args: Record<string, unknown>
): Promise<HostMediaToolResult> {
  try {
    const attachmentPath = str(args, 'attachmentPath');
    const propertyId = str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? null;
    if (!attachmentPath || !propertyId) {
      return { ok: false, error: 'attachmentPath and propertyId are required' };
    }
    const conversationId = requireConversationId(ctx);
    assertAssistantAttachmentPathAllowed(attachmentPath, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      conversationId,
    });
    await assertPropertyInOrg(propertyId, ctx.organizationId);
    await verifyPropertyAccess(ctx.req, propertyId, 'settings.media:edit');

    const meta = await loadConversationAttachment(ctx, attachmentPath);
    const setPrimary = bool(args, 'setPrimary');
    const tier = classifyActionRisk({
      toolName: 'propose_apply_property_media',
      targetBookingId: null,
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: ctx.isBulk,
    });

    return {
      ok: true,
      proposed: true,
      riskTier: tier,
      auditPropertyId: propertyId,
      data: {
        summary: setPrimary
          ? `Add “${meta.fileName}” to the property gallery and set it as the primary image.`
          : `Add “${meta.fileName}” to the property gallery.`,
        payload: {
          attachmentPath,
          propertyId,
          setPrimary,
          fileName: meta.fileName,
          mimeType: meta.mimeType,
        },
        details: [
          { label: 'File', value: meta.fileName },
          { label: 'Target', value: 'Property gallery' },
          ...(setPrimary ? [{ label: 'Primary', value: 'Yes' }] : []),
        ],
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeApplyPropertyMedia(
  ctx: HostMediaToolContext,
  payload: Record<string, unknown>
): Promise<HostMediaToolResult> {
  try {
    const attachmentPath = str(payload, 'attachmentPath');
    const propertyId = str(payload, 'propertyId');
    if (!attachmentPath || !propertyId) {
      return { ok: false, error: 'attachmentPath and propertyId are required' };
    }
    const conversationId = requireConversationId(ctx);
    assertAssistantAttachmentPathAllowed(attachmentPath, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      conversationId,
    });
    await assertPropertyInOrg(propertyId, ctx.organizationId);
    await verifyPropertyAccess(ctx.req, propertyId, 'settings.media:edit');
    await assertActionSafeToExecute({
      toolName: 'propose_apply_property_media',
      targetBookingId: null,
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const file = await loadConversationAttachment(ctx, attachmentPath);
    const result = await applyPropertyMediaFromBytes({
      propertyId,
      bytes: file.bytes,
      mimeType: file.mimeType,
      fileName: file.fileName,
      setPrimary: bool(payload, 'setPrimary'),
    });

    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: propertyId,
      data: {
        item: result.item,
        mediaCount: result.media.length,
        message: `Added to property gallery${result.item.isPrimary ? ' (primary)' : ''}.`,
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Parking cover ───────────────────────────────────────────────────────────

export async function toolProposeApplyParkingMedia(
  ctx: HostMediaToolContext,
  args: Record<string, unknown>
): Promise<HostMediaToolResult> {
  try {
    const attachmentPath = str(args, 'attachmentPath');
    const parkingId = str(args, 'parkingId');
    if (!attachmentPath || !parkingId) {
      return { ok: false, error: 'attachmentPath and parkingId are required' };
    }
    const conversationId = requireConversationId(ctx);
    assertAssistantAttachmentPathAllowed(attachmentPath, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      conversationId,
    });

    await assertParkingInOrgManageable(ctx, parkingId);

    const meta = await loadConversationAttachment(ctx, attachmentPath);
    const tier = classifyActionRisk({
      toolName: 'propose_apply_parking_media',
      targetBookingId: null,
      targetPropertyId: null,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: ctx.isBulk,
    });

    return {
      ok: true,
      proposed: true,
      riskTier: tier,
      auditPropertyId: null,
      data: {
        summary: `Set parking cover photo from “${meta.fileName}”. This replaces the current cover if one is already set.`,
        payload: {
          attachmentPath,
          parkingId,
          fileName: meta.fileName,
          mimeType: meta.mimeType,
        },
        details: [
          { label: 'File', value: meta.fileName },
          { label: 'Target', value: 'Parking cover photo' },
        ],
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeApplyParkingMedia(
  ctx: HostMediaToolContext,
  payload: Record<string, unknown>
): Promise<HostMediaToolResult> {
  try {
    const attachmentPath = str(payload, 'attachmentPath');
    const parkingId = str(payload, 'parkingId');
    if (!attachmentPath || !parkingId) {
      return { ok: false, error: 'attachmentPath and parkingId are required' };
    }
    const conversationId = requireConversationId(ctx);
    assertAssistantAttachmentPathAllowed(attachmentPath, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      conversationId,
    });
    await assertParkingInOrgManageable(ctx, parkingId);
    await assertActionSafeToExecute({
      toolName: 'propose_apply_parking_media',
      targetBookingId: null,
      targetPropertyId: null,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const file = await loadConversationAttachment(ctx, attachmentPath);
    const result = await applyParkingCoverFromBytes({
      parkingId,
      bytes: file.bytes,
      mimeType: file.mimeType,
      fileName: file.fileName,
    });

    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: null,
      data: {
        coverImage: result.coverImage,
        replacedExisting: result.replacedExisting,
        message: result.replacedExisting
          ? 'Parking cover photo replaced.'
          : 'Parking cover photo updated.',
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── App settings assets (signature / reviews) ───────────────────────────────

export async function toolProposeApplyAppSettingsAttachment(
  ctx: HostMediaToolContext,
  args: Record<string, unknown>
): Promise<HostMediaToolResult> {
  try {
    const attachmentPath = str(args, 'attachmentPath');
    const propertyId = str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? null;
    const assetTypeRaw = args.assetType;
    if (
      !attachmentPath ||
      !propertyId ||
      !isAppSettingsApplyAssetType(String(assetTypeRaw ?? ''))
    ) {
      return {
        ok: false,
        error: `attachmentPath, propertyId, and assetType (${APP_SETTINGS_APPLY_ASSET_TYPES.join(' | ')}) are required. GCash QR must use the payment settings OTP flow.`,
      };
    }
    const assetType = assetTypeRaw as AppSettingsApplyAssetType;
    const reviewId = str(args, 'reviewId') ?? undefined;
    const photoIndexRaw = args.photoIndex;
    const photoIndex =
      typeof photoIndexRaw === 'number' && Number.isFinite(photoIndexRaw)
        ? photoIndexRaw
        : typeof photoIndexRaw === 'string' && photoIndexRaw.trim()
          ? Number(photoIndexRaw)
          : undefined;

    if (
      (assetType === 'external_review_image' || assetType === 'external_review_stay_photo') &&
      !reviewId
    ) {
      return { ok: false, error: 'reviewId is required for external review assets' };
    }

    const conversationId = requireConversationId(ctx);
    assertAssistantAttachmentPathAllowed(attachmentPath, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      conversationId,
    });
    await assertPropertyInOrg(propertyId, ctx.organizationId);
    await verifyPropertyAccess(ctx.req, propertyId, appSettingsAssetPermission(assetType));

    const meta = await loadConversationAttachment(ctx, attachmentPath);
    const label = APP_SETTINGS_APPLY_LABELS[assetType];
    const tier = classifyActionRisk({
      toolName: 'propose_apply_app_settings_attachment',
      targetBookingId: null,
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: ctx.isBulk,
    });

    return {
      ok: true,
      proposed: true,
      riskTier: tier,
      auditPropertyId: propertyId,
      data: {
        summary: `Apply “${meta.fileName}” as ${label}. Confirm replaces any existing file in that slot.`,
        payload: {
          attachmentPath,
          propertyId,
          assetType,
          reviewId: reviewId ?? null,
          photoIndex: photoIndex ?? null,
          fileName: meta.fileName,
          mimeType: meta.mimeType,
        },
        details: [
          { label: 'File', value: meta.fileName },
          { label: 'Target', value: label },
          ...(reviewId ? [{ label: 'Review', value: reviewId }] : []),
        ],
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeApplyAppSettingsAttachment(
  ctx: HostMediaToolContext,
  payload: Record<string, unknown>
): Promise<HostMediaToolResult> {
  try {
    const attachmentPath = str(payload, 'attachmentPath');
    const propertyId = str(payload, 'propertyId');
    const assetTypeRaw = payload.assetType;
    if (
      !attachmentPath ||
      !propertyId ||
      !isAppSettingsApplyAssetType(String(assetTypeRaw ?? ''))
    ) {
      return { ok: false, error: 'attachmentPath, propertyId, and assetType are required' };
    }
    const assetType = assetTypeRaw as AppSettingsApplyAssetType;
    const reviewId = str(payload, 'reviewId') ?? undefined;
    const photoIndexRaw = payload.photoIndex;
    const photoIndex =
      typeof photoIndexRaw === 'number' && Number.isFinite(photoIndexRaw)
        ? photoIndexRaw
        : typeof photoIndexRaw === 'string' && photoIndexRaw.trim()
          ? Number(photoIndexRaw)
          : undefined;

    const conversationId = requireConversationId(ctx);
    assertAssistantAttachmentPathAllowed(attachmentPath, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      conversationId,
    });
    await assertPropertyInOrg(propertyId, ctx.organizationId);
    await verifyPropertyAccess(ctx.req, propertyId, appSettingsAssetPermission(assetType));
    await assertActionSafeToExecute({
      toolName: 'propose_apply_app_settings_attachment',
      targetBookingId: null,
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const file = await loadConversationAttachment(ctx, attachmentPath);
    const result = await applyAppSettingsAssetFromBytes({
      propertyId,
      assetType,
      bytes: file.bytes,
      mimeType: file.mimeType,
      fileName: file.fileName,
      reviewId,
      photoIndex,
    });

    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: propertyId,
      data: {
        url: result.url,
        label: result.label,
        replacedExisting: result.replacedExisting,
        message: result.replacedExisting ? `${result.label} replaced.` : `${result.label} updated.`,
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Template assets ─────────────────────────────────────────────────────────

export async function toolProposeApplyTemplateAttachment(
  ctx: HostMediaToolContext,
  args: Record<string, unknown>
): Promise<HostMediaToolResult> {
  try {
    const attachmentPath = str(args, 'attachmentPath');
    const propertyId = str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? null;
    const assetType = str(args, 'assetType') as TemplateAssetType | null;
    const templateKey = str(args, 'templateKey') ?? undefined;
    if (
      !attachmentPath ||
      !propertyId ||
      (assetType !== 'section_image' && assetType !== 'inline_image')
    ) {
      return {
        ok: false,
        error:
          'attachmentPath, propertyId, and assetType (section_image | inline_image) are required',
      };
    }
    if (assetType === 'section_image' && !templateKey) {
      return {
        ok: false,
        error:
          'templateKey is required for section_image (house-rules | check-in-instructions | check-out-instructions | parking-reminders)',
      };
    }

    const conversationId = requireConversationId(ctx);
    assertAssistantAttachmentPathAllowed(attachmentPath, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      conversationId,
    });
    await assertPropertyInOrg(propertyId, ctx.organizationId);
    await verifyPropertyAccess(ctx.req, propertyId, 'templates.standard:edit');

    const meta = await loadConversationAttachment(ctx, attachmentPath);
    const label =
      assetType === 'section_image' ? `Section image (${templateKey})` : 'Inline template image';
    const tier = classifyActionRisk({
      toolName: 'propose_apply_template_attachment',
      targetBookingId: null,
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: ctx.isBulk,
    });

    return {
      ok: true,
      proposed: true,
      riskTier: tier,
      auditPropertyId: propertyId,
      data: {
        summary: `Apply “${meta.fileName}” as ${label}. Confirm replaces any existing section image.`,
        payload: {
          attachmentPath,
          propertyId,
          assetType,
          templateKey: templateKey ?? null,
          fileName: meta.fileName,
          mimeType: meta.mimeType,
        },
        details: [
          { label: 'File', value: meta.fileName },
          { label: 'Target', value: label },
        ],
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeApplyTemplateAttachment(
  ctx: HostMediaToolContext,
  payload: Record<string, unknown>
): Promise<HostMediaToolResult> {
  try {
    const attachmentPath = str(payload, 'attachmentPath');
    const propertyId = str(payload, 'propertyId');
    const assetType = str(payload, 'assetType') as TemplateAssetType | null;
    const templateKey = str(payload, 'templateKey') ?? undefined;
    if (
      !attachmentPath ||
      !propertyId ||
      (assetType !== 'section_image' && assetType !== 'inline_image')
    ) {
      return { ok: false, error: 'attachmentPath, propertyId, and assetType are required' };
    }

    const conversationId = requireConversationId(ctx);
    assertAssistantAttachmentPathAllowed(attachmentPath, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      conversationId,
    });
    await assertPropertyInOrg(propertyId, ctx.organizationId);
    await verifyPropertyAccess(ctx.req, propertyId, 'templates.standard:edit');
    await assertActionSafeToExecute({
      toolName: 'propose_apply_template_attachment',
      targetBookingId: null,
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const file = await loadConversationAttachment(ctx, attachmentPath);
    const result = await applyPropertyTemplateAssetFromBytes({
      propertyId,
      assetType,
      bytes: file.bytes,
      mimeType: file.mimeType,
      fileName: file.fileName,
      templateKey,
    });

    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: propertyId,
      data: {
        url: result.url,
        templateKey: result.templateKey,
        replacedExisting: result.replacedExisting,
        message: result.replacedExisting ? `${result.label} replaced.` : `${result.label} updated.`,
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Declarations ────────────────────────────────────────────────────────────

export const APPLY_ORG_LOGO_TOOL_DECLARATION = {
  name: 'propose_apply_org_logo',
  description:
    'Apply a chat attachment as the organization team logo (email + org branding). Requires Confirm. Replaces any existing logo.',
  parameters: {
    type: 'object',
    properties: {
      attachmentPath: {
        type: 'string',
        description: 'Exact attachmentPath from Known facts / conversation summary',
      },
    },
    required: ['attachmentPath'],
  },
};

export const APPLY_PROPERTY_MEDIA_TOOL_DECLARATION = {
  name: 'propose_apply_property_media',
  description:
    'Add a chat attachment (image or video) to a property gallery. Optional setPrimary for images. Requires Confirm.',
  parameters: {
    type: 'object',
    properties: {
      attachmentPath: { type: 'string' },
      propertyId: { type: 'string' },
      setPrimary: { type: 'boolean' },
    },
    required: ['attachmentPath', 'propertyId'],
  },
};

export const APPLY_PARKING_MEDIA_TOOL_DECLARATION = {
  name: 'propose_apply_parking_media',
  description:
    'Apply a chat image as the parking listing cover photo. Requires Confirm. Replaces any existing cover.',
  parameters: {
    type: 'object',
    properties: {
      attachmentPath: { type: 'string' },
      parkingId: { type: 'string' },
    },
    required: ['attachmentPath', 'parkingId'],
  },
};

export const APPLY_APP_SETTINGS_ATTACHMENT_TOOL_DECLARATION = {
  name: 'propose_apply_app_settings_attachment',
  description:
    'Apply a chat image as GAF unit owner signature, external review image, or stay photo. Not for GCash QR (OTP payment settings). Requires Confirm.',
  parameters: {
    type: 'object',
    properties: {
      attachmentPath: { type: 'string' },
      propertyId: { type: 'string' },
      assetType: {
        type: 'string',
        enum: ['gaf_unit_owner_signature', 'external_review_image', 'external_review_stay_photo'],
      },
      reviewId: { type: 'string' },
      photoIndex: { type: 'number' },
    },
    required: ['attachmentPath', 'propertyId', 'assetType'],
  },
};

export const APPLY_TEMPLATE_ATTACHMENT_TOOL_DECLARATION = {
  name: 'propose_apply_template_attachment',
  description:
    'Apply a chat image as a standard template section_image (needs templateKey) or inline_image. Requires Confirm.',
  parameters: {
    type: 'object',
    properties: {
      attachmentPath: { type: 'string' },
      propertyId: { type: 'string' },
      assetType: { type: 'string', enum: ['section_image', 'inline_image'] },
      templateKey: {
        type: 'string',
        description:
          'Required for section_image: house-rules | check-in-instructions | check-out-instructions | parking-reminders',
      },
    },
    required: ['attachmentPath', 'propertyId', 'assetType'],
  },
};
