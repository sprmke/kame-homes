#!/usr/bin/env node
/**
 * AI companion conversation QA driver (Phase 0).
 *
 * Opens the local UI, signs in as the kame-home owner, sends corpus questions to the
 * dashboard assistant (sheet + AI mode) and optionally guest web chat, waits for the
 * terminal `blocks` SSE event, screenshots, and appends wall-clock + `turn_timing` to
 * a run ledger under docs/workflow/qa/ai-conversations/.
 *
 * Screenshots go to the gitignored folder ui/e2e/artifacts/ai-conversations/.
 *
 *   bun run qa:ai -- --run 0 --ids H-01,H-25          # sample
 *   bun run qa:ai -- --run 0 --surface ai --viewport 1440
 *   bun run qa:ai -- --run 0 --all                    # full corpus (slow, live tokens)
 *   bun run qa:ai -- --run 4 --briefing --surface ai --viewport 1440
 *   bun run qa:ai -- --run 3 --surface voice --viewport 375 --ids G-01,G-12,G-23
 *
 * Requires: local stack (`./dev.sh`), `bun run seed:ai-qa`, Gemini keys, Playwright browsers.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, appendFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CORPUS = resolve(ROOT, 'docs/workflow/qa/ai-conversations/corpus-v1.json');
const LEDGER_DIR = resolve(ROOT, 'docs/workflow/qa/ai-conversations');
const ARTIFACT_DIR = resolve(ROOT, 'ui/e2e/artifacts/ai-conversations');

const UI = process.env.AI_QA_UI ?? 'http://localhost:5173';
const AUTH = process.env.AI_QA_AUTH ?? 'http://127.0.0.1:54321';
const ANON =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SRK =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const EMAIL = process.env.AI_QA_EMAIL ?? 'sprmke.dev@gmail.com';
const GUEST_EMAIL = process.env.AI_QA_GUEST_EMAIL ?? 'ai-qa-guest@example.test';
const MEMBER_EMAIL = process.env.AI_QA_MEMBER_EMAIL ?? 'ai-qa-member@example.test';
const ORG = process.env.AI_QA_ORG ?? 'kame-home';
const PROPERTY = process.env.AI_QA_PROPERTY ?? 'monaco-2612';
const PROPERTY_SLUG = process.env.AI_QA_PUBLIC_SLUG ?? 'monaco-2612';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = args[i + 1];
  if (!next || next.startsWith('--')) return true;
  return next;
};

const RUN_ID = String(flag('run', '0'));
const SURFACE = String(flag('surface', 'ai')); // ai | sheet | guest | voice
const isGuestSurface = SURFACE === 'guest' || SURFACE === 'voice';
const VIEWPORT = String(flag('viewport', '1440')); // 1440 | 768 | 375
const ALL = Boolean(flag('all', false));
const BRIEFING = Boolean(flag('briefing', false));
const IDS = flag('ids', null) ? String(flag('ids')).split(',').map((s) => s.trim()) : null;
const TIMEOUT_MS = Number(flag('timeout', 90_000));
let guestConversationId = null;
const PAGE_ERRORS = [];

const VIEWPORTS = {
  1440: { width: 1440, height: 900 },
  768: { width: 768, height: 1024 },
  375: { width: 375, height: 812 },
};

function parseSseData(payload) {
  const lines = String(payload)
    .split('\n')
    .filter((line) => line.startsWith('data:'));
  const out = [];
  for (const line of lines) {
    const raw = line.slice(5).trim();
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      /* ignore keep-alives */
    }
  }
  return out;
}

async function ensureAuthUser(email) {
  const created = await fetch(`${AUTH}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, email_confirm: true, password: 'AiQa-Guest-Aa1!' }),
  });
  const json = await created.json();
  if (json?.id) return json.id;
  const list = await fetch(`${AUTH}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
  });
  const payload = await list.json();
  const users = payload?.users ?? payload ?? [];
  const found = Array.isArray(users) ? users.find((row) => row.email === email) : null;
  if (!found?.id) {
    throw new Error(`ensureAuthUser failed for ${email}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return found.id;
}

async function magicLinkSession(email = EMAIL) {
  const linkRes = await fetch(`${AUTH}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'magiclink', email }),
  });
  const link = await linkRes.json();
  const token = link.hashed_token;
  if (!token) throw new Error(`generate_link failed: ${JSON.stringify(link).slice(0, 300)}`);
  const verify = await fetch(`${AUTH}/auth/v1/verify?token=${token}&type=magiclink`, {
    headers: { apikey: ANON },
    redirect: 'manual',
  });
  const loc = verify.headers.get('location') || '';
  const hash = new URLSearchParams(loc.split('#')[1] || '');
  const access = hash.get('access_token');
  if (!access) throw new Error(`verify failed: ${loc.slice(0, 200)}`);
  const userRes = await fetch(`${AUTH}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${access}`, apikey: ANON },
  });
  const user = await userRes.json();
  return {
    access_token: access,
    refresh_token: hash.get('refresh_token'),
    expires_at: Number(hash.get('expires_at')),
    expires_in: Number(hash.get('expires_in')),
    token_type: 'bearer',
    user,
  };
}

function hostUrl(surface) {
  const base = `${UI}/org/${ORG}/property/${PROPERTY}`;
  return surface === 'ai' ? `${base}?mode=ai` : `${base}?mode=advanced`;
}

function guestUrl() {
  return `${UI}/properties/${PROPERTY_SLUG}/messages?checkInDate=2026-12-24&checkOutDate=2026-12-26`;
}

function blockTypes(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((block) => block?.type).filter(Boolean);
}

function pickQuestions(corpus) {
  const hostable = corpus.filter((row) => row.surface === 'host' && !row.skip);
  const guestable = corpus.filter(
    (row) => (row.surface === 'guest' || row.surface === 'guest-ux') && !row.skip
  );
  if (IDS) return corpus.filter((row) => IDS.includes(row.id));
  if (ALL) {
    if (SURFACE === 'voice') return guestable.filter((row) => !row.uxCheck);
    return SURFACE === 'guest' ? guestable : hostable;
  }
  // Default sample: one question from the first few groups so a smoke run is cheap.
  const sampleIds =
    SURFACE === 'guest' || SURFACE === 'voice'
      ? SURFACE === 'voice'
        ? ['G-01', 'G-12', 'G-23']
        : ['G-01', 'G-12', 'G-27']
      : ['H-01', 'H-07', 'H-25', 'H-38'];
  return corpus.filter((row) => sampleIds.includes(row.id));
}

function composerLocator(page) {
  if (SURFACE === 'sheet') {
    return page
      .getByRole('dialog', { name: 'AI Assistant' })
      .getByTestId('assistant-composer')
      .first();
  }
  return page.getByTestId('assistant-composer').first();
}

