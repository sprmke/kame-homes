import { useEffect, useMemo, useRef, useState } from 'react';

import { InputGroup } from '@blueprintjs/core';
import { Search } from '@blueprintjs/icons';
import { observer } from 'mobx-react-lite';
import { NounprojectPanel } from 'openpolotno/side-panel/elements-panel';
import { ImagesGrid } from 'openpolotno/side-panel/side-panel';

import {
  KameSidePanelGroup,
  KameSidePanelShell,
} from '@/features/dashboard/marketing/components/design-editor/polotno/KameSidePanelShell';
import {
  buildKamePolotnoShapes,
  KAME_POLOTNO_DEFAULT_SHAPE_FILL,
  type KamePolotnoShape,
} from '@/features/dashboard/marketing/lib/polotno/kamePolotnoShapes';
import {
  loadLogoNaturalSize,
  squareImageCoverCrop,
} from '@/features/dashboard/marketing/lib/polotno/orgLogoCircle';
import type { PolotnoStore } from '@/features/dashboard/marketing/lib/polotno/polotnoStore';
import { roundedOutlineSvgUrl } from '@/features/dashboard/marketing/lib/polotno/roundedOutlineSvg';

type LineStyleItem = { preview: string; data: Record<string, unknown> };
type GridPosition = { x: number; y: number };
type ImageGridItem = { url: string };
type GridTargetElement = {
  type?: string;
  contentEditable?: boolean;
  set: (patch: Record<string, unknown>) => void;
};

const LINE_STYLES: LineStyleItem[] = [
  {
    preview: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="16"><path stroke="#C0BFBF" strokeWidth="4" d="M 1 8 L 30 8"></path></svg>`)}`,
    data: {},
  },
  {
    preview: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="16"><path stroke="#C0BFBF" strokeWidth="4" stroke-dasharray="4 2" d="M 1 8 L 30 8"></path></svg>`)}`,
    data: { dash: [4, 2] },
  },
  {
    preview: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="16"><path stroke="#C0BFBF" strokeWidth="4" stroke-dasharray="1 1" d="M 1 8 L 30 8"></path></svg>`)}`,
    data: { dash: [1, 1] },
  },
];

function addShapeToCanvas(
  store: PolotnoStore,
  item: KamePolotnoShape,
  pos?: { x: number; y: number }
) {
  const page = (
    store as {
      activePage?: {
        computedWidth: number;
        computedHeight: number;
        addElement: (el: Record<string, unknown>) => void;
      };
    }
  ).activePage;
  if (!page) return;

  const ratio = (page.computedWidth + page.computedHeight) / 2160;
  const baseW = item.canvasWidth ?? item.width;
  const baseH = item.canvasHeight ?? item.height;
  const w = baseW * ratio;
  const h = baseH * ratio;
  const x = (pos?.x ?? page.computedWidth / 2) - w / 2;
  const y = (pos?.y ?? page.computedHeight / 2) - h / 2;

  if (item.kind === 'outline-svg') {
    const strokeWidth = Math.max(2, (item.strokeWidth / item.height) * h);
    page.addElement({
      type: 'svg',
      name: item.label,
      x,
      y,
      width: w,
      height: h,
      src: roundedOutlineSvgUrl({
        width: Math.round(w),
        height: Math.round(h),
        stroke: item.stroke,
        strokeWidth,
        cornerRadius: h / 2,
      }),
      keepRatio: false,
      stretchEnabled: true,
    });
    return;
  }

  const element: Record<string, unknown> = {
    type: 'figure',
    subType: item.subType,
    x,
    y,
    width: w,
    height: h,
    fill: KAME_POLOTNO_DEFAULT_SHAPE_FILL,
    stroke: item.stroke,
    strokeWidth: item.strokeWidth,
  };

  if (item.cornerRadius != null) {
    element.cornerRadius = (item.cornerRadius / item.height) * h;
  }

  page.addElement(element);
}

const KameLinesGrid = observer(function KameLinesGrid({ store }: { store: PolotnoStore }) {
  return (
    <ImagesGrid
      shadowEnabled={false}
      rowsNumber={3}
      images={LINE_STYLES}
      getPreview={(item: LineStyleItem) => item.preview}
      itemHeight={50}
      isLoading={false}
      onSelect={async (item: LineStyleItem, pos?: GridPosition) => {
        const page = (
          store as {
            activePage?: {
              computedWidth: number;
              computedHeight: number;
              addElement: (el: Record<string, unknown>) => void;
            };
          }
        ).activePage;
        if (!page) return;
        const w = page.computedWidth / 3;
        page.addElement({
          type: 'line',
          x: pos ? pos.x : page.computedWidth / 2 - w / 2,
          y: pos ? pos.y : page.computedHeight / 2,
          color: KAME_POLOTNO_DEFAULT_SHAPE_FILL,
          width: w,
          ...item.data,
        });
      }}
    />
  );
});

