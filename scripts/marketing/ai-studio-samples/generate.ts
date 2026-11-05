/**
 * Makes the AI Studio photo and clip examples with the production generation code.
 *
 * Same prompt builders, enhancement, models and output checks as `generate-marketing-media`,
 * called directly (no HTTP, no job rows) so the result is what a host would get with the
 * recipe in `ui/src/features/dashboard/marketing/lib/aiStudioSamples.ts`.
 *
 * Raw attempts land in `.cache/raw/<sampleId>/<n>.{png|mp4,json}` (gitignored). Pick the
 * best with `picks.json` and run `export.mjs` to write the shipped files.
 *
 *   deno run -A --no-check --sloppy-imports --config scripts/marketing/ai-studio-samples/deno.json \
 *     scripts/marketing/ai-studio-samples/generate.ts [--only id,id] [--attempts 2] [--kind image|video]
 *
 * Env: GEMINI keys from supabase/.env.local; SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY of the
 * LOCAL stack (AI usage for the prompt rewrite is recorded there). Refuses non-local URLs.
 * Costs real Google API money: ~$0.07 per photo, ~$0.80 per 720p clip.
 */
import {
  CLIP_SAMPLES,
  PHOTO_SAMPLES,
  samplePrompt,
  type ClipSample,
  type PhotoSample,
} from '@/features/dashboard/marketing/lib/aiStudioSamples.ts';

import {
  geminiModelPath,
  geminiRequestWithKey,
} from '../../../supabase/functions/_shared/ai/llmTransport.ts';
import {
  getMarketingImageModel,
  getMarketingVideoModel,
} from '../../../supabase/functions/_shared/aiModelRouter.ts';
import {
  fetchGeneratedVideoBytes,
  isDegenerateGeneratedImage,
} from '../../../supabase/functions/_shared/marketingGenerationStorage.ts';
import { generateMarketingImage } from '../../../supabase/functions/_shared/marketingImageGenerationAi.ts';
import {
  enhanceMarketingImagePrompt,
  type MarketingImagePropertyContext,
} from '../../../supabase/functions/_shared/marketingImagePromptBuilder.ts';
import { buildVeoRequestBody } from '../../../supabase/functions/_shared/marketingVideoGenerationAi.ts';
import {
  buildStructuredVideoPrompt,
  buildVideoNegativePrompt,
  enhanceMarketingVideoPrompt,
} from '../../../supabase/functions/_shared/marketingVideoPromptBuilder.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;
const CACHE = `${ROOT}scripts/marketing/ai-studio-samples/.cache`;

/** Neutral showcase listing, so the rewrite has context without naming a real place. */
const SHOWCASE_PROPERTY: MarketingImagePropertyContext = {
  name: 'Showcase Suite',
  type: 'Condo',
  city: null,
  residenceName: null,
  maxGuests: 4,
  amenities: ['Pool', 'Wi-Fi', 'Balcony', 'Air conditioning'],
  brandColor: null,
};

function arg(name: string): string | null {
  const index = Deno.args.indexOf(`--${name}`);
  return index >= 0 ? (Deno.args[index + 1] ?? null) : null;
}

function loadDotEnv(path: string) {
  const text = Deno.readTextFileSync(path);
  for (const line of text.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const value = match[2]!.replace(/^['"]|['"]$/g, '');
    if (value && !Deno.env.get(match[1]!)) Deno.env.set(match[1]!, value);
  }
}

function assertLocalSupabase() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  if (!/^http:\/\/(127\.0\.0\.1|localhost|kong)(:\d+)?/.test(url)) {
    throw new Error(
      'SUPABASE_URL must point at the local stack (this script never writes to a hosted project)'
    );
  }
}

async function run(cmd: string, args: string[]) {
  const out = await new Deno.Command(cmd, { args, stdout: 'null', stderr: 'piped' }).output();
  if (!out.success)
    throw new Error(`${cmd} failed: ${new TextDecoder().decode(out.stderr).slice(-400)}`);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function sourcePhoto(id: string): Promise<string> {
  const path = `${CACHE}/sources/${id}.jpg`;
  try {
    await Deno.stat(path);
    return path;
  } catch {
    // download below
  }
  await Deno.mkdir(`${CACHE}/sources`, { recursive: true });
  const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1600`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download source ${id} (${res.status})`);
  await Deno.writeFile(path, new Uint8Array(await res.arrayBuffer()));
  return path;
}

/** Center-crops the source to the clip's shape, as a host would frame their start photo. */
async function startFrameFor(sample: ClipSample): Promise<string> {
  const src = await sourcePhoto(sample.source.id);
  const out = `${CACHE}/sources/${sample.id}-start.jpg`;
  const [w, h] = sample.aspect.split(':').map(Number) as [number, number];
  const longEdge = 1280;
  const width = w >= h ? longEdge : Math.round((longEdge * w) / h);
  const height = w >= h ? Math.round((longEdge * h) / w) : longEdge;
  await run('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    src,
    '-vf',
    `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`,
    '-q:v',
    '2',
    out,
  ]);
  return out;
}

