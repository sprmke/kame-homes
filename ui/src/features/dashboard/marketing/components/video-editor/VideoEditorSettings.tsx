import { useEffect, useMemo, useState } from 'react';

import { Clapperboard, Layers, Music } from 'lucide-react';

import { StyleSection } from '@/features/dashboard/marketing/components/calendar-builder/components/panels/StyleSection';
import {
  VideoMusicSettings,
  defaultProjectMusic,
} from '@/features/dashboard/marketing/components/video-editor/VideoMusicSettings';
import { VideoSceneElementsPanel } from '@/features/dashboard/marketing/components/video-editor/VideoSceneElementsPanel';
import { VideoSceneMetaSettings } from '@/features/dashboard/marketing/components/video-editor/VideoSceneSettings';
import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import { marketingFormatMeta } from '@/features/dashboard/marketing/lib/marketingFormats';
import type { PropertyMediaItem } from '@/features/dashboard/marketing/lib/polotno/propertyMedia';
import { VIDEO_FORMAT_DIMENSIONS } from '@/features/dashboard/marketing/lib/video/videoFormatDimensions';
import type {
  VideoProject,
  VideoScene,
  VideoSceneElementId,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import { updateScene } from '@/features/dashboard/marketing/lib/video/videoProjectUtils';
import { videoTemplateFieldsToSceneTexts } from '@/features/dashboard/marketing/lib/video/videoSceneKindChange';
import type { VideoTypographyContext } from '@/features/dashboard/marketing/lib/video/videoTemplateTypography';
import { defaultVideoFields } from '@/features/dashboard/marketing/lib/videoCampaignTemplates';


type Props = {
  project: VideoProject;
  selectedScene: VideoScene;
  selectedSceneIndex: number;
  propertyImages: PropertyMediaItem[];
  templateTypography: VideoTypographyContext;
  logoUrl?: string | null;
  onProjectChange: (project: VideoProject) => void;
  binding: DesignBinding;
  selectedElementId: VideoSceneElementId | null;
  onSelectElement: (id: VideoSceneElementId | null) => void;
  elementFocusRequest?: number;
};

export function VideoEditorSettings({
  project,
  selectedScene,
  selectedSceneIndex,
  propertyImages,
  templateTypography,
  logoUrl = null,
  onProjectChange,
  binding,
  selectedElementId,
  onSelectElement,
  elementFocusRequest = 0,
}: Props) {
  const [elementsOpen, setElementsOpen] = useState(true);
  const [sceneOpen, setSceneOpen] = useState(true);

  useEffect(() => {
    if (elementFocusRequest <= 0) return;
    setElementsOpen(true);
    setSceneOpen(true);
  }, [elementFocusRequest]);

  const handleSceneChange = (scene: VideoScene) => {
    onProjectChange(updateScene(project, scene.id, scene));
  };

  const formatDims = VIDEO_FORMAT_DIMENSIONS[project.format];
  const formatMeta = marketingFormatMeta(formatDims.width, formatDims.height);

  const templateTextSeed = useMemo(
    () => videoTemplateFieldsToSceneTexts(defaultVideoFields(project.templateId, binding)),
    [project.templateId, binding]
  );

  return (
    <div className="w-full min-w-0 max-w-full pb-2">
      <p className="text-muted-foreground mb-3 text-xs">
        {project.scenes.length} scenes · {formatMeta.resolutionLabel}
      </p>

      <StyleSection
        title={`Scene ${selectedSceneIndex + 1}`}
        icon={<Clapperboard className="size-4" />}
        open={sceneOpen}
        onOpenChange={setSceneOpen}
      >
        <VideoSceneMetaSettings
          scene={selectedScene}
          sceneIndex={selectedSceneIndex}
          onChange={handleSceneChange}
          templateTextSeed={templateTextSeed}
          templateId={project.templateId}
        />
      </StyleSection>

      <StyleSection
        title="Elements"
        icon={<Layers className="size-4" />}
        open={elementsOpen}
        onOpenChange={setElementsOpen}
      >
        <VideoSceneElementsPanel
          scene={selectedScene}
          propertyImages={propertyImages}
          templateTypography={templateTypography}
          logoUrl={logoUrl}
          templateTextSeed={templateTextSeed}
          selectedElementId={selectedElementId}
          onSelectElement={onSelectElement}
          onChange={handleSceneChange}
          elementFocusRequest={elementFocusRequest}
        />
      </StyleSection>

      <StyleSection
        title="Music"
        icon={<Music className="size-4" />}
        defaultOpen={Boolean(project.music?.url || project.music?.title)}
        keepChildrenMounted
      >
        <VideoMusicSettings
          music={defaultProjectMusic(project.music)}
          onChange={(music) => onProjectChange({ ...project, music })}
        />
      </StyleSection>

    </div>
  );
}
