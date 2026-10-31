// Every video template profile and every per-scene motion override must produce
// finite spring / transform values at every frame. Remotion's spring() merges the
// passed config over its defaults, so an explicit `undefined` yields NaN — this
// guards that regression. Run: bun scripts/dev/check-video-motion-profiles.mjs
import { fileURLToPath } from 'node:url';

import { spring } from 'remotion';

const src = await import(
  fileURLToPath(
    new URL(
      '../../ui/src/features/dashboard/marketing/lib/video/videoMotionProfiles.ts',
      import.meta.url
    )
  )
);
const {
  DEFAULT_VIDEO_MOTION_PROFILE,
  VIDEO_MOTION_OVERRIDES,
  backgroundMotionTransform,
  resolveSceneMotionProfile,
  resolveVideoMotionProfile,
} = src;

const TEMPLATE_IDS = [
  'quiet-morning',
  'golden-hour',
  'poolside-calm',
  'amenity-tour',
  'weekday-cut',
  'percent-off',
  'rainy-day-rate',
  'one-left',
  'three-dates',
  'this-weekend',
  'guest-love',
  'stay-again',
  'sold-out-stamp',
  'join-waitlist',
  'ber-months',
  'holiday-glow',
];

const FPS = 30;
const DURATION = 120;
const failures = [];

function checkProfile(name, profile) {
  if (!Number.isFinite(profile.springDamping) || !Number.isFinite(profile.springStiffness)) {
    failures.push(`${name}: non-finite spring config`);
    return;
  }

  for (let frame = 0; frame <= DURATION; frame += 1) {
    const enter = spring({
      frame,
      fps: FPS,
      config: { damping: profile.springDamping, stiffness: profile.springStiffness },
    });
    if (!Number.isFinite(enter)) {
      failures.push(`${name}: spring() returned ${enter} at frame ${frame}`);
      break;
    }

    const offsetY = (1 - enter) * profile.entryOffsetY;
    const offsetX = (1 - enter) * profile.entryOffsetX;
    if (!Number.isFinite(offsetY) || !Number.isFinite(offsetX)) {
      failures.push(`${name}: non-finite entry offset at frame ${frame}`);
      break;
    }

    const progress = frame / DURATION;
    const zoom = profile.zoomFrom + (profile.zoomTo - profile.zoomFrom) * progress;
    for (const sceneIndex of [0, 1]) {
      const transform = backgroundMotionTransform(profile, progress, sceneIndex, zoom);
      if (/NaN|Infinity|undefined/.test(transform)) {
        failures.push(`${name}: transform "${transform}" at frame ${frame}`);
      }
    }

    if (!Number.isFinite(profile.ctaRevealFrames) || profile.ctaRevealFrames <= 0) {
      failures.push(`${name}: ctaRevealFrames is ${profile.ctaRevealFrames}`);
      break;
    }
  }
}

checkProfile('fallback (unknown template id)', resolveVideoMotionProfile('does-not-exist'));
checkProfile('fallback (undefined template id)', resolveVideoMotionProfile(undefined));

let checked = 2;
for (const templateId of TEMPLATE_IDS) {
  const profile = resolveVideoMotionProfile(templateId);
  if (profile === DEFAULT_VIDEO_MOTION_PROFILE) {
    failures.push(`${templateId}: has no motion profile of its own`);
  }
  checkProfile(templateId, profile);
  checked += 1;

  for (const { value } of VIDEO_MOTION_OVERRIDES) {
    checkProfile(`${templateId} + ${value}`, resolveSceneMotionProfile(profile, value));
    checked += 1;
  }

  const untouched = resolveSceneMotionProfile(profile, undefined);
  if (untouched !== profile) {
    failures.push(`${templateId}: undefined override did not fall through to the template profile`);
  }
}

// The fallback profile has no pan, so it must render its authored zoom exactly —
// a blanket safety buffer would silently crop pre-motion projects on frame 1.
const fallbackStart = backgroundMotionTransform(
  DEFAULT_VIDEO_MOTION_PROFILE,
  0,
  0,
  DEFAULT_VIDEO_MOTION_PROFILE.zoomFrom
);
if (!fallbackStart.includes('scale(1.0000)')) {
  failures.push(`fallback profile starts at "${fallbackStart}", expected scale(1.0000)`);
}

// A panning profile still needs the floor, or the sweep exposes the frame edge.
const panning = { ...DEFAULT_VIDEO_MOTION_PROFILE, panXPct: 4, zoomFrom: 1, zoomTo: 1 };
const panningStart = backgroundMotionTransform(panning, 0, 0, panning.zoomFrom);
const panningScale = Number(/scale\(([\d.]+)\)/.exec(panningStart)?.[1]);
if (!(panningScale >= 1 + panning.panXPct / 100)) {
  failures.push(`panning profile scale ${panningScale} does not cover a ${panning.panXPct}% sweep`);
}

