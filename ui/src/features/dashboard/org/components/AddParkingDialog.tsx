import { AddEntityDialog } from '@/features/dashboard/org/components/AddEntityDialog';
import type { Parking } from '@/features/dashboard/org/types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgSlug: string;
  orgName?: string;
  onCreated?: (parking: Parking) => void;
};

/** @deprecated Prefer AddEntityDialog — kept for org parkings page entry point */
export function AddParkingDialog({
  open,
  onOpenChange,
  orgId,
  orgSlug,
  orgName,
  onCreated,
}: Props) {
  return (
    <AddEntityDialog
      open={open}
      onOpenChange={onOpenChange}
      orgId={orgId}
      orgSlug={orgSlug}
      orgName={orgName ?? orgSlug}
      canAddProperty={false}
      canAddParking
      defaultKind="parking"
      onParkingCreated={onCreated}
    />
  );
}
