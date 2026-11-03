/**
 * Server-side ingest into the Marketing media library, for endpoints that already receive the
 * bytes (`upload-marketing-asset`, `marketing-music`). Same quota rules as the direct-upload path
 * in `marketing-media`: advisory-locked reserve RPC, magic-byte check, content-hash dedupe.
 */

import type { SupabaseClient } from './supabaseJs.ts';

import {
  assertUploadMatchesBytes,
  extensionForMarketingMime,
  isMarketingMediaLimitCode,
  MARKETING_MEDIA_BUCKET,
  MARKETING_MEDIA_CACHE_CONTROL,
  type MarketingMediaKind,
  type MarketingMediaLimitCode,
  limitMessage,
  marketingMediaOriginalPath,
  removeMarketingMediaObjects,
  reserveLimitsFor,
} from './marketingMediaStorage.ts';
import type { PlanMarketingMediaLibrary } from './planFeatures.ts';

/** Thrown when the plan allowance blocks an upload. Handlers map it to a 403 upgrade response. */
export class MarketingMediaLimitError extends Error {
  readonly code: MarketingMediaLimitCode;
  constructor(code: MarketingMediaLimitCode, lib: PlanMarketingMediaLibrary) {
    super(limitMessage(code, lib));
    this.name = 'MarketingMediaLimitError';
    this.code = code;
  }
}

export type IngestInput = {
  orgId: string;
  propertyId: string;
  userId: string | null;
  kind: MarketingMediaKind;
  bytes: Uint8Array;
  declaredMime: string;
  fileName: string;
  source: 'upload' | 'music_upload';
  lib: PlanMarketingMediaLibrary;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
};

export type IngestedAsset = {
  id: string;
  url: string;
  storagePath: string;
  bucket: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  deduped: boolean;
};

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

type ReadyRow = {
  id: string;
  bucket: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number | null;
  reserved_bytes: number;
  width: number | null;
  height: number | null;
};

function toIngested(sb: SupabaseClient, row: ReadyRow, deduped: boolean): IngestedAsset {
  return {
    id: row.id,
    url: sb.storage.from(row.bucket).getPublicUrl(row.storage_path).data.publicUrl,
    storagePath: row.storage_path,
    bucket: row.bucket,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes ?? row.reserved_bytes,
    width: row.width,
    height: row.height,
    deduped,
  };
}

const READY_COLUMNS =
  'id, bucket, storage_path, mime_type, size_bytes, reserved_bytes, width, height';

async function findReadyByHash(
  sb: SupabaseClient,
  propertyId: string,
  hash: string
): Promise<ReadyRow | null> {
  const { data } = await sb
    .from('marketing_media_assets')
    .select(READY_COLUMNS)
    .eq('property_id', propertyId)
    .eq('content_hash', hash)
    .eq('status', 'ready')
    .maybeSingle();
  return (data as ReadyRow | null) ?? null;
}

/**
 * Throws `MarketingMediaLimitError` when over quota and a plain `Error` (host-readable message)
 * when the bytes are not an allowed file. Never leaves a `pending` row or an object behind.
 */
export async function ingestMarketingMediaBytes(
  sb: SupabaseClient,
  input: IngestInput
): Promise<IngestedAsset> {
  if (input.bytes.byteLength === 0) throw new Error('File is empty');
  const { mime } = assertUploadMatchesBytes(input.bytes, input.kind, input.declaredMime);
  const hash = await sha256Hex(input.bytes);

  const existing = await findReadyByHash(sb, input.propertyId, hash);
  if (existing) return toIngested(sb, existing, true);

  const assetId = crypto.randomUUID();
  const path = marketingMediaOriginalPath(
    input.propertyId,
    assetId,
    extensionForMarketingMime(mime)
  );

  const { data, error } = await sb.rpc('reserve_marketing_media_upload', {
    p_org_id: input.orgId,
    p_property_id: input.propertyId,
    p_kind: input.kind,
    p_bytes: input.bytes.byteLength,
    p_duration_ms: input.durationMs ?? null,
    p_hash: hash,
    p_limits: reserveLimitsFor(input.kind, input.lib),
    p_storage_path: path,
    p_poster_path: null,
    p_mime_type: mime,
    p_file_name: input.fileName.replace(/[\r\n]/g, ' ').slice(0, 200),
    p_source: input.source,
    p_created_by: input.userId,
    p_asset_id: assetId,
  });
  if (error) throw new Error('Could not reserve upload');
  const result = (Array.isArray(data) ? data[0] : data) as { error_code: string | null } | null;
  if (!result || result.error_code) {
    const code = result?.error_code;
    throw new MarketingMediaLimitError(
      isMarketingMediaLimitCode(code) ? code : 'storage_full',
      input.lib
    );
  }

  const fail = async () => {
    await removeMarketingMediaObjects(sb, [path]);
    await sb.from('marketing_media_assets').update({ status: 'failed' }).eq('id', assetId);
  };

  const { error: uploadError } = await sb.storage
    .from(MARKETING_MEDIA_BUCKET)
    .upload(path, input.bytes, {
      contentType: mime,
      cacheControl: MARKETING_MEDIA_CACHE_CONTROL,
      upsert: false,
    });
  if (uploadError) {
    await sb.from('marketing_media_assets').update({ status: 'failed' }).eq('id', assetId);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data: updated, error: updateError } = await sb
    .from('marketing_media_assets')
    .update({
      status: 'ready',
      size_bytes: input.bytes.byteLength,
      width: input.width ?? null,
      height: input.height ?? null,
      duration_ms: input.durationMs ?? null,
    })
    .eq('id', assetId)
    .eq('status', 'pending')
    .select(READY_COLUMNS)
    .single();

  if (updateError) {
    await fail();
    if (updateError.code === '23505') {
      // A parallel upload of the same bytes won the unique (property, hash) slot.
      const winner = await findReadyByHash(sb, input.propertyId, hash);
      if (winner) return toIngested(sb, winner, true);
    }
    throw new Error('Could not finish the upload');
  }
  return toIngested(sb, updated as ReadyRow, false);
}