async function dumpAiModeFail(page, label) {
  const dir = resolve(ARTIFACT_DIR, `run-${RUN_ID}`, SURFACE, VIEWPORT);
  mkdirSync(dir, { recursive: true });
  const failPath = resolve(dir, '_ai-mode-fail.png');
  await page.screenshot({ path: failPath, fullPage: true });
  const snippet = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400);
  const root = (await page.locator('#root').innerHTML().catch(() => '')).replace(/\s+/g, ' ').slice(0, 240);
  const html = (await page.content().catch(() => '')).replace(/\s+/g, ' ').slice(0, 360);
  const mode = await page
    .locator('[data-dashboard-mode]')
    .first()
    .getAttribute('data-dashboard-mode', { timeout: 3_000 })
    .catch(() => 'unknown');
  throw new Error(
    `${label} (mode=${mode}) at ${page.url()} (${snippet || `empty body root=${root || 'empty'}`}) html=${html} js=${PAGE_ERRORS.slice(-6).join(' | ')}. screenshot ${failPath.replace(`${ROOT}/`, '')}`
  );
}

async function waitForDashboardShell(page) {
  try {
    await page.locator('[data-dashboard-mode]').first().waitFor({ timeout: 60_000 });
    return true;
  } catch {
    return false;
  }
}

async function ensureAiMode(page) {
  const shell = page.locator('[data-dashboard-mode="ai"]');
  try {
    await page.locator('[data-dashboard-mode]').first().waitFor({ timeout: 45_000 });
  } catch {
    await dumpAiModeFail(page, 'dashboard mode shell missing');
  }
  // Phone layout keeps a compact header switch; the desktop sidebar toggle is `display:none`
  // and `.first()` would match that hidden node. If the shell is already AI, skip the toggle.
  if ((await shell.count()) > 0) {
    await page.waitForTimeout(400);
    if ((await shell.count()) > 0) return;
  }
  const row = page.locator('[data-testid="dashboard-mode-toggle"]').locator('visible=true').first();
  try {
    await row.waitFor({ state: 'visible', timeout: 20_000 });
  } catch {
    await dumpAiModeFail(page, 'AI mode toggle missing');
  }
  const inner = row.locator('[role="switch"]').first();
  const turnOn = async () => {
    const checked = await inner.getAttribute('aria-checked', { timeout: 5_000 }).catch(() => 'false');
    if (checked === 'true') return;
    await inner.click({ timeout: 8_000 }).catch(async () => {
      await page.keyboard.press('Meta+j');
      await page.keyboard.press('Control+j');
    });
  };
  await turnOn();
  try {
    await shell.waitFor({ timeout: 20_000 });
  } catch {
    await turnOn();
    try {
      await shell.waitFor({ timeout: 15_000 });
    } catch {
      await dumpAiModeFail(page, 'AI mode shell missing after toggle');
    }
  }
  // Prefs GET can still clobber a first paint; re-assert after it lands.
  await page.waitForTimeout(1_500);
  if ((await shell.count()) === 0) {
    await turnOn();
    try {
      await shell.waitFor({ timeout: 15_000 });
    } catch {
      await dumpAiModeFail(page, 'AI mode dropped after preferences load');
    }
  }
}

async function sendHostQuestion(page, question, { continueThread = false } = {}) {
  await recoverHostPage(page);
  await dismissBlockingOverlays(page);
  await ensureSheetComposer(page);
  if (SURFACE === 'ai') {
    await ensureAiMode(page);
    if (!continueThread) {
      const newChat = page.getByRole('button', { name: 'New chat' }).locator('visible=true').first();
      if (await newChat.isVisible().catch(() => false)) {
        await newChat.click();
        await page.waitForTimeout(400);
      }
    }
  }
  const stop = page.getByRole('button', { name: 'Stop response' }).locator('visible=true').first();
  if (await stop.isVisible().catch(() => false)) {
    await stop.click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
  const composer = composerLocator(page);
  await composer.waitFor({ state: 'visible', timeout: 30_000 });
  await dismissBlockingOverlays(page);
  await composer.evaluate((el) => {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    el.focus();
  });
  if (question.needsAttachment) {
    const receipt = receiptFixturePath();
    const imageInput = page.locator('input[type="file"][accept*="image"]').first();
    await imageInput.setInputFiles(receipt);
    await page.waitForTimeout(400);
  }
  await composer.fill(question.message);
  const send =
    SURFACE === 'sheet'
      ? page.getByRole('dialog', { name: 'AI Assistant' }).getByRole('button', { name: 'Send message' }).first()
      : page.getByRole('button', { name: 'Send message' }).locator('visible=true').first();
  const enabledUntil = Date.now() + 20_000;
  while (Date.now() < enabledUntil) {
    await dismissBlockingOverlays(page);
    const ready = await send.isEnabled().catch(() => false);
    if (ready) break;
    await page.waitForTimeout(250);
  }
  await dismissBlockingOverlays(page);
  await page.evaluate(() => {
    window.__aiQaEvents = [];
    window.__aiQaFetches = [];
  });
  const started = Date.now();
  await composer.press('Enter');
  const captured = { timing: null, blocks: null, error: null };
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const ev = await page.evaluate(() => {
      const q = window.__aiQaEvents || [];
      window.__aiQaEvents = [];
      return q;
    });
    for (const event of ev) {
      if (event.type === 'turn_timing') captured.timing = event.timing ?? event;
      if (event.type === 'blocks') captured.blocks = event.blocks ?? event;
      if (event.type === 'error') captured.error = event;
    }
    if (captured.blocks || captured.error) break;
    await page.waitForTimeout(250);
  }
  const wallMs = Date.now() - started;
  if (!captured.blocks && !captured.error) {
    const debug = await page.evaluate(() => ({
      fetches: window.__aiQaFetches || [],
      events: window.__aiQaEvents || [],
      mode: document.querySelector('[data-dashboard-mode]')?.getAttribute('data-dashboard-mode'),
    }));
    captured.error = {
      type: 'timeout',
      message: `no blocks event in ${TIMEOUT_MS}ms mode=${debug.mode} fetches=${JSON.stringify(debug.fetches).slice(0, 400)}`,
    };
  }
  const proposed = blockTypes(captured.blocks).includes('action_confirmation');
  if (proposed && !captured.error) {
    const confirmBtn = page.getByRole('button', { name: 'Confirm' }).locator('visible=true').last();
    if (await confirmBtn.isVisible().catch(() => false)) {
      process.stdout.write('(confirm) ');
      await confirmBtn.click();
      const confirmUntil = Date.now() + 30_000;
      while (Date.now() < confirmUntil) {
        const ev = await page.evaluate(() => {
          const q = window.__aiQaEvents || [];
          window.__aiQaEvents = [];
          return q;
        });
        for (const event of ev) {
          if (event.type === 'blocks') captured.blocks = event.blocks ?? event;
        }
        const stillProposed = await page.getByRole('button', { name: 'Cancel' }).locator('visible=true').count();
        if (stillProposed === 0) break;
        await page.waitForTimeout(250);
      }
      await page.getByText('Suggestions').last().waitFor({ timeout: 5_000 }).catch(() => undefined);
      const done = page.getByText('Done.').last();
      if (await done.isVisible().catch(() => false)) {
        await done.scrollIntoViewIfNeeded().catch(() => undefined);
      }
      await page.waitForTimeout(400);
    }
  }
  return { wallMs, ...captured };
}

