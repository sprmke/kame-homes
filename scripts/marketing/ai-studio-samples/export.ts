/**
 * Writes the shipped AI Studio example files from the stock sources and the picked raw
 * generations (see generate.ts).
 *
 *   bun scripts/marketing/ai-studio-samples/export.ts sources   # stock "before" + showcase photos, CREDITS.md
 *   bun scripts/marketing/ai-studio-samples/export.ts samples   # picked generations → after / clip files
 *
 * `picks.json` (next to this file) maps a sample id to the raw attempt to ship, e.g.
 * `{ "photo-golden-balcony": 2 }`. Only picked samples are exported; the rest stay hidden
 * in the app. Rewrites `ui/src/features/dashboard/marketing/lib/aiStudioSampleAssets.ts`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import sharp from 'sharp';

import {
  AI_STUDIO_SAMPLES_BASE,
  CLIP_SAMPLES,
  PHOTO_SAMPLES,
  SAMPLE_IMAGE_WIDTHS,
  SHOWCASE_PHOTOS,
  aspectSize,
  sampleFiles,
  showcasePhotoUrl,
  type ClipSample,
  type PhotoSample,
  type SampleImage,
} from '../../../ui/src/features/dashboard/marketing/lib/aiStudioSamples';

const HERE = dirname(new URL(import.meta.url).pathname);
const ROOT = join(HERE, '../../..');
const PUBLIC = join(ROOT, 'ui/public');
const CACHE = join(HERE, '.cache');
const ASSETS_TS = join(ROOT, 'ui/src/features/dashboard/marketing/lib/aiStudioSampleAssets.ts');

const MAX_IMAGE_BYTES_960 = 120 * 1024;
const MAX_CLIP_BYTES = 1.5 * 1024 * 1024;

function out(publicPath: string): string {
  const path = join(PUBLIC, publicPath);
  mkdirSync(dirname(path), { recursive: true });
  return path;
}

async function source(id: string): Promise<Buffer> {
  const path = join(CACHE, 'sources', `${id}.jpg`);
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    const res = await fetch(
      `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1600`
    );
    if (!res.ok) throw new Error(`Could not download source ${id} (${res.status})`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(path);
}

/** Writes every width × format of one image, cropped to its aspect, and checks the budget. */
async function writeImage(input: Buffer, image: SampleImage) {
  const stem = image.src.replace(/-\d+\.webp$/, '');
  for (const width of SAMPLE_IMAGE_WIDTHS) {
    const height = Math.round((width * image.height) / image.width);
    const resized = sharp(input).resize(width, height, { fit: 'cover', position: 'centre' });
    await resized
      .clone()
      .webp({ quality: 78 })
      .toFile(out(`${stem}-${width}.webp`));
    await resized
      .clone()
      .avif({ quality: 52 })
      .toFile(out(`${stem}-${width}.avif`));
    const size = statSync(join(PUBLIC, `${stem}-${width}.webp`)).size;
    if (width === 960 && size > MAX_IMAGE_BYTES_960) {
      console.warn(`  ! ${stem}-960.webp is ${Math.round(size / 1024)} KB (budget 120 KB)`);
    }
  }
}

