/**
 * Clone Storage objects between properties for copy-property-settings.
 * Never deletes source objects. Per-object failures are reported, not fatal.
 */

import { createClient } from './supabaseJs.ts';
import { formatPublicUrl } from './utils.ts';

function storageAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

export type AssetCloneRequest = {
  bucket: string;
  /** Source object path inside the bucket (not a full URL). */
  sourcePath: string;
  /** Destination object path inside the same or another bucket. */
  targetPath: string;
  targetBucket?: string;
  contentType?: string;
};

export type AssetCloneResult = {
  sourcePath: string;
  targetPath: string;
  url: string | null;
  ok: boolean;
  error?: string;
};

/** Extract storage object path from a public Supabase URL when possible. */
export function storagePathFromPublicUrl(url: string, bucket: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = trimmed.indexOf(marker);
  if (idx >= 0) {
    return decodeURIComponent(trimmed.slice(idx + marker.length).split('?')[0] ?? '');
  }
  // Already a path
  if (!trimmed.startsWith('http')) return trimmed.replace(/^\//, '');
  return null;
}

export async function cloneStorageObject(req: AssetCloneRequest): Promise<AssetCloneResult> {
  const supabase = storageAdmin();
  const targetBucket = req.targetBucket ?? req.bucket;
  try {
    const { data, error: downloadError } = await supabase.storage
      .from(req.bucket)
      .download(req.sourcePath);
    if (downloadError || !data) {
      return {
        sourcePath: req.sourcePath,
        targetPath: req.targetPath,
        url: null,
        ok: false,
        error: downloadError?.message ?? 'download failed',
      };
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    const contentType = req.contentType ?? data.type ?? 'application/octet-stream';
    const { error: uploadError } = await supabase.storage
      .from(targetBucket)
      .upload(req.targetPath, bytes, {
        contentType,
        upsert: true,
        cacheControl: '300',
      });
    if (uploadError) {
      return {
        sourcePath: req.sourcePath,
        targetPath: req.targetPath,
        url: null,
        ok: false,
        error: uploadError.message,
      };
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from(targetBucket).getPublicUrl(req.targetPath);
    return {
      sourcePath: req.sourcePath,
      targetPath: req.targetPath,
      url: formatPublicUrl(publicUrl),
      ok: true,
    };
  } catch (err) {
    return {
      sourcePath: req.sourcePath,
      targetPath: req.targetPath,
      url: null,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Clone many objects; returns oldUrl → newUrl map for successful clones.
 * Failures are collected but do not throw.
 */
export async function cloneStorageObjects(
  requests: AssetCloneRequest[]
): Promise<{ urlMap: Map<string, string>; results: AssetCloneResult[] }> {
  const results: AssetCloneResult[] = [];
  const urlMap = new Map<string, string>();
  for (const req of requests) {
    const result = await cloneStorageObject(req);
    results.push(result);
    if (result.ok && result.url) {
      urlMap.set(req.sourcePath, result.url);
    }
  }
  return { urlMap, results };
}
