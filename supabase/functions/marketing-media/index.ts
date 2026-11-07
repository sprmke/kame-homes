/**
 * marketing-media — Marketing Studio media library (images, video, audio) with plan quotas.
 *
 * GET                       ?kind=&q=&source=&cursor=&limit=   Page of ready assets
 * GET    /usage                                               { usedBytes, files, uploadsToday, limits }
 * POST   /reserve   { kind, mime, bytes, durationMs?, width?, height?, hash, fileName }
 *                                                             Quota check + signed upload URL(s)
 * POST   /finalize  { assetId, peaks? }   Verify the uploaded object, mark ready
 *                                          (audio waveform peaks as base64 bytes)
 * POST   /abandon   { assetId }            Cancel a pending upload, free its quota now
 * DELETE            { ids[] }                                 Soft delete (7 day restore window)
 * POST   /restore   { ids[] }                                 Undo a delete if still in the window
 *
 * Bytes go straight from the browser to Storage via signed upload URLs; this function only
 * reserves quota (advisory-locked RPC) and verifies the result. Plan allowance comes from
 * `marketingMediaLibrary`; going over returns 403 with `upgradeHook: true` and a `code`.
 *
 * Auth: marketing:view (read), marketing.media:add (upload), marketing.media:delete
 * (delete / restore); every route also resolves the `marketingMediaLibrary` plan feature.
 * Plan: docs/workflow/in-progress/marketing-video-editor-multitrack.md §5.4.
 *
 * activity-log: marketing.media_deleted / marketing.media_restored. Uploads are N/A (staging
 * artifacts, high volume), as with upload-marketing-asset; blocked attempts are plain 403s.
 */

