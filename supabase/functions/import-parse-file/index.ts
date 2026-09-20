/**
 * import-parse-file — Upload CSV/Excel, store privately, parse rows into import_batches staging.
 * Auth: resolveImportAccess (import:manage / org owner-admin layer).
 */

import { resolveImportAccess } from '../_shared/importAccess.ts';
import { parseImportFile } from '../_shared/importFileParse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  IMPORT_MAX_FILE_BYTES,
  IMPORT_MAX_ROW_COUNT,
  IMPORT_ROW_INSERT_CHUNK_SIZE,
  IMPORT_UPLOAD_BUCKET,
  contentTypeForImportKind,
  importStoragePath,
  isAllowedImportFile,
} from '../_shared/importUploadLimits.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

function sampleRows(rows: Record<string, string>[], limit = 5): Record<string, string>[] {
  return rows.slice(0, limit);
}

type ImportBatchRowRecord = {
  batch_id: string;
  row_index: number;
  raw_data: Record<string, string>;
};

function chunkRecords<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function insertImportBatchRowsInChunks(
  supabase: ReturnType<typeof createServiceClient>,
  rowRecords: ImportBatchRowRecord[]
): Promise<string | null> {
  for (const chunk of chunkRecords(rowRecords, IMPORT_ROW_INSERT_CHUNK_SIZE)) {
    const { error } = await supabase.from('import_batch_rows').insert(chunk);
    if (error) return error.message;
  }
  return null;
}

serveAuthenticated('import-parse-file', async (req) => {
  requireHttpMethod(req, 'POST');

  const access = await resolveImportAccess(req);
  const supabase = createServiceClient();

  const formData = await req.formData();
  const file = formData.get('file');
  const fileNameRaw = formData.get('fileName');
  const fileName =
    (typeof fileNameRaw === 'string' && fileNameRaw.trim()) ||
    (file instanceof File ? file.name : '');

  if (!(file instanceof File)) {
    return jsonError(req, 'file is required');
  }
  if (!fileName) {
    return jsonError(req, 'fileName is required');
  }
  if (!isAllowedImportFile(file, fileName)) {
    return jsonError(req, 'File must be a CSV (.csv) or Excel (.xlsx, .xls)');
  }
  if (file.size > IMPORT_MAX_FILE_BYTES) {
    return jsonError(req, 'File must be 15 MB or smaller');
  }

  let parsedKind: 'csv' | 'xlsx' | 'xls';
  let parsed;
  try {
    const result = await parseImportFile(file, fileName);
    parsedKind = result.kind;
    parsed = result.table;
  } catch (error) {
    return jsonError(req, (error as Error).message);
  }

  if (parsed.rows.length === 0) {
    return jsonError(req, 'File must include at least one data row');
  }
  if (parsed.rows.length > IMPORT_MAX_ROW_COUNT) {
    return jsonError(req, `File exceeds the ${IMPORT_MAX_ROW_COUNT.toLocaleString()} row limit`);
  }

  const batchId = crypto.randomUUID();
  const storagePath = importStoragePath(access.orgId, batchId, fileName);

  const { error: uploadError } = await supabase.storage
    .from(IMPORT_UPLOAD_BUCKET)
    .upload(storagePath, file, {
      upsert: false,
      contentType: contentTypeForImportKind(parsedKind),
      cacheControl: '31536000',
    });

  if (uploadError) {
    console.error('[import-parse-file] storage upload failed:', uploadError.message);
    return jsonError(req, `Upload failed: ${uploadError.message}`);
  }

  const { error: batchError } = await supabase.from('import_batches').insert({
    id: batchId,
    organization_id: access.orgId,
    property_id: access.propertyId,
    created_by: access.user.email,
    status: 'uploaded',
    original_file_name: fileName,
    storage_path: storagePath,
    column_headers: parsed.headers,
    row_count: parsed.rows.length,
  });

  if (batchError) {
    console.error('[import-parse-file] batch insert failed:', batchError.message);
    await supabase.storage.from(IMPORT_UPLOAD_BUCKET).remove([storagePath]);
    return jsonError(req, 'Failed to create import batch');
  }

  const rowRecords = parsed.rows.map((rawData, index) => ({
    batch_id: batchId,
    row_index: index,
    raw_data: rawData,
  }));

  const rowsError = await insertImportBatchRowsInChunks(supabase, rowRecords);

  if (rowsError) {
    console.error('[import-parse-file] row insert failed:', rowsError);
    await supabase.from('import_batches').delete().eq('id', batchId);
    await supabase.storage.from(IMPORT_UPLOAD_BUCKET).remove([storagePath]);
    return jsonError(req, 'Failed to store parsed rows');
  }

  console.log(
    `[import-parse-file] batch ${batchId} — ${parsed.rows.length} rows (${parsedKind}) for property ${access.propertyId}`
  );

  return jsonSuccess(req, {
    batchId,
    fileName,
    headers: parsed.headers,
    sampleRows: sampleRows(parsed.rows),
    rowCount: parsed.rows.length,
  });
});
