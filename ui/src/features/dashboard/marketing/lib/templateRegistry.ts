export type DesignTemplateFormat =
  | 'instagram-post'
  | 'instagram-portrait'
  | 'instagram-story'
  | 'facebook-post';

export const DESIGN_FORMAT_DIMENSIONS: Record<
  DesignTemplateFormat,
  { width: number; height: number; label: string }
> = {
  'instagram-post': { width: 1080, height: 1080, label: 'Instagram Post' },
  'instagram-portrait': { width: 1080, height: 1350, label: 'Instagram Portrait' },
  'instagram-story': { width: 1080, height: 1920, label: 'Instagram Story' },
  'facebook-post': { width: 1200, height: 630, label: 'Facebook Post' },
};

/**
 * Formats with hand-built Design presets. 4:5 portrait is produced by AI Post
 * (lib/poster) and opens in the Design editor, but the preset library has not been
 * tuned for it, so the editor's format picker only lists it while it's the open format.
 */
export const DESIGN_PRESET_FORMATS: DesignTemplateFormat[] = [
  'instagram-post',
  'instagram-story',
  'facebook-post',
];
