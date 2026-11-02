/**
 * Plan 02 §4.3 / §5.7 — read-only HTTP smoke against hosted fwor (no auth).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..', '..');
const FWOR_REF = 'fworvijbrwpyngycotbz';
const DEFAULT_ORIGIN = process.env.SMOKE_ORIGIN?.trim() || 'https://dev.kamehomes.space';

function loadAnonKey(): string {
  const devEnv = join(ROOT, 'ui', '.env.development.dev');
  if (!existsSync(devEnv)) throw new Error('ui/.env.development.dev missing');
  const line = readFileSync(devEnv, 'utf8')
    .split('\n')
    .find((l) => /^VITE_SUPABASE_ANON_KEY=/.test(l));
  if (!line) throw new Error('VITE_SUPABASE_ANON_KEY missing');
  return line
    .replace(/^VITE_SUPABASE_ANON_KEY=/, '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

async function getJson(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* plain */
  }
  return { status: res.status, body };
}

async function main() {
  const anon = loadAnonKey();
  const fnBase = `https://${FWOR_REF}.supabase.co/functions/v1`;
  const apikey = { apikey: anon, Authorization: `Bearer ${anon}` };

  const health = await getJson(
    `${fnBase}/resolve-booking-property?bookingId=00000000-0000-0000-0000-000000000000`,
    apikey
  );
  if (health.status !== 404 && health.status !== 400) {
    console.error('resolve-booking-property: expected 404/400 for unknown id, got', health.status);
    process.exit(1);
  }
  console.log('resolve-booking-property: reachable');

  const origin = await getJson(DEFAULT_ORIGIN, { Accept: 'text/html' });
  if (origin.status >= 500) {
    console.error('app origin:', DEFAULT_ORIGIN, 'status', origin.status);
    process.exit(1);
  }
  console.log(`app origin ${DEFAULT_ORIGIN}: ${origin.status}`);

  console.log('hosted-r3-smoke: ok');
}

main().catch((e) => {
  console.error('hosted-r3-smoke failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
