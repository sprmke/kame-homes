import { usePreviewOverride } from '@/features/guest/lib/previewOverrideContext';

/** Page Editor preview overrides that render through the showcase template engine. */
function isTemplateEditorOverride(kind: string | undefined): boolean {
  return kind === 'property-showcase' || kind === 'stay-guide';
}

/** True when showcase chrome must stay inside a nested scrollport (Page Editor, embed iframe). */
export function useShowcaseContainedChrome(embed: boolean): boolean {
  const override = usePreviewOverride();
  return embed || isTemplateEditorOverride(override?.kind);
}

/** True when palette / motion should follow editor config live (no guest localStorage). */
export function useShowcaseConfigControlled(): boolean {
  const override = usePreviewOverride();
  return isTemplateEditorOverride(override?.kind);
}
