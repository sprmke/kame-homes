import * as React from 'react';

import { FeatureAvailabilityDialog } from '@/features/dashboard/super-admin/components/super-admin-feature-availability/FeatureAvailabilityDialog';
import { FeatureAvailabilityRow } from '@/features/dashboard/super-admin/components/super-admin-feature-availability/FeatureAvailabilityRow';
import { SuperAdminPage } from '@/features/dashboard/super-admin/components/shared/SuperAdminPage';
import {
  useDeleteUnusedFeatureAvailabilityRow,
  useFeatureAvailabilityAdmin,
  useUpdateFeatureAvailabilityAdmin,
  type FeatureAvailabilityAdminOverride,
} from '@/features/dashboard/super-admin/hooks/useFeatureAvailabilityAdmin';
import {
  countFeaturesOff,
  FEATURE_AVAILABILITY_MODULE_LABELS,
  groupCatalogByModule,
} from '@/features/dashboard/super-admin/lib/featureAvailabilityAdmin';

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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { FeatureAvailabilityCatalogEntry } from '@/lib/featureAvailability/featureAvailabilityCatalog';
import { appPageTitle, usePageTitle } from '@/lib/pageTitle';

type DialogState = {
  entry: FeatureAvailabilityCatalogEntry;
  override: FeatureAvailabilityAdminOverride | null;
};

type TurnOnConfirm = {
  entry: FeatureAvailabilityCatalogEntry;
};

export function SuperAdminFeatureAvailabilityPage() {
  usePageTitle(appPageTitle('Feature availability'));

  const { data, isLoading, error } = useFeatureAvailabilityAdmin();
  const update = useUpdateFeatureAvailabilityAdmin();
  const removeUnused = useDeleteUnusedFeatureAvailabilityRow();

  const [offOnly, setOffOnly] = React.useState(false);
  const [dialog, setDialog] = React.useState<DialogState | null>(null);
  const [turnOnConfirm, setTurnOnConfirm] = React.useState<TurnOnConfirm | null>(null);

  const offCount = data ? countFeaturesOff(data.resolved) : 0;

  const overridesByKey = React.useMemo(() => {
    const map = new Map<string, FeatureAvailabilityAdminOverride>();
    for (const row of data?.overrides ?? []) {
      map.set(row.feature_key, row);
    }
    return map;
  }, [data?.overrides]);

  const saveFromDialog = async (input: Parameters<typeof update.mutateAsync>[0]) => {
    try {
      await update.mutateAsync(input);
      setDialog(null);
      return true;
    } catch {
      return false;
    }
  };

  const confirmTurnOn = async () => {
    if (!turnOnConfirm) return;
    try {
      await update.mutateAsync({
        featureKey: turnOnConfirm.entry.key,
        isEnabled: true,
      });
      setTurnOnConfirm(null);
    } catch {
      /* toast from mutation */
    }
  };

  const handleToggle = (entry: FeatureAvailabilityCatalogEntry, nextEnabled: boolean) => {
    if (!data) return;
    if (nextEnabled) {
      setTurnOnConfirm({ entry });
      return;
    }
    setDialog({
      entry,
      override: overridesByKey.get(entry.key) ?? null,
    });
  };

  const moduleGroups = groupCatalogByModule();

  return (
    <SuperAdminPage
      title="Feature availability"
      subtitle="Turn product areas off for hosts with a reason, optional banner, and super-admin bypass."
      isLoading={isLoading}
      error={error}
      toolbar={
        data ? (
          <div className="flex flex-wrap items-center gap-3">
            {offCount > 0 ? (
              <Badge variant="secondary" className="text-sm font-normal">
                {offCount} {offCount === 1 ? 'feature off' : 'features off'}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-sm font-normal">
                All features on
              </Badge>
            )}
            <div className="flex min-h-[44px] items-center gap-2">
              <Switch
                id="fa-off-only"
                checked={offOnly}
                onCheckedChange={setOffOnly}
                aria-labelledby="fa-off-only-label"
              />
              <Label id="fa-off-only-label" htmlFor="fa-off-only" className="font-normal">
                Off only
              </Label>
            </div>
          </div>
        ) : null
      }
    >
      {data ? (
        <div className="space-y-4">
          {Array.from(moduleGroups.entries()).map(([module, entries]) => {
            const visible = entries.filter((entry) => {
              if (!offOnly) return true;
              return !data.resolved[entry.key]?.available;
            });
            if (visible.length === 0) return null;
            return (
              <Card key={module}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {FEATURE_AVAILABILITY_MODULE_LABELS[module]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {visible.map((entry) => {
                    const resolved = data.resolved[entry.key];
                    if (!resolved) return null;
                    const parentOff = !!entry.parent && !data.resolved[entry.parent]?.available;
                    return (
                      <FeatureAvailabilityRow
                        key={entry.key}
                        entry={entry}
                        resolved={resolved}
                        override={overridesByKey.get(entry.key) ?? null}
                        parentOff={parentOff}
                        onToggle={(next) => handleToggle(entry, next)}
                        onEdit={() =>
                          setDialog({
                            entry,
                            override: overridesByKey.get(entry.key) ?? null,
                          })
                        }
                      />
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}

          {data.unusedKeys.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Unused keys</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <p className="text-muted-foreground text-sm">
                  Rows left over after a catalog key was removed. Safe to delete.
                </p>
                <ul className="divide-border divide-y rounded-lg border">
                  {data.unusedKeys.map((key) => (
                    <li
                      key={key}
                      className="flex min-h-[44px] items-center justify-between gap-3 px-3 py-2"
                    >
                      <code className="text-xs">{key}</code>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={removeUnused.isPending}
                        onClick={() => void removeUnused.mutateAsync(key)}
                      >
                        Delete
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {dialog ? (
        <FeatureAvailabilityDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          entry={dialog.entry}
          initialOverride={dialog.override}
          onSave={saveFromDialog}
        />
      ) : null}

      <AlertDialog
        open={!!turnOnConfirm}
        onOpenChange={(open) => {
          if (!open) setTurnOnConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn on {turnOnConfirm?.entry.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Hosts will be able to use this feature again. Override reason and message are cleared
              on the server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmTurnOn()}>Turn on</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SuperAdminPage>
  );
}
