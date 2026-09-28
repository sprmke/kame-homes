/**
 * Types for copy-property-settings / propertySettingsClone registry.
 * Keep CloneGroupId in sync with ui/.../copyPropertySettingsGroups.ts
 * (Deno test propertySettingsClone_test.ts asserts id parity).
 */

import type { PlanFeatureKey } from './planFeatures.ts';
import type { TeamPermissionId } from './propertyTeamPermissions.ts';

/** Stable group keys used by UI, dry-run, log, and the registry. */
export const CLONE_GROUP_IDS = [
  'propertyDetails',
  'listingContent',
  'amenities',
  'houseRules',
  'cancellationPolicy',
  'guestForm',
  'branding',
  'contact',
  'emailAutomations',
  'pricingRates',
  'smartPricing',
  'voucherConfig',
  'publicPages',
  'templates',
  'telegramNotifications',
  'inboxSnippets',
  'teamRoles',
  'media',
  'buildingForms',
  'marketingTemplates',
  'financeRecurring',
  'maintenanceRecurring',
] as const;

export type CloneGroupId = (typeof CLONE_GROUP_IDS)[number];

export type CloneSkipReason =
  'permission' | 'plan' | 'opt_in' | 'not_implemented' | 'empty' | 'already_customized';

export type CloneGroupSkip = {
  group: CloneGroupId;
  reason: CloneSkipReason;
  detail?: string;
};

export type CloneGroupFailure = {
  group: CloneGroupId;
  error: string;
};

export type CloneTargetResult = {
  targetPropertyId: string;
  applied: CloneGroupId[];
  skipped: CloneGroupSkip[];
  failed: CloneGroupFailure[];
  alreadyCustomized: CloneGroupId[];
};

export type CloneRunResult = {
  dryRun: boolean;
  results: CloneTargetResult[];
  logId?: string;
};

export type CloneOptions = {
  copyContact?: boolean;
  copyEmailRecipients?: boolean;
  copyTelegramCredentials?: boolean;
  /** When true, skip groups where hasNonDefault(target) is true. */
  skipAlreadyCustomized?: boolean;
  /**
   * Actor user id for `updated_by` / `created_by` columns (UUID).
   * Injected by the orchestrator — never accept from the client body.
   */
  actorUserId?: string;
};

/** Opaque per-group payload after read(); shape is group-specific. */
export type GroupPayload = Record<string, unknown>;

export type ClonePropertyCtx = {
  propertyId: string;
  organizationId: string;
};

export type CloneGroup = {
  id: CloneGroupId;
  label: string;
  editLeaves: TeamPermissionId[];
  /** Single plan feature required on the target (skip + report when off). */
  planFeature?: PlanFeatureKey;
  /** Extra plan features that must also be on (all required). */
  planFeatures?: PlanFeatureKey[];
  assets?: boolean;
  defaultOn: boolean;
  read: (sourceCtx: ClonePropertyCtx) => Promise<GroupPayload>;
  sanitize: (
    payload: GroupPayload,
    targetCtx: ClonePropertyCtx,
    options: CloneOptions
  ) => GroupPayload;
  hasNonDefault: (targetCtx: ClonePropertyCtx) => Promise<boolean>;
  write: (
    payload: GroupPayload,
    targetCtx: ClonePropertyCtx,
    options: CloneOptions
  ) => Promise<void>;
};
