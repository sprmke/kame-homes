#!/usr/bin/env bun
/**
 * storage-audit — per-bucket size baseline for the image/video upload
 * optimization rollout (docs/workflow/planned/image-video-upload-optimization.md
 * §13). Run once before Phase 1 and again at +2 / +6 weeks to see the curve.
 *
 * Usage (from repo root):
 *   bun scripts/media/storage-audit.ts             # local stack (ui/.env.development)
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bun scripts/media/storage-audit.ts
 *   bun scripts/media/storage-audit.ts --json      # machine-readable
 *
 * Read-only. Lists every object in every media bucket and reports count, total
 * bytes, and p50/p90/p99 object size.
 */

import { createClient } from '@supabase/supabase-js';

const MEDIA_BUCKETS = [
  'property-media',
  'valid-ids',
  'payment-receipts',
  'pet-images',
  'pet-vaccinations',
  'guest-profile-assets',
  'guest-chat-attachments',
  'guest-review-media',
  'org-verification-assets',
  'listing-authorization-assets',
  'app-settings-assets',
  'parking-endorsements',
  'sd-refund-receipts',
  'support-ticket-attachments',
];

const asJson = process.argv.includes('--json');
const keyShapesOnly = process.argv.includes('--key-shapes');

/** Guest PII buckets — cost/abuse §2.2 key-shape audit. */
const GUEST_DOC_BUCKETS = new Set([
  'valid-ids',
  'payment-receipts',
  'pet-images',
  'pet-vaccinations',
  'parking-endorsements',
]);

const UUID_PREFIX_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\//i;

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  // Local stack default service_role key.
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UtZGVtbyIsImlhdCI6MTY0MTc2OTIwMCwiZXhwIjoxNzk5NTM1NjAwfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

const supabase = createClient(url, key, { auth: { persistSession: false } });

interface BucketStat {
  bucket: string;
  objects: number;
  totalBytes: number;
  p50: number;
  p90: number;
  p99: number;
  error?: string;
}

async function listBucketObjects(bucket: string): Promise<{ path: string; size: number }[]> {
  const objects: { path: string; size: number }[] = [];
  const stack = [''];
  while (stack.length) {
    const prefix = stack.pop() as string;
    let offset = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const entry of data) {
        const size = (entry.metadata as { size?: number } | null)?.size;
        const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (typeof size === 'number') {
          objects.push({ path: fullPath, size });
        } else {
          stack.push(fullPath);
        }
      }
      if (data.length < 1000) break;
      offset += data.length;
    }
  }
  return objects;
}

async function listAll(bucket: string): Promise<number[]> {
  const objects = await listBucketObjects(bucket);
  return objects.map((o) => o.size);
}

function classifyGuestDocKey(path: string): 'property_scoped' | 'flat' | 'other' {
  if (UUID_PREFIX_RE.test(path)) return 'property_scoped';
  if (!path.includes('/')) return 'flat';
  return 'other';
}

async function printGuestDocKeyShapes() {
  const report: Record<
    string,
    { total: number; propertyScoped: number; flat: number; other: number; samples: string[] }
  > = {};

  for (const bucket of GUEST_DOC_BUCKETS) {
    try {
      const objects = await listBucketObjects(bucket);
      const row = {
        total: objects.length,
        propertyScoped: 0,
        flat: 0,
        other: 0,
        samples: [] as string[],
      };
      for (const obj of objects) {
        const kind = classifyGuestDocKey(obj.path);
        if (kind === 'property_scoped') row.propertyScoped += 1;
        else if (kind === 'flat') row.flat += 1;
        else row.other += 1;
        if (row.samples.length < 5) row.samples.push(obj.path);
      }
      report[bucket] = row;
    } catch (err) {
      report[bucket] = {
        total: 0,
        propertyScoped: 0,
        flat: 0,
        other: 0,
        samples: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  if (asJson) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), url, report }, null, 2));
    return;
  }

  console.log(`\nGuest-doc storage key shapes — ${url}   ${new Date().toISOString()}\n`);
  for (const [bucket, row] of Object.entries(report)) {
    console.log(
      `${bucket}: ${row.total} objects — property-scoped ${row.propertyScoped}, flat ${row.flat}, other ${row.other}`
    );
    for (const sample of row.samples) {
      console.log(`  sample: ${sample}`);
    }
  }
  console.log('');
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function mb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function main() {
  if (keyShapesOnly) {
    await printGuestDocKeyShapes();
    return;
  }

  const stats: BucketStat[] = [];
  for (const bucket of MEDIA_BUCKETS) {
    try {
      const sizes = await listAll(bucket);
      sizes.sort((a, b) => a - b);
      stats.push({
        bucket,
        objects: sizes.length,
        totalBytes: sizes.reduce((a, b) => a + b, 0),
        p50: percentile(sizes, 50),
        p90: percentile(sizes, 90),
        p99: percentile(sizes, 99),
      });
    } catch (err) {
      stats.push({
        bucket,
        objects: 0,
        totalBytes: 0,
        p50: 0,
        p90: 0,
        p99: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (asJson) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), url, stats }, null, 2));
    return;
  }

  console.log(`\nStorage audit — ${url}   ${new Date().toISOString()}\n`);
  console.log(
    'bucket'.padEnd(30) +
      'objects'.padStart(9) +
      'total'.padStart(12) +
      'p50'.padStart(11) +
      'p90'.padStart(11) +
      'p99'.padStart(11)
  );
  console.log('-'.repeat(85));
  let grandTotal = 0;
  let grandCount = 0;
  for (const s of stats) {
    if (s.error) {
      console.log(`${s.bucket.padEnd(30)}  (skipped: ${s.error})`);
      continue;
    }
    grandTotal += s.totalBytes;
    grandCount += s.objects;
    console.log(
      s.bucket.padEnd(30) +
        String(s.objects).padStart(9) +
        mb(s.totalBytes).padStart(12) +
        mb(s.p50).padStart(11) +
        mb(s.p90).padStart(11) +
        mb(s.p99).padStart(11)
    );
  }
  console.log('-'.repeat(85));
  console.log(
    `${'TOTAL'.padEnd(30)}${String(grandCount).padStart(9)}${mb(grandTotal).padStart(12)}\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
