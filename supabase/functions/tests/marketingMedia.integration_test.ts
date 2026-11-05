/**
 * Live end-to-end check of the Marketing media library against the local stack
 * (`./dev.sh`, functions served on :54321, migrations 20261316128900+ applied).
 * Skipped unless LOCAL_MEDIA_LIVE=1.
 *
 *   LOCAL_MEDIA_LIVE=1 deno test --allow-net --allow-env --allow-read \
 *     supabase/functions/tests/marketingMedia.integration_test.ts
 *
 * Covers: permission gates, reserve/upload/finalize, dedupe, magic-byte rejection, every quota
 * error code, parallel reserves at the quota edge (advisory lock), delete/restore window, restore
 * quota re-check, sweeper expiry + purge, and over-quota-after-downgrade (list still works).
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  ingestMarketingMediaBytes,
  MarketingMediaLimitError,
} from '../_shared/marketingMediaIngest.ts';
import { DEFAULT_MARKETING_MEDIA_LIBRARY } from '../_shared/planFeatures.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { runMarketingMediaSweeper } from '../_shared/marketingMediaSweeper.ts';
import { LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from './_localSupabaseEnv.ts';

const enabled = Deno.env.get('LOCAL_MEDIA_LIVE') === '1';
/**
 * Override when the new functions are served by a separate process (a long-running
 * `functions serve` only registers functions that existed when it started).
 */
const MEDIA_FN_URL =
  Deno.env.get('MEDIA_FN_URL') ?? `${LOCAL_SUPABASE_URL}/functions/v1/marketing-media`;
const ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const service = {
  apikey: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${LOCAL_SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...service,
      Prefer: 'return=representation',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`REST ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function rpc(name: string, args: Record<string, unknown>) {
  return await rest(`rpc/${name}`, {
    method: 'POST',
    body: JSON.stringify(args),
  });
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Minimal valid PNG (1x1) with a unique trailing chunk so each call hashes differently. */
function tinyPng(seed: string): Uint8Array {
  const base = Uint8Array.from(
    atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    ),
    (c) => c.charCodeAt(0)
  );
  const tail = new TextEncoder().encode(seed);
  const out = new Uint8Array(base.length + tail.length);
  out.set(base);
  out.set(tail, base.length);
  return out;
}

async function putSigned(uploadUrl: string, bytes: Uint8Array, contentType: string) {
  const form = new FormData();
  form.append('cacheControl', '3600');
  form.append('', new Blob([bytes.slice()], { type: contentType }));
  const res = await fetch(uploadUrl, { method: 'PUT', body: form });
  await res.text();
  return res.status;
}

Deno.test({
  name: 'marketing media library: quota, upload, dedupe, delete/restore, sweeper (live local)',
  ignore: !enabled,
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const [property] = await rest(
      'properties?select=id,organization_id&order=created_at.asc&limit=1'
    );
    const propertyId = property.id as string;
    const orgId = property.organization_id as string;

    const email = `media-test-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const created = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: service,
      body: JSON.stringify({
        email,
        password: 'Media-test-pass-1!',
        email_confirm: true,
      }),
    }).then((r) => r.json());
    const userId = created.id as string;
    let memberId = '';
    const assetIds: string[] = [];

    try {
      const [member] = await rest('property_members', {
        method: 'POST',
        body: JSON.stringify({
          property_id: propertyId,
          user_id: userId,
          role_id: 'ADMIN',
          permissions: ['marketing:view'],
          status: 'active',
        }),
      });
      memberId = member.id as string;

      const link = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: service,
        body: JSON.stringify({ type: 'magiclink', email }),
      }).then((r) => r.json());
      const token = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/verify`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'magiclink',
          token_hash: link.hashed_token,
        }),
      })
        .then((r) => r.json())
        .then((j) => j.access_token as string);

      const call = async (route: string, method: string, body?: unknown, query = '') => {
        const res = await fetch(`${MEDIA_FN_URL}${route}?property_id=${propertyId}${query}`, {
          method,
          headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        return { status: res.status, json };
      };
      const setPermissions = (permissions: string[]) =>
        rest(`property_members?id=eq.${memberId}`, {
          method: 'PATCH',
          body: JSON.stringify({ permissions }),
        });

      // ── Permission gates ──────────────────────────────────────────────────
      assertEquals((await call('/usage', 'GET')).status, 200, 'view leaf can read usage');
      const png = tinyPng('a');
      const reserveBody = async (bytes: Uint8Array, extra: Record<string, unknown> = {}) => ({
        kind: 'image',
        mime: 'image/png',
        bytes: bytes.length,
        hash: await sha256(bytes),
        fileName: 'a.png',
        ...extra,
      });
      assertEquals(
        (await call('/reserve', 'POST', await reserveBody(png))).status,
        403,
        'reserve needs marketing.templates:add'
      );
      assertEquals((await call('', 'DELETE', { ids: [crypto.randomUUID()] })).status, 403);
      assertEquals((await call('/nope', 'GET')).status, 404);

      await setPermissions([
        'marketing:view',
        'marketing.templates:add',
        'marketing.templates:delete',
      ]);

      // ── Input validation ──────────────────────────────────────────────────
      assertEquals(
        (
          await call('/reserve', 'POST', {
            ...(await reserveBody(png)),
            hash: 'zz',
          })
        ).status,
        400
      );
      assertEquals(
        (
          await call('/reserve', 'POST', {
            ...(await reserveBody(png)),
            mime: 'image/svg+xml',
          })
        ).status,
        400,
        'svg rejected'
      );
      assertEquals(
        (
          await call('/reserve', 'POST', {
            ...(await reserveBody(png)),
            kind: 'video',
          })
        ).status,
        400,
        'kind must match mime'
      );
      assertEquals(
        (
          await call('/reserve', 'POST', {
            ...(await reserveBody(png)),
            bytes: -5,
          })
        ).status,
        400
      );
      assertEquals(
        (
          await call('/reserve', 'POST', {
            kind: 'video',
            mime: 'video/mp4',
            bytes: 10,
            hash: 'a'.repeat(64),
          })
        ).status,
        400,
        'video needs durationMs'
      );
      assertEquals((await call('', 'DELETE', { ids: ['nope'] })).status, 400);

      // ── Happy path: reserve → upload → finalize ───────────────────────────
      const before = (await call('/usage', 'GET')).json.data;
      const reserved = await call(
        '/reserve',
        'POST',
        await reserveBody(png, { width: 1, height: 1 })
      );
      assertEquals(reserved.status, 200);
      const reservedData = reserved.json.data;
      assertEquals(reservedData.deduped, false);
      assetIds.push(reservedData.assetId);
      assertEquals(await putSigned(reservedData.uploadUrl, png, 'image/png'), 200);
      const finalized = await call('/finalize', 'POST', {
        assetId: reservedData.assetId,
      });
      assertEquals(finalized.status, 200);
      assertEquals(finalized.json.data.asset.kind, 'image');
      assertEquals(finalized.json.data.asset.sizeBytes, png.length);
      const publicRes = await fetch(finalized.json.data.asset.url);
      assertEquals(publicRes.status, 200);
      await publicRes.arrayBuffer();

      // Finalize is idempotent.
      assertEquals(
        (await call('/finalize', 'POST', { assetId: reservedData.assetId })).status,
        200
      );

      const after = (await call('/usage', 'GET')).json.data;
      assertEquals(after.files, before.files + 1);
      assertEquals(after.usedBytes, before.usedBytes + png.length);

      // ── Dedupe: same bytes reuse the asset, no new row ────────────────────
      const again = await call('/reserve', 'POST', await reserveBody(png));
      assertEquals(again.json.data.deduped, true);
      assertEquals(again.json.data.asset.id, reservedData.assetId);
      assertEquals((await call('/usage', 'GET')).json.data.files, after.files);

      // ── Listing ───────────────────────────────────────────────────────────
      const list = await call('', 'GET', undefined, '&kind=image&q=a.png');
      assert(list.json.data.items.some((i: { id: string }) => i.id === reservedData.assetId));
      assertEquals(
        (await call('', 'GET', undefined, '&kind=audio&q=a.png')).json.data.items.length,
        0
      );

      // ── Magic-byte mismatch is rejected and cleaned up ────────────────────
      const fake = new TextEncoder().encode(
        '<html><script>alert(1)</script></html>' + 'x'.repeat(40)
      );
      const fakeReserve = await call('/reserve', 'POST', await reserveBody(fake));
      assertEquals(fakeReserve.status, 200);
      assetIds.push(fakeReserve.json.data.assetId);
      assertEquals(await putSigned(fakeReserve.json.data.uploadUrl, fake, 'image/png'), 200);
      const fakeFinalize = await call('/finalize', 'POST', {
        assetId: fakeReserve.json.data.assetId,
      });
      assertEquals(fakeFinalize.status, 400, 'HTML posing as PNG must fail finalize');
      const [failedRow] = await rest(
        `marketing_media_assets?id=eq.${fakeReserve.json.data.assetId}&select=status`
      );
      assertEquals(failedRow.status, 'failed');
      assertEquals(
        (await call('/usage', 'GET')).json.data.files,
        after.files,
        'failed row not counted'
      );

      // Abandon frees a pending reservation immediately and is safe to repeat.
      const abandonBytes = tinyPng('abandon');
      const beforeAbandon = (await call('/usage', 'GET')).json.data;
      const pendingRes = await call('/reserve', 'POST', await reserveBody(abandonBytes));
      assetIds.push(pendingRes.json.data.assetId);
      assertEquals(
        (await call('/usage', 'GET')).json.data.files,
        beforeAbandon.files + 1,
        'pending counts'
      );
      assertEquals(
        (
          await call('/abandon', 'POST', {
            assetId: pendingRes.json.data.assetId,
          })
        ).json.data.abandoned,
        true
      );
      assertEquals(
        (await call('/usage', 'GET')).json.data.files,
        beforeAbandon.files,
        'abandon frees quota'
      );
      assertEquals(
        (
          await call('/abandon', 'POST', {
            assetId: pendingRes.json.data.assetId,
          })
        ).json.data.abandoned,
        false
      );
      assertEquals((await call('/abandon', 'POST', { assetId: 'nope' })).status, 400);
      assertEquals(
        (await call('/abandon', 'POST', { assetId: reservedData.assetId })).json.data.abandoned,
        false,
        'ready assets are never abandoned'
      );

      // Audio: finalize stores compact waveform peaks and the list returns them decoded.
      const mp3 = new Uint8Array(4096);
      mp3.set([0x49, 0x44, 0x33, 0x03, 0, 0, 0, 0, 0, 0x21]);
      mp3.set(new TextEncoder().encode(crypto.randomUUID()), 64);
      const audioReserve = await call('/reserve', 'POST', {
        kind: 'audio',
        mime: 'audio/mpeg',
        bytes: mp3.length,
        durationMs: 12_345,
        hash: await sha256(mp3),
        fileName: 'song.mp3',
      });
      assertEquals(audioReserve.status, 200);
      assetIds.push(audioReserve.json.data.assetId);
      assertEquals(await putSigned(audioReserve.json.data.uploadUrl, mp3, 'audio/mpeg'), 200);
      const peakBytes = Uint8Array.from({ length: 200 }, (_, i) => (i * 5) % 256);
      const peaksB64 = btoa(String.fromCharCode(...peakBytes));
      const audioFinal = await call('/finalize', 'POST', {
        assetId: audioReserve.json.data.assetId,
        peaks: peaksB64,
      });
      assertEquals(audioFinal.status, 200);
      assertEquals(audioFinal.json.data.asset.peaks.length, 200);
      assertEquals(audioFinal.json.data.asset.peaks[1], 0.02);
      assertEquals(audioFinal.json.data.asset.durationMs, 12_345);

      // Finalize without an uploaded object fails cleanly.
      const ghostBytes = tinyPng('ghost');
      const ghost = await call('/reserve', 'POST', await reserveBody(ghostBytes));
      assetIds.push(ghost.json.data.assetId);
      assertEquals(
        (await call('/finalize', 'POST', { assetId: ghost.json.data.assetId })).status,
        400
      );
      assertEquals((await call('/finalize', 'POST', { assetId: crypto.randomUUID() })).status, 404);

      // Uploaded larger than reserved is rejected.
      const small = tinyPng('s');
      const big = new Uint8Array(small.length + 5000);
      big.set(small);
      const lie = await call(
        '/reserve',
        'POST',
        await reserveBody(small, { hash: await sha256(big) })
      );
      assetIds.push(lie.json.data.assetId);
      assertEquals(await putSigned(lie.json.data.uploadUrl, big, 'image/png'), 200);
      assertEquals(
        (await call('/finalize', 'POST', { assetId: lie.json.data.assetId })).status,
        403
      );

      // ── Quota error codes ─────────────────────────────────────────────────
      const tooLarge = await call('/reserve', 'POST', {
        ...(await reserveBody(png)),
        bytes: 11 * 1024 * 1024,
        hash: 'b'.repeat(64),
      });
      assertEquals(tooLarge.status, 403);
      assertEquals(tooLarge.json.code, 'file_too_large');
      assertEquals(tooLarge.json.upgradeHook, true);

      const tooLong = await call('/reserve', 'POST', {
        kind: 'video',
        mime: 'video/mp4',
        bytes: 1000,
        durationMs: 10 * 60 * 1000,
        hash: 'c'.repeat(64),
        fileName: 'long.mp4',
      });
      assertEquals(tooLong.status, 403);
      assertEquals(tooLong.json.code, 'video_too_long');

      // ── RPC edge: storage/file/daily limits + parallel reserves at the edge ─
      const limits = (o: Record<string, number>) => ({
        storageBytes: 1500,
        maxFiles: 100,
        maxFileBytes: 5000,
        maxVideoSec: 60,
        dailyUploads: 1000,
        ...o,
      });
      const reserveRpc = (n: string, bytes: number, l: Record<string, number>) =>
        rpc('reserve_marketing_media_upload', {
          p_org_id: orgId,
          p_property_id: propertyId,
          p_kind: 'image',
          p_bytes: bytes,
          p_duration_ms: null,
          p_hash: n.padEnd(64, '0'),
          p_limits: l,
          p_storage_path: `${propertyId}/${crypto.randomUUID()}/original.png`,
          p_mime_type: 'image/png',
          p_file_name: n,
          p_created_by: userId,
        });
      const current = (await call('/usage', 'GET')).json.data;
      const room = l1(current.usedBytes);
      function l1(used: number) {
        return used + 1500;
      }
      const results = await Promise.all([
        reserveRpc('p1', 1000, limits({ storageBytes: room })),
        reserveRpc('p2', 1000, limits({ storageBytes: room })),
      ]);
      const flat = results.map((r) => (Array.isArray(r) ? r[0] : r));
      for (const r of flat) if (r.asset_id) assetIds.push(r.asset_id);
      assertEquals(flat.filter((r) => r.asset_id).length, 1, 'exactly one parallel reserve wins');
      assertEquals(flat.filter((r) => r.error_code === 'storage_full').length, 1);

      const usageNow = (await call('/usage', 'GET')).json.data;
      const full = await reserveRpc('p3', 10, limits({ maxFiles: usageNow.files }));
      assertEquals(full[0].error_code, 'too_many_files');
      const daily = await reserveRpc('p4', 10, limits({ dailyUploads: 0 }));
      assertEquals(daily[0].error_code, 'daily_limit');
      const huge = await reserveRpc('p5', 6000, limits({}));
      assertEquals(huge[0].error_code, 'file_too_large');

      // ── Delete → restore window ───────────────────────────────────────────
      const deleted = await call('', 'DELETE', { ids: [reservedData.assetId] });
      assertEquals(deleted.status, 200);
      assertEquals(deleted.json.data.deleted, [reservedData.assetId]);
      assertEquals(
        (await call('', 'DELETE', { ids: [reservedData.assetId] })).json.data.deleted.length,
        0
      );
      const afterDelete = (await call('/usage', 'GET')).json.data;
      assertEquals(
        afterDelete.usedBytes,
        usageNow.usedBytes - png.length,
        'deleted stops counting'
      );
      assert(
        !(await call('', 'GET')).json.data.items.some(
          (i: { id: string }) => i.id === reservedData.assetId
        )
      );

      // Quota is re-checked on restore.
      await rest(`marketing_media_assets?id=eq.${reservedData.assetId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          reserved_bytes: 10 * 1024 * 1024 * 1024,
          size_bytes: 10 * 1024 * 1024 * 1024,
        }),
      });
      const blocked = await call('/restore', 'POST', {
        ids: [reservedData.assetId],
      });
      assertEquals(blocked.status, 403);
      assertEquals(blocked.json.code, 'storage_full');
      await rest(`marketing_media_assets?id=eq.${reservedData.assetId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          reserved_bytes: png.length,
          size_bytes: png.length,
        }),
      });
      const restored = await call('/restore', 'POST', {
        ids: [reservedData.assetId],
      });
      assertEquals(restored.json.data.restored, [reservedData.assetId]);

      // Past the window it cannot be restored.
      await call('', 'DELETE', { ids: [reservedData.assetId] });
      await rest(`marketing_media_assets?id=eq.${reservedData.assetId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          purge_after: new Date(Date.now() - 60_000).toISOString(),
        }),
      });
      assertEquals(
        (await call('/restore', 'POST', { ids: [reservedData.assetId] })).json.data.restored.length,
        0
      );

      // ── Sweeper: expire stale pending, purge expired deleted ──────────────
      const stale = (flat.find((r) => r.asset_id) as { asset_id: string }).asset_id;
      await rest(`marketing_media_assets?id=eq.${stale}`, {
        method: 'PATCH',
        body: JSON.stringify({
          created_at: new Date(Date.now() - 4 * 3600_000).toISOString(),
        }),
      });
      const sweepJson = await runMarketingMediaSweeper(new Date());
      assert((sweepJson.expiredPending as number) >= 1, 'stale pending expired');
      assert((sweepJson.purged as number) >= 1, 'expired deleted purged');
      const [staleRow] = await rest(`marketing_media_assets?id=eq.${stale}&select=status`);
      assertEquals(staleRow.status, 'failed');
      // Old failed rows are dropped too.
      await rest(`marketing_media_assets?id=eq.${stale}`, {
        method: 'PATCH',
        body: JSON.stringify({
          created_at: new Date(Date.now() - 8 * 86400_000).toISOString(),
        }),
      });
      const sweepAgain = await runMarketingMediaSweeper(new Date());
      assert((sweepAgain.failedPurged as number) >= 1, 'old failed rows purged');
      assertEquals((await rest(`marketing_media_assets?id=eq.${stale}&select=id`)).length, 0);
      assertEquals(
        (await rest(`marketing_media_assets?id=eq.${reservedData.assetId}&select=id`)).length,
        0
      );
      assertEquals(
        (await fetch(finalized.json.data.asset.url)).status === 200,
        false,
        'object purged'
      );

      // ── Downgrade: over quota keeps list working, blocks new reserves ─────
      const [free] = await rest('pricing_plans?code=eq.free&select=features');
      assert(free.features.marketingMediaLibrary.storageMb > 0, 'every tier has an allowance');
    } finally {
      for (const id of assetIds) {
        const [row] =
          (await rest(`marketing_media_assets?id=eq.${id}&select=storage_path,poster_path`).catch(
            () => []
          )) ?? [];
        if (row) {
          await fetch(`${LOCAL_SUPABASE_URL}/storage/v1/object/marketing-media`, {
            method: 'DELETE',
            headers: service,
            body: JSON.stringify({
              prefixes: [row.storage_path, row.poster_path].filter(Boolean),
            }),
          })
            .then((r) => r.text())
            .catch(() => undefined);
        }
        await rest(`marketing_media_assets?id=eq.${id}`, { method: 'DELETE' }).catch(
          () => undefined
        );
      }
      if (memberId) {
        await rest(`property_members?id=eq.${memberId}`, { method: 'DELETE' }).catch(
          () => undefined
        );
      }
      await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: service,
      })
        .then((r) => r.text())
        .catch(() => undefined);
    }
  },
});

