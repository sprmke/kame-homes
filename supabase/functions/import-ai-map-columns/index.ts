/**
 * import-ai-map-columns — AI-suggest CSV header → booking field mappings for an import batch.
 * Auth: resolveImportAccess (import:manage / org owner-admin layer). Idempotent re-run from uploaded/mapping/mapped.
 */

import { suggestImportColumnMappings } from '../_shared/importColumnMappingAi.ts';
import { resolveImportAccessWithPlan } from '../_shared/importAccess.ts';
import {
  canImportBatchTransition,
  canRunImportAiColumnMapping,
  isImportBatchStatus,
  type ImportBatchStatus,
} from '../_shared/importBatchStatusMachine.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const SAMPLE_ROW_LIMIT = 5;

type ImportBatchRow = {
  row_index: number;
  raw_data: Record<string, string>;
};

function parseHeaders(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((header) => (typeof header === 'string' ? header.trim() : '')).filter(Boolean);
}

function buildSamplesByHeader(headers: string[], rows: ImportBatchRow[]): Record<string, string[]> {
  const samples: Record<string, string[]> = Object.fromEntries(
    headers.map((header) => [header, [] as string[]])
  );

  for (const row of rows.slice(0, SAMPLE_ROW_LIMIT)) {
    for (const header of headers) {
      const bucket = samples[header];
      if (!bucket || bucket.length >= SAMPLE_ROW_LIMIT) continue;
      const cell = String(row.raw_data?.[header] ?? '').trim();
      if (cell) bucket.push(cell);
    }
  }

  return samples;
}

async function updateBatchStatus(
  supabase: ReturnType<typeof createServiceClient>,
  batchId: string,
  from: ImportBatchStatus,
  to: ImportBatchStatus
): Promise<boolean> {
  if (!canImportBatchTransition(from, to)) {
    throw new Error(`Invalid import batch transition: ${from} → ${to}`);
  }

  const { data, error } = await supabase
    .from('import_batches')
    .update({ status: to, updated_at: new Date().toISOString() })
    .eq('id', batchId)
    .eq('status', from)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

serveAuthenticated('import-ai-map-columns', async (req, user) => {
  requireHttpMethod(req, 'POST');

  const limited = await rateLimitGate(req, {
    scope: 'import-ai-map-columns',
    identity: identityFromRequest(req, user),
    limit: 20,
    windowSec: 3600,
  });
  if (limited) return limited;

  const access = await resolveImportAccessWithPlan(req);
  const body = await readJsonBody(req);
  const batchId = typeof body.batchId === 'string' ? body.batchId.trim() : '';
  if (!batchId) {
    return jsonError(req, 'batchId is required');
  }

  const supabase = createServiceClient();
  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .select('id, organization_id, property_id, status, column_headers')
    .eq('id', batchId)
    .maybeSingle();

  if (batchError) {
    console.error('[import-ai-map-columns] batch load failed:', batchError.message);
    return jsonError(req, 'Failed to load import batch');
  }
  if (!batch) {
    return jsonError(req, 'Import batch not found', 404);
  }
  if (batch.organization_id !== access.orgId || batch.property_id !== access.propertyId) {
    return jsonError(req, 'Import batch not found', 404);
  }

  const status = String(batch.status ?? '');
  if (!isImportBatchStatus(status)) {
    return jsonError(req, 'Import batch has an invalid status');
  }
  if (!canRunImportAiColumnMapping(status)) {
    return jsonError(req, `Cannot map columns while batch status is ${status}`);
  }

  const headers = parseHeaders(batch.column_headers);
  if (!headers.length) {
    return jsonError(req, 'Import batch has no column headers');
  }

  const { data: sampleRows, error: rowsError } = await supabase
    .from('import_batch_rows')
    .select('row_index, raw_data')
    .eq('batch_id', batchId)
    .order('row_index', { ascending: true })
    .limit(SAMPLE_ROW_LIMIT);

  if (rowsError) {
    console.error('[import-ai-map-columns] sample rows failed:', rowsError.message);
    return jsonError(req, 'Failed to load sample rows');
  }

  if (status === 'uploaded') {
    const moved = await updateBatchStatus(supabase, batchId, 'uploaded', 'mapping');
    if (!moved) {
      const { data: refreshed } = await supabase
        .from('import_batches')
        .select('status')
        .eq('id', batchId)
        .maybeSingle();
      const refreshedStatus = String(refreshed?.status ?? '');
      if (refreshedStatus !== 'mapping' && refreshedStatus !== 'mapped') {
        return jsonError(req, 'Import batch status changed — retry mapping');
      }
    }
  }

  const aiResult = await suggestImportColumnMappings({
    organizationId: batch.organization_id as string,
    propertyId: batch.property_id as string,
    headers,
    samplesByHeader: buildSamplesByHeader(headers, (sampleRows ?? []) as ImportBatchRow[]),
    actorUserId: access.user.id,
    actorType: 'staff',
  });

  const columnMapping = {
    version: 1,
    generatedAt: new Date().toISOString(),
    provider: aiResult.provider,
    degraded: aiResult.degraded,
    mappings: aiResult.mappings,
  };

  const { data: persisted, error: updateError } = await supabase
    .from('import_batches')
    .update({
      column_mapping: columnMapping,
      status: 'mapped',
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId)
    .in('status', ['mapping', 'mapped'])
    .select('id')
    .maybeSingle();

  if (updateError) {
    console.error('[import-ai-map-columns] persist failed:', updateError.message);
    return jsonError(req, 'Failed to save column mapping');
  }
  if (!persisted) {
    return jsonError(req, 'Import batch status changed — retry mapping');
  }

  const matchedCount = aiResult.mappings.filter((entry) => entry.status === 'matched').length;
  const reviewCount = aiResult.mappings.filter((entry) => entry.status !== 'matched').length;

  console.log(
    `[import-ai-map-columns] batch ${batchId} — ${matchedCount} matched, ${reviewCount} need review (${aiResult.provider})`
  );

  return jsonSuccess(req, {
    batchId,
    status: 'mapped',
    columnMapping,
    summary: {
      matched: matchedCount,
      needsReview: reviewCount,
      total: aiResult.mappings.length,
    },
    degraded: aiResult.degraded,
    provider: aiResult.provider,
  });
});