function receiptFixturePath() {
  const dir = resolve(ROOT, 'scripts/dev/fixtures');
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, 'ai-qa-receipt.png');
  if (!existsSync(path)) {
    writeFileSync(
      path,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FAP5IDveIWwQDgAAAABJRU5ErkJggg==',
        'base64'
      )
    );
  }
  return path;
}

async function ensureGuestComposer(page) {
  const box = page.getByRole('textbox', { name: 'Message' });
  for (let attempt = 0; attempt < 4; attempt++) {
    const visible = await box.isVisible().catch(() => false);
    if (visible) return;
    const startFailed =
      (await page.getByText('Request failed').count()) > 0 ||
      (await page.getByText('Too many requests').count()) > 0;
    if (!startFailed && attempt === 0) {
      try {
        await box.waitFor({ timeout: 20_000 });
        return;
      } catch {
        /* reload below */
      }
    }
    process.stdout.write(attempt === 0 ? '(composer) ' : '(reload) ');
    await resetGuestChatStartLimits();
    const retry = page.getByRole('button', { name: 'Try again' });
    if (await retry.isVisible().catch(() => false)) {
      await retry.click().catch(() => undefined);
      try {
        await box.waitFor({ timeout: 20_000 });
        return;
      } catch {
        /* goto below */
      }
    }
    await page.waitForTimeout(2_000 * (attempt + 1));
    await page.goto(guestUrl(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  }
  await dumpGuestComposerFail(page, 'textbox "Message" not found after reloads');
}

async function waitForGuestAutomated(page, guestMsg, guestWaitMs) {
  const deadline = Date.now() + guestWaitMs;
  while (Date.now() < deadline) {
    const auto = page.locator('text=Automated').last();
    const autoVisible = await auto.isVisible().catch(() => false);
    const guestBox = await guestMsg.boundingBox().catch(() => null);
    const autoBox = autoVisible ? await auto.boundingBox().catch(() => null) : null;
    if (autoBox && guestBox && autoBox.y + 4 >= guestBox.y) return true;
    if (autoBox && !guestBox) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

let voiceTurnsInSession = 0;
const VOICE_TURNS_BEFORE_RESTART = 20;

async function closeVoiceBooth(page) {
  const end = page.getByRole('button', { name: 'End call' });
  if (await end.isVisible().catch(() => false)) {
    await end.click().catch(() => undefined);
  }
  const done = page.getByRole('button', { name: 'Done' });
  if (await done.isVisible().catch(() => false)) {
    await done.click().catch(() => undefined);
  }
  await page.getByRole('region', { name: 'Voice receptionist' }).waitFor({
    state: 'hidden',
    timeout: 8_000,
  }).catch(() => undefined);
}

async function openVoiceBoothFromMenu(page) {
  const booth = page.getByRole('region', { name: 'Voice receptionist' });
  await ensureGuestComposer(page);
  await page.getByRole('button', { name: 'Chat options' }).click();
  const talk = page.getByRole('option', { name: 'Talk to receptionist' }).or(
    page.getByRole('menuitem', { name: 'Talk to receptionist' })
  ).or(page.getByRole('button', { name: 'Talk to receptionist' }));
  try {
    await talk.first().click({ timeout: 8_000 });
  } catch {
    const dir = resolve(ARTIFACT_DIR, `run-${RUN_ID}`, SURFACE, VIEWPORT);
    mkdirSync(dir, { recursive: true });
    const failPath = resolve(dir, '_voice-menu-fail.png');
    await page.screenshot({ path: failPath, fullPage: true }).catch(() => undefined);
    const snippet = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 400);
    throw new Error(
      `Talk to receptionist not in Chat options (${snippet}). screenshot ${failPath.replace(`${ROOT}/`, '')}`
    );
  }
  await booth.waitFor({ state: 'visible', timeout: 20_000 });
  await page.getByRole('button', { name: 'Start call' }).click();
}

async function ensureVoiceBooth(page, { forceNew = false } = {}) {
  const booth = page.getByRole('region', { name: 'Voice receptionist' });
  const boothVisible = await booth.isVisible().catch(() => false);
  const ended =
    (await page.getByText('Call ended').count()) > 0 ||
    (await page.getByText('Ending call').count()) > 0;
  const issue =
    (await page.getByText('Connection issue').count()) > 0 ||
    (await page.getByText('Voice service is unavailable').count()) > 0;
  if (forceNew || ended) {
    await resetVoiceHealthCircuit();
    if (boothVisible) {
      const retry = page.getByRole('button', { name: 'Retry' });
      if (await retry.isVisible().catch(() => false)) {
        await retry.click();
      } else {
        await closeVoiceBooth(page);
        const start = page.getByRole('button', { name: 'Start call' });
        if (await start.isVisible().catch(() => false)) {
          await start.click();
        } else {
          await openVoiceBoothFromMenu(page);
        }
      }
    } else {
      await openVoiceBoothFromMenu(page);
    }
  } else if (!boothVisible) {
    await openVoiceBoothFromMenu(page);
  } else {
    const retry = page.getByRole('button', { name: 'Retry' });
    const start = page.getByRole('button', { name: 'Start call' });
    if (await retry.isVisible().catch(() => false) || issue) {
      if (await retry.isVisible().catch(() => false)) await retry.click();
      else await start.click().catch(() => undefined);
    } else if (await start.isVisible().catch(() => false)) {
      await start.click();
    }
  }
  const readyUntil = Date.now() + 45_000;
  let retried = false;
  while (Date.now() < readyUntil) {
    const hooked = await page.evaluate(() => typeof window.__aiQaVoiceSend === 'function');
    const live =
      (await page.getByText('Listening').count()) > 0 ||
      (await page.getByText('Thinking').count()) > 0 ||
      (await page.getByText('Speaking').count()) > 0 ||
      (await page.getByText("You're speaking").count()) > 0 ||
      (await page.getByText('Looking that up').count()) > 0;
    if (hooked && live) return;
    const failed =
      (await page.getByText('Connection issue').count()) > 0 ||
      (await page.getByText('Voice service is unavailable').count()) > 0;
    if (failed && !retried) {
      retried = true;
      const retry = page.getByRole('button', { name: 'Retry' });
      if (await retry.isVisible().catch(() => false)) {
        await retry.click();
        await page.waitForTimeout(250);
        continue;
      }
      const dir = resolve(ARTIFACT_DIR, `run-${RUN_ID}`, SURFACE, VIEWPORT);
      mkdirSync(dir, { recursive: true });
      const failPath = resolve(dir, '_voice-connect-fail.png');
      await page.screenshot({ path: failPath, fullPage: true }).catch(() => undefined);
      const alert = (await page.getByRole('alert').innerText().catch(() => '')).replace(/\s+/g, ' ');
      const snippet = (await booth.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 400);
      throw new Error(
        `voice booth failed to connect${alert ? ` (${alert})` : ''}: ${snippet}. screenshot ${failPath.replace(`${ROOT}/`, '')}`
      );
    }
    await page.waitForTimeout(250);
  }
  throw new Error('voice booth Listening not ready');
}

async function sendVoiceQuestion(page, question) {
  if (question.uxCheck) {
    return {
      wallMs: 0,
      timing: null,
      blocks: null,
      error: { type: 'skip', message: 'UX checks are web chat only' },
    };
  }
  if (voiceTurnsInSession >= VOICE_TURNS_BEFORE_RESTART) {
    process.stdout.write('(new call) ');
    await ensureVoiceBooth(page, { forceNew: true });
    voiceTurnsInSession = 0;
  } else {
    try {
      await ensureVoiceBooth(page);
    } catch {
      process.stdout.write('(reopen) ');
      await ensureVoiceBooth(page, { forceNew: true });
      voiceTurnsInSession = 0;
    }
  }
  const panel = page.getByRole('region', { name: 'Voice receptionist' });
  const beforeAssistant = ((await panel.locator('.self-start').last().innerText().catch(() => '')) || '').trim();
  const started = Date.now();
  const sent = await page.evaluate((text) => {
    const send = window.__aiQaVoiceSend;
    return typeof send === 'function' ? send(text) : false;
  }, question.message);
  if (!sent) {
    return {
      wallMs: Date.now() - started,
      timing: null,
      blocks: null,
      error: { type: 'exception', message: 'voice send hook not ready' },
    };
  }
  const waitMs = Math.min(Math.max(TIMEOUT_MS, 20_000), 45_000);
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const assistant = ((await panel.locator('.self-start').last().innerText().catch(() => '')) || '').trim();
    if (assistant && assistant !== beforeAssistant) {
      const settleUntil = Date.now() + 8_000;
      while (Date.now() < settleUntil) {
        if ((await page.getByText('Listening').count()) > 0) break;
        await page.waitForTimeout(250);
      }
      voiceTurnsInSession += 1;
      return { wallMs: Date.now() - started, timing: null, blocks: null, error: null };
    }
    await page.waitForTimeout(250);
  }
  voiceTurnsInSession = VOICE_TURNS_BEFORE_RESTART;
  return {
    wallMs: Date.now() - started,
    timing: null,
    blocks: null,
    error: { type: 'timeout', message: `no voice caption in ${waitMs}ms` },
  };
}

async function sendGuestQuestion(page, question) {
  if (question.uxCheck) return sendGuestUxCheck(page, question);
  await ensureGuestComposer(page);
  const box = page.getByRole('textbox', { name: 'Message' });
  const sendBtn = page.getByRole('button', { name: 'Send message' });
  const guestWaitMs = Math.min(Math.max(TIMEOUT_MS, 20_000), 120_000);
  await box.fill(question.message);
  const started = Date.now();
  // Inlined auto-reply holds isBusy, so Send stays disabled until the prior POST returns.
  await sendBtn.click({ timeout: guestWaitMs });
  const guestMsg = page.getByText(question.message, { exact: true }).last();
  try {
    await guestMsg.waitFor({ timeout: 20_000 });
  } catch {
    return {
      wallMs: Date.now() - started,
      timing: null,
      blocks: null,
      error: { type: 'timeout', message: 'guest message not in thread' },
    };
  }
  const gotReply = await waitForGuestAutomated(page, guestMsg, guestWaitMs);
  if (!gotReply) {
    return {
      wallMs: Date.now() - started,
      timing: null,
      blocks: null,
      error: { type: 'timeout', message: `no Automated guest reply in ${guestWaitMs}ms` },
    };
  }
  return { wallMs: Date.now() - started, timing: null, blocks: null, error: null };
}

async function sendGuestUxCheck(page, question) {
  await ensureGuestComposer(page);
  const box = page.getByRole('textbox', { name: 'Message' });
  const sendBtn = page.getByRole('button', { name: 'Send message' });
  const guestWaitMs = Math.min(Math.max(TIMEOUT_MS, 20_000), 120_000);
  const started = Date.now();
  const sendAndWait = async (text) => {
    await box.fill(text);
    await sendBtn.click({ timeout: guestWaitMs });
    const guestMsg = page.getByText(text, { exact: true }).last();
    await guestMsg.waitFor({ timeout: 20_000 });
    const ok = await waitForGuestAutomated(page, guestMsg, guestWaitMs);
    if (!ok) throw new Error(`no Automated guest reply in ${guestWaitMs}ms`);
    return guestMsg;
  };

  try {
    if (question.id === 'G-44') {
      await sendAndWait('What time is check-in and check-out?');
      const secondStarted = Date.now();
      await sendAndWait('How many guests can stay?');
      const gapMs = Date.now() - secondStarted;
      if (gapMs > 90_000) throw new Error(`second reply took ${gapMs}ms (over 90s)`);
    } else if (question.id === 'G-45') {
      await box.fill('What time is check-in and check-out?');
      const typing = page.getByText('Assistant is typing…');
      const seenTyping = typing.waitFor({ state: 'visible', timeout: 15_000 });
      await sendBtn.click({ timeout: guestWaitMs });
      await seenTyping;
    } else if (question.id === 'G-46') {
      await sendAndWait('What time is check-in and check-out?');
      const follow = page.getByRole('region', { name: 'Follow-up' });
      await follow.waitFor({ state: 'visible', timeout: 8_000 });
      await page.getByRole('button', { name: 'Talk to the host' }).waitFor({
        state: 'visible',
        timeout: 4_000,
      });
    } else if (question.id === 'G-47') {
      await sendAndWait('What time is check-in and check-out?');
      const desktop = page.getByRole('button', { name: 'Not helpful' }).last();
      if (await desktop.isVisible().catch(() => false)) {
        await desktop.click();
        const pressed = await desktop.getAttribute('aria-pressed');
        if (pressed !== 'true') throw new Error('thumbs down did not stay pressed');
      } else {
        await page.getByRole('button', { name: 'Message actions' }).last().click();
        await page.getByRole('menuitem', { name: 'Not helpful' }).click();
      }
    } else if (question.id === 'G-48') {
      const deadline = Date.now() + 15_000;
      while (!guestConversationId && Date.now() < deadline) {
        await page.waitForTimeout(150);
      }
      if (!guestConversationId) throw new Error('guest conversation id missing');
      await exhaustGuestAutoReplyBudget(guestConversationId);
      await resetBudgetExhaustedNotice(guestConversationId);
      const prompt = 'What time is check-in and check-out?';
      await box.fill(prompt);
      await sendBtn.click({ timeout: guestWaitMs });
      const guestMsg = page.getByText(prompt, { exact: true }).last();
      await guestMsg.waitFor({ timeout: 20_000 });
      const noticeLine =
        'The assistant has reached its reply limit for now. The host will reply soon.';
      const notice = page.getByText(noticeLine).last();
      const until = Date.now() + 20_000;
      let placed = false;
      while (Date.now() < until) {
        const noticeBox = await notice.boundingBox().catch(() => null);
        const guestBox = await guestMsg.boundingBox().catch(() => null);
        if (noticeBox && guestBox && noticeBox.y + 4 >= guestBox.y) {
          placed = true;
          break;
        }
        await page.waitForTimeout(250);
      }
      if (!placed) throw new Error('budget-exhausted line not shown after this send');
    } else {
      throw new Error(`unknown guest UX check ${question.id}`);
    }
    return { wallMs: Date.now() - started, timing: null, blocks: null, error: null };
  } catch (err) {
    return {
      wallMs: Date.now() - started,
      timing: null,
      blocks: null,
      error: { type: 'ux', message: err instanceof Error ? err.message : String(err) },
    };
  }
}

async function exhaustGuestAutoReplyBudget(conversationId) {
  const windowSec = 3600;
  const windowStart = new Date(
    Math.floor(Date.now() / (windowSec * 1000)) * windowSec * 1000
  ).toISOString();
  // Local functions serve sets INBOX_AUTO_REPLY_PER_CONVERSATION_PER_HOUR=80 so a
  // full guest corpus on one thread is not cut off. Production stays at 10.
  const envLimit = Number(process.env.INBOX_AUTO_REPLY_PER_CONVERSATION_PER_HOUR);
  const limit = Number.isFinite(envLimit) && envLimit > 0 ? Math.min(Math.floor(envLimit), 200) : 80;
  const bumps = limit + 2;
  let lastCount = 0;
  for (let i = 0; i < bumps; i++) {
    const res = await fetch(`${AUTH}/rest/v1/rpc/bump_rate_limit`, {
      method: 'POST',
      headers: {
        apikey: SRK,
        Authorization: `Bearer ${SRK}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_scope: 'inbox-auto-reply',
        p_identity: `conv:${conversationId}`,
        p_window_start: windowStart,
      }),
    });
    if (!res.ok) {
      throw new Error(`bump_rate_limit ${res.status}`);
    }
    const body = await res.json().catch(() => null);
    lastCount = typeof body === 'number' ? body : Number(body ?? 0);
  }
  if (!Number.isFinite(lastCount) || lastCount <= limit) {
    throw new Error(
      `auto-reply budget still open after ${bumps} bumps (count=${lastCount}, limit=${limit}, conv=${conversationId})`
    );
  }
}

async function resetBudgetExhaustedNotice(conversationId) {
  const identity = `conv:${conversationId}`;
  const res = await fetch(
    `${AUTH}/rest/v1/request_rate_limits?scope=eq.inbox-auto-reply-budget-notice&identity=eq.${encodeURIComponent(identity)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: SRK,
        Authorization: `Bearer ${SRK}`,
        Prefer: 'return=minimal',
      },
    }
  );
  if (!res.ok) {
    throw new Error(`reset budget notice ${res.status}`);
  }
}

async function resetQaRateLimits(scopes) {
  await Promise.all(
    scopes.map((scope) =>
      fetch(`${AUTH}/rest/v1/request_rate_limits?scope=eq.${encodeURIComponent(scope)}`, {
        method: 'DELETE',
        headers: {
          apikey: SRK,
          Authorization: `Bearer ${SRK}`,
          Prefer: 'return=minimal',
        },
      })
    )
  );
}

async function resetGuestChatStartLimits() {
  await resetQaRateLimits([
    'guest-web-chat-start',
    'guest-web-chat-resume',
    'guest-web-chat-messages',
    'voice-receptionist-start',
    'inbox-auto-reply',
    'inbox-auto-reply-budget-notice',
  ]);
}

/** Local only. A failed mint opens a 5-minute unhealthy circuit and hides Talk to receptionist. */
async function resetVoiceHealthCircuit() {
  const res = await fetch(`${AUTH}/rest/v1/ai_platform_global_settings?id=eq.1`, {
    method: 'PATCH',
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      voice_receptionist_health_status: 'unknown',
      voice_receptionist_health_checked_at: null,
    }),
  });
  if (!res.ok) {
    throw new Error(`reset voice health ${res.status}`);
  }
}

async function dumpGuestComposerFail(page, message) {
  const dir = resolve(ARTIFACT_DIR, `run-${RUN_ID}`, SURFACE, VIEWPORT);
  mkdirSync(dir, { recursive: true });
  const failPath = resolve(dir, '_guest-composer-fail.png');
  await page.screenshot({ path: failPath, fullPage: true }).catch(() => undefined);
  const snippet = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 400);
  throw new Error(`${message} at ${page.url()} (${snippet}). screenshot ${failPath.replace(`${ROOT}/`, '')}`);
}

async function captureBriefing(page) {
  const started = Date.now();
  await ensureAiMode(page);
  const newChat = page.getByRole('button', { name: 'New chat' }).locator('visible=true').first();
  if (await newChat.isVisible().catch(() => false)) {
    await newChat.click();
  }
  const root = page.locator('[data-testid="assistant-briefing"]');
  await root.waitFor({ state: 'visible', timeout: 20_000 });
  const loading = root.getByLabel('Loading');
  await loading.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined);
  await loading.waitFor({ state: 'hidden', timeout: 25_000 });
  const cards = root.getByLabel('Needs attention');
  try {
    await cards.waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    throw new Error(
      'Briefing cards did not hydrate. Re-run bun run seed:ai-qa and confirm dashboard-assistant-briefing returns cards.'
    );
  }
  const shot = screenshotPath({ id: 'B-01' });
  await page.screenshot({ path: shot, fullPage: false });
  appendLedger({
    id: 'B-01',
    wallMs: Date.now() - started,
    timing: null,
    blocks: [{ type: 'briefing' }],
    error: null,
    screenshot: shot.replace(`${ROOT}/`, ''),
  });
  console.log(`ok  ${Date.now() - started}ms  [briefing]`);
}

