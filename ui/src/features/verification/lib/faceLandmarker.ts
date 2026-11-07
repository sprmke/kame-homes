/**
 * MediaPipe FaceLandmarker loader.
 *
 * Loaded lazily from a pinned CDN with a runtime `import()` so neither the SDK nor the
 * ~13 MB model ever enters the app bundle. Any failure (blocked CDN, old WebGL, no camera)
 * throws, and `useLivenessChallenges` turns that into "skip liveness", never a dead end.
 */

const TASKS_VISION_VERSION = '0.10.22';
const CDN_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

type FaceLandmarkerLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number
  ) => {
    faceBlendshapes?: Array<{ categories: Array<{ categoryName: string; score: number }> }>;
    facialTransformationMatrixes?: Array<{ data: number[] }>;
    faceLandmarks?: Array<Array<{ x: number; y: number; z: number }>>;
  };
  close: () => void;
};

type FaceLandmarkerModule = {
  FilesetResolver: { forVisionTasks: (path: string) => Promise<unknown> };
  FaceLandmarker: {
    createFromOptions: (
      fileset: unknown,
      options: Record<string, unknown>
    ) => Promise<FaceLandmarkerLike>;
  };
};

let cached: FaceLandmarkerLike | null = null;
let loading: Promise<FaceLandmarkerLike> | null = null;

export async function loadFaceLandmarker(): Promise<FaceLandmarkerLike> {
  if (cached) return cached;
  if (loading) return loading;

  loading = (async () => {
    const moduleUrl = `${CDN_BASE}/vision_bundle.mjs`;
    const vision = (await import(/* @vite-ignore */ moduleUrl)) as FaceLandmarkerModule;
    const fileset = await vision.FilesetResolver.forVisionTasks(`${CDN_BASE}/wasm`);
    const landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
    cached = landmarker;
    return landmarker;
  })();

  try {
    return await loading;
  } catch (error) {
    loading = null;
    throw error;
  }
}

export function resetFaceLandmarker(): void {
  try {
    cached?.close();
  } catch {
    // Never let cleanup throw into an unmount path.
  }
  cached = null;
  loading = null;
}

export type FaceSample = {
  /** Left + right eye closure, 0..1 each. */
  blinkLeft: number;
  blinkRight: number;
  /** Jaw open, 0..1. */
  jawOpen: number;
  /** Head yaw in degrees from the transformation matrix, when available. */
  yawDegrees: number | null;
  /** Face is present in the frame at all. */
  faceDetected: boolean;
};

function blendScore(
  categories: Array<{ categoryName: string; score: number }>,
  name: string
): number {
  return categories.find((category) => category.categoryName === name)?.score ?? 0;
}

/** Yaw (degrees) from a column-major 4x4 matrix; `null` when the shape is unexpected. */
export function yawFromMatrix(data: number[] | null | undefined): number | null {
  if (!data || data.length < 16) return null;
  // Rotation about Y: atan2(-m[2], m[0]) for a standard right-handed matrix.
  const m00 = data[0];
  const m02 = data[2];
  if (typeof m00 !== 'number' || typeof m02 !== 'number') return null;
  return (Math.atan2(-m02, m00) * 180) / Math.PI;
}

export function sampleFace(result: ReturnType<FaceLandmarkerLike['detectForVideo']>): FaceSample {
  const categories = result.faceBlendshapes?.[0]?.categories ?? [];
  const matrix = result.facialTransformationMatrixes?.[0]?.data ?? null;
  return {
    blinkLeft: blendScore(categories, 'eyeBlinkLeft'),
    blinkRight: blendScore(categories, 'eyeBlinkRight'),
    jawOpen: blendScore(categories, 'jawOpen'),
    yawDegrees: yawFromMatrix(matrix),
    faceDetected: Boolean(result.faceLandmarks?.[0]?.length),
  };
}

export function detectVideo(
  landmarker: FaceLandmarkerLike,
  video: HTMLVideoElement,
  timestampMs: number
): FaceSample {
  return sampleFace(landmarker.detectForVideo(video, timestampMs));
}

export const LIVENESS_THRESHOLDS = {
  /** Blendshape score that counts as a closed eye. */
  blinkClosed: 0.45,
  /** Yaw magnitude (degrees) that counts as a head turn. */
  turnDegrees: 18,
  /** Jaw blendshape that counts as an open mouth. */
  jawOpen: 0.45,
} as const;