async function nextAttempt(sampleId: string): Promise<{ dir: string; n: number }> {
  const dir = `${CACHE}/raw/${sampleId}`;
  await Deno.mkdir(dir, { recursive: true });
  let n = 1;
  for await (const entry of Deno.readDir(dir)) {
    const match = entry.name.match(/^(\d+)\.json$/);
    if (match) n = Math.max(n, Number(match[1]) + 1);
  }
  return { dir, n };
}

const ids = { organizationId: '', propertyId: '' };

async function makePhoto(sample: PhotoSample) {
  const bytes = await Deno.readFile(await sourcePhoto(sample.source.id));
  const reference = { mimeType: 'image/jpeg', data: toBase64(bytes) };
  const prompt = samplePrompt(sample);
  const enhancement = sample.enhancePrompt
    ? await enhanceMarketingImagePrompt({
        organizationId: ids.organizationId,
        propertyId: ids.propertyId,
        prompt,
        aspectRatio: sample.aspect,
        property: SHOWCASE_PROPERTY,
        hasReferenceImages: true,
        actorUserId: null,
      })
    : null;
  const config = getMarketingImageModel(sample.tier);
  const generated = await generateMarketingImage({
    config,
    prompt: enhancement?.prompt ?? prompt,
    negativePrompt: null,
    aspectRatio: sample.aspect,
    imageSize: sample.imageSize,
    references: [reference],
  });
  const degenerate = await isDegenerateGeneratedImage({
    bytes: generated.bytes,
    dimensions:
      generated.width && generated.height
        ? { width: generated.width, height: generated.height }
        : null,
    requestedAspectRatio: sample.aspect,
  });
  if (degenerate.degenerate) throw new Error(`Rejected output: ${degenerate.reason}`);
  const { dir, n } = await nextAttempt(sample.id);
  const ext = generated.mimeType.includes('png') ? 'png' : 'jpg';
  await Deno.writeFile(`${dir}/${n}.${ext}`, generated.bytes);
  await Deno.writeTextFile(
    `${dir}/${n}.json`,
    JSON.stringify(
      {
        sampleId: sample.id,
        model: config.model,
        hostPrompt: prompt,
        sentPrompt: enhancement?.prompt ?? prompt,
        promptEnhanced: enhancement?.enhanced ?? false,
        file: `${n}.${ext}`,
        createdAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log(`  ✓ ${sample.id} #${n} (enhanced: ${enhancement?.enhanced ?? false})`);
}

async function makeClip(sample: ClipSample) {
  const startPath = await startFrameFor(sample);
  const startFrame = { mimeType: 'image/jpeg', data: toBase64(await Deno.readFile(startPath)) };
  const promptInput = {
    prompt: sample.prompt,
    cameraMove: sample.cameraMove,
    sound: sample.sound,
    aspectRatio: sample.aspect,
    property: SHOWCASE_PROPERTY,
    hasStartFrame: true,
  };
  const enhancement = sample.enhancePrompt
    ? await enhanceMarketingVideoPrompt({
        ...promptInput,
        organizationId: ids.organizationId,
        propertyId: ids.propertyId,
        startFrame,
        actorUserId: null,
      })
    : { prompt: buildStructuredVideoPrompt(promptInput), enhanced: false };
  const config = getMarketingVideoModel(sample.tier);
  const body = buildVeoRequestBody({
    prompt: enhancement.prompt,
    negativePrompt: buildVideoNegativePrompt(null, true),
    aspectRatio: sample.aspect,
    resolution: sample.resolution,
    durationSeconds: 8,
    startFrame,
  });
  const started = await geminiRequestWithKey(
    geminiModelPath(config.model, 'predictLongRunning'),
    body,
    { timeoutMs: 60_000 }
  );
  const operation = String(started.json.name ?? '');
  if (!operation) throw new Error('Veo did not return an operation');
  console.log(`  … ${sample.id} rendering (${operation.split('/').pop()})`);

  const deadline = Date.now() + 10 * 60_000;
  let uri = '';
  let apiKey = started.apiKey;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    const polled = await geminiRequestWithKey(operation, null, {
      method: 'GET',
      timeoutMs: 30_000,
      keySpecificStatuses: [404],
    });
    const status = polled.json as {
      done?: boolean;
      error?: { message?: string };
      response?: {
        generateVideoResponse?: {
          generatedSamples?: Array<{ video?: { uri?: string } }>;
          raiMediaFilteredReasons?: string[];
        };
      };
    };
    if (!status.done) continue;
    apiKey = polled.apiKey;
    if (status.error) throw new Error(`Veo failed: ${status.error.message ?? 'unknown'}`);
    uri = status.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ?? '';
    if (!uri) {
      throw new Error(
        `Veo returned no video (${JSON.stringify(status.response?.generateVideoResponse?.raiMediaFilteredReasons ?? [])})`
      );
    }
    break;
  }
  if (!uri) throw new Error('Timed out waiting for Veo');
  const video = await fetchGeneratedVideoBytes(uri, apiKey);
  const { dir, n } = await nextAttempt(sample.id);
  await Deno.writeFile(`${dir}/${n}.mp4`, video.bytes);
  await Deno.copyFile(startPath, `${dir}/start.jpg`);
  await Deno.writeTextFile(
    `${dir}/${n}.json`,
    JSON.stringify(
      {
        sampleId: sample.id,
        model: config.model,
        hostPrompt: sample.prompt,
        sentPrompt: enhancement.prompt,
        promptEnhanced: enhancement.enhanced,
        file: `${n}.mp4`,
        createdAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log(`  ✓ ${sample.id} #${n} (${Math.round(video.bytes.byteLength / 1024)} KB)`);
}

async function main() {
  loadDotEnv(`${ROOT}supabase/.env.local`);
  assertLocalSupabase();
  ids.organizationId = Deno.env.get('SAMPLES_ORG_ID') ?? '';
  ids.propertyId = Deno.env.get('SAMPLES_PROPERTY_ID') ?? '';
  if (!ids.organizationId || !ids.propertyId) {
    throw new Error(
      'Set SAMPLES_ORG_ID and SAMPLES_PROPERTY_ID to a local org/property (usage rows land there)'
    );
  }

  const only = arg('only')?.split(',').filter(Boolean) ?? null;
  const kind = arg('kind');
  const attempts = Math.min(4, Math.max(1, Number(arg('attempts') ?? 1)));
  const photos = PHOTO_SAMPLES.filter((s) => (!only || only.includes(s.id)) && kind !== 'video');
  const clips = CLIP_SAMPLES.filter((s) => (!only || only.includes(s.id)) && kind !== 'image');

  let failures = 0;
  const attempt = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      failures += 1;
      console.error(`  ✗ ${label}: ${(err as Error).message}`);
    }
  };

  for (let i = 0; i < attempts; i += 1) {
    console.log(`Attempt ${i + 1}/${attempts}`);
    // Photos one at a time (rate limits); clips in parallel (each waits minutes on Veo).
    for (const sample of photos) await attempt(sample.id, () => makePhoto(sample));
    await Promise.all(clips.map((sample) => attempt(sample.id, () => makeClip(sample))));
  }
  if (failures > 0) console.error(`${failures} attempt(s) failed`);
}

await main();
