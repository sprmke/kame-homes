import { useEffect } from 'react';

import { Icon } from '@blueprintjs/core';
import { NewTextBox } from '@blueprintjs/icons';
import { observer } from 'mobx-react-lite';
import { SectionTab } from 'openpolotno/side-panel/side-panel';

import {
  KameSidePanelGroup,
  KameSidePanelShell,
} from '@/features/dashboard/marketing/components/design-editor/polotno/KameSidePanelShell';
import type { PolotnoStore } from '@/features/dashboard/marketing/lib/polotno/polotnoStore';

import { cn } from '@/lib/utils';

type TextPreset = {
  id: string;
  preview: string;
  text: string;
  fontSize: number;
  previewClassName: string;
  /** Theme type role used for this preset. */
  role: 'display' | 'label' | 'body';
};

/** Theme fonts + text color for new text (falls back to Roboto / black without a theme). */
export type KameTextTheme = {
  fonts: { display: string; body: string; label: string };
  ink: string;
};

const TEXT_PRESETS: TextPreset[] = [
  {
    id: 'heading',
    preview: 'Heading',
    text: 'Heading',
    fontSize: 76,
    previewClassName: 'text-xl font-bold',
    role: 'display',
  },
  {
    id: 'subheading',
    preview: 'Subheading',
    text: 'Subheading',
    fontSize: 44,
    previewClassName: 'text-base font-semibold',
    role: 'label',
  },
  {
    id: 'body',
    preview: 'Body text',
    text: 'Body text',
    fontSize: 28,
    previewClassName: 'text-sm font-normal',
    role: 'body',
  },
];

function addTextToCanvas(
  store: PolotnoStore,
  attrs: { fontSize: number; text: string; fontFamily?: string; fill?: string }
) {
  const page = store.activePage as
    | {
        addElement: (el: Record<string, unknown>) => { toggleEditMode?: (on: boolean) => void };
      }
    | undefined;
  if (!page) return;

  const width = store.width / 2;
  const scale = (store.width + store.height) / 2160;
  const fontSize = attrs.fontSize * scale;
  const x = store.width / 2 - width / 2;
  const y = store.height / 2 - fontSize / 2;

  const el = page.addElement({
    type: 'text',
    fontFamily: attrs.fontFamily ?? 'Roboto',
    ...(attrs.fill ? { fill: attrs.fill } : {}),
    text: attrs.text,
    fontSize,
    width,
    x,
    y,
  });
  el.toggleEditMode?.(true);
}

export const KameTextPanel = observer(function KameTextPanel({
  store,
  textTheme,
}: {
  store: PolotnoStore;
  textTheme?: KameTextTheme | null;
}) {
  useEffect(() => {
    const families = textTheme
      ? [textTheme.fonts.display, textTheme.fonts.label, textTheme.fonts.body]
      : ['Roboto'];
    for (const family of new Set(families)) store.loadFont?.(family);
  }, [store, textTheme]);

  return (
    <KameSidePanelShell title="Text">
      <KameSidePanelGroup label="Add text">
        <div className="space-y-2">
          {TEXT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={cn(
                'border-border bg-background hover:bg-muted',
                'flex min-h-[48px] w-full items-center rounded-lg border px-3 text-left transition-colors'
              )}
              onClick={() =>
                addTextToCanvas(store, {
                  fontSize: preset.fontSize,
                  text: preset.text,
                  fontFamily: textTheme?.fonts[preset.role],
                  fill: textTheme?.ink,
                })
              }
            >
              <span
                className={cn('text-foreground truncate', preset.previewClassName)}
                style={
                  textTheme
                    ? { fontFamily: `"${textTheme.fonts[preset.role]}", sans-serif` }
                    : undefined
                }
              >
                {preset.preview}
              </span>
            </button>
          ))}
        </div>
      </KameSidePanelGroup>
    </KameSidePanelShell>
  );
});

export function createTextSection(textTheme?: KameTextTheme | null) {
  return {
    name: 'text',
    Tab: observer(function TextTab(props: Record<string, unknown>) {
      return (
        <SectionTab name="Text" iconSize={16} {...props}>
          <Icon icon={<NewTextBox />} />
        </SectionTab>
      );
    }),
    Panel: observer(function TextPanelWrapper({ store }: { store: PolotnoStore }) {
      return <KameTextPanel store={store} textTheme={textTheme} />;
    }),
  };
}
