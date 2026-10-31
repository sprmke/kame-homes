/**
 * Phase 2 (assets) + Phase 3 (recurring) clone groups.
 */

import { createServiceClient } from './orgAuth.ts';
import { manilaTodayYmd } from './calendarAvailabilityManila.ts';
import { isRecurrenceInterval, type RecurrenceInterval } from './financeRecurrence.ts';
import type { FinanceLineItemKind } from './financeService.ts';
import { cloneStorageObject, storagePathFromPublicUrl } from './propertyAssetClone.ts';
import {
  PROPERTY_MEDIA_BUCKET,
  normalizePropertyMediaItems,
  propertyMediaStoragePath,
  type PropertyMediaRecord,
} from './propertyMedia.ts';
import { persistPropertyMedia } from './propertyMediaUpload.ts';
import {
  listPropertyTemplateRows,
  upsertPropertyTemplateRow,
  type PropertyTemplateCategory,
} from './propertyTemplates.ts';
import {
  loadAppSettingsColumns,
  loadPropertyRow,
  patchAppSettingsColumns,
} from './propertySettingsCloneHelpers.ts';
import type { CloneGroup } from './propertySettingsCloneTypes.ts';

const BUILDING_FORM_COLUMNS = [
  'gaf_unit_owner',
  'gaf_guests_onsite_contact_person',
  'gaf_owner_contact_number',
  'gaf_unit_owner_signature_url',
] as const;

function extFromPathOrUrl(pathOrUrl: string): string {
  const clean = pathOrUrl.split('?')[0] ?? pathOrUrl;
  const match = clean.match(/(\.[a-zA-Z0-9]{2,5})$/);
  return match?.[1]?.toLowerCase() ?? '.jpg';
}

async function nextFutureAnchor(
  interval: RecurrenceInterval,
  referenceYmd: string
): Promise<string> {
  // Anchor at today or the next occurrence after today (simple: use today).
  void interval;
  void referenceYmd;
  return manilaTodayYmd();
}

export const mediaGroup: CloneGroup = {
  id: 'media',
  label: 'Photos & videos',
  editLeaves: ['settings.media:edit'],
  defaultOn: true,
  assets: true,
  async read(sourceCtx) {
    const row = await loadPropertyRow(sourceCtx.propertyId);
    return {
      media: normalizePropertyMediaItems(row.settings.media),
      _sourcePropertyId: sourceCtx.propertyId,
    };
  },
  sanitize(payload) {
    return payload;
  },
  async hasNonDefault(targetCtx) {
    const row = await loadPropertyRow(targetCtx.propertyId);
    return normalizePropertyMediaItems(row.settings.media).length > 0;
  },
  async write(payload, targetCtx) {
    const sourceItems = normalizePropertyMediaItems(payload.media);
    const cloned: PropertyMediaRecord[] = [];
    for (const item of sourceItems) {
      const sourcePath =
        item.storagePath?.trim() ||
        (item.url ? storagePathFromPublicUrl(item.url, PROPERTY_MEDIA_BUCKET) : null);
      if (!sourcePath) {
        cloned.push({ ...item });
        continue;
      }
      const ext = extFromPathOrUrl(sourcePath);
      const newId = crypto.randomUUID();
      const targetPath = propertyMediaStoragePath(targetCtx.propertyId, newId, ext);
      const result = await cloneStorageObject({
        bucket: PROPERTY_MEDIA_BUCKET,
        sourcePath,
        targetPath,
      });
      if (!result.ok || !result.url) {
        console.warn('[media clone] skip', sourcePath, result.error);
        continue;
      }
      cloned.push({
        ...item,
        id: newId,
        url: result.url,
        storagePath: targetPath,
      });
    }
    await persistPropertyMedia(targetCtx.propertyId, cloned);
  },
};

