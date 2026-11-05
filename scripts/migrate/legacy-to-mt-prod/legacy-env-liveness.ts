/**
 * Plan 01 B-14 — harmless read-only API checks for legacy env backup (ok/fail only).
 *
 * Usage: bun scripts/migrate/legacy-to-mt-prod/legacy-env-liveness.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..', '..');
const ENV_PATH = join(ROOT, 'supabase', '.env.legacy-prod.local');

function parseEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (val) out[key] = val;
  }
  return out;
}

async function check(name: string, fn: () => Promise<boolean>) {
  try {
    const ok = await fn();
    console.log(`${name}: ${ok ? 'ok' : 'fail'}`);
  } catch {
    console.log(`${name}: fail`);
  }
}

const env = parseEnv();
if (!existsSync(ENV_PATH)) {
  console.error('missing supabase/.env.legacy-prod.local');
  process.exit(1);
}

console.log('legacy-env-liveness');

await check('RESEND_API_KEY', async () => {
  const key = env.RESEND_API_KEY;
  if (!key) return false;
  const res = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${key}` },
  });
  return res.ok;
});

await check('GROQ_API_KEY', async () => {
  const key = env.GROQ_API_KEY;
  if (!key) return false;
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  return res.ok;
});

await check('GEMINI_API_KEY', async () => {
  const key = env.GEMINI_API_KEY || env.GEMINI_API_KEYS?.split(/[,;\s]+/)[0];
  if (!key) return false;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  return res.ok;
});

for (const [label, tokenKey] of [
  ['TELEGRAM_ADMIN_BOT_TOKEN', 'TELEGRAM_ADMIN_BOT_TOKEN'],
  ['TELEGRAM_STAFF_BOT_TOKEN', 'TELEGRAM_STAFF_BOT_TOKEN'],
  ['TELEGRAM_FINANCE_BOT_TOKEN', 'TELEGRAM_FINANCE_BOT_TOKEN'],
  ['TELEGRAM_MAINTENANCE_BOT_TOKEN', 'TELEGRAM_MAINTENANCE_BOT_TOKEN'],
  ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_TOKEN'],
] as const) {
  await check(label, async () => {
    const token = env[tokenKey];
    if (!token) return false;
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    if (!res.ok) return false;
    const j = (await res.json()) as { ok?: boolean };
    return j.ok === true;
  });
}
