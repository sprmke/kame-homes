import { AudioItemInspector } from '@/features/dashboard/marketing/components/video-editor/v2/inspector/AudioItemInspector';
import type { InspectorActions } from '@/features/dashboard/marketing/components/video-editor/v2/inspector/InspectorShared';
import { LayerItemInspector } from '@/features/dashboard/marketing/components/video-editor/v2/inspector/LayerItemInspector';
import { MediaItemInspector } from '@/features/dashboard/marketing/components/video-editor/v2/inspector/MediaItemInspector';
import { ProjectInspectorV2 } from '@/features/dashboard/marketing/components/video-editor/v2/inspector/ProjectInspectorV2';
import { itemLabel } from '@/features/dashboard/marketing/lib/video/v2/editorCommands';
import { findItem } from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import {
  isAudioItem,
  isLayerItem,
  type VideoProjectV2,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

type Props = {
  actions: InspectorActions;
  selectedIds: string[];
  onProjectChange: (updater: (project: VideoProjectV2) => VideoProjectV2) => void;
};

/** Title for the inspector header: what is selected. */
export function inspectorTitle(project: VideoProjectV2, selectedIds: string[]): string {
  if (selectedIds.length > 1) return `${selectedIds.length} selected`;
  const loc = selectedIds[0] ? findItem(project, selectedIds[0]) : null;
  return loc ? itemLabel(loc.item) : 'Video';
}

export function VideoInspectorV2({ actions, selectedIds, onProjectChange }: Props) {
  const { project } = actions;
  if (selectedIds.length > 1) {
    return <p className="text-muted-foreground text-sm">Select one clip to edit it.</p>;
  }
  const loc = selectedIds[0] ? findItem(project, selectedIds[0]) : null;
  if (!loc) return <ProjectInspectorV2 project={project} onChange={onProjectChange} />;
  const { item } = loc;
  if (isLayerItem(item)) return <LayerItemInspector key={item.id} item={item} actions={actions} />;
  if (isAudioItem(item)) return <AudioItemInspector key={item.id} item={item} actions={actions} />;
  return <MediaItemInspector key={item.id} item={item} actions={actions} />;
}
