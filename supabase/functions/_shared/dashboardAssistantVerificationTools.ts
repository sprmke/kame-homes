/**
 * AI assistant tools: org verification, listing authorization, and GCash QR staging.
 */

import {
  assertAssistantAttachmentPathAllowed,
  downloadAssistantAttachment,
} from './assistantAttachmentApply.ts';
import { classifyActionRisk, type ActionRiskTier } from './dashboardAssistantRiskClassifier.ts';
import { assertActionSafeToExecute } from './dashboardAssistantSafetyGuard.ts';
import type { AttachedContextItem } from './dashboardAssistantAttachedContext.ts';
import { manilaTodayYmd } from './calendarAvailabilityManila.ts';
import { resetLifecycleForNewContractCycle } from './contractLifecycle.ts';
import { stageGcashQrFromBytes } from './gcashQrStageUpload.ts';
import {
  canSubmitBaseListingAuthorization,
  canSubmitListingRenewal,
  isListingAuthorizationHardRejected,
  isListingRenewEligible,
  listingRightsNeedContractEnd,
  LISTING_AUTHORIZATION_ASSET_TYPES,
  type ListingAuthorizationAssetType,
  type ListingAuthorizationState,
} from './listingAuthorization.ts';
import {
  applyListingAuthorizationAssetFromBytes,
  isListingAuthorizationAssetType,
  LISTING_AUTHORIZATION_ASSET_LABELS,
  parseListingKind,
} from './listingAuthorizationAssetUpload.ts';
import {
  saveListingAuthorization,
  serializeListingAuthorization,
  verifyListingOwner,
} from './listingAuthorizationService.ts';
import {
  applyOrgVerificationAssetFromBytes,
  ASSISTANT_ORG_VERIFICATION_ASSET_TYPES,
  isAssistantOrgVerificationAssetType,
  ORG_VERIFICATION_ASSET_LABELS,
  type AssistantOrgVerificationAssetType,
} from './orgVerificationAssetUpload.ts';
import {
  canSubmitBaseVerification,
  canSubmitEnhancedVerification,
  ORG_SOCIAL_PROOF_PLATFORMS,
  ORG_VERIFICATION_RIGHTS,
  orgVerificationToSettingsValue,
  readOrgVerificationFromSettings,
  validateVerificationContractEndDate,
  type OrgSocialProofPlatform,
  type OrgVerificationRights,
} from './orgVerification.ts';
import {
  createServiceClient,
  serializeOrganization,
  verifyOrgAccess,
  verifyOrgOwner,
  verifyPropertyAccess,
} from './orgAuth.ts';
import { PlanFeatureRequiredError, requireOrgPropertyFeature } from './planEntitlements.ts';
import { resolveOrganizationIdForProperty } from './propertyScope.ts';

export type VerificationToolContext = {
  req: Request;
  organizationId: string;
  userId: string;
  userEmail: string;
  pageContext: { propertyId?: string | null; bookingId?: string | null };
  attachedContext: AttachedContextItem[];
  isBulk: boolean;
  conversationId?: string | null;
};

