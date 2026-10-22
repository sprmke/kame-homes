import '@/features/dashboard/marketing/lib/polotno/configurePolotnoOverlays';

import { useEffect, useMemo, useRef, type CSSProperties } from 'react';

import { Popover, Tooltip } from '@blueprintjs/core';
import { RaeditorContainer, SidePanelWrap, WorkspaceWrap } from 'openpolotno';
import Workspace from 'openpolotno/canvas/workspace';
import SidePanel from 'openpolotno/side-panel/side-panel';
import Toolbar from 'openpolotno/toolbar/toolbar';
import ZoomButtons from 'openpolotno/toolbar/zoom-buttons';

import {
  createElementsSection,
  createLayersSection,
} from '@/features/dashboard/marketing/components/design-editor/polotno/KameBuiltinPanels';
import { KamePolotnoToolbarHistory } from '@/features/dashboard/marketing/components/design-editor/polotno/KamePolotnoToolbarHistory';
import { KameSidePanelCollapse } from '@/features/dashboard/marketing/components/design-editor/polotno/KameSidePanelCollapse';
import {
  aiSection,
  collageSection,
  reviewsSection,
  templatesSection,
} from '@/features/dashboard/marketing/components/design-editor/polotno/KameStudioSections';
import { createTextSection } from '@/features/dashboard/marketing/components/design-editor/polotno/KameTextPanel';
import { PolotnoPagePlanWatermark } from '@/features/dashboard/marketing/components/design-editor/polotno/PolotnoPagePlanWatermark';
import {
  createBackgroundSection,
  createUploadSection,
} from '@/features/dashboard/marketing/components/design-editor/polotno/PropertyMediaPanels';
import type { MarketingUploads } from '@/features/dashboard/marketing/components/design-editor/polotno/useMarketingUploads';
import { usePolotnoOverlayAnchor } from '@/features/dashboard/marketing/components/design-editor/polotno/usePolotnoOverlayAnchor';
import { usePolotnoOverlayDebug } from '@/features/dashboard/marketing/components/design-editor/polotno/usePolotnoOverlayDebug';
import { useUploadMarketingAsset } from '@/features/dashboard/marketing/hooks/useUploadMarketingAsset';
import { configurePolotnoUploader } from '@/features/dashboard/marketing/lib/polotno/initPolotno';
import type { PolotnoStore } from '@/features/dashboard/marketing/lib/polotno/polotnoStore';
import { polotnoWorkspaceChrome } from '@/features/dashboard/marketing/lib/polotno/polotnoWorkspaceTheme';
import { propertyMediaItems } from '@/features/dashboard/marketing/lib/polotno/propertyMedia';
import {
  resolveMarketingTheme,
  type MarketingThemeTokens,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';

import { useTheme } from '@/components/theme/ThemeProvider';

type Props = {
  store: PolotnoStore;
  propertyImageUrls: string[];
  brandColor: string;
  /** Active marketing theme: new text uses its fonts and text color. */
  theme?: MarketingThemeTokens | null;
  logoUrl?: string | null;
  style?: CSSProperties;
  onResetDesign?: () => void;
  resetDisabled?: boolean;
  /** Drop the toolbar's undo/redo/reset group (relocated to the mobile editor dock). */
  hideHistory?: boolean;
  /** Owned by the caller (`PolotnoDesignStudio`) so the Collage panel shares the same session grid. */
  sessionMedia: MarketingUploads;
  /** Templates / Collage / Reviews / AI rail sections (content via `KameStudioSectionsProvider`). */
  studioSections?: { ai: boolean };
  /** Rail section open on mount ('' = closed). */
  defaultSection?: string;
};

export function KamePolotnoEditor({
  store,
  propertyImageUrls,
  brandColor,
  theme = null,
  logoUrl = null,
  style,
  onResetDesign,
  resetDisabled = false,
  hideHistory = false,
  sessionMedia,
  studioSections,
  defaultSection = '',
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const workspaceChrome = useMemo(
    () => polotnoWorkspaceChrome(resolvedTheme === 'dark'),
    [resolvedTheme]
  );
  usePolotnoOverlayAnchor(rootRef);
  usePolotnoOverlayDebug(rootRef);

  useEffect(() => {
    const portal = portalRef.current;
    if (!portal) return;

    const popoverDefaults = Popover.defaultProps ?? {};
    const tooltipDefaults = Tooltip.defaultProps ?? {};

    Popover.defaultProps = {
      ...popoverDefaults,
      portalContainer: portal,
    };
    Tooltip.defaultProps = {
      ...tooltipDefaults,
      portalContainer: portal,
    };

    return () => {
      Popover.defaultProps = popoverDefaults;
      Tooltip.defaultProps = tooltipDefaults;
    };
  }, []);

  const propertyImages = useMemo(() => propertyMediaItems(propertyImageUrls), [propertyImageUrls]);
  const { mutateAsync: uploadMarketingAsset } = useUploadMarketingAsset();

  useEffect(() => {
    configurePolotnoUploader(async (file: File) => {
      const result = await uploadMarketingAsset(file);
      return result.url;
    });
  }, [uploadMarketingAsset]);

  const textTheme = useMemo(
    () => (theme ? { fonts: theme.fonts, ink: resolveMarketingTheme(theme).readableInk } : null),
    [theme]
  );

  const withAi = Boolean(studioSections?.ai);
  const withStudio = Boolean(studioSections);
  const sections = useMemo(
    () => [
      ...(withStudio ? [templatesSection] : []),
      createTextSection(textTheme),
      createElementsSection(logoUrl),
      createUploadSection(propertyImages, sessionMedia),
      createBackgroundSection(propertyImages, brandColor, sessionMedia),
      ...(withStudio ? [collageSection, reviewsSection] : []),
      ...(withAi ? [aiSection] : []),
      createLayersSection(),
    ],
    [propertyImages, brandColor, logoUrl, sessionMedia, textTheme, withStudio, withAi]
  );

  const toolbarComponents = useMemo(
    () => ({
      ActionControls: null,
      History: hideHistory
        ? () => null
        : (props: { store: PolotnoStore }) => (
            <KamePolotnoToolbarHistory
              store={props.store}
              onReset={onResetDesign}
              resetDisabled={resetDisabled}
            />
          ),
    }),
    [onResetDesign, resetDisabled, hideHistory]
  );

  return (
    <div ref={rootRef} className="kame-polotno-shell relative min-h-0 flex-1">
      <div ref={portalRef} className="kame-polotno-portal" aria-hidden />
      <PolotnoPagePlanWatermark rootRef={rootRef} />
      <RaeditorContainer className="raeditor-app-container kame-polotno-editor" style={style}>
        <SidePanelWrap className="kame-side-panel-wrap" data-tour="side-panel">
          <SidePanel
            store={store as never}
            sections={sections as never}
            defaultSection={defaultSection}
          />
          <KameSidePanelCollapse store={store} />
        </SidePanelWrap>
        <WorkspaceWrap data-tour="canvas">
          <Toolbar
            store={store as never}
            downloadButtonEnabled={false}
            components={toolbarComponents as never}
          />
          <Workspace store={store as never} {...workspaceChrome} />
          <ZoomButtons store={store as never} />
        </WorkspaceWrap>
      </RaeditorContainer>
    </div>
  );
}