import { logAssetActivity } from '../_shared/assetActivity.ts';
import { jsonError, jsonResponse, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import {
  assertUploadMatchesBytes,
  decodePeaks,
  parsePeaksBase64,
  createMarketingMediaSignedUpload,
  extensionForMarketingMime,
  isAllowedMarketingMediaMime,
  isMarketingMediaLimitCode,
  isUuid,
  kindForMime,
  limitMessage,
  MARKETING_MEDIA_DELETE_RETENTION_DAYS,
  type MarketingMediaKind,
  marketingMediaOriginalPath,
  marketingMediaPosterPath,
  normalizeMime,
  parseMp4DurationMs,
  readMarketingMediaHead,
  routeFromPath,
  removeMarketingMediaObjects,
  reserveLimitsFor,
  statMarketingMediaObject,
} from '../_shared/marketingMediaStorage.ts';
import { createServiceClient, requirePropertyPermissionAndFeature } from '../_shared/orgAuth.ts';
import {
  DEFAULT_MARKETING_MEDIA_LIBRARY,
  type PlanMarketingMediaLibrary,
} from '../_shared/planFeatures.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import type { TeamPermissionId } from '../_shared/propertyTeamPermissions.ts';
import { rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import type { SupabaseClient } from '../_shared/supabaseJs.ts';

const MAX_IDS = 50;
/** Posters are small JPEG stills. */
const MAX_POSTER_BYTES = 2 * 1024 * 1024;
/** `used-in` scans saved designs, so it takes a handful of ids at a time. */
const MAX_USED_IN_IDS = 10;
const DEFAULT_PAGE = 40;
const MAX_PAGE = 100;
const HASH_RE = /^[a-f0-9]{64}$/;
/** MP4 duration read from the file head may differ slightly from the client probe. */
const DURATION_TOLERANCE_MS = 500;

type AssetRow = {
  id: string;
  org_id: string;
  property_id: string;
  kind: MarketingMediaKind;
  status: string;
  source: string;
  bucket: string;
  storage_path: string;
  poster_path: string | null;
  file_name: string;
  mime_type: string;
  reserved_bytes: number;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  content_hash: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  purge_after: string | null;
};

const ASSET_COLUMNS =
  'id, org_id, property_id, kind, status, source, bucket, storage_path, poster_path, file_name, mime_type, reserved_bytes, size_bytes, width, height, duration_ms, content_hash, meta, created_at, purge_after';

function publicUrl(sb: SupabaseClient, bucket: string, path: string): string {
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function serializeAsset(sb: SupabaseClient, row: AssetRow) {
  return {
    id: row.id,
    kind: row.kind,
    source: row.source,
    fileName: row.file_name,
    mimeType: row.mime_type,
    url: publicUrl(sb, row.bucket, row.storage_path),
    posterUrl: row.poster_path ? publicUrl(sb, row.bucket, row.poster_path) : null,
    sizeBytes: row.size_bytes ?? row.reserved_bytes,
    width: row.width,
    height: row.height,
    durationMs: row.duration_ms,
    peaks: decodePeaks(row.meta?.peaks),
    createdAt: row.created_at,
  };
}

function permissionFor(req: Request, route: string): TeamPermissionId | null {
  if (req.method === 'GET') {
    return route === '' || route === 'usage' || route === 'used-in' ? 'marketing:view' : null;
  }
  if (req.method === 'POST') {
    if (route === 'reserve' || route === 'finalize' || route === 'abandon') {
      return 'marketing.media:add';
    }
    if (route === 'restore') return 'marketing.media:delete';
    return null;
  }
  if (req.method === 'DELETE' && route === '') return 'marketing.media:delete';
  return null;
}

/** Pixel size from the client probe: 1 to 16384, else unknown. */
function clampDimension(value: unknown): number | null {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= 16384 ? n : null;
}

function parseIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_IDS) return null;
  const ids = value.filter(isUuid);
  return ids.length === value.length ? [...new Set(ids)] : null;
}

function limitResponse(req: Request, code: string, lib: PlanMarketingMediaLibrary): Response {
  const known = isMarketingMediaLimitCode(code);
  return jsonResponse(
    req,
    {
      success: false,
      error: known ? limitMessage(code, lib) : 'Upload limit reached',
      code,
      upgradeHook: true,
      feature: 'marketingMediaLibrary',
    },
    403
  );
}

serveAuthenticated('marketing-media', async (req, user) => {
  const url = new URL(req.url);
  const route = routeFromPath(url.pathname);

  const permission = permissionFor(req, route);
  if (!permission) return jsonError(req, 'Not found', 404);

  let propertyId: string;
  let organizationId: string;
  let lib: PlanMarketingMediaLibrary;
  let accessKind: string | null = null;
  try {
    const scoped = await resolveScopedPropertyAccess(req, permission);
    propertyId = scoped.property.id;
    organizationId = scoped.org.id;
    const access = await requirePropertyPermissionAndFeature(
      req,
      propertyId,
      permission,
      'marketingMediaLibrary'
    );
    accessKind = access.accessKind ?? null;
    lib = access.entitlements?.marketingMediaLibrary ?? DEFAULT_MARKETING_MEDIA_LIBRARY;
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const sb = createServiceClient();

  // ── GET / ────────────────────────────────────────────────────────────────
  if (req.method === 'GET' && route === '') {
    const kind = url.searchParams.get('kind');
    const source = url.searchParams.get('source');
    const q = url.searchParams.get('q')?.trim().slice(0, 80) ?? '';
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(
      Math.max(Number(url.searchParams.get('limit')) || DEFAULT_PAGE, 1),
      MAX_PAGE
    );

    let query = sb
      .from('marketing_media_assets')
      .select(ASSET_COLUMNS)
      .eq('property_id', propertyId)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);
    if (kind === 'image' || kind === 'video' || kind === 'audio') query = query.eq('kind', kind);
    if (source) query = query.eq('source', source);
    if (q) query = query.ilike('file_name', `%${q.replace(/[%_]/g, '')}%`);
    if (cursor && !Number.isNaN(Date.parse(cursor))) query = query.lt('created_at', cursor);

    const { data, error } = await query;
    if (error) return jsonError(req, 'Could not load media', 500);
    const rows = (data ?? []) as AssetRow[];
    const page = rows.slice(0, limit);
    return jsonSuccess(req, {
      items: page.map((row) => serializeAsset(sb, row)),
      nextCursor: rows.length > limit ? (page.at(-1)?.created_at ?? null) : null,
    });
  }

  // ── GET /usage ───────────────────────────────────────────────────────────
  if (req.method === 'GET' && route === 'usage') {
    const usage = await loadUsage(sb, propertyId);
    if (!usage) return jsonError(req, 'Could not load usage', 500);
    return jsonSuccess(req, { ...usage, limits: lib });
  }

  // ── GET /used-in?ids=a,b ─────────────────────────────────────────────────
  // How many saved designs use each asset, so the delete confirmation can warn first.
  if (req.method === 'GET' && route === 'used-in') {
    const ids = parseIds((url.searchParams.get('ids') ?? '').split(',').filter(Boolean));
    if (!ids || ids.length > MAX_USED_IN_IDS) {
      return jsonError(req, `ids must be 1 to ${MAX_USED_IN_IDS} valid ids`, 400);
    }
    const { data, error } = await sb.rpc('marketing_media_used_in', {
      p_property_id: propertyId,
      p_ids: ids,
    });
    if (error) return jsonError(req, 'Could not check where this is used', 500);
    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as Array<{ asset_id: string; uses: number }>) {
      counts[row.asset_id] = row.uses;
    }
    return jsonSuccess(req, { counts });
  }

  const body = await readJsonBody(req);

  // ── POST /reserve ────────────────────────────────────────────────────────
  if (req.method === 'POST' && route === 'reserve') {
    const limited = await rateLimitGate(req, {
      scope: 'marketing-media-reserve',
      identity: user.id,
      limit: 30,
      windowSec: 300,
    });
    if (limited) return limited;

    const mime = typeof body.mime === 'string' ? normalizeMime(body.mime) : '';
    const kind = typeof body.kind === 'string' ? body.kind : '';
    const bytes = Number(body.bytes);
    const hash = typeof body.hash === 'string' ? body.hash.toLowerCase() : '';
    const durationMs =
      body.durationMs == null ? null : Math.max(0, Math.round(Number(body.durationMs)));
    if (!isAllowedMarketingMediaMime(mime) || kindForMime(mime) !== kind) {
      return jsonError(req, 'This file type is not supported', 400);
    }
    if (!Number.isFinite(bytes) || bytes <= 0 || !Number.isInteger(bytes)) {
      return jsonError(req, 'bytes must be a positive integer', 400);
    }
    if (!HASH_RE.test(hash)) return jsonError(req, 'hash must be a SHA-256 hex digest', 400);
    if (durationMs !== null && !Number.isFinite(durationMs)) {
      return jsonError(req, 'durationMs is invalid', 400);
    }
    if (kind === 'video' && durationMs === null) {
      return jsonError(req, 'durationMs is required for video', 400);
    }
    const fileName =
      typeof body.fileName === 'string' ? body.fileName.replace(/[\r\n]/g, ' ').slice(0, 200) : '';

    // Dedupe: the same bytes already in this library reuse that asset.
    const { data: existing } = await sb
      .from('marketing_media_assets')
      .select(ASSET_COLUMNS)
      .eq('property_id', propertyId)
      .eq('content_hash', hash)
      .eq('status', 'ready')
      .maybeSingle();
    if (existing) {
      return jsonSuccess(req, { deduped: true, asset: serializeAsset(sb, existing as AssetRow) });
    }

    const assetId = crypto.randomUUID();
    const ext = extensionForMarketingMime(mime);
    const storagePath = marketingMediaOriginalPath(propertyId, assetId, ext);
    const posterPath = kind === 'video' ? marketingMediaPosterPath(propertyId, assetId) : null;

    const { data: reserved, error: reserveError } = await sb.rpc('reserve_marketing_media_upload', {
      p_org_id: organizationId,
      p_property_id: propertyId,
      p_kind: kind,
      p_bytes: bytes,
      p_duration_ms: durationMs,
      p_hash: hash,
      p_limits: reserveLimitsFor(kind as MarketingMediaKind, lib),
      p_storage_path: storagePath,
      p_poster_path: posterPath,
      p_mime_type: mime,
      p_file_name: fileName,
      p_source: 'upload',
      p_created_by: user.id,
      p_asset_id: assetId,
    });
    if (reserveError) {
      console.error('[marketing-media] reserve rpc failed', reserveError.message);
      return jsonError(req, 'Could not reserve upload', 500);
    }
    const result = (Array.isArray(reserved) ? reserved[0] : reserved) as {
      asset_id: string | null;
      error_code: string | null;
    } | null;
    if (!result || result.error_code) {
      return limitResponse(req, result?.error_code ?? 'storage_full', lib);
    }

    if (typeof body.width === 'number' || typeof body.height === 'number') {
      await sb
        .from('marketing_media_assets')
        .update({
          width: clampDimension(body.width),
          height: clampDimension(body.height),
        })
        .eq('id', assetId);
    }

    try {
      const upload = await createMarketingMediaSignedUpload(sb, storagePath);
      const poster = posterPath ? await createMarketingMediaSignedUpload(sb, posterPath) : null;
      return jsonSuccess(req, {
        deduped: false,
        assetId,
        uploadUrl: upload.uploadUrl,
        token: upload.token,
        path: upload.path,
        poster: poster
          ? { uploadUrl: poster.uploadUrl, token: poster.token, path: poster.path }
          : null,
      });
    } catch (err) {
      await sb.from('marketing_media_assets').update({ status: 'failed' }).eq('id', assetId);
      console.error('[marketing-media] signed url failed', (err as Error).message);
      return jsonError(req, 'Could not start the upload. Try again.', 502);
    }
  }

  // ── POST /finalize ───────────────────────────────────────────────────────
  if (req.method === 'POST' && route === 'finalize') {
    const assetId = body.assetId;
    if (!isUuid(assetId)) return jsonError(req, 'assetId is required', 400);

    const { data: found } = await sb
      .from('marketing_media_assets')
      .select(ASSET_COLUMNS)
      .eq('id', assetId)
      .eq('property_id', propertyId)
      .maybeSingle();
    const row = found as AssetRow | null;
    if (!row) return jsonError(req, 'Upload not found', 404);
    if (row.status === 'ready') return jsonSuccess(req, { asset: serializeAsset(sb, row) });
    if (row.status !== 'pending') return jsonError(req, 'This upload expired. Try again.', 409);

    const fail = async (message: string, status = 400, code?: string) => {
      await removeMarketingMediaObjects(sb, [row.storage_path, row.poster_path]);
      await sb.from('marketing_media_assets').update({ status: 'failed' }).eq('id', row.id);
      return code ? limitResponse(req, code, lib) : jsonError(req, message, status);
    };

    const stat = await statMarketingMediaObject(sb, row.storage_path);
    if (!stat) return await fail('We could not find the uploaded file. Try again.');

    const maxBytes = reserveLimitsFor(row.kind, lib).maxFileBytes!;
    if (stat.size > row.reserved_bytes || stat.size > maxBytes) {
      return await fail('This file is larger than expected.', 400, 'file_too_large');
    }

    const head = await readMarketingMediaHead(sb, row.storage_path);
    if (!head) return await fail('We could not read the uploaded file. Try again.');

    let sniffedMime: string;
    try {
      sniffedMime = assertUploadMatchesBytes(head, row.kind, row.mime_type).mime;
    } catch (err) {
      return await fail((err as Error).message);
    }

    let durationMs = row.duration_ms;
    if (row.kind === 'video') {
      const parsed = parseMp4DurationMs(head);
      if (parsed !== null) durationMs = parsed;
      // Without a server-read length (moov past the first 64 KiB, WebM, MOV) the client's probe is
      // the only source, so it must exist and be sane.
      if (durationMs === null || durationMs <= 0) {
        return await fail('We could not read this video length. Try another file.');
      }
      if (durationMs !== null && durationMs > lib.maxVideoSec * 1000 + DURATION_TOLERANCE_MS) {
        return await fail('This video is too long.', 400, 'video_too_long');
      }
    }

    let posterPath = row.poster_path;
    let posterBytes = 0;
    if (posterPath) {
      const posterStat = await statMarketingMediaObject(sb, posterPath);
      const posterHead = posterStat ? await readMarketingMediaHead(sb, posterPath) : null;
      // A poster is a small JPEG. Anything else is dropped so it cannot carry quota-free bytes.
      const isJpeg =
        posterHead !== null &&
        posterHead.length >= 3 &&
        posterHead[0] === 0xff &&
        posterHead[1] === 0xd8 &&
        posterHead[2] === 0xff;
      if (posterStat && isJpeg && posterStat.size <= MAX_POSTER_BYTES) {
        posterBytes = posterStat.size;
      } else {
        await removeMarketingMediaObjects(sb, [posterPath]);
        posterPath = null;
      }
    }

    const { data: updated, error: updateError } = await sb
      .from('marketing_media_assets')
      .update({
        status: 'ready',
        size_bytes: stat.size + posterBytes,
        mime_type: sniffedMime,
        duration_ms: durationMs,
        poster_path: posterPath,
        ...(row.kind === 'audio' && parsePeaksBase64(body.peaks)
          ? { meta: { ...(row.meta ?? {}), peaks: parsePeaksBase64(body.peaks) } }
          : {}),
      })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select(ASSET_COLUMNS)
      .single();

    if (updateError) {
      // Unique (property_id, content_hash) for ready rows: a parallel upload of the same bytes won.
      if (updateError.code === '23505') {
        await removeMarketingMediaObjects(sb, [row.storage_path, row.poster_path]);
        await sb.from('marketing_media_assets').update({ status: 'failed' }).eq('id', row.id);
        const { data: winner } = await sb
          .from('marketing_media_assets')
          .select(ASSET_COLUMNS)
          .eq('property_id', propertyId)
          .eq('content_hash', row.content_hash)
          .eq('status', 'ready')
          .maybeSingle();
        if (winner) {
          return jsonSuccess(req, { deduped: true, asset: serializeAsset(sb, winner as AssetRow) });
        }
      }
      console.error('[marketing-media] finalize update failed', updateError.message);
      return jsonError(req, 'Could not finish the upload', 500);
    }
    return jsonSuccess(req, { deduped: false, asset: serializeAsset(sb, updated as AssetRow) });
  }

  // ── POST /abandon ────────────────────────────────────────────────────────
  // The browser gave up (cancel, network error, unsupported file after reserve): free the quota now
  // instead of waiting for the sweeper's 3 h expiry. Only pending rows can be abandoned.
  if (req.method === 'POST' && route === 'abandon') {
    const assetId = body.assetId;
    if (!isUuid(assetId)) return jsonError(req, 'assetId is required', 400);
    const { data: pending } = await sb
      .from('marketing_media_assets')
      .select('id, bucket, storage_path, poster_path')
      .eq('id', assetId)
      .eq('property_id', propertyId)
      .eq('status', 'pending')
      .maybeSingle();
    if (!pending) return jsonSuccess(req, { abandoned: false });
    const row = pending as Pick<AssetRow, 'id' | 'storage_path' | 'poster_path'>;
    await removeMarketingMediaObjects(sb, [row.storage_path, row.poster_path]);
    await sb
      .from('marketing_media_assets')
      .update({ status: 'failed' })
      .eq('id', row.id)
      .eq('status', 'pending');
    return jsonSuccess(req, { abandoned: true });
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const ids = parseIds(body.ids);
    if (!ids) return jsonError(req, `ids must be 1 to ${MAX_IDS} valid ids`, 400);
    const purgeAfter = new Date(
      Date.now() + MARKETING_MEDIA_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const { data, error } = await sb
      .from('marketing_media_assets')
      .update({ status: 'deleted', deleted_at: new Date().toISOString(), purge_after: purgeAfter })
      .eq('property_id', propertyId)
      .in('id', ids)
      .eq('status', 'ready')
      .select('id, file_name')
      .limit(MAX_IDS);
    if (error) return jsonError(req, 'Could not delete media', 500);
    const deleted = (data ?? []) as Array<{ id: string; file_name: string }>;
    if (deleted.length > 0) {
      await logAssetActivity({
        req,
        user,
        propertyId,
        organizationId,
        accessKind,
        action: 'marketing.media_deleted',
        targetType: 'marketing_media',
        targetId: deleted[0]!.id,
        targetLabel: deleted.length === 1 ? deleted[0]!.file_name : null,
        metadata: { count: deleted.length },
      });
    }
    return jsonSuccess(req, { deleted: deleted.map((row) => row.id), purgeAfter });
  }

  // ── POST /restore ────────────────────────────────────────────────────────
  if (req.method === 'POST' && route === 'restore') {
    const ids = parseIds(body.ids);
    if (!ids) return jsonError(req, `ids must be 1 to ${MAX_IDS} valid ids`, 400);

    const { data: candidates } = await sb
      .from('marketing_media_assets')
      .select('id, file_name, size_bytes, reserved_bytes, source')
      .eq('property_id', propertyId)
      .in('id', ids)
      .eq('status', 'deleted')
      .gt('purge_after', new Date().toISOString())
      .limit(MAX_IDS);
    const rows = (candidates ?? []) as Array<{
      id: string;
      file_name: string;
      size_bytes: number | null;
      reserved_bytes: number;
      source: string;
    }>;
    if (rows.length === 0) return jsonSuccess(req, { restored: [] });

    const usage = await loadUsage(sb, propertyId);
    if (!usage) return jsonError(req, 'Could not check storage', 500);
    const addBytes = rows.reduce((n, r) => n + (r.size_bytes ?? r.reserved_bytes), 0);
    const limits = reserveLimitsFor('image', lib);
    if (usage.usedBytes + addBytes > limits.storageBytes!) {
      return limitResponse(req, 'storage_full', lib);
    }
    if (usage.files + rows.length > limits.maxFiles!) {
      return limitResponse(req, 'too_many_files', lib);
    }

    const { data, error } = await sb
      .from('marketing_media_assets')
      .update({ status: 'ready', deleted_at: null, purge_after: null })
      .eq('property_id', propertyId)
      .in(
        'id',
        rows.map((r) => r.id)
      )
      .eq('status', 'deleted')
      .select('id, file_name')
      .limit(MAX_IDS);
    if (error) {
      // A same-hash ready asset may have been re-uploaded while this one sat in the bin.
      if (error.code === '23505') {
        return jsonError(req, 'A copy of this file is already in your library.', 409);
      }
      return jsonError(req, 'Could not restore media', 500);
    }
    const restored = (data ?? []) as Array<{ id: string; file_name: string }>;
    if (restored.length > 0) {
      await logAssetActivity({
        req,
        user,
        propertyId,
        organizationId,
        accessKind,
        action: 'marketing.media_restored',
        targetType: 'marketing_media',
        targetId: restored[0]!.id,
        targetLabel: restored.length === 1 ? restored[0]!.file_name : null,
        metadata: { count: restored.length },
      });
    }
    return jsonSuccess(req, { restored: restored.map((row) => row.id) });
  }

  return jsonError(req, 'Not found', 404);
});

async function loadUsage(
  sb: SupabaseClient,
  propertyId: string
): Promise<{ usedBytes: number; files: number; uploadsToday: number } | null> {
  const { data, error } = await sb.rpc('marketing_media_usage', { p_property_id: propertyId });
  if (error) {
    console.error('[marketing-media] usage rpc failed', error.message);
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as {
    used_bytes: number | string;
    files: number | string;
    uploads_today: number | string;
  } | null;
  return {
    usedBytes: Number(row?.used_bytes ?? 0),
    files: Number(row?.files ?? 0),
    uploadsToday: Number(row?.uploads_today ?? 0),
  };
}
