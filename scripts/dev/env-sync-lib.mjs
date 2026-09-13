/**
 * Shared helpers for UI / Supabase / Vercel env sync scripts.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Keys mirrored across UI files (ui/.env → ui/.env.development → ui/.env.development.dev). */
export const UI_SHARED_KEYS = [
  'VITE_POSTHOG_KEY',
  'VITE_POSTHOG_HOST',
  'VITE_TURNSTILE_SITE_KEY',
  'VITE_PLATFORM_APP_NAME',
  'VITE_PLATFORM_CONTACT_EMAIL',
  'VITE_VAPID_PUBLIC_KEY',
  'VITE_SUPER_ADMIN_EMAILS',
];

/** UI PostHog project key → Edge server-side PostHog. */
export const POSTHOG_UI_TO_EDGE = {
  VITE_POSTHOG_KEY: 'POSTHOG_API_KEY',
  VITE_POSTHOG_HOST: 'POSTHOG_HOST',
};

/** @param {string} raw */
export function parseEnvFile(raw) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    if (key) map.set(key, value);
  }
  return map;
}

/** @param {string} path */
export function readEnvFile(path) {
  if (!existsSync(path)) return new Map();
  return parseEnvFile(readFileSync(path, 'utf8'));
}

/** @param {Map<string, string>} map @param {string} key @param {string} value */
export function setIfMissing(map, key, value) {
  const cur = map.get(key)?.trim();
  if (!cur && value?.trim()) {
    map.set(key, value.trim());
    return 'added';
  }
  return null;
}

/** @param {Map<string, string>} map @param {string} key @param {string} value */
export function setAlways(map, key, value) {
  const v = value?.trim();
  if (!v) return null;
  const prev = map.get(key);
  if (prev === v) return null;
  map.set(key, v);
  return prev === undefined ? 'added' : 'updated';
}

/**
 * @param {string} path
 * @param {{ title: string; keys: string[] }[]} sections
 * @param {Map<string, string>} values
 * @param {boolean} dryRun
 */
export function writeSectionedEnvSync(path, sections, values, dryRun = false) {
  const used = new Set();
  const lines = [];
  for (const section of sections) {
    const entries = section.keys
      .map((key) => ({ key, value: values.get(key) }))
      .filter((e) => e.value !== undefined && e.value !== '');
    if (entries.length === 0) continue;
    lines.push('', `# ${section.title}`);
    for (const { key, value } of entries) {
      used.add(key);
      const needsQuotes = /[\s#"'\\]/.test(value) || value.includes(',');
      lines.push(needsQuotes ? `${key}='${value.replace(/'/g, "'\\''")}'` : `${key}=${value}`);
    }
  }
  const extras = [...values.keys()].filter((k) => !used.has(k)).sort();
  if (extras.length > 0) {
    lines.push('', '# Other');
    for (const key of extras) {
      const value = values.get(key) ?? '';
      const needsQuotes = /[\s#"'\\]/.test(value) || value.includes(',');
      lines.push(needsQuotes ? `${key}='${value.replace(/'/g, "'\\''")}'` : `${key}=${value}`);
    }
  }
  const body = `${lines.join('\n').replace(/^\n+/, '')}\n`;
  if (!dryRun) writeFileSync(path, body, 'utf8');
  return body;
}

/** @param {string} root */
export function loadVercelAuth(root) {
  const authPath = join(homedir(), 'Library/Application Support/com.vercel.cli/auth.json');
  if (!existsSync(authPath)) return null;
  try {
    const token = JSON.parse(readFileSync(authPath, 'utf8')).token?.trim();
    if (!token) return null;
    const projectPath = join(root, '.vercel/project.json');
    if (!existsSync(projectPath)) return null;
    const project = JSON.parse(readFileSync(projectPath, 'utf8'));
    return {
      token,
      projectId: project.projectId,
      teamId: project.orgId,
      projectName: project.projectName,
    };
  } catch {
    return null;
  }
}

/**
 * @param {{ token: string; projectId: string; teamId: string }} auth
 * @param {string} key
 * @param {string} value
 * @param {string[]} targets
 */
export async function vercelUpsertEnv(auth, key, value, targets) {
  const url = `https://api.vercel.com/v10/projects/${auth.projectId}/env?upsert=true&teamId=${auth.teamId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key,
      value,
      type: 'encrypted',
      target: targets,
    }),
  });
  const payload = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, payload };
}
