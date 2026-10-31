import {
  VIDEO_MOTION_OVERRIDES,
  type VideoMotionOverride,
} from '@/features/dashboard/marketing/lib/video/videoMotionProfiles';
import type {
  VideoScene,
  VideoSceneKind,
  VideoSceneTextFields,
  VideoTransition,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import { VIDEO_SCENE_DURATION } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import { applySceneKindChange } from '@/features/dashboard/marketing/lib/video/videoSceneKindChange';
import type { VideoOverlayMode } from '@/features/dashboard/marketing/lib/video/videoStoryboardRecipes';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SCENE_KINDS: { value: VideoSceneKind; label: string }[] = [
  { value: 'photo', label: 'Photo' },
  { value: 'promo', label: 'Promo' },
  { value: 'slots', label: 'Slots' },
  { value: 'cta', label: 'CTA' },
];

const TRANSITIONS: { value: VideoTransition; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'dissolve', label: 'Dissolve' },
  { value: 'slide-left', label: 'Slide left' },
  { value: 'slide-up', label: 'Slide up' },
  { value: 'push-cut', label: 'Push cut' },
  { value: 'wipe', label: 'Wipe' },
  { value: 'clock-wipe', label: 'Clock wipe' },
  { value: 'flip', label: 'Flip' },
  { value: 'zoom-in-out', label: 'Zoom in out' },
];

const OVERLAYS: { value: VideoOverlayMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'soft-scrim', label: 'Soft scrim' },
  { value: 'bottom-band', label: 'Bottom band' },
  { value: 'top-band', label: 'Top band' },
];

/** Radix Select has no empty-string value, so "use the template motion" needs a sentinel. */
const MOTION_TEMPLATE_DEFAULT = 'template';

type SceneChangeHandler = (scene: VideoScene) => void;

export function VideoSceneMetaSettings({
  scene,
  sceneIndex,
  onChange,
  templateTextSeed,
  templateId,
}: {
  scene: VideoScene;
  sceneIndex: number;
  onChange: SceneChangeHandler;
  templateTextSeed?: VideoSceneTextFields;
  templateId?: string;
}) {
  const patch = (partial: Partial<VideoScene>) => onChange({ ...scene, ...partial });

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="scene-label">Label</Label>
        <Input
          id="scene-label"
          value={scene.label}
          onChange={(e) => patch({ label: e.target.value })}
          className="h-10"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="scene-kind">Layout</Label>
        <Select
          value={scene.kind}
          onValueChange={(value) => {
            const kind = value as VideoSceneKind;
            if (kind === scene.kind) return;
            onChange(applySceneKindChange(scene, kind, templateTextSeed, templateId));
          }}
        >
          <SelectTrigger id="scene-kind" className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCENE_KINDS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="scene-duration">
          Duration ({VIDEO_SCENE_DURATION.min}–{VIDEO_SCENE_DURATION.max}s)
        </Label>
        <Input
          id="scene-duration"
          type="number"
          min={VIDEO_SCENE_DURATION.min}
          max={VIDEO_SCENE_DURATION.max}
          step={0.5}
          value={scene.durationSec}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (Number.isFinite(next)) {
              patch({
                durationSec: Math.min(
                  VIDEO_SCENE_DURATION.max,
                  Math.max(VIDEO_SCENE_DURATION.min, next)
                ),
              });
            }
          }}
          className="h-10"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="scene-overlay">Overlay</Label>
        <Select
          value={scene.overlay ?? 'soft-scrim'}
          onValueChange={(value) => patch({ overlay: value as VideoOverlayMode })}
        >
          <SelectTrigger id="scene-overlay" className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OVERLAYS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="scene-motion">Motion</Label>
        <Select
          value={scene.motion ?? MOTION_TEMPLATE_DEFAULT}
          onValueChange={(value) =>
            patch({
              motion:
                value === MOTION_TEMPLATE_DEFAULT ? undefined : (value as VideoMotionOverride),
            })
          }
        >
          <SelectTrigger id="scene-motion" className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={MOTION_TEMPLATE_DEFAULT}>Template default</SelectItem>
            {VIDEO_MOTION_OVERRIDES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sceneIndex > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="scene-transition">Transition in</Label>
          <Select
            value={scene.transition}
            onValueChange={(value) => patch({ transition: value as VideoTransition })}
          >
            <SelectTrigger id="scene-transition" className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSITIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
