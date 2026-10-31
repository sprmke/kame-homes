// Renders compositions into ./out.
//   node scripts/render.mjs [stills|videos|all] [filter]      (SKIP=1 skips files that exist)
//
// Output:
//   out/campaign/<nn-concept>/<format>.png|mp4 · <n>.png for carousel slides
//   out/features/<nn-module>/ad/<format>.png|mp4      product ad
//   out/features/<nn-module>/hook/<format>.png        question hook post
//   out/features/<nn-module>/carousel/<n>.png         how-it-works carousel
//   out/features/<nn-module>/reel/story.mp4           hook-first reel
//   out/mascot/<name>.png                             Kame reference sheets
//
// --gl=angle: the mascot campaign renders Kame with WebGL (three.js); headless Chrome
// needs a GL backend for it. Harmless for the 2D compositions.
//   out/filipino/...                                  Filipino set (ids with a `fil-` prefix), same tree
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const mode = process.argv[2] ?? 'all';
const filter = process.argv[3] ?? '';
const skip = process.env.SKIP === '1';
const bin = 'node_modules/.bin/remotion';
const entry = 'src/index.ts';

const FMT = '(story|portrait|square|landscape|link|email|\\d+)';

/** Composition id → output path. */
function outPath(id) {
  const isVideo = id.startsWith('video-');
  const ext = isVideo ? 'mp4' : 'png';
  let name = id.replace(/^(still|video)-/, '');
  const lang = name.startsWith('fil-') ? 'filipino/' : '';
  name = name.replace(/^fil-/, '');
  const rules = [
    [new RegExp(`^feature-(\\d+-[a-z-]+?)-${FMT}$`), (m) => `features/${m[1]}/ad/${m[2]}`],
    [new RegExp(`^fhook-(\\d+-[a-z-]+?)-${FMT}$`), (m) => `features/${m[1]}/hook/${m[2]}`],
    [new RegExp(`^fsteps-(\\d+-[a-z-]+?)-${FMT}$`), (m) => `features/${m[1]}/carousel/${m[2]}`],
    [new RegExp(`^freel-(\\d+-[a-z-]+?)-${FMT}$`), (m) => `features/${m[1]}/reel/${m[2]}`],
    [new RegExp(`^(\\d+-[a-z-]+?)-${FMT}$`), (m) => `campaign/${m[1]}/${m[2]}`],
    [/^kame-([a-z-]+)$/, (m) => `mascot/${m[1]}`],
  ];
  for (const [re, to] of rules) {
    const m = name.match(re);
    if (m) return `out/${lang}${to(m)}.${ext}`;
  }
  return `out/${lang}misc/${name}.${ext}`;
}

const ids = execFileSync(bin, ['compositions', entry, '-q'], { encoding: 'utf8' })
  .split(/\s+/)
  .filter((id) => /^(still|video)-/.test(id) && id.includes(filter));

for (const id of ids) {
  const isVideo = id.startsWith('video-');
  if ((mode === 'stills' && isVideo) || (mode === 'videos' && !isVideo)) continue;
  const out = outPath(id);
  if (skip && existsSync(out)) continue;
  mkdirSync(dirname(out), { recursive: true });
  const args = isVideo
    ? [
        'render',
        entry,
        id,
        out,
        '--codec=h264',
        '--crf=15',
        '--image-format=png',
        '--pixel-format=yuv420p',
        '--x264-preset=slow',
        '--gl=angle',
      ]
    : ['still', entry, id, out, '--gl=angle'];
  console.log(`→ ${out}`);
  execFileSync(bin, args, { stdio: ['ignore', 'ignore', 'inherit'] });
}
