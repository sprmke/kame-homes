/**
 * Sync legacy Storage blobs into hosted fwor (or any TARGET_* project).
 *
 * 1. booking-paths — paths referenced by guest_submissions on the target DB
 * 2. legacy-buckets — recursive list of every object in legacy buckets
 *
 * Env: LEGACY_OBJECT_BASE_URL, LEGACY_SERVICE_ROLE_KEY (supabase/.env.local)
 *      DEV_SUPABASE_URL, DEV_SERVICE_ROLE_KEY (supabase/.env.dev.local)
 *
 * Usage:
 *   bun scripts/migrate/legacy-to-mt-prod/storage/syncHostedStorageFromLegacy.ts inventory-booking-paths
 *   bun scripts/migrate/legacy-to-mt-prod/storage/syncHostedStorageFromLegacy.ts verify-booking-paths
 *   bun scripts/migrate/legacy-to-mt-prod/storage/syncHostedStorageFromLegacy.ts copy-booking-paths [limit]
 *   bun scripts/migrate/legacy-to-mt-prod/storage/syncHostedStorageFromLegacy.ts copy-legacy-buckets [limit]
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  LEGACY_BUCKETS,
  copyFromLegacyToTarget,
  fetchBookingStorageKeys,
  listBucketObjects,
  loadSyncEnv,
  rowFromKey,
  targetBlobReadable,
} from './legacyStorageSyncLib.ts';

const ROOT = join(import.meta.dir, '..', '..', '..', '..');
const RUN_DIR = process.env.RUN_DIR || join(ROOT, 'backups', 'migration', 'latest-rehearsal');
const MODE = process.argv[2] ?? 'inventory-booking-paths';
const LIMIT = Number(process.argv[3] ?? 0);

async function auditBookingPaths(env: ReturnType<typeof loadSyncEnv>) {
  const keys = await fetchBookingStorageKeys(env.TARGET_REST, env.TARGET_KEY);
  const broken: string[] = [];
  let ok = 0;
  const batch = 16;
  for (let i = 0; i < keys.length; i += batch) {
    const chunk = keys.slice(i, i + batch);
    const results = await Promise.all(
      chunk.map(async (key) => {
        const o = rowFromKey(key);
        const readable = await targetBlobReadable(env.TARGET_BASE, env.TARGET_KEY, o);
        return { key, readable };
      })
    );
    for (const r of results) {
      if (r.readable) ok += 1;
      else broken.push(r.key);
    }
  }
  return { keys, ok, broken };
}

async function inventoryBookingPaths(env: ReturnType<typeof loadSyncEnv>) {
  const { keys, ok, broken } = await auditBookingPaths(env);
  writeFileSync(join(RUN_DIR, 'booking-storage-paths.json'), JSON.stringify(keys, null, 2) + '\n');
  writeFileSync(
    join(RUN_DIR, 'broken-booking-storage-paths.json'),
    JSON.stringify(broken, null, 2) + '\n'
  );
  console.log(
    JSON.stringify(
      { uniquePaths: keys.length, readable: ok, broken: broken.length, runDir: RUN_DIR },
      null,
      2
    )
  );
  if (broken.length > 0) process.exit(1);
}

async function verifyBookingPaths(env: ReturnType<typeof loadSyncEnv>) {
  const { keys, ok, broken } = await auditBookingPaths(env);
  console.log(
    JSON.stringify({ uniquePaths: keys.length, readable: ok, broken: broken.length }, null, 2)
  );
  if (broken.length > 0) {
    for (const b of broken.slice(0, 20)) console.log(`[broken] ${b}`);
    process.exit(1);
  }
}

async function copyKeys(env: ReturnType<typeof loadSyncEnv>, keys: string[], label: string) {
  const scan = LIMIT > 0 ? keys.slice(0, LIMIT) : keys;
  let skipped = 0;
  let repaired = 0;
  let legacyMissing = 0;
  let uploadFailed = 0;

  for (let i = 0; i < scan.length; i++) {
    const key = scan[i];
    const o = rowFromKey(key);
    const result = await copyFromLegacyToTarget(env, o);
    if (result === 'skipped') skipped += 1;
    else if (result === 'repaired') repaired += 1;
    else if (result === 'legacy-missing') {
      legacyMissing += 1;
      console.log(`[legacy-missing] ${key}`);
    } else {
      uploadFailed += 1;
      console.log(`[upload-failed] ${key}`);
    }
    if ((i + 1) % 25 === 0) {
      console.log(`[progress] ${label} ${i + 1}/${scan.length}`);
    }
  }

  const summary = {
    mode: MODE,
    label,
    scanned: scan.length,
    skipped,
    repaired,
    legacyMissing,
    uploadFailed,
    at: new Date().toISOString(),
  };
  console.log(JSON.stringify(summary, null, 2));
  writeFileSync(
    join(RUN_DIR, `storage-sync-${label}-result.json`),
    JSON.stringify(summary, null, 2) + '\n'
  );
  if (legacyMissing > 0 || uploadFailed > 0) process.exit(1);
}

async function copyBookingPaths(env: ReturnType<typeof loadSyncEnv>) {
  const brokenPath = join(RUN_DIR, 'broken-booking-storage-paths.json');
  let keys: string[];
  if (existsSync(brokenPath)) {
    keys = JSON.parse(readFileSync(brokenPath, 'utf8')) as string[];
  } else {
    keys = (await auditBookingPaths(env)).broken;
  }
  if (keys.length === 0) {
    console.log('No broken booking paths; nothing to copy.');
    return;
  }
  await copyKeys(env, keys, 'booking-paths');
}

async function copyLegacyBuckets(env: ReturnType<typeof loadSyncEnv>) {
  if (!env.LEGACY_KEY) {
    throw new Error('LEGACY_SERVICE_ROLE_KEY required to list/copy private legacy buckets');
  }
  const legacyApi = env.LEGACY_BASE.replace(/\/storage\/v1\/object\/?$/, '/storage/v1');
  const allKeys: string[] = [];
  for (const bucket_id of LEGACY_BUCKETS) {
    console.log(`[list-legacy] ${bucket_id}`);
    const objects = await listBucketObjects(legacyApi, env.LEGACY_KEY, bucket_id);
    console.log(`  objects=${objects.length}`);
    for (const o of objects) allKeys.push(`${o.bucket_id}/${o.name}`);
  }
  writeFileSync(
    join(RUN_DIR, 'legacy-storage-paths.json'),
    JSON.stringify(allKeys, null, 2) + '\n'
  );
  await copyKeys(env, allKeys, 'legacy-buckets');
}

async function main() {
  const env = loadSyncEnv(ROOT);
  if (!env.LEGACY_BASE || !env.TARGET_BASE || !env.TARGET_KEY || !env.TARGET_REST) {
    throw new Error('Need LEGACY_OBJECT_BASE_URL, DEV_SUPABASE_URL, DEV_SERVICE_ROLE_KEY');
  }

  switch (MODE) {
    case 'inventory-booking-paths':
      await inventoryBookingPaths(env);
      break;
    case 'verify-booking-paths':
      await verifyBookingPaths(env);
      break;
    case 'copy-booking-paths':
      await copyBookingPaths(env);
      break;
    case 'copy-legacy-buckets':
      await copyLegacyBuckets(env);
      break;
    default:
      throw new Error(`Unknown mode ${MODE}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
