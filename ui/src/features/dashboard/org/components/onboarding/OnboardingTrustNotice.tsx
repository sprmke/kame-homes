import { ShieldCheck } from 'lucide-react';

export function OnboardingTrustNotice() {
  return (
    <div className="border-primary/20 from-primary/8 via-card to-card space-y-3 rounded-xl border bg-gradient-to-br p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span
          className="bg-primary/15 text-primary flex size-9 shrink-0 items-center justify-center rounded-full"
          aria-hidden
        >
          <ShieldCheck className="size-4" />
        </span>
        <p className="text-foreground text-sm font-semibold">Scam-free hosting</p>
      </div>
      <div className="text-muted-foreground space-y-2 text-[13px] leading-relaxed sm:text-sm">
        <p>
          To create a scam-free platform, we verify every host so guests can book with confidence.
          You may hide sensitive details on documents as long as the information needed for
          verification stays visible.
        </p>
        <p>
          Your documents are stored securely and are never shown on your public listing. Review
          usually takes a few hours and can take up to 3 days.
        </p>
      </div>
    </div>
  );
}
