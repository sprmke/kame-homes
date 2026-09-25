/**
 * finance-line-items — Admin CRUD for property-wide or parking-scoped operating expenses/income.
 */

import {
  createFinanceLineItem,
  deleteFinanceLineItem,
  extendRecurringSeries,
  listOperatingLineItems,
  listRecurringSeriesItems,
  updateFinanceLineItem,
  type FinanceLineItemKind,
} from '../_shared/financeService.ts';
import { financeDbScope, resolveFinanceAssetAccess } from '../_shared/financeAssetScope.ts';
import { isRecurrenceEditScope, isRecurrenceInterval } from '../_shared/financeRecurrence.ts';
import { parseFinanceTelegramReminderInput } from '../_shared/telegramFinance.ts';
import { jsonError, jsonResponse, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';
import { assertAssetRowInScope } from '../_shared/assetRowScope.ts';

function isKind(v: unknown): v is FinanceLineItemKind {
  return v === 'expense' || v === 'income';
}

serveAuthenticated('finance-line-items', async (req, user) => {
  const url = new URL(req.url);
  const parkingId = url.searchParams.get('parking_id');
  const permission = (() => {
    if (req.method === 'GET') return 'finance:view' as const;
    // Parking team RBAC stays on coarse finance:edit until Phase 9.
    if (parkingId) return 'finance:edit' as const;
    if (req.method === 'POST') return 'finance.transactions:add' as const;
    if (req.method === 'PATCH') return 'finance.transactions:edit' as const;
    if (req.method === 'DELETE') return 'finance.transactions:delete' as const;
    return 'finance:view' as const;
  })();
  const asset = await resolveFinanceAssetAccess(req, permission);
  const scope = financeDbScope(asset);
  const email = user.email;
  const activityScope = {
    propertyId: asset.kind === 'property' ? asset.id : null,
    parkingId: asset.kind === 'parking' ? asset.id : null,
    organizationId: asset.orgId,
    accessKind: asset.accessKind,
    memberId: asset.memberId,
  };

  if (req.method === 'GET') {
    const seriesId = url.searchParams.get('recurrence_series_id');
    if (seriesId) {
      await assertAssetRowInScope({ table: 'finance_line_items', scope: scope, recurrenceSeriesId: seriesId });
      const items = await listRecurringSeriesItems(seriesId);
      return jsonSuccess(req, items);
    }
    const items = await listOperatingLineItems({
      ...scope,
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
      q: url.searchParams.get('q') ?? undefined,
      includeDueInRange: url.searchParams.get('include_due_in_range') === 'true',
    });
    return jsonSuccess(req, items);
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);

    if (body.action === 'extend_series') {
      const seriesId =
        typeof body.recurrence_series_id === 'string' ? body.recurrence_series_id : '';
      const direction = body.direction === 'before' ? 'before' : 'after';
      const extend_until =
        typeof body.extend_until === 'string' ? body.extend_until.slice(0, 10) : '';
      if (!seriesId || !/^\d{4}-\d{2}-\d{2}$/.test(extend_until)) {
        return jsonError(req, 'Invalid fields');
      }
      await assertAssetRowInScope({ table: 'finance_line_items', scope: scope, recurrenceSeriesId: seriesId });
      const result = await extendRecurringSeries(seriesId, direction, extend_until, email);
      return jsonSuccess(req, result.rows, {
        created_count: result.created_count,
      });
    }

    if (!isKind(body.kind)) {
      return jsonError(req, 'Invalid kind');
    }
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const amount = Number(body.amount);
    const occurred_on = typeof body.occurred_on === 'string' ? body.occurred_on.slice(0, 10) : '';
    if (
      !label ||
      !category ||
      Number.isNaN(amount) ||
      amount <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(occurred_on)
    ) {
      return jsonError(req, 'Invalid fields');
    }

    const recurrence_interval =
      body.recurrence_interval === null || body.recurrence_interval === 'none'
        ? null
        : isRecurrenceInterval(body.recurrence_interval)
          ? body.recurrence_interval
          : null;
    const recurrence_until =
      typeof body.recurrence_until === 'string' && body.recurrence_until
        ? body.recurrence_until.slice(0, 10)
        : null;

    if (body.recurrence_interval && body.recurrence_interval !== 'none' && !recurrence_interval) {
      return jsonError(req, 'Invalid recurrence interval');
    }

    const result = await createFinanceLineItem(
      {
        ...scope,
        kind: body.kind,
        label,
        amount,
        category,
        occurred_on,
        notes: typeof body.notes === 'string' ? body.notes : null,
        recurrence_interval,
        recurrence_until,
        telegramReminder: parseFinanceTelegramReminderInput(body),
      },
      email
    );
    await logAssetActivity({
      req,
      user,
      action: 'finance.entry_created',
      ...activityScope,
      targetId: (result.row as { id?: string })?.id ?? null,
      targetLabel: label,
      metadata: {
        kind: body.kind,
        category,
        amount,
        occurred_on,
        recurring: Boolean(recurrence_interval),
        created_count: result.created_count,
      },
    });
    return jsonSuccess(req, result.row, {
      created_count: result.created_count,
    });
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) {
      return jsonError(req, 'Missing id');
    }
    const scopeParam = isRecurrenceEditScope(body.scope) ? body.scope : 'this';
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const amount = Number(body.amount);
    if (!label || !category || Number.isNaN(amount) || amount <= 0) {
      return jsonError(req, 'Invalid fields');
    }
    const patch: Parameters<typeof updateFinanceLineItem>[1] = {};
    if (body.kind !== undefined && isKind(body.kind)) patch.kind = body.kind;
    patch.label = label;
    patch.amount = amount;
    patch.category = category;
    if (typeof body.occurred_on === 'string') patch.occurred_on = body.occurred_on.slice(0, 10);
    if (body.notes !== undefined) {
      patch.notes = typeof body.notes === 'string' ? body.notes : null;
    }
    patch.telegramReminder = parseFinanceTelegramReminderInput(body);
    const recurrence_interval =
      body.recurrence_interval === null || body.recurrence_interval === 'none'
        ? undefined
        : isRecurrenceInterval(body.recurrence_interval)
          ? body.recurrence_interval
          : undefined;
    if (body.recurrence_interval && body.recurrence_interval !== 'none' && !recurrence_interval) {
      return jsonError(req, 'Invalid recurrence interval');
    }
    if (recurrence_interval) patch.recurrence_interval = recurrence_interval;
    if (typeof body.recurrence_until === 'string' && body.recurrence_until) {
      patch.recurrence_until = body.recurrence_until.slice(0, 10);
    }
    await assertAssetRowInScope({ table: 'finance_line_items', scope: scope, id });
    const result = await updateFinanceLineItem(id, patch, scopeParam);
    await logAssetActivity({
      req,
      user,
      action: 'finance.entry_updated',
      ...activityScope,
      targetId: id,
      targetLabel: label,
      metadata: { category, amount, edit_scope: scopeParam, updated_count: result.updated_count },
    });
    return jsonSuccess(req, result.row, {
      updated_count: result.updated_count,
    });
  }

  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) {
      return jsonError(req, 'Missing id');
    }
    const scopeParam = url.searchParams.get('scope');
    const deleteScope = isRecurrenceEditScope(scopeParam) ? scopeParam : 'this';
    await assertAssetRowInScope({ table: 'finance_line_items', scope: scope, id });
    const result = await deleteFinanceLineItem(id, deleteScope);
    await logAssetActivity({
      req,
      user,
      action: 'finance.entry_deleted',
      ...activityScope,
      targetId: id,
      metadata: { delete_scope: deleteScope, deleted_count: result.deleted_count },
    });
    return jsonResponse(req, {
      success: true,
      deleted_count: result.deleted_count,
    });
  }

  return jsonError(req, 'Method not allowed', 405);
});