export const buildingFormsGroup: CloneGroup = {
  id: 'buildingForms',
  label: 'Building forms',
  editLeaves: ['settings.buildingForms:edit'],
  defaultOn: true,
  assets: true,
  async read(sourceCtx) {
    const cols = await loadAppSettingsColumns(sourceCtx.propertyId, [...BUILDING_FORM_COLUMNS]);
    return { ...cols, _sourcePropertyId: sourceCtx.propertyId };
  },
  sanitize(payload) {
    const out = { ...payload };
    delete out.gaf_tower_and_unit_number;
    return out;
  },
  async hasNonDefault(targetCtx) {
    const cols = await loadAppSettingsColumns(targetCtx.propertyId, [...BUILDING_FORM_COLUMNS]);
    return Object.values(cols).some((v) => v != null && String(v).trim() !== '');
  },
  async write(payload, targetCtx) {
    const target = await loadPropertyRow(targetCtx.propertyId);
    const towerUnit = [target.tower, target.unit_number].filter(Boolean).join(' ').trim();
    const patch: Record<string, unknown> = {
      gaf_unit_owner: payload.gaf_unit_owner ?? null,
      gaf_guests_onsite_contact_person: payload.gaf_guests_onsite_contact_person ?? null,
      gaf_owner_contact_number: payload.gaf_owner_contact_number ?? null,
      gaf_tower_and_unit_number: towerUnit || null,
    };

    const sigUrl =
      typeof payload.gaf_unit_owner_signature_url === 'string'
        ? payload.gaf_unit_owner_signature_url.trim()
        : '';
    if (sigUrl) {
      const sourcePath =
        storagePathFromPublicUrl(sigUrl, 'app-settings-assets') ??
        (sigUrl.startsWith('gaf-unit-owner-signature/') ? sigUrl : null);
      if (sourcePath) {
        const ext = extFromPathOrUrl(sourcePath);
        const targetPath = `gaf-unit-owner-signature/${targetCtx.propertyId}/current${ext}`;
        const result = await cloneStorageObject({
          bucket: 'app-settings-assets',
          sourcePath,
          targetPath,
        });
        if (result.ok && result.url) {
          patch.gaf_unit_owner_signature_url = result.url;
        }
      }
    }

    await patchAppSettingsColumns(targetCtx.propertyId, patch);
  },
};

/** Upgrade templates write to clone section images when present. */
export const templatesWithAssetsGroup: CloneGroup = {
  id: 'templates',
  label: 'Templates',
  editLeaves: ['templates.standard:edit', 'templates.email:edit'],
  defaultOn: true,
  assets: true,
  async read(sourceCtx) {
    const rows = await listPropertyTemplateRows(sourceCtx.propertyId);
    return {
      rows: rows.map((r) => ({
        template_key: r.template_key,
        category: r.category,
        name: r.name,
        content: r.content,
        section_image_url: r.section_image_url,
      })),
    };
  },
  sanitize(payload) {
    return payload;
  },
  async hasNonDefault(targetCtx) {
    const rows = await listPropertyTemplateRows(targetCtx.propertyId);
    return rows.length > 0;
  },
  async write(payload, targetCtx) {
    const rows = Array.isArray(payload.rows)
      ? (payload.rows as Array<{
          template_key: string;
          category: PropertyTemplateCategory;
          name: string | null;
          content: string;
          section_image_url: string | null;
        }>)
      : [];
    for (const row of rows) {
      let sectionImageUrl: string | null = null;
      const src = row.section_image_url?.trim();
      if (src) {
        const sourcePath = storagePathFromPublicUrl(src, 'app-settings-assets');
        if (sourcePath) {
          const ext = extFromPathOrUrl(sourcePath);
          const targetPath = `property-templates/${targetCtx.propertyId}/${row.template_key}/section${ext}`;
          const result = await cloneStorageObject({
            bucket: 'app-settings-assets',
            sourcePath,
            targetPath,
          });
          if (result.ok && result.url) sectionImageUrl = result.url;
        }
      }
      await upsertPropertyTemplateRow({
        propertyId: targetCtx.propertyId,
        templateKey: String(row.template_key),
        category: row.category,
        name: row.name,
        content: String(row.content ?? ''),
        sectionImageUrl,
      });
    }
  },
};