Deno.test({
  name: 'marketing media ingest (upload-marketing-asset / marketing-music path) enforces quota (live local)',
  ignore: !enabled,
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const [property] = await rest(
      'properties?select=id,organization_id&order=created_at.asc&limit=1'
    );
    const sb = createServiceClient();
    const base = {
      orgId: property.organization_id as string,
      propertyId: property.id as string,
      userId: null,
      fileName: 'ingest.png',
      source: 'upload' as const,
    };
    const lib = { ...DEFAULT_MARKETING_MEDIA_LIBRARY };
    const ids: string[] = [];
    const paths: string[] = [];
    try {
      const png = tinyPng(`ingest-${crypto.randomUUID()}`);
      const first = await ingestMarketingMediaBytes(sb, {
        ...base,
        kind: 'image',
        bytes: png,
        declaredMime: 'image/png',
        lib,
        width: 1,
        height: 1,
      });
      ids.push(first.id);
      paths.push(first.storagePath);
      assertEquals(first.deduped, false);
      assertEquals(first.mimeType, 'image/png');
      assertEquals((await fetch(first.url)).status, 200);

      const second = await ingestMarketingMediaBytes(sb, {
        ...base,
        kind: 'image',
        bytes: png,
        declaredMime: 'image/png',
        lib,
      });
      assertEquals(second.deduped, true);
      assertEquals(second.id, first.id);

      // Parallel identical uploads converge on one asset.
      const twin = tinyPng(`twin-${crypto.randomUUID()}`);
      const raced = await Promise.all([
        ingestMarketingMediaBytes(sb, {
          ...base,
          kind: 'image',
          bytes: twin,
          declaredMime: 'image/png',
          lib,
        }),
        ingestMarketingMediaBytes(sb, {
          ...base,
          kind: 'image',
          bytes: twin,
          declaredMime: 'image/png',
          lib,
        }),
      ]);
      for (const r of raced) {
        ids.push(r.id);
        paths.push(r.storagePath);
      }
      assertEquals(raced[0].id, raced[1].id, 'racing identical uploads share one asset');

      // Over quota → typed limit error, no row, no object.
      const blocked = tinyPng(`blocked-${crypto.randomUUID()}`);
      const err = await ingestMarketingMediaBytes(sb, {
        ...base,
        kind: 'image',
        bytes: blocked,
        declaredMime: 'image/png',
        lib: { ...lib, storageMb: 0 },
      }).then(
        () => null,
        (e) => e
      );
      assert(err instanceof MarketingMediaLimitError);
      assertEquals(err.code, 'storage_full');
      assertEquals(
        (await rest(`marketing_media_assets?file_name=eq.ingest.png&status=eq.pending&select=id`))
          .length,
        0
      );

      // Not an image → readable error, nothing stored.
      const notImage = await ingestMarketingMediaBytes(sb, {
        ...base,
        kind: 'image',
        bytes: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
        declaredMime: 'image/png',
        lib,
      }).then(
        () => null,
        (e) => e as Error
      );
      assert(notImage && !(notImage instanceof MarketingMediaLimitError));
      const empty = await ingestMarketingMediaBytes(sb, {
        ...base,
        kind: 'image',
        bytes: new Uint8Array(0),
        declaredMime: 'image/png',
        lib,
      }).then(
        () => null,
        (e) => e as Error
      );
      assertEquals(empty?.message, 'File is empty');

      // Audio uses the per-plan audio cap.
      const mp3 = new Uint8Array(4096);
      mp3.set([0x49, 0x44, 0x33, 0x03, 0, 0, 0, 0, 0, 0x21]);
      mp3.set(new TextEncoder().encode(crypto.randomUUID()), 64);
      const tooBig = await ingestMarketingMediaBytes(sb, {
        ...base,
        kind: 'audio',
        bytes: mp3,
        declaredMime: 'audio/mpeg',
        fileName: 'song.mp3',
        source: 'music_upload',
        lib: { ...lib, maxAudioMb: 0 },
      }).then(
        () => null,
        (e) => e
      );
      assert(tooBig instanceof MarketingMediaLimitError);
      assertEquals(tooBig.code, 'file_too_large');
      const audio = await ingestMarketingMediaBytes(sb, {
        ...base,
        kind: 'audio',
        bytes: mp3,
        declaredMime: 'audio/mpeg',
        fileName: 'song.mp3',
        source: 'music_upload',
        lib,
      });
      ids.push(audio.id);
      paths.push(audio.storagePath);
      const [audioRow] = await rest(
        `marketing_media_assets?id=eq.${audio.id}&select=kind,source,status`
      );
      assertEquals(audioRow, {
        kind: 'audio',
        source: 'music_upload',
        status: 'ready',
      });
    } finally {
      if (paths.length) {
        await fetch(`${LOCAL_SUPABASE_URL}/storage/v1/object/marketing-media`, {
          method: 'DELETE',
          headers: service,
          body: JSON.stringify({ prefixes: paths }),
        })
          .then((r) => r.text())
          .catch(() => undefined);
      }
      for (const id of new Set(ids)) {
        await rest(`marketing_media_assets?id=eq.${id}`, { method: 'DELETE' }).catch(
          () => undefined
        );
      }
      // The losing side of a parallel identical upload is recorded as failed; drop it.
      await rest(`marketing_media_assets?file_name=eq.ingest.png&status=eq.failed`, {
        method: 'DELETE',
      }).catch(() => undefined);
    }
  },
});

