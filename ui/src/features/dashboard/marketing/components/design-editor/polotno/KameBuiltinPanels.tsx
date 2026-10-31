import { observer } from 'mobx-react-lite';
import { ElementsSection, LayersSection } from 'openpolotno/side-panel/side-panel';

import { KameElementsPanel } from '@/features/dashboard/marketing/components/design-editor/polotno/KameElementsPanel';
import { KameSidePanelShell } from '@/features/dashboard/marketing/components/design-editor/polotno/KameSidePanelShell';
import type { PolotnoStore } from '@/features/dashboard/marketing/lib/polotno/polotnoStore';

export function createElementsSection(logoUrl?: string | null) {
  return {
    name: ElementsSection.name,
    Tab: ElementsSection.Tab,
    Panel: observer(function KameElementsSectionPanel({ store }: { store: PolotnoStore }) {
      return <KameElementsPanel store={store} logoUrl={logoUrl} />;
    }),
  };
}

export function createLayersSection() {
  const Panel = LayersSection.Panel;

  return {
    name: LayersSection.name,
    Tab: LayersSection.Tab,
    Panel: observer(function KameLayersPanel({ store }: { store: PolotnoStore }) {
      return (
        <KameSidePanelShell title="Layers">
          <div className="kame-builtin-panel kame-layers-panel">
            <Panel store={store as never} />
          </div>
        </KameSidePanelShell>
      );
    }),
  };
}
