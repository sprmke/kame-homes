import { useMemo } from 'react';

import { Icon } from '@blueprintjs/core';
import { CloudUpload, LayoutGrid } from '@blueprintjs/icons';
import { observer } from 'mobx-react-lite';
import { selectImage } from 'openpolotno/side-panel/select-image';
import { ImagesGrid, SectionTab } from 'openpolotno/side-panel/side-panel';

import {
  KameSidePanelGroup,
  KameSidePanelShell,
} from '@/features/dashboard/marketing/components/design-editor/polotno/KameSidePanelShell';
import { PropertyMediaUploadButton } from '@/features/dashboard/marketing/components/design-editor/polotno/PropertyMediaUploadButton';
import {
  mergePropertyMediaItems,
  type MarketingUploads,
} from '@/features/dashboard/marketing/components/design-editor/polotno/useMarketingUploads';
import type { PolotnoStore } from '@/features/dashboard/marketing/lib/polotno/polotnoStore';
import type { PropertyMediaItem } from '@/features/dashboard/marketing/lib/polotno/propertyMedia';

import { resolveOrgBrandHex } from '@/lib/theme/brandColor';
import { cn } from '@/lib/utils';

type PanelProps = {
  store: PolotnoStore;
  propertyImages: PropertyMediaItem[];
  sessionMedia: MarketingUploads;
};

type PropertyMediaGridItem = { url: string; preview: string };

const BASE_BG_PRESETS = ['#0f172a', '#ffffff', '#5c3d2e', '#16a34a', '#2563eb'] as const;

export function buildBackgroundColorPresets(brandColor: string): string[] {
  const brand = resolveOrgBrandHex(brandColor);
  const brandLower = brand.toLowerCase();
  const rest = BASE_BG_PRESETS.filter((color) => color.toLowerCase() !== brandLower);
  return [brand, ...rest];
}

export const PropertyUploadPanel = observer(function PropertyUploadPanel({
  store,
  propertyImages,
  sessionMedia,
}: PanelProps) {
  const { sessionUploads, isUploading, appendFiles } = sessionMedia;

  const allImages = useMemo(
    () => mergePropertyMediaItems(propertyImages, sessionUploads),
    [propertyImages, sessionUploads]
  );

  const addImageToCanvas = (src: string) => {
    void selectImage({ src, store: store as never });
  };

  return (
    <KameSidePanelShell
      title="Upload"
      header={
        <PropertyMediaUploadButton
          disabled={isUploading}
          onFilesSelected={(files) => appendFiles(files)}
        />
      }
    >
      {allImages.length > 0 ? (
        <KameSidePanelGroup label="Images">
          <div className="kame-image-grid">
            <ImagesGrid
              images={allImages}
              isLoading={isUploading}
              hideNoResults
              getPreview={(item: PropertyMediaGridItem) => item.preview}
              onSelect={(item: PropertyMediaGridItem) => addImageToCanvas(item.url)}
            />
          </div>
        </KameSidePanelGroup>
      ) : (
        <p className="text-muted-foreground text-center text-sm">No images yet</p>
      )}
    </KameSidePanelShell>
  );
});

export const PropertyBackgroundPanel = observer(function PropertyBackgroundPanel({
  store,
  propertyImages,
  brandColor,
  sessionMedia,
}: PanelProps & { brandColor: string }) {
  const { sessionUploads, isUploading, appendFiles } = sessionMedia;

  const page = store.activePage as
    { background?: string; set: (patch: { background: string }) => void } | undefined;
  const currentBg = page?.background ?? '#0f172a';
  const colorPresets = useMemo(() => buildBackgroundColorPresets(brandColor), [brandColor]);

  const allImages = useMemo(
    () => mergePropertyMediaItems(propertyImages, sessionUploads),
    [propertyImages, sessionUploads]
  );

  const setBackground = (background: string) => {
    page?.set({ background });
  };

  return (
    <KameSidePanelShell
      title="Background"
      header={
        <PropertyMediaUploadButton
          disabled={isUploading}
          onFilesSelected={(files) => appendFiles(files)}
        />
      }
    >
      <div className="space-y-4">
        <KameSidePanelGroup label="Colors">
          <div className="flex flex-wrap gap-2">
            {colorPresets.map((color, index) => (
              <button
                key={color}
                type="button"
                aria-label={index === 0 ? 'Brand color' : `Background ${color}`}
                aria-pressed={currentBg.toLowerCase() === color.toLowerCase()}
                className={cn(
                  'border-border size-9 rounded-lg border shadow-sm transition-shadow',
                  currentBg.toLowerCase() === color.toLowerCase() &&
                    'ring-primary ring-2 ring-offset-2'
                )}
                style={{ background: color }}
                onClick={() => setBackground(color)}
              />
            ))}
          </div>
        </KameSidePanelGroup>

        <KameSidePanelGroup label="Photos">
          {allImages.length > 0 ? (
            <div className="kame-image-grid">
              <ImagesGrid
                images={allImages}
                isLoading={isUploading}
                hideNoResults
                getPreview={(item: PropertyMediaGridItem) => item.preview}
                onSelect={(item: PropertyMediaGridItem) => setBackground(item.url)}
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-center text-sm">No images yet</p>
          )}
        </KameSidePanelGroup>
      </div>
    </KameSidePanelShell>
  );
});

export function createUploadSection(
  propertyImages: PropertyMediaItem[],
  sessionMedia: MarketingUploads
) {
  return {
    name: 'upload',
    Tab: observer(function UploadTab(props: Record<string, unknown>) {
      return (
        <SectionTab name="Upload" iconSize={16} {...props}>
          <Icon icon={<CloudUpload />} />
        </SectionTab>
      );
    }),
    Panel: observer(function UploadPanelWrapper({ store }: { store: PolotnoStore }) {
      return (
        <PropertyUploadPanel
          store={store}
          propertyImages={propertyImages}
          sessionMedia={sessionMedia}
        />
      );
    }),
  };
}

export function createBackgroundSection(
  propertyImages: PropertyMediaItem[],
  brandColor: string,
  sessionMedia: MarketingUploads
) {
  return {
    name: 'background',
    Tab: observer(function BackgroundTab(props: Record<string, unknown>) {
      return (
        <SectionTab name="Background" iconSize={16} {...props}>
          <Icon icon={<LayoutGrid />} />
        </SectionTab>
      );
    }),
    Panel: observer(function BackgroundPanelWrapper({ store }: { store: PolotnoStore }) {
      return (
        <PropertyBackgroundPanel
          store={store}
          propertyImages={propertyImages}
          brandColor={brandColor}
          sessionMedia={sessionMedia}
        />
      );
    }),
  };
}
