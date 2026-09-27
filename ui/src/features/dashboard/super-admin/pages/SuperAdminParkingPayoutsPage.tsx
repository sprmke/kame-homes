import { useEffect, useState } from 'react';

import { Wallet } from 'lucide-react';

import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import { SuperAdminPage } from '@/features/dashboard/super-admin/components/shared/SuperAdminPage';
import { SuperAdminPageLoading } from '@/features/dashboard/super-admin/components/shared/SuperAdminPageLoading';
import { SectionContentSkeleton } from '@/components/skeletons/AdminSkeletons';
import { SuperAdminAdminListBodySkeleton } from '@/components/skeletons/SuperAdminSkeletons';
import {
  SuperAdminSettingsCard,
  SuperAdminSettingsRow,
} from '@/features/dashboard/super-admin/components/shared/SuperAdminSettingsCard';
import {
  type ParkingPayoutTransaction,
  useMarkParkingPayoutDisbursed,
  useParkingPayouts,
  usePlatformParkingSettings,
  useRecordParkingPayoutClawback,
  useUpdatePlatformParkingSettings,
} from '@/features/dashboard/super-admin/hooks/usePlatformParkingSettings';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveModalTrigger } from '@/components/ui/responsive-modal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { appPageTitle, usePageTitle } from '@/lib/pageTitle';

