/**
 * AI assistant tools — finance + maintenance update/delete parity (Phase 5).
 * Wire from dashboardAssistantTools after Phase 4 lands.
 */

import { classifyActionRisk, type ActionRiskTier } from './dashboardAssistantRiskClassifier.ts';
import { assertAssetRowInScope } from './assetRowScope.ts';
import { assertActionSafeToExecute } from './dashboardAssistantSafetyGuard.ts';
import type { AttachedContextItem } from './dashboardAssistantAttachedContext.ts';
import {
  deleteFinanceLineItem,
  updateFinanceLineItem,
  type FinanceLineItemKind,
} from './financeService.ts';
import { deleteMaintenanceItem, updateMaintenanceItem } from './maintenanceService.ts';
import { resolveOrganizationIdForProperty } from './propertyScope.ts';
import { verifyPropertyAccess } from './orgAuth.ts';

export type FmToolContext = {
  req: Request;
  organizationId: string;
  userId: string;
  userEmail: string;
  pageContext: { propertyId?: string | null; bookingId?: string | null };
  attachedContext: AttachedContextItem[];
  isBulk: boolean;
  conversationId?: string | null;
};

export type FmToolResult = {
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

function num(args: Record<string, unknown>, key: string): number | null {
  const v = args[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function assertPropertyInOrg(propertyId: string, organizationId: string): Promise<void> {
  const orgId = await resolveOrganizationIdForProperty(propertyId);
  if (orgId !== organizationId) throw new Error('Property is outside this organization');
}

/**
 * Finance line items are addressed by a bare id, so every propose/execute re-checks the caller's
 * property permission AND that the id belongs to that property (never trust a model-supplied id).
 */
async function authorizeFinanceLineItem(
  ctx: FmToolContext,
  id: string,
  propertyId: string | null,
  permission: 'finance.transactions:edit' | 'finance.transactions:delete'
): Promise<string> {
  if (!propertyId) throw new Error('propertyId is required');
  await assertPropertyInOrg(propertyId, ctx.organizationId);
  await verifyPropertyAccess(ctx.req, propertyId, permission);
  await assertAssetRowInScope({ table: 'finance_line_items', scope: { propertyId }, id });
  return propertyId;
}

export async function toolProposeUpdateFinanceLineItem(
  ctx: FmToolContext,
  args: Record<string, unknown>
): Promise<FmToolResult> {
  try {
    const id = str(args, 'id');
    if (!id) return { ok: false, error: 'id is required' };
    const propertyId = await authorizeFinanceLineItem(
      ctx,
      id,
      str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? null,
      'finance.transactions:edit'
    );

    const patch: Record<string, unknown> = {};
    const label = str(args, 'label');
    const category = str(args, 'category');
    const amount = num(args, 'amount');
    const occurred_on = str(args, 'occurredOn') ?? str(args, 'occurred_on');
    const notes = str(args, 'notes');
    const kind = str(args, 'kind');
    if (label) patch.label = label;
    if (category) patch.category = category;
    if (amount != null) patch.amount = amount;
    if (occurred_on) patch.occurred_on = occurred_on.slice(0, 10);
    if (notes != null) patch.notes = notes;
    if (kind === 'expense' || kind === 'income') patch.kind = kind as FinanceLineItemKind;
    if (Object.keys(patch).length === 0) {
      return { ok: false, error: 'Provide at least one field to update' };
    }

    const tier = classifyActionRisk({
      toolName: 'propose_update_finance_line_item',
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
        summary: `Update finance line item ${id}.`,
        payload: { id, propertyId, patch },
        details: Object.entries(patch).map(([k, v]) => ({ label: k, value: String(v) })),
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeUpdateFinanceLineItem(
  ctx: FmToolContext,
  payload: Record<string, unknown>
): Promise<FmToolResult> {
  try {
    const id = str(payload, 'id');
    const patch = (payload.patch ?? {}) as Record<string, unknown>;
    if (!id || typeof patch !== 'object') return { ok: false, error: 'Malformed proposal payload' };
    const propertyId = await authorizeFinanceLineItem(
      ctx,
      id,
      str(payload, 'propertyId'),
      'finance.transactions:edit'
    );
    await assertActionSafeToExecute({
      toolName: 'propose_update_finance_line_item',
      targetBookingId: null,
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const row = await updateFinanceLineItem(
      id,
      patch as Parameters<typeof updateFinanceLineItem>[1]
    );
    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: propertyId,
      data: { item: row, message: 'Finance line item updated.' },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toolProposeDeleteFinanceLineItem(
  ctx: FmToolContext,
  args: Record<string, unknown>
): Promise<FmToolResult> {
  try {
    const id = str(args, 'id');
    if (!id) return { ok: false, error: 'id is required' };
    const propertyId = await authorizeFinanceLineItem(
      ctx,
      id,
      str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? null,
      'finance.transactions:delete'
    );

    const tier = classifyActionRisk({
      toolName: 'propose_delete_finance_line_item',
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
        summary: `Delete finance line item ${id}. This cannot be undone.`,
        payload: { id, propertyId },
        details: [{ label: 'Item', value: id }],
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeDeleteFinanceLineItem(
  ctx: FmToolContext,
  payload: Record<string, unknown>
): Promise<FmToolResult> {
  try {
    const id = str(payload, 'id');
    if (!id) return { ok: false, error: 'Malformed proposal payload' };
    const propertyId = await authorizeFinanceLineItem(
      ctx,
      id,
      str(payload, 'propertyId'),
      'finance.transactions:delete'
    );
    await assertActionSafeToExecute({
      toolName: 'propose_delete_finance_line_item',
      targetBookingId: null,
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });
    await deleteFinanceLineItem(id);
    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: propertyId,
      data: { message: 'Finance line item deleted.' },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toolProposeUpdateMaintenanceItem(
  ctx: FmToolContext,
  args: Record<string, unknown>
): Promise<FmToolResult> {
  try {
    const id = str(args, 'id');
    const propertyId = str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? null;
    if (!id || !propertyId) return { ok: false, error: 'id and propertyId are required' };
    await assertPropertyInOrg(propertyId, ctx.organizationId);
    await verifyPropertyAccess(ctx.req, propertyId, 'maintenance.reminders:edit');
    await assertAssetRowInScope({ table: 'maintenance_items', scope: { propertyId }, id });

    const patch: Record<string, unknown> = {};
    const label = str(args, 'label');
    const category = str(args, 'category');
    const scheduled_on = str(args, 'scheduledOn') ?? str(args, 'scheduled_on');
    const notes = str(args, 'notes');
    if (label) patch.label = label;
    if (category) patch.category = category;
    if (scheduled_on) patch.scheduled_on = scheduled_on.slice(0, 10);
    if (notes != null) patch.notes = notes;
    if (Object.keys(patch).length === 0) {
      return {
        ok: false,
        error: 'Provide at least one field to update (label, category, scheduledOn, notes)',
      };
    }

    const tier = classifyActionRisk({
      toolName: 'propose_update_maintenance_item',
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
        summary: `Update maintenance item ${id}.`,
        payload: { id, propertyId, patch },
        details: Object.entries(patch).map(([k, v]) => ({ label: k, value: String(v) })),
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeUpdateMaintenanceItem(
  ctx: FmToolContext,
  payload: Record<string, unknown>
): Promise<FmToolResult> {
  try {
    const id = str(payload, 'id');
    const propertyId = str(payload, 'propertyId');
    const patch = (payload.patch ?? {}) as Record<string, unknown>;
    if (!id || !propertyId) return { ok: false, error: 'Malformed proposal payload' };
    await assertPropertyInOrg(propertyId, ctx.organizationId);
    await verifyPropertyAccess(ctx.req, propertyId, 'maintenance.reminders:edit');
    await assertAssetRowInScope({ table: 'maintenance_items', scope: { propertyId }, id });
    await assertActionSafeToExecute({
      toolName: 'propose_update_maintenance_item',
      targetBookingId: null,
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });
    const row = await updateMaintenanceItem(
      id,
      patch as Parameters<typeof updateMaintenanceItem>[1]
    );
    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: propertyId,
      data: { item: row, message: 'Maintenance item updated.' },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toolProposeDeleteMaintenanceItem(
  ctx: FmToolContext,
  args: Record<string, unknown>
): Promise<FmToolResult> {
  try {
    const id = str(args, 'id');
    const propertyId = str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? null;
    if (!id || !propertyId) return { ok: false, error: 'id and propertyId are required' };
    await assertPropertyInOrg(propertyId, ctx.organizationId);
    await verifyPropertyAccess(ctx.req, propertyId, 'maintenance.reminders:delete');
    await assertAssetRowInScope({ table: 'maintenance_items', scope: { propertyId }, id });

    const tier = classifyActionRisk({
      toolName: 'propose_delete_maintenance_item',
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
        summary: `Delete maintenance item ${id}. This cannot be undone.`,
        payload: { id, propertyId },
        details: [{ label: 'Item', value: id }],
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeDeleteMaintenanceItem(
  ctx: FmToolContext,
  payload: Record<string, unknown>
): Promise<FmToolResult> {
  try {
    const id = str(payload, 'id');
    const propertyId = str(payload, 'propertyId');
    if (!id || !propertyId) return { ok: false, error: 'Malformed proposal payload' };
    await assertPropertyInOrg(propertyId, ctx.organizationId);
    await verifyPropertyAccess(ctx.req, propertyId, 'maintenance.reminders:delete');
    await assertAssetRowInScope({ table: 'maintenance_items', scope: { propertyId }, id });
    await assertActionSafeToExecute({
      toolName: 'propose_delete_maintenance_item',
      targetBookingId: null,
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });
    await deleteMaintenanceItem(id);
    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: propertyId,
      data: { message: 'Maintenance item deleted.' },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export const UPDATE_FINANCE_LINE_ITEM_TOOL_DECLARATION = {
  name: 'propose_update_finance_line_item',
  description: 'Update an existing finance expense/income line. Requires Confirm.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      propertyId: { type: 'string' },
      label: { type: 'string' },
      category: { type: 'string' },
      amount: { type: 'number' },
      occurredOn: { type: 'string' },
      notes: { type: 'string' },
      kind: { type: 'string', enum: ['expense', 'income'] },
    },
    required: ['id'],
  },
};

export const DELETE_FINANCE_LINE_ITEM_TOOL_DECLARATION = {
  name: 'propose_delete_finance_line_item',
  description: 'Delete a finance line item permanently. Requires Confirm.',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' }, propertyId: { type: 'string' } },
    required: ['id'],
  },
};

export const UPDATE_MAINTENANCE_ITEM_TOOL_DECLARATION = {
  name: 'propose_update_maintenance_item',
  description: 'Update a maintenance reminder (label, date, notes). Requires Confirm.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      propertyId: { type: 'string' },
      label: { type: 'string' },
      category: { type: 'string' },
      scheduledOn: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['id', 'propertyId'],
  },
};

export const DELETE_MAINTENANCE_ITEM_TOOL_DECLARATION = {
  name: 'propose_delete_maintenance_item',
  description: 'Delete a maintenance reminder permanently. Requires Confirm.',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' }, propertyId: { type: 'string' } },
    required: ['id', 'propertyId'],
  },
};
