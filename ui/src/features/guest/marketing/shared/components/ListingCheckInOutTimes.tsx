import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

type Props = {
  checkInTime: string;
  checkOutTime: string;
  motionDelay?: number;
};

export function ListingCheckInOutTimes({ checkInTime, checkOutTime, motionDelay = 0.3 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: motionDelay }}
      className="bg-muted/50 flex flex-wrap gap-4 rounded-2xl p-4"
    >
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 rounded-full p-2">
          <Clock className="text-primary h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="text-muted-foreground text-sm">Check-in</p>
          <p className="text-foreground font-semibold">{checkInTime}</p>
        </div>
      </div>
      <div className="bg-border h-px w-full sm:h-auto sm:w-px" />
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 rounded-full p-2">
          <Clock className="text-primary h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="text-muted-foreground text-sm">Check-out</p>
          <p className="text-foreground font-semibold">{checkOutTime}</p>
        </div>
      </div>
    </motion.div>
  );
}
