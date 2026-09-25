#!/usr/bin/env node
/**
 * AI gateway guard (docs/architecture/ai-platform.md). Every model call in the edge functions
 * must go through supabase/functions/_shared/ai/ (llmClient / llmTools / llmTransport), which
 * owns timeouts, retries, key handling, quota, metering and tracing. This fails when:
 *
 *  1. an AI provider host appears outside _shared/ai/ (a hand-rolled provider fetch), or
 *  2. a provider API key is put in a URL query string (`?key=` / `&key=`) anywhere.
 *
 * Tests (`*_test.ts`, `tests/`) are skipped — they may contain provider error fixtures.
 *
 * Exemption: geminiLiveEphemeral.ts mints a server-side ephemeral token only — the browser
 * then connects directly to Gemini Live over WebSocket (the API key never leaves the server,
 * but the Live traffic itself is not proxied through the gateway by design).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const FUNCTIONS = join(ROOT, 'supabase', 'functions');
const GATEWAY_DIR = join(FUNCTIONS, '_shared', 'ai') + sep;
const EXEMPT_FILES = [join(FUNCTIONS, '_shared', 'geminiLiveEphemeral.ts')];

const PROVIDER_HOSTS = [
  'generativelanguage.googleapis.com',
  'api.groq.com',
  'api.openai.com',
  'api.anthropic.com',
  'openrouter.ai',
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'tests' || entry.name === 'node_modules') continue;
      walk(path, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('_test.ts')) {
      out.push(path);
    }
  }
  return out;
}

const failures = [];
for (const file of walk(FUNCTIONS)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const inGateway = file.startsWith(GATEWAY_DIR) || EXEMPT_FILES.includes(file);
  lines.forEach((line, i) => {
    const where = `${relative(ROOT, file)}:${i + 1}`;
    if (!inGateway && PROVIDER_HOSTS.some((host) => line.includes(host))) {
      failures.push(`${where}  provider host outside _shared/ai/ — call the AI gateway instead`);
    }
    if (/[?&]key=\$\{/.test(line)) {
      failures.push(`${where}  API key in a URL query string — send it in a header`);
    }
  });
}

if (failures.length) {
  console.error('AI gateway guard failed:\n');
  for (const row of failures) console.error(`  ${row}`);
  process.exit(1);
}
console.log('AI gateway guard: all provider calls go through supabase/functions/_shared/ai/.');