// Storyboard text beats must have authored layout positions (not the 50/50 fallback).
const recipesMod = await import(
  fileURLToPath(
    new URL(
      '../../ui/src/features/dashboard/marketing/lib/video/videoStoryboardRecipes.ts',
      import.meta.url
    )
  )
);
const layoutsMod = await import(
  fileURLToPath(
    new URL(
      '../../ui/src/features/dashboard/marketing/lib/video/videoTemplateLayouts.ts',
      import.meta.url
    )
  )
);
const { VIDEO_STORYBOARD_RECIPES } = recipesMod;
const { textLayoutForTemplate } = layoutsMod;

const SLOT_BEATS = new Set([
  'headline',
  'subheadline',
  'promoLine',
  'ctaLine',
  'rulesLine',
  'slotLabels',
]);

for (const recipe of VIDEO_STORYBOARD_RECIPES) {
  for (const clip of recipe.clips) {
    const layout = textLayoutForTemplate(recipe.id, clip.kind);
    for (const beat of clip.textBeats) {
      if (!SLOT_BEATS.has(beat)) continue;
      const pos = layout[beat];
      if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
        failures.push(
          `${recipe.id} / ${clip.role} (${clip.kind}): missing layout for text beat "${beat}"`
        );
      }
    }
  }
}

// Build every recipe project and assert storyboard text beats become overlay layers.
const defaultsMod = await import(
  fileURLToPath(
    new URL(
      '../../ui/src/features/dashboard/marketing/lib/video/videoProjectDefaults.ts',
      import.meta.url
    )
  )
);
const { buildDefaultVideoProject } = defaultsMod;
const emptyBinding = {
  propertyName: 'Sample Property',
  propertyPhoto: 'https://example.com/photo.jpg',
  propertyMedia: [{ url: 'https://example.com/photo.jpg', type: 'image' }],
  monthLabel: 'August',
  monthShort: 'Aug',
  nightlyRate: '₱4,500',
  availabilityText: 'Open dates',
  openSlots: [
    { dateNum: '2', dayName: 'Sat' },
    { dateNum: '9', dayName: 'Sat' },
    { dateNum: '16', dayName: 'Sat' },
  ],
};

for (const recipe of VIDEO_STORYBOARD_RECIPES) {
  const project = buildDefaultVideoProject(recipe.id, recipe.category, emptyBinding, 'instagram-story');
  if (project.scenes.length !== recipe.clips.length) {
    failures.push(
      `${recipe.id}: expected ${recipe.clips.length} scenes, got ${project.scenes.length}`
    );
  }
  recipe.clips.forEach((clip, index) => {
    const scene = project.scenes[index];
    if (!scene) return;
    if (scene.overlay !== clip.overlay) {
      failures.push(
        `${recipe.id} / ${clip.role}: overlay ${scene.overlay} !== recipe ${clip.overlay}`
      );
    }
    if (Math.abs(scene.durationSec - clip.durationSec) > 0.05) {
      failures.push(
        `${recipe.id} / ${clip.role}: duration ${scene.durationSec} !== ${clip.durationSec}`
      );
    }
    const layers = scene.layers ?? [];
    const overlayText = layers.filter((layer) => layer.kind !== 'background');
    const expectedBeats = clip.textBeats.length;
    if (overlayText.length < expectedBeats) {
      failures.push(
        `${recipe.id} / ${clip.role}: expected ≥${expectedBeats} text layers, got ${overlayText.length}`
      );
    }
    // No two text layers should share nearly the same center (overlap).
    for (let i = 0; i < overlayText.length; i += 1) {
      for (let j = i + 1; j < overlayText.length; j += 1) {
        const a = overlayText[i].position;
        const b = overlayText[j].position;
        if (!a || !b) continue;
        const dy = Math.abs(a.y - b.y);
        const dx = Math.abs(a.x - b.x);
        if (dy < 10 && dx < 20) {
          failures.push(
            `${recipe.id} / ${clip.role}: overlapping layers at (~${a.x},${a.y}) and (~${b.x},${b.y})`
          );
        }
      }
    }
  });
}

if (failures.length > 0) {
  console.error(`FAIL (${failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`OK — ${checked} motion profiles finite across ${DURATION + 1} frames each.`);
console.log(`OK — ${VIDEO_STORYBOARD_RECIPES.length} recipes have layout positions for every text beat.`);
console.log(`OK — ${VIDEO_STORYBOARD_RECIPES.length} recipes seed scenes with matching overlays, durations, and text layers.`);