function ffmpeg(args: string[]) {
  const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${result.stderr.slice(-400)}`);
}

async function exportSources() {
  const credits: string[] = [];
  const seen = new Set<string>();
  for (const sample of [...PHOTO_SAMPLES, ...CLIP_SAMPLES]) {
    const files = sampleFiles(sample);
    // Clips start from the center-cropped frame the generator sent; photos from the source.
    const startPath = join(CACHE, 'sources', `${sample.id}-start.jpg`);
    const input =
      sample.output === 'video' && existsSync(startPath)
        ? readFileSync(startPath)
        : await source(sample.source.id);
    await writeImage(input, files.before);
    if (!seen.has(sample.source.id)) {
      seen.add(sample.source.id);
      credits.push(
        `| ${sample.source.id} | ${sample.source.photographer} | [Pexels](${sample.source.pageUrl}) |`
      );
    }
  }
  for (const photo of SHOWCASE_PHOTOS) {
    const { width, height } = aspectSize(photo.aspect);
    await sharp(await source(photo.id))
      .resize(960, Math.round((960 * height) / width), { fit: 'cover', position: 'centre' })
      .webp({ quality: 78 })
      .toFile(out(showcasePhotoUrl(photo.id)));
    if (!seen.has(photo.id)) {
      seen.add(photo.id);
      credits.push(`| ${photo.id} | ${photo.photographer} | [Pexels](${photo.pageUrl}) |`);
    }
  }
  writeFileSync(
    out(`${AI_STUDIO_SAMPLES_BASE}/CREDITS.md`),
    [
      '# AI Studio example sources',
      '',
      'Free stock photos used as the "before" of each example and as the stand-in listing for post',
      'examples. Pexels License: free for commercial use, attribution not required. Recorded anyway.',
      '',
      '| Pexels id | Photographer | Page |',
      '| --- | --- | --- |',
      ...credits,
      '',
    ].join('\n')
  );
  console.log(`✓ ${seen.size} sources exported`);
}

type RawMeta = {
  sampleId: string;
  model: string;
  hostPrompt: string;
  sentPrompt: string;
  promptEnhanced: boolean;
  file: string;
};

function rawMeta(sampleId: string, attempt: number): RawMeta {
  const path = join(CACHE, 'raw', sampleId, `${attempt}.json`);
  if (!existsSync(path)) throw new Error(`No raw attempt ${attempt} for ${sampleId}`);
  return JSON.parse(readFileSync(path, 'utf8')) as RawMeta;
}

async function exportPhoto(sample: PhotoSample, attempt: number): Promise<RawMeta> {
  const meta = rawMeta(sample.id, attempt);
  const files = sampleFiles(sample);
  if (files.kind !== 'image') throw new Error('unreachable');
  await writeImage(readFileSync(join(CACHE, 'raw', sample.id, meta.file)), files.after);
  return meta;
}

async function exportClip(sample: ClipSample, attempt: number): Promise<RawMeta> {
  const meta = rawMeta(sample.id, attempt);
  const files = sampleFiles(sample);
  if (files.kind !== 'video') throw new Error('unreachable');
  const raw = join(CACHE, 'raw', sample.id, meta.file);
  const { width, height } = aspectSize(sample.aspect);
  const scale = width >= height ? 'scale=-2:720' : 'scale=720:-2';
  ffmpeg([
    '-i',
    raw,
    '-vf',
    scale,
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '27',
    '-profile:v',
    'high',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '64k',
    '-movflags',
    '+faststart',
    out(files.mp4),
  ]);
  const size = statSync(join(PUBLIC, files.mp4)).size;
  if (size > MAX_CLIP_BYTES)
    console.warn(`  ! ${files.mp4} is ${Math.round(size / 1024)} KB (budget 1.5 MB)`);
  const frame = join(CACHE, 'raw', sample.id, `${attempt}-frame0.png`);
  ffmpeg(['-i', raw, '-frames:v', '1', frame]);
  await writeImage(readFileSync(frame), files.poster);
  return meta;
}

async function exportSamples() {
  const picksPath = join(HERE, 'picks.json');
  const picks = existsSync(picksPath)
    ? (JSON.parse(readFileSync(picksPath, 'utf8')) as Record<string, number>)
    : {};
  const ready: string[] = [];
  const records: Array<RawMeta & { attempt: number }> = [];
  for (const sample of PHOTO_SAMPLES) {
    const attempt = picks[sample.id];
    if (!attempt) continue;
    records.push({ ...(await exportPhoto(sample, attempt)), attempt });
    ready.push(sample.id);
  }
  for (const sample of CLIP_SAMPLES) {
    const attempt = picks[sample.id];
    if (!attempt) continue;
    records.push({ ...(await exportClip(sample, attempt)), attempt });
    ready.push(sample.id);
  }
  // What was actually sent for each shipped example (review record, not used by the app).
  writeFileSync(join(HERE, 'shipped.json'), `${JSON.stringify(records, null, 2)}\n`);
  writeFileSync(
    ASSETS_TS,
    [
      '/**',
      ' * Generated by `scripts/marketing/ai-studio-samples/export.ts`. Do not edit by hand.',
      ' * Photo and clip examples whose files are exported and reviewed; the gallery shows only these.',
      ' */',
      `export const READY_SAMPLE_IDS: readonly string[] = ${JSON.stringify(ready)};`,
      '',
    ].join('\n')
  );
  console.log(`✓ ${ready.length} examples ready: ${ready.join(', ') || 'none'}`);
}

const mode = process.argv[2];
if (mode === 'sources') await exportSources();
else if (mode === 'samples') await exportSamples();
else {
  console.error('Usage: bun scripts/marketing/ai-studio-samples/export.ts <sources|samples>');
  process.exit(1);
}
