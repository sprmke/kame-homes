import { useCallback, useEffect, useState } from 'react';

import { CheckCircle2, Copy, Loader2, RefreshCw, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import type { IdentitySessionStatus } from '../lib/identityApi';

type CrossDeviceHandoffPanelProps = {
  verifyUrl: string;
  expiresAt: string;
  status: IdentitySessionStatus;
  onRestart: () => void;
};

function remainingLabel(expiresAt: string): string {
  const remainingMs = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 'Link expired';
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')} left`;
}

/**
 * Desktop → phone handoff. QR plus a copyable link; the desktop keeps polling the session
 * and the caller advances itself when the status changes. No `navigate()` from here.
 */
export function CrossDeviceHandoffPanel({
  verifyUrl,
  expiresAt,
  status,
  onRestart,
}: CrossDeviceHandoffPanelProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState(() => remainingLabel(expiresAt));

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(verifyUrl, {
      margin: 1,
      width: 220,
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [verifyUrl]);

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(remainingLabel(expiresAt)), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  // The `remaining` state ticks every second, so this is already re-evaluated on time.
  const expired = Date.parse(expiresAt) <= Date.now();

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the link');
    }
  }, [verifyUrl]);

  if (status === 'completed') {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <CheckCircle2 className="h-7 w-7 text-emerald-500" aria-hidden />
        <p className="text-sm font-semibold">Done</p>
        <p className="text-muted-foreground text-xs">Your phone finished the check.</p>
      </div>
    );
  }

  if (expired || status === 'expired' || status === 'failed') {
    return (
      <div className="space-y-3 py-4 text-center">
        <p className="text-sm font-medium">This link expired</p>
        <Button type="button" variant="outline" onClick={onRestart}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Start again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3">
        <div className="bg-background rounded-xl border p-3">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR code for the verification link"
              width={220}
              height={220}
              className="h-[220px] w-[220px]"
            />
          ) : (
            <div className="flex h-[220px] w-[220px] items-center justify-center">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          )}
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Smartphone className="h-4 w-4" aria-hidden />
          <span>Scan with your phone camera</span>
        </div>
        <p className="text-muted-foreground text-xs">{remaining}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" className="flex-1" onClick={() => void copyLink()}>
          <Copy className="mr-2 h-4 w-4" />
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>

      <div className="text-muted-foreground flex items-center justify-center gap-2 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        <span>Waiting for your phone</span>
      </div>
    </div>
  );
}
