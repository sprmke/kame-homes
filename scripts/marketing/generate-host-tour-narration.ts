#!/usr/bin/env bun
/**
 * Generate per-chapter MP3 voiceovers for the /for-hosts Remotion tour.
 *
 * Requires: `edge-tts` on PATH (pip install edge-tts). `ffprobe` (optional) records each clip's
 * length in manifest.json so chapter durations in `hostTourChapters.ts` can be paced to the voice.
 * Files for chapters no longer in `hostTourNarration` are removed.
 *
 * Usage (from repo root):
 *   bun scripts/marketing/generate-host-tour-narration.ts
 *   bun scripts/marketing/generate-host-tour-narration.ts --voice en-US-AndrewMultilingualNeural --rate=+5%
 */

import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HOST_TOUR_NARRATION_PUBLIC_DIR,
  hostTourNarration,
} from '../../ui/src/features/guest/marketing/for-hosts/data/hostTourNarration.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = join(ROOT, 'ui/public', HOST_TOUR_NARRATION_PUBLIC_DIR.replace(/^\//, ''));

function parseArgs(argv: string[]) {
  let voice = 'en-US-AvaMultilingualNeural';
  let rate = '+4%';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--voice') {
      voice = argv[i + 1] ?? voice;
      i += 1;
      continue;
    }
    if (arg?.startsWith('--voice=')) {
      voice = arg.slice('--voice='.length);
      continue;
    }
    if (arg === '--rate') {
      rate = argv[i + 1] ?? rate;
      i += 1;
      continue;
    }
    if (arg?.startsWith('--rate=')) {
      rate = arg.slice('--rate='.length);
    }
  }
  return { voice, rate };
}

async function ensureEdgeTts(): Promise<string> {
  const which = Bun.spawnSync(['which', 'edge-tts'], { stdout: 'pipe', stderr: 'pipe' });
  if (which.exitCode === 0) {
    return which.stdout.toString().trim() || 'edge-tts';
  }

  const home = process.env.HOME ?? '';
  const candidates = [
    join(home, 'Library/Python/3.9/bin/edge-tts'),
    join(home, 'Library/Python/3.10/bin/edge-tts'),
    join(home, 'Library/Python/3.11/bin/edge-tts'),
    join(home, 'Library/Python/3.12/bin/edge-tts'),
    join(home, 'Library/Python/3.13/bin/edge-tts'),
    join(home, '.local/bin/edge-tts'),
  ];
  for (const candidate of candidates) {
    const probe = Bun.spawnSync(['test', '-x', candidate]);
    if (probe.exitCode === 0) return candidate;
  }

  console.error('edge-tts not found on PATH. Install with: pip3 install --user edge-tts');
  console.error('Then ensure ~/.local/bin (or your user scripts dir) is on PATH.');
  process.exit(1);
}

async function synthesize(opts: {
  edgeTts: string;
  text: string;
  outMp3: string;
  voice: string;
  rate: string;
}) {
  const proc = Bun.spawn(
    [
      opts.edgeTts,
      '--voice',
      opts.voice,
      '--rate',
      opts.rate,
      '--text',
      opts.text,
      '--write-media',
      opts.outMp3,
      '--write-subtitles',
      opts.outMp3.replace(/\.mp3$/, '.vtt'),
    ],
    { stdout: 'inherit', stderr: 'inherit' }
  );
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`edge-tts failed for ${opts.outMp3} (exit ${code})`);
  }
}

function probeSeconds(file: string): number | null {
  const probe = Bun.spawnSync(
    ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { stdout: 'pipe', stderr: 'pipe' }
  );
  if (probe.exitCode !== 0) return null;
  const seconds = Number.parseFloat(probe.stdout.toString().trim());
  return Number.isFinite(seconds) ? Math.round(seconds * 100) / 100 : null;
}

async function main() {
  const { voice, rate } = parseArgs(process.argv.slice(2));
  const edgeTts = await ensureEdgeTts();

  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Writing narration to ${OUT_DIR}`);
  console.log(`Voice=${voice} rate=${rate}`);

  const manifest: Array<{ id: string; text: string; file: string; seconds: number | null }> = [];

  for (const line of hostTourNarration) {
    const file = `${line.id}.mp3`;
    const outMp3 = join(OUT_DIR, file);
    console.log(`→ ${line.id}: ${line.text}`);
    await synthesize({
      edgeTts,
      text: line.text,
      outMp3,
      voice,
      rate,
    });
    manifest.push({ id: line.id, text: line.text, file, seconds: probeSeconds(outMp3) });
  }

  const keep = new Set(hostTourNarration.flatMap((line) => [`${line.id}.mp3`, `${line.id}.vtt`]));
  keep.add('manifest.json');
  for (const name of await readdir(OUT_DIR)) {
    if (!keep.has(name)) {
      await rm(join(OUT_DIR, name));
      console.log(`✕ removed stale ${name}`);
    }
  }

  await writeFile(join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Done. ${manifest.length} MP3s + manifest.json`);
}

await main();
