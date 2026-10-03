// Renders every still (PNG) and/or video (MP4) composition into ./out.
// Usage: node scripts/render.mjs [stills|videos|all] [filter]
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const mode = process.argv[2] ?? 'all';
const filter = process.argv[3] ?? '';
const bin = 'node_modules/.bin/remotion';
const entry = 'src/index.ts';

const list = execFileSync(bin, ['compositions', entry, '-q'], { encoding: 'utf8' })
  .split(/\s+/)
  .filter((id) => /^(still|video|carousel)-/.test(id) && id.includes(filter));

for (const id of list) {
  const isVideo = id.startsWith('video-');
  if (mode === 'stills' && isVideo) continue;
  if (mode === 'videos' && !isVideo) continue;
  const dir = isVideo ? 'out/videos' : 'out/stills';
  mkdirSync(dir, { recursive: true });
  const name = id.replace(/^(still|video)-/, '');
  const args = isVideo
    ? ['render', entry, id, `${dir}/${name}.mp4`, '--codec=h264', '--crf=16', '--image-format=png', '--pixel-format=yuv420p']
    : ['still', entry, id, `${dir}/${name}.png`, '--scale=1'];
  console.log(`→ ${id}`);
  execFileSync(bin, args, { stdio: 'inherit' });
}
