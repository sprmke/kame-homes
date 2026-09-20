import { useEffect, useMemo, useState } from 'react';

import { Clapperboard, Film, Layers, Music } from 'lucide-react';

import { StyleSection } from '@/features/dashboard/marketing/components/calendar-builder/components/panels/StyleSection';
import { MarketingOverflowMenu } from '@/features/dashboard/marketing/components/shared/MarketingOverflowMenu';
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

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';

type Props = {
  project: VideoProject;
  selectedScene: VideoScene;
  selectedSceneIndex: number;
  propertyImages: PropertyMediaItem[];
  templateTypography: VideoTypographyContext;
  logoUrl?: string | null;
  templateName: string;
  savedTemplateId?: string | null;
  onRenameSavedTemplate?: (name: string) => void | Promise<void>;
  onDeleteSavedTemplate?: () => void | Promise<void>;
  onRenameDisplayName?: (name: string) => void;
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
  templateName,
  savedTemplateId,
  onRenameSavedTemplate,
  onDeleteSavedTemplate,
  onRenameDisplayName,
  onProjectChange,
  binding,
  selectedElementId,
  onSelectElement,
  elementFocusRequest = 0,
}: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nameValue, setNameValue] = useState(templateName);
  const [elementsOpen, setElementsOpen] = useState(true);
  const [sceneOpen, setSceneOpen] = useState(true);

  useEffect(() => {
    setNameValue(templateName);
  }, [templateName]);

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

  const commitName = () => {
    const trimmed = nameValue.trim();
    if (!trimmed) {
      setNameValue(templateName);
      return;
    }
    if (trimmed === templateName) return;

    if (savedTemplateId && onRenameSavedTemplate) {
      void onRenameSavedTemplate(trimmed);
      return;
    }
    onRenameDisplayName?.(trimmed);
  };

  const deleteMenu =
    savedTemplateId && onDeleteSavedTemplate ? (
      <MarketingOverflowMenu
        label="Template options"
        menuItems={[
          {
            id: 'delete',
            label: 'Delete',
            destructive: true,
            onSelect: () => setDeleteOpen(true),
          },
        ]}
        triggerClassName="min-h-[44px] min-w-[44px]"
      />
    ) : null;

  return (
    <div className="w-full min-w-0 max-w-full pb-2">
      <StyleSection
        icon={<Film className="size-4" />}
        defaultOpen
        headerActions={deleteMenu}
        titleContent={
          <Input
            value={nameValue}
            onChange={(event) => setNameValue(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }
            }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            className="h-10 min-w-0 flex-1 text-sm font-medium"
            aria-label="Template name"
          />
        }
      >
        <p className="text-muted-foreground text-xs">
          {project.scenes.length} scenes · {formatMeta.resolutionLabel}
        </p>
      </StyleSection>

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

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="max-w-[min(calc(100vw-1.5rem),24rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void onDeleteSavedTemplate?.()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
