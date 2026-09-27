import { useEffect, useState } from 'react';

import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import { PropertyLocationPicker } from '@/features/dashboard/org/components/property-settings/PropertyLocationPicker';
import {
  buildGoogleMapsUrl,
  clonePropertyLocationFields,
  isPropertyLocationManageValid,
  PROPERTY_LOCATION_MANAGE_FIELD_IDS,
  propertyLocationFieldsEqual,
  type PropertyLocationFields,
} from '@/features/dashboard/org/lib/propertyLocation';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { cn } from '@/lib/utils';

type Props = {
  value: PropertyLocationFields;
  disabled?: boolean;
  persistPending?: boolean;
  onChange: (next: PropertyLocationFields) => void;
  /** Persist to the server (modal Save). Draft-only if omitted. */
  onPersist?: (next: PropertyLocationFields) => Promise<void>;
  onFieldInteract?: (fieldId: string) => void;
  /** Inline picker (Setup Guide). */
  embedded?: boolean;
};

export function PropertyLocationSettingsBlock({
  value,
  disabled = false,
  persistPending = false,
  onChange,
  onPersist,
  onFieldInteract,
  embedded = false,
}: Props) {
  const [manageOpen, setManageOpen] = useState(false);
  const [session, setSession] = useState<PropertyLocationFields | null>(null);
  const [sessionBaseline, setSessionBaseline] = useState<PropertyLocationFields | null>(null);
  const [saving, setSaving] = useState(false);

  const summaryAddress = value.address.trim() || 'No address set';
  const mapsUrl =
    value.mapsUrl.trim() ||
    (value.latitude != null && value.longitude != null
      ? buildGoogleMapsUrl(value.latitude, value.longitude, value.placeId)
      : null);
  const canOpenMaps = Boolean(mapsUrl);

  const handleCopyMapsLink = async () => {
    if (!mapsUrl) return;
    try {
      await navigator.clipboard.writeText(mapsUrl);
      toast.success('Maps link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const sessionDirty = Boolean(
    session && sessionBaseline && !propertyLocationFieldsEqual(session, sessionBaseline)
  );
  const sessionValid = session ? isPropertyLocationManageValid(session) : false;
  const canSave = Boolean(
    session && sessionDirty && sessionValid && !disabled && !saving && !persistPending
  );

  const openManage = () => {
    const snapshot = clonePropertyLocationFields(value);
    setSession(snapshot);
    setSessionBaseline(clonePropertyLocationFields(snapshot));
    setManageOpen(true);
  };

  const closeManageClean = () => {
    setManageOpen(false);
    setSession(null);
    setSessionBaseline(null);
    setSaving(false);
  };

  const handleSave = async (): Promise<boolean> => {
    if (!session || !canSave) {
      for (const fieldId of PROPERTY_LOCATION_MANAGE_FIELD_IDS) {
        onFieldInteract?.(fieldId);
      }
      return false;
    }
    const next = clonePropertyLocationFields(session);
    for (const fieldId of PROPERTY_LOCATION_MANAGE_FIELD_IDS) {
      onFieldInteract?.(fieldId);
    }
    if (!onPersist) {
      onChange(next);
      closeManageClean();
      return true;
    }
    setSaving(true);
    try {
      await onPersist(next);
      closeManageClean();
      return true;
    } catch {
      // Parent surfaces toast; keep modal open with session intact.
      return false;
    } finally {
      setSaving(false);
    }
  };

  const { onOpenChange: guardedOpenChange, dialogProps } = useGuardedClose({
    open: manageOpen,
    onOpenChange: (next) => {
      if (next) openManage();
      else closeManageClean();
    },
    isDirty: sessionDirty,
    onSave: handleSave,
  });

  const applySessionPatch = (patch: Partial<PropertyLocationFields>) => {
    setSession((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  // Surface required-field errors while Save is disabled.
  useEffect(() => {
    if (!manageOpen || !sessionDirty || sessionValid) return;
    for (const fieldId of PROPERTY_LOCATION_MANAGE_FIELD_IDS) {
      onFieldInteract?.(fieldId);
    }
  }, [manageOpen, onFieldInteract, sessionDirty, sessionValid]);

  const resolvedAddressError =
    session && !session.address.trim() && sessionDirty ? 'Enter the street address' : null;

  const resolvedMapError =
    session && sessionDirty && (session.latitude == null || session.longitude == null)
      ? 'Pin your property on the map'
      : null;

  if (embedded) {
    return (
      <PropertyLocationPicker
        value={value}
        disabled={disabled || persistPending}
        onFieldInteract={onFieldInteract}
        onChange={(patch) => onChange({ ...value, ...patch })}
      />
    );
  }

  return (
    <>
      <div className="bg-muted/40 flex min-h-0 w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 sm:gap-3 sm:px-4 sm:py-3">
        <p className="min-w-0 truncate text-xs font-medium sm:text-sm">{summaryAddress}</p>
        <div className="flex shrink-0 items-center gap-1">
          {canOpenMaps ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={disabled}
                className="settings-action !size-8 p-0"
                asChild
              >
                <a
                  href={mapsUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open in Google Maps"
                  title="Open in Google Maps"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                className="settings-action !size-8 border-0 p-0"
                aria-label="Copy Google Maps link"
                title="Copy link"
                onClick={() => void handleCopyMapsLink()}
              >
                <Copy className="size-3.5" aria-hidden />
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="settings-action"
            disabled={disabled}
            onClick={openManage}
          >
            Manage
          </Button>
        </div>
      </div>

      <ResponsiveModal
        open={manageOpen}
        onOpenChange={(open) => {
          if (!open && saving) return;
          guardedOpenChange(open);
        }}
      >
        <ResponsiveModalContent
          sheetLayout="split"
          className={cn(
            'flex max-h-[min(92dvh,52rem)] w-[min(calc(100vw-1.5rem),40rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(95vw,40rem)] sm:p-0'
          )}
        >
          <ResponsiveModalHeader className="border-border/60 shrink-0 space-y-0 border-b px-4 py-3 sm:px-5 sm:py-4">
            <ResponsiveModalTitle className="pr-8 text-base sm:text-lg">
              Location
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5">
            {session ? (
              <PropertyLocationPicker
                value={session}
                disabled={disabled || saving}
                addressError={resolvedAddressError}
                mapError={resolvedMapError}
                onFieldInteract={onFieldInteract}
                onChange={applySessionPatch}
              />
            ) : null}
          </div>

          <ResponsiveModalFooter className="border-border/60 shrink-0 border-t px-4 py-3 sm:px-5">
            <Button
              type="button"
              className="min-h-[44px] w-full sm:ml-auto sm:w-auto"
              disabled={!canSave}
              onClick={() => void handleSave()}
            >
              {saving || persistPending ? 'Saving…' : 'Save'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