export const marketingTemplatesGroup: CloneGroup = {
  id: 'marketingTemplates',
  label: 'Marketing designs',
  editLeaves: ['marketing.templates:add'],
  planFeature: 'marketingStudio',
  planFeatures: ['customTemplates'],
  defaultOn: true,
  assets: true,
  async read(sourceCtx) {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('marketing_templates')
      .select('name, content_type, platform, aspect_preset, design_json')
      .eq('property_id', sourceCtx.propertyId);
    if (error) throw new Error(error.message);
    return { rows: data ?? [], _sourcePropertyId: sourceCtx.propertyId };
  },
  sanitize(payload) {
    return payload;
  },
  async hasNonDefault(targetCtx) {
    const supabase = createServiceClient();
    const { count } = await supabase
      .from('marketing_templates')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', targetCtx.propertyId);
    return (count ?? 0) > 0;
  },
  async write(payload, targetCtx) {
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const supabase = createServiceClient();
    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const { error } = await supabase.from('marketing_templates').insert({
        property_id: targetCtx.propertyId,
        organization_id: targetCtx.organizationId,
        name: r.name ?? 'Copied template',
        content_type: r.content_type,
        platform: r.platform ?? null,
        aspect_preset: r.aspect_preset ?? null,
        design_json: r.design_json ?? {},
      });
      if (error) throw new Error(error.message);
    }
  },
};

type SeriesCanon = {
  label: string;
  amount?: number;
  kind?: FinanceLineItemKind;
  category: string | null;
  interval: RecurrenceInterval;
  notes: string | null;
};

export const financeRecurringGroup: CloneGroup = {
  id: 'financeRecurring',
  label: 'Recurring finance',
  editLeaves: ['finance.transactions:add'],
  defaultOn: false,
  async read(sourceCtx) {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('finance_line_items')
      .select(
        'label, amount, kind, category, notes, recurrence_interval, recurrence_series_id, occurred_on'
      )
      .eq('property_id', sourceCtx.propertyId)
      .not('recurrence_series_id', 'is', null)
      .order('occurred_on', { ascending: false });
    if (error) throw new Error(error.message);

    const bySeries = new Map<string, SeriesCanon>();
    for (const row of data ?? []) {
      const seriesId = String(row.recurrence_series_id ?? '');
      const interval = row.recurrence_interval;
      if (!seriesId || !isRecurrenceInterval(interval)) continue;
      if (bySeries.has(seriesId)) continue;
      bySeries.set(seriesId, {
        label: String(row.label ?? ''),
        amount: Number(row.amount),
        kind: row.kind as FinanceLineItemKind,
        category: (row.category as string | null) ?? null,
        interval,
        notes: (row.notes as string | null) ?? null,
      });
    }
    return { series: [...bySeries.values()] };
  },
  sanitize(payload) {
    return payload;
  },
  async hasNonDefault(targetCtx) {
    const supabase = createServiceClient();
    const { count } = await supabase
      .from('finance_line_items')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', targetCtx.propertyId)
      .not('recurrence_series_id', 'is', null);
    return (count ?? 0) > 0;
  },
  async write(payload, targetCtx, options) {
    const actorUserId = options.actorUserId;
    if (!actorUserId) throw new Error('Missing actor for finance recurring copy');
    const series = Array.isArray(payload.series) ? (payload.series as SeriesCanon[]) : [];
    const supabase = createServiceClient();
    const { data: existing } = await supabase
      .from('finance_line_items')
      .select('label, amount, recurrence_interval')
      .eq('property_id', targetCtx.propertyId)
      .not('recurrence_series_id', 'is', null);
    const dedupe = new Set(
      (existing ?? []).map(
        (r) =>
          `${String(r.label).trim().toLowerCase()}|${Number(r.amount)}|${r.recurrence_interval}`
      )
    );

    for (const item of series) {
      if (!item.label || !isRecurrenceInterval(item.interval)) continue;
      const key = `${item.label.trim().toLowerCase()}|${Number(item.amount)}|${item.interval}`;
      if (dedupe.has(key)) continue;
      const anchor = await nextFutureAnchor(item.interval, manilaTodayYmd());
      const { createFinanceLineItem } = await import('./financeService.ts');
      await createFinanceLineItem(
        {
          propertyId: targetCtx.propertyId,
          kind: item.kind ?? 'expense',
          label: item.label,
          amount: Number(item.amount) || 0,
          category: item.category,
          occurred_on: anchor,
          notes: item.notes,
          recurrence_interval: item.interval,
        },
        actorUserId
      );
      dedupe.add(key);
    }
  },
};

