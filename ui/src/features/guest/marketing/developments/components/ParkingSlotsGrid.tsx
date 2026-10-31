import { AnimatePresence, motion } from 'framer-motion';
import { Car } from 'lucide-react';

import { ParkingSlotCard } from '@/features/guest/marketing/developments/components/ParkingSlotCard';
import { formatParkingSlotLocation } from '@/features/guest/marketing/developments/lib/parkingSlotDisplay';
import type { ParkingListEntry } from '@/features/guest/marketing/parkings/lib/parkingListEntries';

interface ParkingSlotsGridProps {
  entries: ParkingListEntry[];
  /** When set, carousel cards show tower/level instead of development name. */
  showPlacementSubtitle?: boolean;
}

export function ParkingSlotsGrid({ entries, showPlacementSubtitle = true }: ParkingSlotsGridProps) {
  if (entries.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-border bg-muted/30 flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center"
      >
        <Car className="text-muted-foreground/40 mb-3 h-10 w-10" aria-hidden />
        <p className="text-foreground text-base font-semibold">No slots found</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Try adjusting your filters or search dates.
        </p>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={entries.map((entry) => entry.slot.id).join(',')}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
      >
        {entries.map((entry, idx) => (
          <motion.div
            key={entry.slot.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: idx * 0.04 }}
          >
            <ParkingSlotCard
              slot={entry.slot}
              developmentSlug={entry.developmentSlug}
              developmentName={showPlacementSubtitle ? undefined : entry.developmentName}
              subtitle={showPlacementSubtitle ? formatParkingSlotLocation(entry.slot) : undefined}
              city={entry.city}
              detailSlug={entry.detailSlug}
              index={idx}
              variant="carousel"
            />
          </motion.div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
