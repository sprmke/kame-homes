import { useEffect, useState } from 'react';

import { HardDriveDownload, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { InstallAppEntry } from '@/components/pwa/InstallAppEntry';
import { Button } from '@/components/ui/button';
import { PLATFORM_APP_NAME } from '@/lib/platformBranding';
import { getPwaCapabilities, requestPersistentStorage } from '@/lib/pwa/capabilities';
import { purgeOfflineState } from '@/lib/pwa/purgeOfflineState';
import { checkForPwaUpdate } from '@/lib/pwa/useRegisterSW';
import { cn } from '@/lib/utils';

type AppInfoCardProps = {
  className?: string;
};

type StorageState = {
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

/**
 * Offline storage panel: how much is cached, whether the browser has promised to
 * keep it, and one action to clear everything (PWA v2 tasks 5.14 / 4.8 / 2.2).
 */
function OfflineDataPanel() {
  const [state, setState] = useState<StorageState>({ usage: null, quota: null, persisted: null });
  const [clearing, setClearing] = useState(false);
  const caps = getPwaCapabilities();

  useEffect(() => {
    if (!caps.storageEstimate) return;
    let active = true;
    void (async () => {
      try {
        const estimate = await navigator.storage.estimate();
        const persisted = (await navigator.storage.persisted?.()) ?? null;
        if (active) {
          setState({
            usage: estimate.usage ?? null,
            quota: estimate.quota ?? null,
            persisted,
          });
        }
      } catch {
        // storage API blocked — the panel just omits the numbers
      }
    })();
    return () => {
      active = false;
    };
  }, [caps.storageEstimate]);

  return (
    <div className="border-border/70 mt-3 space-y-2 border-t pt-3">
      <p className="text-foreground text-xs font-semibold">Offline data</p>
      <p className="text-muted-foreground text-xs">
        {state.usage === null
          ? 'Storage usage is unavailable in this browser.'
          : `${formatBytes(state.usage)} used${state.quota ? ` of ${formatBytes(state.quota)}` : ''}`}
        {state.persisted === true
          ? ' · kept until you clear it'
          : state.persisted === false
            ? ' · may be cleared by the browser when space is low'
            : ''}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {state.persisted === false && caps.persistentStorage ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              void requestPersistentStorage().then((ok) => {
                setState((prev) => ({ ...prev, persisted: ok }));
                if (ok) toast.success('Offline data will be kept');
              });
            }}
          >
            <HardDriveDownload className="size-3.5" aria-hidden />
            Keep offline data
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          disabled={clearing}
          onClick={() => {
            setClearing(true);
            void purgeOfflineState()
              .then(() => {
                toast.success('Offline data cleared');
                setState((prev) => ({ ...prev, usage: 0 }));
              })
              .finally(() => setClearing(false));
          }}
        >
          Clear offline data
        </Button>
      </div>
      <p className="text-muted-foreground text-[11px] leading-snug">
        Clears cached pages, saved drafts and queued changes on this device. You stay signed in.
      </p>
    </div>
  );
}

/**
 * App version + "Check for updates" + the permanent install entry + offline
 * data controls. Support can ask "which build are you on?" and a host can clear
 * cached data without reinstalling.
 */
export function AppInfoCard({ className }: AppInfoCardProps) {
  const version = import.meta.env.VITE_APP_VERSION;

  return (
    <div className={cn('border-border bg-card rounded-xl border p-4', className)}>
      <p className="text-foreground text-sm font-semibold">{PLATFORM_APP_NAME} app</p>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {version ? `Version ${version}` : 'Version unavailable'}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => {
            checkForPwaUpdate();
          }}
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Check for updates
        </Button>
        <InstallAppEntry />
      </div>
      <OfflineDataPanel />
    </div>
  );
}