export const maintenanceRecurringGroup: CloneGroup = {
  id: 'maintenanceRecurring',
  label: 'Recurring maintenance',
  editLeaves: ['maintenance.reminders:add'],
  defaultOn: false,
  async read(sourceCtx) {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('maintenance_items')
      .select('label, category, notes, recurrence_interval, recurrence_series_id, scheduled_on')
      .eq('property_id', sourceCtx.propertyId)
      .not('recurrence_series_id', 'is', null)
      .order('scheduled_on', { ascending: false });
    if (error) throw new Error(error.message);

    const bySeries = new Map<
      string,
      { label: string; category: string | null; notes: string | null; interval: RecurrenceInterval }
    >();
    for (const row of data ?? []) {
      const seriesId = String(row.recurrence_series_id ?? '');
      const interval = row.recurrence_interval;
      if (!seriesId || !isRecurrenceInterval(interval)) continue;
      if (bySeries.has(seriesId)) continue;
      bySeries.set(seriesId, {
        label: String(row.label ?? ''),
        category: (row.category as string | null) ?? null,
        notes: (row.notes as string | null) ?? null,
        interval,
      });
    }
    return { series: [...bySeries.values()] };
  },
  sanitize(payload) {
    return payload;
  },
  async hasNonDefault(targetCtx) {
    const supabase = createServiceClient();
    const { count } = await supabase
      .from('maintenance_items')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', targetCtx.propertyId)
      .not('recurrence_series_id', 'is', null);
    return (count ?? 0) > 0;
  },
  async write(payload, targetCtx, options) {
    const actorUserId = options.actorUserId;
    if (!actorUserId) throw new Error('Missing actor for maintenance recurring copy');
    const series = Array.isArray(payload.series)
      ? (payload.series as Array<{
          label: string;
          category: string | null;
          notes: string | null;
          interval: RecurrenceInterval;
        }>)
      : [];
    const supabase = createServiceClient();
    const { data: existing } = await supabase
      .from('maintenance_items')
      .select('label, recurrence_interval')
      .eq('property_id', targetCtx.propertyId)
      .not('recurrence_series_id', 'is', null);
    const dedupe = new Set(
      (existing ?? []).map(
        (r) => `${String(r.label).trim().toLowerCase()}|${r.recurrence_interval}`
      )
    );

    for (const item of series) {
      if (!item.label || !isRecurrenceInterval(item.interval)) continue;
      const key = `${item.label.trim().toLowerCase()}|${item.interval}`;
      if (dedupe.has(key)) continue;
      const anchor = await nextFutureAnchor(item.interval, manilaTodayYmd());
      const { createMaintenanceItem } = await import('./maintenanceService.ts');
      await createMaintenanceItem(
        {
          propertyId: targetCtx.propertyId,
          label: item.label,
          category: item.category,
          scheduled_on: anchor,
          notes: item.notes,
          recurrence_interval: item.interval,
        },
        actorUserId
      );
      dedupe.add(key);
    }
  },
};

export const PHASE2_CLONE_GROUPS: CloneGroup[] = [
  mediaGroup,
  buildingFormsGroup,
  marketingTemplatesGroup,
];

export const PHASE3_CLONE_GROUPS: CloneGroup[] = [financeRecurringGroup, maintenanceRecurringGroup];
