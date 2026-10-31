/**
 * maintenance-items — Admin CRUD for property maintenance reminders.
 */

import {
  createMaintenanceItem,
  deleteMaintenanceItem,
  extendRecurringSeries,
  listMaintenanceItems,
  listRecurringSeriesItems,
  updateMaintenanceItem,
} from '../_shared/maintenanceService.ts';
import { isRecurrenceEditScope, isRecurrenceInterval } from '../_shared/financeRecurrence.ts';
import { parseMaintenanceTelegramReminderInput } from '../_shared/telegramMaintenance.ts';
import { jsonError, jsonResponse, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';
import { assertAssetRowInScope } from '../_shared/assetRowScope.ts';

serveAuthenticated('maintenance-items', async (req, user) => {
  const permission =
    req.method === 'GET'
      ? ('maintenance:view' as const)
      : req.method === 'POST'
        ? ('maintenance.reminders:add' as const)
        : req.method === 'PATCH'
          ? ('maintenance.reminders:edit' as const)
          : req.method === 'DELETE'
            ? ('maintenance.reminders:delete' as const)
            : ('maintenance:view' as const);
  const access = await resolveScopedPropertyAccess(req, permission);
  const { property } = access;
  const propertyId = property.id;
  const email = user.email;
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const seriesId = url.searchParams.get('recurrence_series_id');
    if (seriesId) {
      await assertAssetRowInScope({ table: 'maintenance_items', scope: { propertyId }, recurrenceSeriesId: seriesId });
      const items = await listRecurringSeriesItems(seriesId);
      return jsonSuccess(req, items);
    }
    const items = await listMaintenanceItems({
      propertyId,
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
      await assertAssetRowInScope({ table: 'maintenance_items', scope: { propertyId }, recurrenceSeriesId: seriesId });
      const result = await extendRecurringSeries(seriesId, direction, extend_until, email);
      return jsonSuccess(req, result.rows, {
        created_count: result.created_count,
      });
    }

    const label = typeof body.label === 'string' ? body.label.trim() : '';
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const scheduled_on =
      typeof body.scheduled_on === 'string' ? body.scheduled_on.slice(0, 10) : '';
    if (!label || !category || !/^\d{4}-\d{2}-\d{2}$/.test(scheduled_on)) {
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

    const result = await createMaintenanceItem(
      {
        propertyId,
        label,
        category,
        scheduled_on,
        notes: typeof body.notes === 'string' ? body.notes : null,
        recurrence_interval,
        recurrence_until,
        telegramReminder: parseMaintenanceTelegramReminderInput(body),
      },
      email
    );
    await logAssetActivity({
      req,
      user,
      action: 'maintenance.task_created',
      propertyId,
      organizationId: access.org.id,
      accessKind: access.accessKind,
      memberId: access.memberId,
      targetId: (result.row as { id?: string })?.id ?? null,
      targetLabel: label,
      metadata: {
        category,
        scheduled_on,
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
    const scope = isRecurrenceEditScope(body.scope) ? body.scope : 'this';
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    if (!label || !category) {
      return jsonError(req, 'Invalid fields');
    }
    const patch: Parameters<typeof updateMaintenanceItem>[1] = {
      label,
      category,
    };
    if (typeof body.scheduled_on === 'string') {
      patch.scheduled_on = body.scheduled_on.slice(0, 10);
    }
    if (body.notes !== undefined) {
      patch.notes = typeof body.notes === 'string' ? body.notes : null;
    }
    patch.telegramReminder = parseMaintenanceTelegramReminderInput(body);
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
    await assertAssetRowInScope({ table: 'maintenance_items', scope: { propertyId }, id });
    const result = await updateMaintenanceItem(id, patch, scope);
    await logAssetActivity({
      req,
      user,
      action: 'maintenance.task_updated',
      propertyId,
      organizationId: access.org.id,
      accessKind: access.accessKind,
      memberId: access.memberId,
      targetId: id,
      targetLabel: label,
      metadata: { category, edit_scope: scope, updated_count: result.updated_count },
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
    const scope = isRecurrenceEditScope(scopeParam) ? scopeParam : 'this';
    await assertAssetRowInScope({ table: 'maintenance_items', scope: { propertyId }, id });
    const result = await deleteMaintenanceItem(id, scope);
    await logAssetActivity({
      req,
      user,
      action: 'maintenance.task_deleted',
      propertyId,
      organizationId: access.org.id,
      accessKind: access.accessKind,
      memberId: access.memberId,
      targetId: id,
      metadata: { delete_scope: scope, deleted_count: result.deleted_count },
    });
    return jsonResponse(req, {
      success: true,
      deleted_count: result.deleted_count,
    });
  }

  return jsonError(req, 'Method not allowed', 405);
});
