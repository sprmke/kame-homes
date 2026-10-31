import {
  type VideoProject,
  type VideoScene,
  type VideoTransition,
  VIDEO_SCENE_DURATION,
  VIDEO_FPS,
  VIDEO_TRANSITION_FRAMES,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import { defaultTextLayoutForSceneKind } from '@/features/dashboard/marketing/lib/video/videoTextSlots';

export function createSceneId(): string {
  return `scene-${crypto.randomUUID().slice(0, 8)}`;
}

export function sceneDurationInFrames(scene: VideoScene, fps: number): number {
  return Math.max(1, Math.round(scene.durationSec * fps));
}

export function transitionDurationInFrames(transition: VideoTransition): number {
  return transition === 'none' ? 0 : VIDEO_TRANSITION_FRAMES;
}

export function videoProjectDurationInFrames(project: VideoProject): number {
  const { fps, scenes } = project;
  if (scenes.length === 0) return fps * 2;

  let total = 0;
  scenes.forEach((scene, index) => {
    total += sceneDurationInFrames(scene, fps);
    if (index > 0) {
      total -= transitionDurationInFrames(scene.transition);
    }
  });

  return Math.max(fps * 2, total);
}

/** First frame index of a scene in the full composition timeline. */
export function sceneStartFrame(project: VideoProject, sceneIndex: number): number {
  const { fps, scenes } = project;
  if (sceneIndex <= 0) return 0;

  let frame = 0;
  for (let i = 0; i < sceneIndex; i++) {
    const scene = scenes[i];
    if (!scene) break;
    frame += sceneDurationInFrames(scene, fps);
  }

  const scene = scenes[sceneIndex];
  if (scene && sceneIndex > 0) {
    frame -= transitionDurationInFrames(scene.transition);
  }

  return Math.max(0, frame);
}

/**
 * Frame to show when selecting a clip for edit/preview.
 * Past the incoming transition so hosts see this clip’s media, not the previous clip fading out.
 */
export function sceneSettledPreviewFrame(project: VideoProject, sceneIndex: number): number {
  const start = sceneStartFrame(project, sceneIndex);
  const scene = project.scenes[sceneIndex];
  if (!scene) return start;

  const sceneFrames = sceneDurationInFrames(scene, project.fps);
  const incoming = sceneIndex > 0 ? transitionDurationInFrames(scene.transition) : 0;
  const offset = Math.min(incoming, Math.max(0, sceneFrames - 1));
  const total = videoProjectDurationInFrames(project);
  return Math.min(start + offset, Math.max(0, total - 1));
}

/** Exclusive end frame for a scene (first frame of the next scene, or project end). */
export function sceneEndFrame(project: VideoProject, sceneIndex: number): number {
  const { scenes } = project;
  if (sceneIndex < 0 || sceneIndex >= scenes.length) {
    return videoProjectDurationInFrames(project);
  }
  if (sceneIndex + 1 >= scenes.length) {
    return videoProjectDurationInFrames(project);
  }
  return sceneStartFrame(project, sceneIndex + 1);
}

export function sceneFrameRange(
  project: VideoProject,
  sceneIndex: number
): { start: number; end: number } {
  return {
    start: sceneStartFrame(project, sceneIndex),
    end: sceneEndFrame(project, sceneIndex),
  };
}

/** Scene index containing `frame` (clamped). */
export function sceneIndexAtFrame(project: VideoProject, frame: number): number {
  if (project.scenes.length === 0) return 0;

  const total = videoProjectDurationInFrames(project);
  const clamped = Math.max(0, Math.min(frame, Math.max(0, total - 1)));

  for (let i = project.scenes.length - 1; i >= 0; i -= 1) {
    if (clamped >= sceneStartFrame(project, i)) return i;
  }

  return 0;
}

export function updateScene(
  project: VideoProject,
  sceneId: string,
  patch: Partial<VideoScene>
): VideoProject {
  return {
    ...project,
    scenes: project.scenes.map((scene) =>
      scene.id === sceneId ? { ...scene, ...patch, texts: patch.texts ?? scene.texts } : scene
    ),
  };
}

export function reorderScenes(
  project: VideoProject,
  fromIndex: number,
  toIndex: number
): VideoProject {
  const scenes = [...project.scenes];
  const [moved] = scenes.splice(fromIndex, 1);
  if (!moved) return project;
  scenes.splice(toIndex, 0, moved);
  return {
    ...project,
    scenes: scenes.map((scene, index) =>
      index === 0 ? { ...scene, transition: 'none' as const } : scene
    ),
  };
}

export function removeScene(project: VideoProject, sceneId: string): VideoProject {
  if (project.scenes.length <= 1) return project;
  const scenes = project.scenes.filter((scene) => scene.id !== sceneId);
  if (scenes[0]) {
    scenes[0] = { ...scenes[0], transition: 'none' };
  }
  return { ...project, scenes };
}

export function addPhotoScene(
  project: VideoProject,
  imageUrl: string | null,
  backgroundMediaType: 'image' | 'video' = 'image'
): VideoProject {
  const scene: VideoScene = {
    id: createSceneId(),
    kind: 'photo',
    label: 'Photo',
    durationSec: VIDEO_SCENE_DURATION.default,
    transition: 'fade',
    imageUrl,
    backgroundMediaType,
    texts: {
      headline: '',
      subheadline: '',
      promoLine: '',
      ctaLine: '',
      slotLabels: [],
      rulesLine: '',
    },
    textLayout: defaultTextLayoutForSceneKind('photo', project.templateId),
  };
  return { ...project, scenes: [...project.scenes, scene] };
}

export function defaultFps(): number {
  return VIDEO_FPS;
}
