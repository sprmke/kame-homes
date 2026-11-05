import { motion } from 'framer-motion';
import { Clock, Shield } from 'lucide-react';

type CancellationHighlight = {
  title: string;
  description: string;
};

type Props = {
  checkInTime: string;
  checkOutTime: string;
  motionDelay?: number;
  cancellation?: CancellationHighlight | null;
};

function TimeCell({ label, time }: { label: string; time: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="bg-primary/10 shrink-0 rounded-full p-2">
        <Clock className="text-primary h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="text-foreground font-semibold">{time}</p>
      </div>
    </div>
  );
}

export function ListingCheckInOutTimes({
  checkInTime,
  checkOutTime,
  motionDelay = 0.3,
  cancellation,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: motionDelay }}
      className="bg-muted/50 @md:flex-row @md:items-center flex flex-col gap-4 rounded-2xl p-4"
    >
      <div className="@md:shrink-0 flex min-w-0 flex-wrap items-center gap-4">
        <TimeCell label="Check-in" time={checkInTime} />
        <div className="bg-border h-px w-full sm:h-8 sm:w-px" />
        <TimeCell label="Check-out" time={checkOutTime} />
      </div>
      {cancellation ? (
        <>
          <div className="bg-border @md:h-8 @md:w-px @md:shrink-0 h-px w-full" />
          <div className="@md:flex-1 flex min-w-0 items-start gap-3">
            <Shield className="text-foreground mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-foreground text-sm font-medium">{cancellation.title}</p>
              <p className="text-muted-foreground text-sm leading-snug">
                {cancellation.description}
              </p>
            </div>
          </div>
        </>
      ) : null}
    </motion.div>
  );
}