function screenshotPath(question) {
  const dir = resolve(ARTIFACT_DIR, `run-${RUN_ID}`, SURFACE, VIEWPORT);
  mkdirSync(dir, { recursive: true });
  return resolve(dir, `${question.id}.png`);
}

function appendLedger(row) {
  mkdirSync(LEDGER_DIR, { recursive: true });
  const path = resolve(LEDGER_DIR, `run-${RUN_ID}.md`);
  if (!existsSync(path)) {
    writeFileSync(
      path,
      `# QA run ${RUN_ID}\n\nGenerated by \`scripts/dev/ai-qa-run.mjs\`. Score the screenshots against the rubric in README.md.\n\n| id | surface | viewport | wall_ms | total_ms | preload | model | tools | synth | guard | blocks | error | screenshot |\n| -- | ------- | -------- | ------- | -------- | ------- | ----- | ----- | ----- | ----- | ------ | ----- | ---------- |\n`
    );
  }
  const t = row.timing || {};
  const line = `| ${row.id} | ${SURFACE} | ${VIEWPORT} | ${row.wallMs ?? ''} | ${t.total_ms ?? ''} | ${t.preload_ms ?? ''} | ${(t.model_ms || []).reduce((a, b) => a + b, 0) || ''} | ${((t.tools_ms || []).reduce((a, b) => a + (b.ms || 0), 0)) || ''} | ${t.synth_ms ?? ''} | ${t.guard_ms ?? ''} | ${(row.blockTypes || []).join(', ')} | ${row.error ? String(row.error.message || row.error.type || 'error').replace(/\|/g, '/') : ''} | \`${row.screenshot}\` |\n`;
  appendFileSync(path, line);
}

