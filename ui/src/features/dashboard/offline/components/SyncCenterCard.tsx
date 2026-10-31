import { AlertTriangle, RotateCw, Trash2, UploadCloud } from 'lucide-react';

import { useOfflineSyncStore } from '@/features/dashboard/offline/store/offlineSyncStore';

import { Button } from '@/components/ui/button';
import { discardOutboxItem, drainOutbox, retryOutboxItem } from '@/lib/pwa/syncEngine';

function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/**
 * Pending + failed offline changes. Hidden entirely when the outbox is empty.
 */
export function SyncCenterCard() {
  const items = useOfflineSyncStore((s) => s.items);
  const syncing = useOfflineSyncStore((s) => s.syncing);
  const lastSyncedAt = useOfflineSyncStore((s) => s.lastSyncedAt);

  if (items.length === 0) return null;

  const pending = items.filter((i) => i.status === 'pending');
  const failed = items.filter((i) => i.status === 'failed');

  return (
    <div className="border-border bg-card rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UploadCloud className="text-primary h-4 w-4" />
          <p className="text-foreground text-sm font-semibold">Offline changes</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          disabled={syncing || pending.length === 0}
          onClick={() => void drainOutbox()}
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </Button>
      </div>

      <p className="text-muted-foreground mt-0.5 text-xs">
        {pending.length} waiting
        {failed.length > 0 ? ` · ${failed.length} failed` : ''}
        {lastSyncedAt ? ` · last synced ${timeAgo(lastSyncedAt)}` : ''}
      </p>

      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="border-border/60 flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-foreground truncate text-sm">{item.label}</p>
              <p className="text-muted-foreground truncate text-xs">
                {item.status === 'failed' ? (
                  <span className="text-destructive inline-flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {item.lastError ?? 'Failed'}
                  </span>
                ) : (
                  `Queued ${timeAgo(item.createdAt)}${item.attempts > 0 ? ` · ${item.attempts} attempt${item.attempts === 1 ? '' : 's'}` : ''}`
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {item.status === 'failed' && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Retry"
                  onClick={() => void retryOutboxItem(item.id)}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Discard"
                onClick={() => void discardOutboxItem(item.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