Deno.test({
  name: 'marketing media used-in counts and last_used_at touch (live local)',
  ignore: !enabled,
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const [property] = await rest(
      'properties?select=id,organization_id&order=created_at.asc&limit=1'
    );
    const propertyId = property.id as string;
    let assetId = '';
    const templateIds: string[] = [];
    try {
      const [asset] = await rest('marketing_media_assets', {
        method: 'POST',
        body: JSON.stringify({
          org_id: property.organization_id,
          property_id: propertyId,
          kind: 'image',
          status: 'ready',
          storage_path: `${propertyId}/${crypto.randomUUID()}/original.png`,
          file_name: 'used.png',
          mime_type: 'image/png',
          size_bytes: 1,
        }),
      });
      assetId = asset.id as string;

      const insertTemplate = async (designJson: Record<string, unknown>, deletedAt?: string) => {
        const [row] = await rest('marketing_templates', {
          method: 'POST',
          body: JSON.stringify({
            property_id: propertyId,
            organization_id: property.organization_id,
            name: 'used-in test',
            content_type: 'video',
            kind: 'design',
            design_json: designJson,
            deleted_at: deletedAt ?? null,
          }),
        });
        templateIds.push(row.id as string);
      };
      // One live design by explicit id, one by storage path, one deleted (must not count).
      await insertTemplate({
        project: { tracks: [{ items: [{ media: { assetId } }] }] },
      });
      await insertTemplate({
        project: {
          url: `/marketing-media/${propertyId}/${assetId}/original.png`,
        },
      });
      await insertTemplate(
        {
          project: { tracks: [{ items: [{ media: { assetId } }] }] },
        },
        new Date().toISOString()
      );

      const unused = crypto.randomUUID();
      const rows = (await rpc('marketing_media_used_in', {
        p_property_id: propertyId,
        p_ids: [assetId, unused],
      })) as Array<{ asset_id: string; uses: number }>;
      const counts = Object.fromEntries(rows.map((r) => [r.asset_id, r.uses]));
      assertEquals(counts[assetId], 2);
      assertEquals(counts[unused], 0);

      await rpc('marketing_media_touch', {
        p_property_id: propertyId,
        p_ids: [assetId],
      });
      const [stamped] = await rest(`marketing_media_assets?id=eq.${assetId}&select=last_used_at`);
      assert(stamped.last_used_at, 'last_used_at is set');
    } finally {
      for (const id of templateIds) {
        await rest(`marketing_templates?id=eq.${id}`, { method: 'DELETE' }).catch(() => undefined);
      }
      if (assetId) {
        await rest(`marketing_media_assets?id=eq.${assetId}`, {
          method: 'DELETE',
        }).catch(() => undefined);
      }
    }
  },
});