async function installSseTap(page) {
  await page.addInitScript(() => {
    window.__aiQaEvents = [];
    const Orig = window.EventSource;
    if (!Orig) return;
    window.EventSource = class extends Orig {
      constructor(url, config) {
        super(url, config);
        this.addEventListener('message', (ev) => {
          try {
            const parsed = JSON.parse(ev.data);
            if (parsed && parsed.type) window.__aiQaEvents.push(parsed);
          } catch {
            /* ignore */
          }
        });
      }
    };
    window.__aiQaFetches = [];
    const origFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const res = await origFetch(...args);
      const url = String(args[0] ?? '');
      const ct = res.headers.get('content-type') || '';
      if (url.includes('dashboard-assistant-chat')) {
        window.__aiQaFetches.push({ status: res.status, ct, url: url.slice(-80) });
        if (ct.includes('application/json')) {
          const clone = res.clone();
          clone
            .json()
            .then((json) => {
              const blocks = json?.data?.blocks ?? json?.blocks;
              if (Array.isArray(blocks)) window.__aiQaEvents.push({ type: 'blocks', blocks });
              if (json?.error || json?.success === false) {
                window.__aiQaEvents.push({ type: 'error', message: json.error || 'request failed' });
              }
            })
            .catch(() => undefined);
          return res;
        }
      }
      if (!url.includes('dashboard-assistant-chat') || !ct.includes('text/event-stream')) return res;
      const clone = res.clone();
      (async () => {
        const reader = clone.body?.getReader();
        if (!reader) return;
        const dec = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop() ?? '';
          for (const part of parts) {
            for (const line of part.split('\n')) {
              if (!line.startsWith('data:')) continue;
              try {
                const parsed = JSON.parse(line.slice(5).trim());
                if (parsed && parsed.type) window.__aiQaEvents.push(parsed);
              } catch {
                /* ignore */
              }
            }
          }
        }
      })();
      return res;
    };
  });
}