const KameLogoGrid = observer(function KameLogoGrid({
  store,
  logoUrl,
}: {
  store: PolotnoStore;
  logoUrl: string;
}) {
  const images = useMemo(() => [{ url: logoUrl }], [logoUrl]);

  return (
    <div className="kame-image-grid">
      <ImagesGrid
        shadowEnabled={false}
        rowsNumber={1}
        images={images}
        getPreview={(item: ImageGridItem) => item.url}
        isLoading={false}
        itemHeight={100}
        onSelect={async (item: ImageGridItem) => {
          const page = (
            store as {
              activePage?: {
                computedWidth: number;
                computedHeight: number;
                addElement: (el: Record<string, unknown>) => void;
              };
            }
          ).activePage;
          if (!page) return;

          const ratio = (page.computedWidth + page.computedHeight) / 2160;
          const size = Math.max(64, Math.round(120 * ratio));
          let crop = { cropX: 0, cropY: 0, cropWidth: 1, cropHeight: 1 };
          try {
            const dims = await loadLogoNaturalSize(item.url);
            crop = squareImageCoverCrop(dims.width, dims.height);
          } catch {
            // Keep full-frame crop.
          }

          page.addElement({
            type: 'image',
            name: 'Org logo',
            src: item.url,
            x: page.computedWidth / 2 - size / 2,
            y: page.computedHeight / 2 - size / 2,
            width: size,
            height: size,
            keepRatio: false,
            stretchEnabled: false,
            cornerRadius: size / 2,
            ...crop,
          });
        }}
      />
    </div>
  );
});

const KameShapesGrid = observer(function KameShapesGrid({ store }: { store: PolotnoStore }) {
  const shapes = useMemo(() => buildKamePolotnoShapes(), []);
  const rows = Math.ceil(shapes.length / 4) || 1;

  return (
    <div style={{ height: `${110 * rows}px` }}>
      <ImagesGrid
        shadowEnabled={false}
        rowsNumber={4}
        images={shapes}
        getPreview={(item: KamePolotnoShape) => item.url}
        isLoading={false}
        itemHeight={100}
        onSelect={async (item: KamePolotnoShape, pos?: GridPosition, el?: GridTargetElement) => {
          if (
            el &&
            (el as { type?: string }).type === 'image' &&
            (el as { contentEditable?: boolean }).contentEditable
          ) {
            (el as { set: (patch: Record<string, unknown>) => void }).set({ clipSrc: item.url });
            return;
          }
          if (
            el &&
            (el as { type?: string }).type === 'video' &&
            (el as { contentEditable?: boolean }).contentEditable
          ) {
            (el as { set: (patch: Record<string, unknown>) => void }).set({ clipSrc: item.url });
            return;
          }
          addShapeToCanvas(store, item as KamePolotnoShape, pos ?? undefined);
        }}
      />
    </div>
  );
});

export const KameElementsPanel = observer(function KameElementsPanel({
  store,
  logoUrl = null,
}: {
  store: PolotnoStore;
  logoUrl?: string | null;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [inputValue, setInputValue] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setQuery(inputValue);
    }, 500);
    return () => {
      clearTimeout(timerRef.current);
    };
  }, [inputValue]);

  const hasQuery = query.length > 0;

  return (
    <KameSidePanelShell
      title="Elements"
      header={
        <InputGroup
          leftIcon={<Search />}
          placeholder="Search icons"
          onChange={(e) => {
            setInputValue(e.target.value);
          }}
          type="search"
        />
      }
    >
      {hasQuery ? (
        <NounprojectPanel store={store as never} query={query} />
      ) : (
        <div className="space-y-4">
          {logoUrl?.trim() ? (
            <KameSidePanelGroup label="Logo">
              <KameLogoGrid store={store} logoUrl={logoUrl.trim()} />
            </KameSidePanelGroup>
          ) : null}
          <KameSidePanelGroup label="Lines">
            <KameLinesGrid store={store} />
          </KameSidePanelGroup>
          <KameSidePanelGroup label="Shapes">
            <KameShapesGrid store={store} />
          </KameSidePanelGroup>
        </div>
      )}
    </KameSidePanelShell>
  );
});
