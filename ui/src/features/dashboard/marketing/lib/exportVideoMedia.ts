import { renderMediaOnWeb } from '@remotion/web-renderer';
import { toast } from 'sonner';

import type { VideoCompositionProps } from '@/features/dashboard/marketing/components/video-editor/VideoCompositions';

type ExportVideoInput = {
  templateId: string;
  component: React.ComponentType<VideoCompositionProps>;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  inputProps: VideoCompositionProps;
  onProgress?: (progress: number) => void;
};

export async function exportVideoToBlob(input: ExportVideoInput): Promise<Blob> {
  const toastId = 'video-export';
  toast.loading('Rendering video…', { id: toastId });

  try {
    const result = await renderMediaOnWeb({
      composition: {
        id: input.templateId,
        component: input.component,
        width: input.width,
        height: input.height,
        fps: input.fps,
        durationInFrames: input.durationInFrames,
        defaultProps: input.inputProps,
      },
      inputProps: input.inputProps,
      container: 'mp4',
      muted: !input.inputProps.project.music?.url,
      onProgress: (progress) => {
        input.onProgress?.(progress.progress);
      },
    });

    const blob = await result.getBlob();
    toast.success('Video ready', { id: toastId });
    return blob;
  } catch (error) {
    console.error('Video export error:', error);
    toast.error('Video export failed', { id: toastId });
    throw error;
  }
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