function formatPhp(value: number): string {
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function MarkDisbursedDialog({ transaction }: { transaction: ParkingPayoutTransaction }) {
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState('');
  const markDisbursed = useMarkParkingPayoutDisbursed();

  return (
    <AdminDialogShell
      open={open}
      onOpenChange={setOpen}
      title="Mark payout as disbursed"
      description={`Confirms ${formatPhp(transaction.hostNetTotal)} was manually paid out to the host for this booking. Reference is optional (e.g. bank transfer/GCash reference number).`}
      trigger={
        <ResponsiveModalTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="min-h-[44px]">
            Mark disbursed
          </Button>
        </ResponsiveModalTrigger>
      }
      footer={
        <Button
          type="button"
          disabled={markDisbursed.isPending}
          className="min-h-[44px]"
          onClick={async () => {
            await markDisbursed.mutateAsync({
              transactionId: transaction.id,
              reference: reference.trim() || undefined,
            });
            setOpen(false);
            setReference('');
          }}
        >
          Confirm disbursed
        </Button>
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor="disbursement-reference">Reference (optional)</Label>
        <Input
          id="disbursement-reference"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />
      </div>
    </AdminDialogShell>
  );
}

function RecordClawbackDialog({ transaction }: { transaction: ParkingPayoutTransaction }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const recordClawback = useRecordParkingPayoutClawback();

  const submitClawback = async (): Promise<boolean> => {
    if (!amount || !reason.trim()) return false;
    try {
      await recordClawback.mutateAsync({
        transactionId: transaction.id,
        amount: Number(amount),
        reason: reason.trim(),
      });
    } catch {
      return false;
    }
    setOpen(false);
    setAmount('');
    setReason('');
    return true;
  };

  const { onOpenChange: guardedOpenChange, dialogProps } = useGuardedClose({
    open,
    onOpenChange: setOpen,
    isDirty: amount !== '' || reason !== '',
    onSave: submitClawback,
    onDiscard: () => {
      setAmount('');
      setReason('');
    },
  });

  return (
    <>
      <AdminDialogShell
        open={open}
        onOpenChange={guardedOpenChange}
        title="Record a clawback"
        description="Audit trail only (e.g. a chargeback after disbursement). No automated collection happens here."
        trigger={
          <ResponsiveModalTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="min-h-[44px]">
              Record clawback
            </Button>
          </ResponsiveModalTrigger>
        }
        footer={
          <Button
            type="button"
            variant="destructive"
            disabled={recordClawback.isPending || !amount || !reason.trim()}
            className="min-h-[44px]"
            onClick={() => void submitClawback()}
          >
            Confirm clawback
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="clawback-amount">Amount (₱)</Label>
            <Input
              id="clawback-amount"
              type="number"
              min={0.01}
              step={0.01}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clawback-reason">Reason</Label>
            <Textarea
              id="clawback-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>
      </AdminDialogShell>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}

function ParkingSettingsCard() {
  const { data, isLoading, error } = usePlatformParkingSettings();
  const save = useUpdatePlatformParkingSettings();
  const [commissionPct, setCommissionPct] = useState('10');
  const [directCommissionPct, setDirectCommissionPct] = useState('5');
  const [weekday, setWeekday] = useState('400');
  const [weekend, setWeekend] = useState('400');
  const [escalationPhone, setEscalationPhone] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!data || initialized) return;
    setCommissionPct(String(Math.round(data.commissionPct * 1000) / 10));
    setDirectCommissionPct(String(Math.round(data.directCommissionPct * 1000) / 10));
    setWeekday(String(data.guestRateWeekday));
    setWeekend(String(data.guestRateWeekend));
    setEscalationPhone(data.supportEscalationPhone ?? '');
    setInitialized(true);
  }, [data, initialized]);

  const settingsInput = {
    commissionPct: Number(commissionPct) / 100,
    directCommissionPct: Number(directCommissionPct) / 100,
    guestRateWeekday: Number(weekday),
    guestRateWeekend: Number(weekend),
    supportEscalationPhone: escalationPhone.trim(),
  };
  const isDirty =
    !!data &&
    initialized &&
    (commissionPct !== String(Math.round(data.commissionPct * 1000) / 10) ||
      directCommissionPct !== String(Math.round(data.directCommissionPct * 1000) / 10) ||
      weekday !== String(data.guestRateWeekday) ||
      weekend !== String(data.guestRateWeekend) ||
      escalationPhone.trim() !== (data.supportEscalationPhone ?? '').trim());

  const saveSettings = async (): Promise<boolean> => {
    try {
      await save.mutateAsync(settingsInput);
      return true;
    } catch {
      return false;
    }
  };

  useUnsavedChangesGuard({ isDirty, onSave: saveSettings });

  if (isLoading && !data) return <SuperAdminPageLoading metricCount={2} />;
  if (error) return <p className="text-destructive text-sm">Could not load parking settings.</p>;

  return (
    <SuperAdminSettingsCard
      title="Commission & guest rate"
      description="Guest rate is what riders are charged per night and doubles as the price cap that excludes hosts priced above it from matching. Commission is taken from the host's gross rate. Changes only apply to bookings created after saving. Already-paid transactions keep their snapshotted values."
      icon={<Wallet className="text-muted-foreground size-4" aria-hidden />}
      onSubmit={() => void saveSettings()}
      footer={
        <Button type="submit" className="min-h-[44px]" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      {isLoading && !data ? (
        <SectionContentSkeleton rows={4} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SuperAdminSettingsRow stacked label="Commission (%)" htmlFor="commission-pct">
              <Input
                id="commission-pct"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={commissionPct}
                onChange={(event) => setCommissionPct(event.target.value)}
              />
            </SuperAdminSettingsRow>
            <SuperAdminSettingsRow
              stacked
              label="Direct-link commission (%)"
              htmlFor="direct-commission-pct"
            >
              <Input
                id="direct-commission-pct"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={directCommissionPct}
                onChange={(event) => setDirectCommissionPct(event.target.value)}
              />
            </SuperAdminSettingsRow>
            <SuperAdminSettingsRow
              stacked
              label="Guest rate weekday (₱/night)"
              htmlFor="guest-rate-weekday"
            >
              <Input
                id="guest-rate-weekday"
                type="number"
                min={0}
                step={1}
                value={weekday}
                onChange={(event) => setWeekday(event.target.value)}
              />
            </SuperAdminSettingsRow>
            <SuperAdminSettingsRow
              stacked
              label="Guest rate weekend (₱/night)"
              htmlFor="guest-rate-weekend"
            >
              <Input
                id="guest-rate-weekend"
                type="number"
                min={0}
                step={1}
                value={weekend}
                onChange={(event) => setWeekend(event.target.value)}
              />
            </SuperAdminSettingsRow>
          </div>
          <SuperAdminSettingsRow
            stacked
            label="Support escalation phone"
            htmlFor="support-escalation-phone"
            description="Shown to guests on the parking status page for an unresponsive host. Optional."
          >
            <Input
              id="support-escalation-phone"
              type="tel"
              placeholder="e.g. +63 900 000 0000"
              value={escalationPhone}
              onChange={(event) => setEscalationPhone(event.target.value)}
            />
          </SuperAdminSettingsRow>
        </>
      )}
    </SuperAdminSettingsCard>
  );
}

function PayoutRowActions({ txn }: { txn: ParkingPayoutTransaction }) {
  return (
    <div className="flex flex-wrap gap-2">
      {!txn.disbursedAt ? <MarkDisbursedDialog transaction={txn} /> : null}
      <RecordClawbackDialog transaction={txn} />
    </div>
  );
}

function PayoutStatusBadge({ txn }: { txn: ParkingPayoutTransaction }) {
  return txn.disbursedAt ? (
    <Badge variant="secondary">Disbursed</Badge>
  ) : (
    <Badge variant="outline">Awaiting disbursement</Badge>
  );
}

function PayoutsLedger() {
  const { data, isLoading, error } = useParkingPayouts();

  if (isLoading && !data) return <SuperAdminAdminListBodySkeleton metricCount={3} />;
  if (error) return <p className="text-destructive text-sm">Could not load the payout ledger.</p>;

  const transactions = data ?? [];
  if (transactions.length === 0) {
    return <SuperAdminEmptyState icon={Wallet} title="No paid parking bookings yet" />;
  }

  return (
    <>
      {/* Desktop table */}
      <Card className="hidden overflow-hidden lg:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Net payout</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell>
                    <div className="font-medium">{txn.guestName ?? 'Guest'}</div>
                    <div className="text-muted-foreground text-xs">
                      {txn.checkInDate ?? '-'} → {txn.checkOutDate ?? '-'} · {txn.nights} night
                      {txn.nights === 1 ? '' : 's'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{txn.parkingName ?? '-'}</div>
                    <div className="text-muted-foreground text-xs">
                      {txn.organizationName ?? '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{formatPhp(txn.hostNetTotal)}</div>
                    <div className="text-muted-foreground text-xs">
                      Gross {formatPhp(txn.hostGrossTotal)} · Commission{' '}
                      {(txn.commissionPct * 100).toFixed(1)}%
                      {txn.bookingChannel === 'direct_link' ? ' · Direct link' : ''}
                    </div>
                    {txn.clawbackAmount != null ? (
                      <div className="text-destructive text-xs">
                        Clawback: {formatPhp(txn.clawbackAmount)}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <PayoutStatusBadge txn={txn} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <PayoutRowActions txn={txn} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Mobile / tablet cards */}
      <div className="space-y-3 lg:hidden">
        {transactions.map((txn) => (
          <Card key={txn.id} padding="sm" className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{txn.guestName ?? 'Guest'}</div>
                <div className="text-muted-foreground text-xs">
                  {txn.checkInDate ?? '-'} → {txn.checkOutDate ?? '-'} · {txn.nights} night
                  {txn.nights === 1 ? '' : 's'}
                </div>
              </div>
              <PayoutStatusBadge txn={txn} />
            </div>
            <div className="text-sm">
              <div>
                {txn.parkingName ?? '-'}{' '}
                <span className="text-muted-foreground">· {txn.organizationName ?? '-'}</span>
              </div>
              <div className="font-medium">{formatPhp(txn.hostNetTotal)} net</div>
              <div className="text-muted-foreground text-xs">
                Gross {formatPhp(txn.hostGrossTotal)} · Commission{' '}
                {(txn.commissionPct * 100).toFixed(1)}%
                {txn.bookingChannel === 'direct_link' ? ' · Direct link' : ''}
              </div>
              {txn.clawbackAmount != null ? (
                <div className="text-destructive text-xs">
                  Clawback: {formatPhp(txn.clawbackAmount)}
                </div>
              ) : null}
            </div>
            <PayoutRowActions txn={txn} />
          </Card>
        ))}
      </div>
    </>
  );
}

export function SuperAdminParkingPayoutsPage() {
  usePageTitle(appPageTitle('Parking payouts'));

  return (
    <SuperAdminPage
      title="Parking payouts"
      subtitle="Commission / guest-rate config and the manual host disbursement ledger for the parkings vertical."
    >
      <ParkingSettingsCard />
      <div className="space-y-3">
        <h2 className="text-section-title">Disbursement ledger</h2>
        <PayoutsLedger />
      </div>
    </SuperAdminPage>
  );
}