export type VerificationToolResult = {
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

function requireConversationId(ctx: VerificationToolContext): string {
  const id = ctx.conversationId?.trim();
  if (!id) throw new Error('Conversation is required to apply attachments');
  return id;
}

function fileNameFromPath(path: string, fallback = 'attachment'): string {
  const base = path.split('/').pop()?.trim();
  return base || fallback;
}

async function loadConversationAttachment(
  ctx: VerificationToolContext,
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
  ctx: VerificationToolContext,
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

function planFeatureErrorMessage(err: unknown): string | null {
  if (err instanceof PlanFeatureRequiredError) return err.message;
  return null;
}

// ─── Org verification asset apply ────────────────────────────────────────────

export async function toolProposeApplyOrgVerificationAttachment(
  ctx: VerificationToolContext,
  args: Record<string, unknown>
): Promise<VerificationToolResult> {
  try {
    const attachmentPath = str(args, 'attachmentPath');
    const assetTypeRaw = args.assetType;
    if (!attachmentPath || !isAssistantOrgVerificationAssetType(String(assetTypeRaw ?? ''))) {
      return {
        ok: false,
        error: `attachmentPath and assetType (${ASSISTANT_ORG_VERIFICATION_ASSET_TYPES.join(' | ')}) are required`,
      };
    }
    const assetType = assetTypeRaw as AssistantOrgVerificationAssetType;
    const conversationId = requireConversationId(ctx);
    assertAssistantAttachmentPathAllowed(attachmentPath, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      conversationId,
    });

    await verifyOrgOwner(ctx.req, ctx.organizationId);

    const meta = await loadConversationAttachment(ctx, attachmentPath);
    const label = ORG_VERIFICATION_ASSET_LABELS[assetType] ?? assetType;
    const tier = classifyActionRisk({
      toolName: 'propose_apply_org_verification_attachment',
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
        summary: `Apply “${meta.fileName}” as org verification ${label}. This replaces any existing file in that slot.`,
        payload: {
          attachmentPath,
          assetType,
          fileName: meta.fileName,
          mimeType: meta.mimeType,
        },
        details: [
          { label: 'File', value: meta.fileName },
          { label: 'Target', value: `Org verification — ${label}` },
        ],
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeApplyOrgVerificationAttachment(
  ctx: VerificationToolContext,
  payload: Record<string, unknown>
): Promise<VerificationToolResult> {
  try {
    const attachmentPath = str(payload, 'attachmentPath');
    const assetTypeRaw = payload.assetType;
    if (!attachmentPath || !isAssistantOrgVerificationAssetType(String(assetTypeRaw ?? ''))) {
      return { ok: false, error: 'attachmentPath and assetType are required' };
    }
    const assetType = assetTypeRaw as AssistantOrgVerificationAssetType;
    const conversationId = requireConversationId(ctx);
    assertAssistantAttachmentPathAllowed(attachmentPath, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      conversationId,
    });
    await verifyOrgOwner(ctx.req, ctx.organizationId);
    await assertActionSafeToExecute({
      toolName: 'propose_apply_org_verification_attachment',
      targetBookingId: null,
      targetPropertyId: null,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const file = await loadConversationAttachment(ctx, attachmentPath);
    const result = await applyOrgVerificationAssetFromBytes({
      organizationId: ctx.organizationId,
      assetType,
      bytes: file.bytes,
      mimeType: file.mimeType,
      fileName: file.fileName,
    });

    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: null,
      data: {
        path: result.path,
        previewUrl: result.previewUrl,
        assetType: result.assetType,
        label: result.label,
        replacedExisting: result.replacedExisting,
        verification: result.verification,
        message: result.replacedExisting
          ? `${result.label} replaced on org verification.`
          : `${result.label} saved to org verification.`,
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Org verification submit ─────────────────────────────────────────────────

export async function toolProposeSubmitOrgVerification(
  ctx: VerificationToolContext,
  args: Record<string, unknown>
): Promise<VerificationToolResult> {
  try {
    const tier = args.tier === 'enhanced' ? 'enhanced' : args.tier === 'base' ? 'base' : null;
    if (!tier) {
      return { ok: false, error: 'tier must be base or enhanced' };
    }

    const { org } = await verifyOrgOwner(ctx.req, ctx.organizationId);
    const currentSettings =
      org.settings && typeof org.settings === 'object' && !Array.isArray(org.settings)
        ? (org.settings as Record<string, unknown>)
        : {};
    let verification = readOrgVerificationFromSettings(currentSettings);

    const platformRaw =
      typeof args.platformAdminPlatform === 'string'
        ? args.platformAdminPlatform.trim()
        : (verification.platformAdminPlatform ?? '');

    if (tier === 'base') {
      if (verification.baseStatus === 'approved') {
        return { ok: false, error: 'Base verification is already approved' };
      }
      if (verification.baseStatus === 'rejected' && verification.baseRejectionKind === 'rejected') {
        return {
          ok: false,
          error: 'This verification was declined. Please start a new application.',
        };
      }
      if (!canSubmitBaseVerification(verification)) {
        const missing: string[] = [];
        if (!verification.assets.validIdPath) missing.push('valid ID');
        if (!verification.assets.socialProofPath) missing.push('Facebook Page screenshot');
        return { ok: false, error: `Required before submit: ${missing.join(', ')}` };
      }
    } else {
      try {
        await requireOrgPropertyFeature(ctx.organizationId, 'recommendedBadgeEligible');
      } catch (err) {
        const msg = planFeatureErrorMessage(err);
        if (msg) return { ok: false, error: msg };
        throw err;
      }

      if (verification.enhancedStatus === 'approved') {
        return { ok: false, error: 'Enhanced verification is already approved' };
      }
      if (platformRaw) {
        if (!ORG_SOCIAL_PROOF_PLATFORMS.includes(platformRaw as OrgSocialProofPlatform)) {
          return {
            ok: false,
            error: 'platformAdminPlatform must be facebook, instagram, or airbnb',
          };
        }
        verification = {
          ...verification,
          platformAdminPlatform: platformRaw as OrgSocialProofPlatform,
        };
      }

      if (!canSubmitEnhancedVerification(verification)) {
        return { ok: false, error: 'Required before submit: selfie with ID' };
      }
    }

    const tierLabel = tier === 'base' ? 'Base (Tier 1)' : 'Enhanced (Recommended badge)';
    const riskTier = classifyActionRisk({
      toolName: 'propose_submit_org_verification',
      targetBookingId: null,
      targetPropertyId: null,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: ctx.isBulk,
    });

    return {
      ok: true,
      proposed: true,
      riskTier,
      auditPropertyId: null,
      data: {
        summary: `Submit org ${tierLabel} verification for review. This notifies the platform team — you cannot undo submit from chat.`,
        payload: {
          tier,
          ...(tier === 'enhanced' && platformRaw ? { platformAdminPlatform: platformRaw } : {}),
        },
        details: [{ label: 'Tier', value: tierLabel }],
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeSubmitOrgVerification(
  ctx: VerificationToolContext,
  payload: Record<string, unknown>
): Promise<VerificationToolResult> {
  try {
    const tier = payload.tier === 'enhanced' ? 'enhanced' : payload.tier === 'base' ? 'base' : null;
    if (!tier) return { ok: false, error: 'tier must be base or enhanced' };

    const { org } = await verifyOrgOwner(ctx.req, ctx.organizationId);
    await assertActionSafeToExecute({
      toolName: 'propose_submit_org_verification',
      targetBookingId: null,
      targetPropertyId: null,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const supabase = createServiceClient();
    const currentSettings =
      org.settings && typeof org.settings === 'object' && !Array.isArray(org.settings)
        ? (org.settings as Record<string, unknown>)
        : {};
    let verification = readOrgVerificationFromSettings(currentSettings);

    if (tier === 'base') {
      if (verification.baseStatus === 'approved') {
        return { ok: false, error: 'Base verification is already approved' };
      }
      if (verification.baseStatus === 'rejected' && verification.baseRejectionKind === 'rejected') {
        return {
          ok: false,
          error: 'This verification was declined. Please start a new application.',
        };
      }
      if (!canSubmitBaseVerification(verification)) {
        return { ok: false, error: 'Required proofs are missing for base verification submit' };
      }
      verification = {
        ...verification,
        baseStatus: 'pending',
        baseSubmittedAt: new Date().toISOString(),
        baseRejectionReason: null,
        baseRejectionKind: null,
        baseChangesRequestedDocs: [],
      };
    } else {
      try {
        await requireOrgPropertyFeature(ctx.organizationId, 'recommendedBadgeEligible');
      } catch (err) {
        const msg = planFeatureErrorMessage(err);
        if (msg) return { ok: false, error: msg };
        throw err;
      }

      if (verification.enhancedStatus === 'approved') {
        return { ok: false, error: 'Enhanced verification is already approved' };
      }

      const platformRaw =
        typeof payload.platformAdminPlatform === 'string'
          ? payload.platformAdminPlatform.trim()
          : '';
      if (platformRaw) {
        if (!ORG_SOCIAL_PROOF_PLATFORMS.includes(platformRaw as OrgSocialProofPlatform)) {
          return {
            ok: false,
            error: 'platformAdminPlatform must be facebook, instagram, or airbnb',
          };
        }
        verification = {
          ...verification,
          platformAdminPlatform: platformRaw as OrgSocialProofPlatform,
        };
      }

      if (!canSubmitEnhancedVerification(verification)) {
        return { ok: false, error: 'Required: selfie with ID' };
      }

      verification = {
        ...verification,
        enhancedStatus: 'pending',
        enhancedSubmittedAt: new Date().toISOString(),
        enhancedRejectionReason: null,
        enhancedRejectionKind: null,
      };
    }

    const { data, error } = await supabase
      .from('organizations')
      .update({
        settings: {
          ...currentSettings,
          verification: orgVerificationToSettingsValue(verification),
        },
      })
      .eq('id', ctx.organizationId)
      .select('*')
      .single();

    if (error || !data) {
      return { ok: false, error: 'Failed to submit verification' };
    }

    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: null,
      data: {
        organization: serializeOrganization(data),
        verification: {
          baseStatus: verification.baseStatus,
          enhancedStatus: verification.enhancedStatus,
          platformAdminPlatform: verification.platformAdminPlatform,
          verifiedBadge: verification.enhancedStatus === 'approved',
        },
        message:
          tier === 'base'
            ? 'Base org verification submitted for review.'
            : 'Enhanced org verification submitted for review.',
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Listing authorization asset apply ───────────────────────────────────────

export async function toolProposeApplyListingAuthorizationAttachment(
  ctx: VerificationToolContext,
  args: Record<string, unknown>
): Promise<VerificationToolResult> {
  try {
    const attachmentPath = str(args, 'attachmentPath');
    const listingKind = parseListingKind(str(args, 'listingKind') ?? '');
    const listingId = str(args, 'listingId');
    const assetTypeRaw = args.assetType;
    if (
      !attachmentPath ||
      !listingKind ||
      !listingId ||
      !isListingAuthorizationAssetType(String(assetTypeRaw ?? ''))
    ) {
      return {
        ok: false,
        error: `attachmentPath, listingKind (property|parking), listingId, and assetType (${LISTING_AUTHORIZATION_ASSET_TYPES.join(' | ')}) are required`,
      };
    }
    const assetType = assetTypeRaw as ListingAuthorizationAssetType;

    const conversationId = requireConversationId(ctx);
    assertAssistantAttachmentPathAllowed(attachmentPath, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      conversationId,
    });

    const ownerContext = await verifyListingOwner(ctx.req, listingKind, listingId);
    if (ownerContext.org.id !== ctx.organizationId) {
      return { ok: false, error: 'Listing is outside this organization' };
    }

    const meta = await loadConversationAttachment(ctx, attachmentPath);
    const label = LISTING_AUTHORIZATION_ASSET_LABELS[assetType];
    const tier = classifyActionRisk({
      toolName: 'propose_apply_listing_authorization_attachment',
      targetBookingId: null,
      targetPropertyId: listingKind === 'property' ? listingId : null,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: ctx.isBulk,
    });

    return {
      ok: true,
      proposed: true,
      riskTier: tier,
      auditPropertyId: listingKind === 'property' ? listingId : null,
      data: {
        summary: `Apply “${meta.fileName}” as ${label} for this ${listingKind}. This replaces any existing file in that slot.`,
        payload: {
          attachmentPath,
          listingKind,
          listingId,
          assetType,
          fileName: meta.fileName,
          mimeType: meta.mimeType,
        },
        details: [
          { label: 'File', value: meta.fileName },
          { label: 'Listing', value: `${listingKind} · ${listingId}` },
          { label: 'Target', value: label },
        ],
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeApplyListingAuthorizationAttachment(
  ctx: VerificationToolContext,
  payload: Record<string, unknown>
): Promise<VerificationToolResult> {
  try {
    const attachmentPath = str(payload, 'attachmentPath');
    const listingKind = parseListingKind(str(payload, 'listingKind') ?? '');
    const listingId = str(payload, 'listingId');
    const assetTypeRaw = payload.assetType;
    if (
      !attachmentPath ||
      !listingKind ||
      !listingId ||
      !isListingAuthorizationAssetType(String(assetTypeRaw ?? ''))
    ) {
      return { ok: false, error: 'Malformed proposal payload' };
    }
    const assetType = assetTypeRaw as ListingAuthorizationAssetType;

    const conversationId = requireConversationId(ctx);
    assertAssistantAttachmentPathAllowed(attachmentPath, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      conversationId,
    });

    const ownerContext = await verifyListingOwner(ctx.req, listingKind, listingId);
    if (ownerContext.org.id !== ctx.organizationId) {
      return { ok: false, error: 'Listing is outside this organization' };
    }

    await assertActionSafeToExecute({
      toolName: 'propose_apply_listing_authorization_attachment',
      targetBookingId: null,
      targetPropertyId: listingKind === 'property' ? listingId : null,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const file = await loadConversationAttachment(ctx, attachmentPath);
    const result = await applyListingAuthorizationAssetFromBytes({
      req: ctx.req,
      listingKind,
      listingId,
      assetType,
      bytes: file.bytes,
      mimeType: file.mimeType,
      fileName: file.fileName,
    });

    if (result.organizationId !== ctx.organizationId) {
      return { ok: false, error: 'Listing is outside this organization' };
    }

    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: listingKind === 'property' ? listingId : null,
      data: {
        path: result.path,
        previewUrl: result.previewUrl,
        assetType: result.assetType,
        label: result.label,
        replacedExisting: result.replacedExisting,
        ...result.serialized,
        message: result.replacedExisting
          ? `${result.label} replaced on listing authorization.`
          : `${result.label} saved to listing authorization.`,
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Listing authorization submit ────────────────────────────────────────────

export async function toolProposeSubmitListingAuthorization(
  ctx: VerificationToolContext,
  args: Record<string, unknown>
): Promise<VerificationToolResult> {
  try {
    const listingKind = parseListingKind(str(args, 'listingKind') ?? '');
    const listingId = str(args, 'listingId');
    const relationshipRaw = str(args, 'relationship') ?? '';
    if (!listingKind || !listingId) {
      return { ok: false, error: 'listingKind (property|parking) and listingId are required' };
    }
    if (!(ORG_VERIFICATION_RIGHTS as readonly string[]).includes(relationshipRaw)) {
      return {
        ok: false,
        error:
          'relationship must be property_owner, authorized_representative, sublessee, or property_admin',
      };
    }
    const relationship = relationshipRaw as OrgVerificationRights;

    const context = await verifyListingOwner(ctx.req, listingKind, listingId);
    if (context.org.id !== ctx.organizationId) {
      return { ok: false, error: 'Listing is outside this organization' };
    }

    let state: ListingAuthorizationState = { ...context.authorization, relationship };
    const today = manilaTodayYmd();
    const isRenew = state.baseStatus === 'approved' && isListingRenewEligible(state, today);

    if (state.baseStatus === 'approved' && !isRenew) {
      return { ok: false, error: 'This listing is already approved' };
    }
    if (context.authorization.baseStatus === 'pending' && !isRenew) {
      return { ok: false, error: 'This listing authorization is already pending review' };
    }
    if (isListingAuthorizationHardRejected(context.authorization)) {
      return { ok: false, error: 'This listing was declined. Please start a new application.' };
    }

    const contractEndDateRaw =
      typeof args.contractEndDate === 'string' ? args.contractEndDate.trim() : '';

    if (listingRightsNeedContractEnd(state)) {
      const endError = validateVerificationContractEndDate(contractEndDateRaw);
      if (endError) return { ok: false, error: endError };

      const previousEnd = context.authorization.contractEndDate;
      if (isRenew && previousEnd && contractEndDateRaw <= previousEnd) {
        return { ok: false, error: 'Renewal contract end must be after the previous end date' };
      }
      state = {
        ...state,
        contractEndDate: contractEndDateRaw,
        ...(isRenew || (previousEnd && previousEnd !== contractEndDateRaw)
          ? { lifecycle: resetLifecycleForNewContractCycle(state.lifecycle) }
          : {}),
      };
    } else {
      state = { ...state, contractEndDate: null };
    }

    if (isRenew) {
      if (!canSubmitListingRenewal(state, today)) {
        return { ok: false, error: 'Renewal requirements not met (rights, contract end, proof)' };
      }
    } else if (!canSubmitBaseListingAuthorization(state)) {
      const missing: string[] = [];
      if (!state.relationship) {
        missing.push(listingKind === 'parking' ? 'parking rights' : 'property rights');
      }
      if (listingRightsNeedContractEnd(state) && !state.contractEndDate) {
        missing.push('contract end date');
      }
      return {
        ok: false,
        error: `Required before submit: ${missing.join(', ') || 'listing rights'}`,
      };
    }

    const actionLabel = isRenew ? 'Renew' : 'Submit';
    const riskTier = classifyActionRisk({
      toolName: 'propose_submit_listing_authorization',
      targetBookingId: null,
      targetPropertyId: listingKind === 'property' ? listingId : null,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: ctx.isBulk,
    });

    return {
      ok: true,
      proposed: true,
      riskTier,
      auditPropertyId: listingKind === 'property' ? listingId : null,
      data: {
        summary: `${actionLabel} ${listingKind} listing authorization for review (${relationship.replace(/_/g, ' ')}).`,
        payload: {
          listingKind,
          listingId,
          relationship,
          contractEndDate: state.contractEndDate,
          isRenew,
        },
        details: [
          { label: 'Listing', value: `${listingKind} · ${listingId}` },
          { label: 'Rights', value: relationship.replace(/_/g, ' ') },
          ...(state.contractEndDate
            ? [{ label: 'Contract end', value: state.contractEndDate }]
            : []),
        ],
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeSubmitListingAuthorization(
  ctx: VerificationToolContext,
  payload: Record<string, unknown>
): Promise<VerificationToolResult> {
  try {
    const listingKind = parseListingKind(str(payload, 'listingKind') ?? '');
    const listingId = str(payload, 'listingId');
    const relationshipRaw = str(payload, 'relationship') ?? '';
    if (!listingKind || !listingId) {
      return { ok: false, error: 'Malformed proposal payload' };
    }
    if (!(ORG_VERIFICATION_RIGHTS as readonly string[]).includes(relationshipRaw)) {
      return { ok: false, error: 'Invalid relationship' };
    }
    const relationship = relationshipRaw as OrgVerificationRights;

    const context = await verifyListingOwner(ctx.req, listingKind, listingId);
    if (context.org.id !== ctx.organizationId) {
      return { ok: false, error: 'Listing is outside this organization' };
    }

    await assertActionSafeToExecute({
      toolName: 'propose_submit_listing_authorization',
      targetBookingId: null,
      targetPropertyId: listingKind === 'property' ? listingId : null,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    let state: ListingAuthorizationState = { ...context.authorization, relationship };
    const today = manilaTodayYmd();
    const isRenew = state.baseStatus === 'approved' && isListingRenewEligible(state, today);

    if (state.baseStatus === 'approved' && !isRenew) {
      return { ok: false, error: 'This listing is already approved' };
    }
    if (context.authorization.baseStatus === 'pending' && !isRenew) {
      return {
        ok: true,
        riskTier: 'tier2_confirmed',
        auditPropertyId: listingKind === 'property' ? listingId : null,
        data: serializeListingAuthorization(context, context.authorization),
      };
    }
    if (isListingAuthorizationHardRejected(context.authorization)) {
      return { ok: false, error: 'This listing was declined. Please start a new application.' };
    }

    const contractEndDateRaw =
      typeof payload.contractEndDate === 'string' ? payload.contractEndDate.trim() : '';

    if (listingRightsNeedContractEnd(state)) {
      const endError = validateVerificationContractEndDate(contractEndDateRaw);
      if (endError) return { ok: false, error: endError };

      const previousEnd = context.authorization.contractEndDate;
      if (isRenew && previousEnd && contractEndDateRaw <= previousEnd) {
        return { ok: false, error: 'Renewal contract end must be after the previous end date' };
      }
      state = {
        ...state,
        contractEndDate: contractEndDateRaw,
        ...(isRenew || (previousEnd && previousEnd !== contractEndDateRaw)
          ? { lifecycle: resetLifecycleForNewContractCycle(state.lifecycle) }
          : {}),
      };
    } else {
      state = { ...state, contractEndDate: null };
    }

    if (isRenew) {
      if (!canSubmitListingRenewal(state, today)) {
        return { ok: false, error: 'Renewal requirements not met' };
      }
    } else if (!canSubmitBaseListingAuthorization(state)) {
      return { ok: false, error: 'Listing authorization requirements not met' };
    }

    state = {
      ...state,
      baseStatus: 'pending',
      baseSubmittedAt: new Date().toISOString(),
      baseRejectionReason: null,
      baseRejectionKind: null,
    };

    const supabase = createServiceClient();
    const listing = await saveListingAuthorization(supabase, context, state);

    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: listingKind === 'property' ? listingId : null,
      data: {
        ...serializeListingAuthorization(context, state, listing),
        message: isRenew
          ? 'Listing authorization renewal submitted for review.'
          : 'Listing authorization submitted for review.',
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── GCash QR staging ────────────────────────────────────────────────────────

export async function toolProposeStageGcashQr(
  ctx: VerificationToolContext,
  args: Record<string, unknown>
): Promise<VerificationToolResult> {
  try {
    const attachmentPath = str(args, 'attachmentPath');
    const scope =
      args.scope === 'parking' ? 'parking' : args.scope === 'property' ? 'property' : null;
    const propertyId = str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? null;
    const parkingId = str(args, 'parkingId');

    if (!attachmentPath || !scope) {
      return { ok: false, error: 'attachmentPath and scope (property|parking) are required' };
    }
    if (scope === 'property' && !propertyId) {
      return { ok: false, error: 'propertyId is required when scope is property' };
    }
    if (scope === 'parking' && !parkingId) {
      return { ok: false, error: 'parkingId is required when scope is parking' };
    }

    const conversationId = requireConversationId(ctx);
    assertAssistantAttachmentPathAllowed(attachmentPath, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      conversationId,
    });

    const scopeId = scope === 'property' ? propertyId! : parkingId!;
    if (scope === 'property') {
      await assertPropertyInOrg(propertyId!, ctx.organizationId);
      await verifyPropertyAccess(ctx.req, propertyId!, 'settings.payment:edit');
    } else {
      await assertParkingInOrgManageable(ctx, parkingId!);
    }

    const meta = await loadConversationAttachment(ctx, attachmentPath);
    const riskTier = classifyActionRisk({
      toolName: 'propose_stage_gcash_qr',
      targetBookingId: null,
      targetPropertyId: scope === 'property' ? propertyId : null,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: ctx.isBulk,
    });

    return {
      ok: true,
      proposed: true,
      riskTier,
      auditPropertyId: scope === 'property' ? propertyId : null,
      data: {
        summary: `Stage “${meta.fileName}” as a ${scope} GCash QR image. This does not save payment settings — you must still open Payment settings and confirm with the email verification code (OTP).`,
        payload: {
          attachmentPath,
          scope,
          propertyId: scope === 'property' ? propertyId : null,
          parkingId: scope === 'parking' ? parkingId : null,
          scopeId,
          fileName: meta.fileName,
          mimeType: meta.mimeType,
        },
        details: [
          { label: 'File', value: meta.fileName },
          { label: 'Scope', value: scope },
          { label: 'OTP required', value: 'Yes — Payment settings' },
        ],
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeStageGcashQr(
  ctx: VerificationToolContext,
  payload: Record<string, unknown>
): Promise<VerificationToolResult> {
  try {
    const attachmentPath = str(payload, 'attachmentPath');
    const scope =
      payload.scope === 'parking' ? 'parking' : payload.scope === 'property' ? 'property' : null;
    const propertyId = str(payload, 'propertyId');
    const parkingId = str(payload, 'parkingId');
    const scopeId = str(payload, 'scopeId');

    if (!attachmentPath || !scope) {
      return { ok: false, error: 'Malformed proposal payload' };
    }
    const resolvedScopeId = scopeId || (scope === 'property' ? propertyId : parkingId) || null;
    if (!resolvedScopeId) {
      return { ok: false, error: 'scopeId is required' };
    }

    const conversationId = requireConversationId(ctx);
    assertAssistantAttachmentPathAllowed(attachmentPath, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      conversationId,
    });

    if (scope === 'property') {
      await assertPropertyInOrg(resolvedScopeId, ctx.organizationId);
      await verifyPropertyAccess(ctx.req, resolvedScopeId, 'settings.payment:edit');
    } else {
      await assertParkingInOrgManageable(ctx, resolvedScopeId);
    }

    await assertActionSafeToExecute({
      toolName: 'propose_stage_gcash_qr',
      targetBookingId: null,
      targetPropertyId: scope === 'property' ? resolvedScopeId : null,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const file = await loadConversationAttachment(ctx, attachmentPath);
    const staged = await stageGcashQrFromBytes({
      scope,
      scopeId: resolvedScopeId,
      bytes: file.bytes,
      mimeType: file.mimeType,
      fileName: file.fileName,
    });

    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: scope === 'property' ? resolvedScopeId : null,
      data: {
        url: staged.url,
        path: staged.path,
        bucket: staged.bucket,
        scope: staged.scope,
        scopeId: staged.scopeId,
        nextStep: staged.nextStep,
        message: staged.nextStep,
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Declarations ────────────────────────────────────────────────────────────

export const APPLY_ORG_VERIFICATION_ATTACHMENT_TOOL_DECLARATION = {
  name: 'propose_apply_org_verification_attachment',
  description:
    'Apply a chat attachment as an org verification proof (valid ID, social proof, selfie, platform admin, legitimacy, business permit). Owner-only. Requires Confirm. Replaces existing file in that slot.',
  parameters: {
    type: 'object',
    properties: {
      attachmentPath: { type: 'string' },
      assetType: {
        type: 'string',
        enum: [...ASSISTANT_ORG_VERIFICATION_ASSET_TYPES],
      },
    },
    required: ['attachmentPath', 'assetType'],
  },
};

export const SUBMIT_ORG_VERIFICATION_TOOL_DECLARATION = {
  name: 'propose_submit_org_verification',
  description:
    'Submit org base (Tier 1) or enhanced (Recommended badge) verification for platform review. Owner-only. Requires proofs uploaded first. Enhanced needs a selfie with ID and recommendedBadgeEligible plan. platformAdminPlatform is optional.',
  parameters: {
    type: 'object',
    properties: {
      tier: { type: 'string', enum: ['base', 'enhanced'] },
      platformAdminPlatform: {
        type: 'string',
        enum: [...ORG_SOCIAL_PROOF_PLATFORMS],
        description: 'Optional leftover platform tag for enhanced tier',
      },
    },
    required: ['tier'],
  },
};

export const APPLY_LISTING_AUTHORIZATION_ATTACHMENT_TOOL_DECLARATION = {
  name: 'propose_apply_listing_authorization_attachment',
  description:
    'Apply a chat attachment as a property or parking listing authorization proof. Owner-only. Requires Confirm. Replaces existing file in that slot.',
  parameters: {
    type: 'object',
    properties: {
      attachmentPath: { type: 'string' },
      listingKind: { type: 'string', enum: ['property', 'parking'] },
      listingId: { type: 'string' },
      assetType: {
        type: 'string',
        enum: [...LISTING_AUTHORIZATION_ASSET_TYPES],
      },
    },
    required: ['attachmentPath', 'listingKind', 'listingId', 'assetType'],
  },
};

export const SUBMIT_LISTING_AUTHORIZATION_TOOL_DECLARATION = {
  name: 'propose_submit_listing_authorization',
  description:
    'Submit or renew a property/parking listing authorization (rights + contract end when required). Owner-only. Requires Confirm.',
  parameters: {
    type: 'object',
    properties: {
      listingKind: { type: 'string', enum: ['property', 'parking'] },
      listingId: { type: 'string' },
      relationship: {
        type: 'string',
        enum: [...ORG_VERIFICATION_RIGHTS],
      },
      contractEndDate: {
        type: 'string',
        description:
          'YYYY-MM-DD — required for sublessee / authorized representative / property_admin',
      },
    },
    required: ['listingKind', 'listingId', 'relationship'],
  },
};

export const STAGE_GCASH_QR_TOOL_DECLARATION = {
  name: 'propose_stage_gcash_qr',
  description:
    'Stage a chat image as a GCash QR for property or parking payment settings. Does NOT commit payment_methods — host must complete OTP verification in Payment settings afterward.',
  parameters: {
    type: 'object',
    properties: {
      attachmentPath: { type: 'string' },
      scope: { type: 'string', enum: ['property', 'parking'] },
      propertyId: { type: 'string', description: 'Required when scope is property' },
      parkingId: { type: 'string', description: 'Required when scope is parking' },
    },
    required: ['attachmentPath', 'scope'],
  },
};
