// Renders compositions into ./out.
//   node scripts/render.mjs [stills|videos|all] [filter]
// Stills → out/stills/<concept>/<format>.png, videos → out/videos/<id>.mp4,
// feature series → out/features/<nn-module>/<format>.png|mp4.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const mode = process.argv[2] ?? 'all';
const filter = process.argv[3] ?? '';
const bin = 'node_modules/.bin/remotion';
const entry = 'src/index.ts';

const ids = execFileSync(bin, ['compositions', entry, '-q'], { encoding: 'utf8' })
  .split(/\s+/)
  .filter((id) => /^(still|video)-/.test(id) && id.includes(filter));

for (const id of ids) {
  const isVideo = id.startsWith('video-');
  if ((mode === 'stills' && isVideo) || (mode === 'videos' && !isVideo)) continue;
  const name = id.replace(/^(still|video)-/, '');
  let out;
  const feat = name.match(/^feature-(\d+-[a-z-]+?)-(story|portrait|square|landscape|link|email)$/);
  if (feat) {
    // Feature series: one folder per module, stills and videos side by side.
    const dir = `out/features/${feat[1]}`;
    mkdirSync(dir, { recursive: true });
    out = `${dir}/${feat[2]}.${isVideo ? 'mp4' : 'png'}`;
  } else if (isVideo) {
    mkdirSync('out/videos', { recursive: true });
    out = `out/videos/${name}.mp4`;
  } else {
    const m = name.match(/^(\d+-[a-z-]+?)-(story|portrait|square|landscape|link|email|\d+)$/);
    const dir = `out/stills/${m ? m[1] : 'misc'}`;
    mkdirSync(dir, { recursive: true });
    out = `${dir}/${m ? m[2] : name}.png`;
  }
  const args = isVideo
    ? ['render', entry, id, out, '--codec=h264', '--crf=15', '--image-format=png', '--pixel-format=yuv420p', '--x264-preset=slow']
    : ['still', entry, id, out];
  console.log(`→ ${out}`);
  execFileSync(bin, args, { stdio: ['ignore', 'ignore', 'inherit'] });
}
