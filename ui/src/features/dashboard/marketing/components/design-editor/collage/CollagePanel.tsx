import { observer } from 'mobx-react-lite';

import { CollageCellList } from '@/features/dashboard/marketing/components/design-editor/collage/CollageCellList';
import { CollageLayoutGrid } from '@/features/dashboard/marketing/components/design-editor/collage/CollageLayoutGrid';
import { CollageStyleControls } from '@/features/dashboard/marketing/components/design-editor/collage/CollageStyleControls';
import type { MarketingUploads } from '@/features/dashboard/marketing/components/design-editor/polotno/useMarketingUploads';
import { MarketingSidebarSection } from '@/features/dashboard/marketing/components/shared/MarketingSidebarSection';
import {
  applyCollageLayout,
  getCollageSettings,
  isStoreInCollageMode,
  startCollageDocument,
} from '@/features/dashboard/marketing/lib/collage/collageStoreOps';
import type { PolotnoStore } from '@/features/dashboard/marketing/lib/polotno/polotnoStore';
import type { PropertyMediaItem } from '@/features/dashboard/marketing/lib/polotno/propertyMedia';
import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';

type Props = {
  store: PolotnoStore;
  format: DesignTemplateFormat;
  propertyImages: PropertyMediaItem[];
  uploads: MarketingUploads;
  /** Called once, the moment a non-collage canvas turns into a fresh collage. */
  onCollageStarted?: () => void;
};

export const CollagePanel = observer(function CollagePanel({
  store,
  format,
  propertyImages,
  uploads,
  onCollageStarted,
}: Props) {
  const isCollage = isStoreInCollageMode(store);
  const settings = getCollageSettings(store);

  const handleSelectLayout = (layoutId: string) => {
    if (isCollage) {
      void applyCollageLayout(store, layoutId);
    } else {
      onCollageStarted?.();
      startCollageDocument(store, layoutId, format);
    }
  };

  return (
    <div className="space-y-5">
      <MarketingSidebarSection title="Layout" collapsible={false}>
        <CollageLayoutGrid
          selectedLayoutId={isCollage ? settings.layoutId : null}
          onSelect={handleSelectLayout}
        />
      </MarketingSidebarSection>

      {isCollage ? (
        <>
          <MarketingSidebarSection title="Photos">
            <CollageCellList store={store} propertyImages={propertyImages} uploads={uploads} />
          </MarketingSidebarSection>
          <MarketingSidebarSection title="Style">
            <CollageStyleControls store={store} settings={settings} />
          </MarketingSidebarSection>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">Pick a layout above to start your collage.</p>
      )}
    </div>
  );
});