async function fetchOrgId() {
  const res = await fetch(`${AUTH}/rest/v1/organizations?slug=eq.${ORG}&select=id`, {
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
  });
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows[0]?.id ?? null : null;
}

async function fetchPropertyId() {
  const res = await fetch(`${AUTH}/rest/v1/properties?slug=eq.${PROPERTY}&select=id`, {
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
  });
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows[0]?.id ?? null : null;
}

/** Property member with assistant access and no org billing leaf (H-64). */
async function ensureQaMember() {
  const userId = await ensureAuthUser(MEMBER_EMAIL);
  const propertyId = await fetchPropertyId();
  if (!propertyId) throw new Error(`property ${PROPERTY} not found for QA member`);
  const headers = {
    apikey: SRK,
    Authorization: `Bearer ${SRK}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  };
  const member = await fetch(`${AUTH}/rest/v1/property_members?on_conflict=property_id,user_id`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      property_id: propertyId,
      user_id: userId,
      role_id: 'ADMIN',
      permissions: ['assistant:view', 'bookings:view'],
      status: 'active',
    }),
  });
  if (!member.ok) {
    throw new Error(`property_members upsert failed: ${member.status} ${await member.text()}`);
  }
  const prefs = await fetch(`${AUTH}/rest/v1/user_ui_preferences?on_conflict=user_id`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ user_id: userId, dashboard_mode: 'ai' }),
  });
  if (!prefs.ok) {
    throw new Error(`user_ui_preferences upsert failed: ${prefs.status} ${await prefs.text()}`);
  }
}

async function injectSession(context, session, orgId, { guest = false } = {}) {
  await context.addInitScript(
    ({ session, org, property, orgId, guest }) => {
      try {
        navigator.serviceWorker?.getRegistrations?.().then((regs) => {
          for (const reg of regs) void reg.unregister();
        });
        caches?.keys?.().then((keys) => {
          for (const key of keys) void caches.delete(key);
        });
      } catch {
        /* ignore */
      }
      let active = session;
      try {
        const packed = window.localStorage.getItem('kame-qa-auth');
        if (packed) active = JSON.parse(packed);
      } catch {
        /* keep baked session */
      }
      window.localStorage.setItem('sb-127-auth-token', JSON.stringify(active));
      if (guest) return;
      window.localStorage.setItem(
        'kame:e2e-admin-session',
        JSON.stringify({
          accessToken: active.access_token,
          refreshToken: active.refresh_token,
          userId: active.user?.id,
          email: active.user?.email ?? 'sprmke.dev@gmail.com',
          name: active.user?.user_metadata?.full_name ?? 'QA Host',
        })
      );
      window.localStorage.setItem('kame-last-org-slug', org);
      window.localStorage.setItem('kame-last-property-slug', property);
      window.localStorage.setItem('kame-last-tenant-kind', 'property');
      if (active.user?.id) {
        window.localStorage.setItem(`kame-admin-ui-mode:${active.user.id}`, 'ai');
      }
      if (orgId) {
        window.sessionStorage.setItem(`setup-guide:snooze:${orgId}`, '1');
      }
    },
    { session, org: ORG, property: PROPERTY, orgId, guest }
  );
}

async function dismissBlockingOverlays(page) {
  for (let i = 0; i < 6; i++) {
    const upgrade = page.getByRole('dialog').filter({ hasText: 'Upgrade to' }).first();
    if (await upgrade.isVisible().catch(() => false)) {
      const cancel = upgrade.getByRole('button', { name: 'Cancel' });
      if (await cancel.isVisible().catch(() => false)) {
        await cancel.click().catch(() => undefined);
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(250);
      continue;
    }
    const assistantOpen =
      SURFACE === 'sheet' &&
      (await page.getByRole('dialog', { name: 'AI Assistant' }).isVisible().catch(() => false));
    const scrim = page.locator('.modal-scrim[data-state="open"]');
    if ((await scrim.count()) === 0) return;
    // The assistant sheet uses the same scrim; Esc would close it.
    if (assistantOpen && (await scrim.count()) <= 1) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
}

async function ensureAdvancedMode(page) {
  if (SURFACE !== 'sheet') return;
  const shell = page.locator('[data-dashboard-mode="advanced"]');
  if (!(await waitForDashboardShell(page))) {
    await page.goto(hostUrl(SURFACE), { waitUntil: 'load', timeout: 60_000 });
    await page.waitForTimeout(1_500);
    if (!(await waitForDashboardShell(page))) {
      await dumpAiModeFail(page, 'dashboard mode shell missing (sheet)');
    }
  }
  if ((await shell.count()) > 0) return;
  const row = page.locator('[data-testid="dashboard-mode-toggle"]').locator('visible=true').first();
  const inner = row.locator('[role="switch"]').first();
  if ((await row.count()) > 0) {
    const checked = await inner.getAttribute('aria-checked', { timeout: 5_000 }).catch(() => 'false');
    if (checked === 'true') {
      await inner.click({ timeout: 8_000 }).catch(async () => {
        await page.keyboard.press('Meta+j');
        await page.keyboard.press('Control+j');
      });
    }
  } else {
    await page.keyboard.press('Meta+j');
    await page.keyboard.press('Control+j');
  }
  try {
    await shell.waitFor({ timeout: 20_000 });
  } catch {
    await dumpAiModeFail(page, 'advanced mode shell missing after toggle');
  }
}

async function ensureSheetComposer(page) {
  if (SURFACE !== 'sheet') return;
  await ensureAdvancedMode(page);
  const panel = page.getByRole('dialog', { name: 'AI Assistant' });
  const composer = composerLocator(page);
  if ((await panel.isVisible().catch(() => false)) && (await composer.isVisible().catch(() => false))) {
    return;
  }
  const fab = page.getByRole('button', { name: 'Open AI assistant' });
  const tab = page.locator('[aria-label="Assistant"]').locator('visible=true').first();
  try {
    if (await fab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await fab.evaluate((el) => el.click());
    } else {
      await tab.waitFor({ state: 'visible', timeout: 20_000 });
      await tab.click();
    }
  } catch {
    await dumpAiModeFail(page, 'AI assistant launcher missing');
  }
  try {
    await panel.waitFor({ state: 'visible', timeout: 20_000 });
    await composer.waitFor({ state: 'visible', timeout: 20_000 });
  } catch {
    await dumpAiModeFail(page, 'sheet composer missing after launcher click');
  }
}

async function applyHostSession(page, session, orgId) {
  await page.evaluate(
    ({ session, org, property, orgId }) => {
      window.localStorage.setItem('kame-qa-auth', JSON.stringify(session));
      window.localStorage.setItem('sb-127-auth-token', JSON.stringify(session));
      window.localStorage.setItem(
        'kame:e2e-admin-session',
        JSON.stringify({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          userId: session.user?.id,
          email: session.user?.email ?? '',
          name: session.user?.user_metadata?.full_name ?? 'QA Host',
        })
      );
      window.localStorage.setItem('kame-last-org-slug', org);
      window.localStorage.setItem('kame-last-property-slug', property);
      window.localStorage.setItem('kame-last-tenant-kind', 'property');
      if (session.user?.id) {
        window.localStorage.setItem(`kame-admin-ui-mode:${session.user.id}`, 'ai');
      }
      if (orgId) {
        window.sessionStorage.setItem(`setup-guide:snooze:${orgId}`, '1');
      }
    },
    { session, org: ORG, property: PROPERTY, orgId }
  );
  await page.goto(hostUrl(SURFACE), { waitUntil: 'load', timeout: 60_000 });
  await page.waitForTimeout(800);
  await dismissBlockingOverlays(page);
  if (SURFACE === 'ai') await ensureAiMode(page);
  await dismissBlockingOverlays(page);
  await ensureSheetComposer(page);
}

async function recoverHostPage(page, { force = false } = {}) {
  if (isGuestSurface) return;
  const crashed = (await page.getByText('Something went wrong').count()) > 0;
  const hasShell = (await page.locator('[data-dashboard-mode]').count()) > 0;
  if (force || crashed || !hasShell) {
    await page.goto(hostUrl(SURFACE), { waitUntil: 'load', timeout: 60_000 });
    await page
      .locator('[data-dashboard-mode]')
      .first()
      .waitFor({ timeout: 60_000 })
      .catch(() => undefined);
    await dismissBlockingOverlays(page);
    if (SURFACE === 'ai') await ensureAiMode(page);
  }
  await ensureSheetComposer(page);
}

async function main() {
  const corpus = JSON.parse(readFileSync(CORPUS, 'utf8'));
  const questions = BRIEFING ? [] : pickQuestions(corpus);
  if (!BRIEFING && questions.length === 0) {
    console.error('No questions selected. Pass --ids H-01,H-25, --all, or --briefing.');
    process.exit(2);
  }
  if (BRIEFING && SURFACE !== 'ai') {
    console.error('Briefing cards are on AI mode only. Re-run with --surface ai.');
    process.exit(2);
  }
  const viewport = VIEWPORTS[VIEWPORT];
  if (!viewport) {
    console.error(`Unknown viewport ${VIEWPORT}. Use 1440, 768, or 375.`);
    process.exit(2);
  }

  console.log(
    `QA run ${RUN_ID}: ${BRIEFING ? 'briefing' : `${questions.length} questions`}, ${SURFACE} @ ${VIEWPORT}`
  );
  if (isGuestSurface) {
    await ensureAuthUser(GUEST_EMAIL);
    await resetGuestChatStartLimits();
    if (SURFACE === 'voice') await resetVoiceHealthCircuit();
  } else {
    // Local only. Prod stays 30 turns / 10 min.
    await resetQaRateLimits(['dashboard-assistant-chat']);
  }
  const wantsMember = !isGuestSurface && questions.some((row) => row.needsMember);
  let memberSession = null;
  if (wantsMember) {
    await ensureQaMember();
    memberSession = await magicLinkSession(MEMBER_EMAIL);
  }
  const session = await magicLinkSession(isGuestSurface ? GUEST_EMAIL : EMAIL);
  const orgId = await fetchOrgId();
  const browser = await chromium.launch({
    headless: true,
    args:
      SURFACE === 'voice'
        ? ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
        : [],
  });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: VIEWPORT === '375' ? 2 : 1,
    isMobile: VIEWPORT === '375',
    hasTouch: VIEWPORT === '375',
  });
  if (SURFACE === 'voice') {
    await context.grantPermissions(['microphone'], { origin: UI });
  }
  await injectSession(context, session, orgId, { guest: isGuestSurface });
  const page = await context.newPage();
  page.on('pageerror', (err) => {
    PAGE_ERRORS.push(String(err?.message || err));
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') PAGE_ERRORS.push(msg.text());
  });
  page.on('request', (req) => {
    const match = req.url().match(/[?&]conversation_id=([0-9a-f-]{36})/i);
    if (match) guestConversationId = match[1];
    if (/guest-web-chat-messages/.test(req.url()) && req.method() === 'POST') {
      try {
        const body = req.postDataJSON();
        const id = body?.conversationId ?? body?.conversation_id;
        if (typeof id === 'string' && id) guestConversationId = id;
      } catch {
        /* ignore */
      }
    }
  });
  page.on('response', async (res) => {
    if (!/guest-web-chat-(start|resume|messages)/.test(res.url()) || !res.ok()) return;
    try {
      const json = await res.json();
      const id =
        json?.conversationId ??
        json?.data?.conversationId ??
        json?.conversation_id ??
        json?.data?.conversation_id;
      if (id) guestConversationId = id;
    } catch {
      /* ignore */
    }
  });
  await installSseTap(page);

  const startUrl = isGuestSurface ? guestUrl() : hostUrl(SURFACE);
  await page.goto(startUrl, { waitUntil: 'load', timeout: 60_000 });
  await dismissBlockingOverlays(page);
  if (SURFACE === 'ai') {
    await ensureAiMode(page);
  }
  await ensureSheetComposer(page);
  if (SURFACE === 'guest') {
    await ensureGuestComposer(page);
  }
  if (SURFACE === 'voice') {
    try {
      await ensureVoiceBooth(page);
    } catch {
      process.stdout.write('(reopen booth) ');
      await ensureVoiceBooth(page, { forceNew: true });
    }
  }
  if (!isGuestSurface) {
    const composer = composerLocator(page);
    try {
      await composer.waitFor({
        state: 'attached',
        timeout: 60_000,
      });
      await composer.scrollIntoViewIfNeeded().catch(() => undefined);
    } catch {
      const byLabel = page.getByRole('textbox', { name: /Message/i }).first();
      const launcher = page.getByRole('button', { name: 'Open AI assistant' });
      if ((await byLabel.count()) > 0) {
        await byLabel.scrollIntoViewIfNeeded().catch(() => undefined);
      } else if (await launcher.count()) {
        await launcher.click({ timeout: 8_000 });
        await composer.waitFor({ state: 'attached', timeout: 30_000 });
      } else {
        const dir = resolve(ARTIFACT_DIR, `run-${RUN_ID}`, SURFACE, VIEWPORT);
        mkdirSync(dir, { recursive: true });
        const failPath = resolve(dir, '_auth-fail.png');
        await page.screenshot({ path: failPath, fullPage: true });
        const snippet = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400);
        throw new Error(
          `composer not found at ${page.url()} (${snippet}). screenshot ${failPath.replace(`${ROOT}/`, '')}`
        );
      }
    }
  }

  if (BRIEFING) {
    await captureBriefing(page);
    await browser.close();
    console.log(`\nLedger: docs/workflow/qa/ai-conversations/run-${RUN_ID}.md (briefing)`);
    process.exit(0);
  }

  const results = [];
  let lastHostId = null;
  let usingMember = false;
  for (const question of questions) {
    process.stdout.write(`  ${question.id} … `);
    if (!isGuestSurface) {
      await resetQaRateLimits(['dashboard-assistant-chat']);
    }
    let result;
    try {
      const wantMember = !isGuestSurface && Boolean(question.needsMember);
      if (wantMember !== usingMember && memberSession) {
        process.stdout.write(wantMember ? '(member) ' : '(owner) ');
        await applyHostSession(page, wantMember ? memberSession : session, orgId);
        usingMember = wantMember;
        lastHostId = null;
      }
      if (!isGuestSurface && question.followUpOf && lastHostId !== question.followUpOf) {
        const parent =
          questions.find((row) => row.id === question.followUpOf) ||
          corpus.find((row) => row.id === question.followUpOf);
        if (parent) {
          await sendHostQuestion(page, parent, { continueThread: false });
          lastHostId = parent.id;
        }
      }
      result =
        SURFACE === 'voice'
          ? await sendVoiceQuestion(page, question)
          : SURFACE === 'guest'
            ? await sendGuestQuestion(page, question)
            : await sendHostQuestion(page, question, {
                continueThread: Boolean(question.followUpOf),
              });
      if (!isGuestSurface) lastHostId = question.id;
    } catch (err) {
      result = {
        wallMs: 0,
        timing: null,
        blocks: null,
        error: { type: 'exception', message: err instanceof Error ? err.message : String(err) },
      };
    }
    const errText = String(result.error?.message || result.error?.type || '');
    const dailyQuota = /quota exceeded|generate_content_free_tier|retry in \d+h/i.test(errText);
    const rateLimited = /too many requests|rate limit|429|high demand|try again later|dns error|no address associated|hostname/i.test(
      errText
    );
    const crashed = /something went wrong|shell missing|toggle missing|invalid or expired session/i.test(
      String(result.error?.message || result.error?.type || '')
    );
    const guestComposerGone =
      SURFACE === 'guest' &&
      /textbox.*Message|Request failed/i.test(String(result.error?.message || ''));
    const browserClosed = /browser has been closed/i.test(
      String(result.error?.message || result.error?.type || '')
    );
    if (rateLimited && !dailyQuota && SURFACE !== 'guest' && !browserClosed) {
      process.stdout.write('(rate limit, 90s) ');
      await page.waitForTimeout(90_000);
      try {
        result = await sendHostQuestion(page, question);
      } catch (err) {
        result = {
          wallMs: 0,
          timing: null,
          blocks: null,
          error: { type: 'exception', message: err instanceof Error ? err.message : String(err) },
        };
      }
    } else if (crashed && SURFACE !== 'guest') {
      process.stdout.write('(reload) ');
      try {
        await recoverHostPage(page, { force: true });
        result = await sendHostQuestion(page, question);
      } catch (err) {
        result = {
          wallMs: 0,
          timing: null,
          blocks: null,
          error: { type: 'exception', message: err instanceof Error ? err.message : String(err) },
        };
      }
    } else if (guestComposerGone) {
      process.stdout.write('(reload) ');
      try {
        result = await sendGuestQuestion(page, question);
      } catch (err) {
        result = {
          wallMs: 0,
          timing: null,
          blocks: null,
          error: { type: 'exception', message: err instanceof Error ? err.message : String(err) },
        };
      }
    } else if (
      SURFACE !== 'guest' &&
      !browserClosed &&
      /status":503|\b503\b|execution context was destroyed|target closed|no blocks event/i.test(
        String(result.error?.message || result.error?.type || '')
      )
    ) {
      const waitMs = /\b503\b/.test(String(result.error?.message || '')) ? 8_000 : 1_000;
      process.stdout.write(waitMs > 1_000 ? '(503, retry) ' : '(retry) ');
      await page.waitForTimeout(waitMs);
      try {
        await recoverHostPage(page, { force: true });
        result = await sendHostQuestion(page, question, {
          continueThread: Boolean(question.followUpOf),
        });
      } catch (err) {
        result = {
          wallMs: 0,
          timing: null,
          blocks: null,
          error: { type: 'exception', message: err instanceof Error ? err.message : String(err) },
        };
      }
    }
    const shot = screenshotPath(question);
    try {
      if (!isGuestSurface) {
        const lastTurn = page.locator('[data-testid="assistant-message"]').last();
        await lastTurn.scrollIntoViewIfNeeded().catch(() => undefined);
        await page.waitForTimeout(400);
      }
      await page.screenshot({ path: shot, fullPage: false });
    } catch (err) {
      result.error = result.error ?? {
        type: 'exception',
        message: err instanceof Error ? err.message : String(err),
      };
    }
    if (!isGuestSurface) await page.waitForTimeout(8_000).catch(() => undefined);
    const row = {
      id: question.id,
      wallMs: result.wallMs,
      timing: result.timing,
      blockTypes: blockTypes(result.blocks),
      error: result.error,
      screenshot: shot.replace(`${ROOT}/`, ''),
    };
    appendLedger(row);
    results.push(row);
    const status = result.error ? `FAIL ${result.error.message || result.error.type}` : 'ok';
    console.log(`${status}  ${result.wallMs}ms  [${row.blockTypes.join(',')}]`);
    if (browserClosed) {
      console.error('Browser closed; stopping this surface.');
      break;
    }
    if (dailyQuota) {
      console.error('Gemini daily quota exceeded; stopping this surface. Recapture remaining ids after reset.');
      break;
    }
  }

  await browser.close();
  const failed = results.filter((r) => r.error).length;
  console.log(
    `\nLedger: docs/workflow/qa/ai-conversations/run-${RUN_ID}.md (${results.length - failed}/${results.length} captured)`
  );
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
