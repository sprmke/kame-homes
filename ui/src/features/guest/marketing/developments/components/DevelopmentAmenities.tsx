import { motion } from 'framer-motion';
import {
  Waves,
  Dumbbell,
  ShieldCheck,
  Users,
  Coffee,
  Car,
  TreePine,
  Zap,
  Wifi,
  Building2,
  CheckCircle2,
} from 'lucide-react';

import type { Development } from '../types';

const AMENITY_ICONS: Record<string, typeof CheckCircle2> = {
  pool: Waves,
  gym: Dumbbell,
  security: ShieldCheck,
  lounge: Users,
  café: Coffee,
  parking: Car,
  garden: TreePine,
  ev: Zap,
  wifi: Wifi,
  clubhouse: Building2,
};

function getAmenityIcon(amenity: string): typeof CheckCircle2 {
  const lower = amenity.toLowerCase();
  for (const [key, Icon] of Object.entries(AMENITY_ICONS)) {
    if (lower.includes(key)) return Icon;
  }
  return CheckCircle2;
}

interface DevelopmentAmenitiesProps {
  development: Development;
}

export function DevelopmentAmenities({ development }: DevelopmentAmenitiesProps) {
  return (
    <section className="border-border bg-muted/30 border-t">
      <div className="container mx-auto px-4 py-6 sm:px-6 md:py-10 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-foreground mb-1 text-lg font-bold sm:text-xl">Community Amenities</h2>
          <p className="text-muted-foreground mb-5">
            Shared facilities available to all residents of {development.name}.
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {development.amenities.map((amenity, idx) => {
              const Icon = getAmenityIcon(amenity);
              return (
                <motion.div
                  key={amenity}
                  initial={{ opacity: 0, scale: 0.92 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: idx * 0.04 }}
                  className="border-border bg-card flex items-center gap-3 rounded-xl border p-3"
                >
                  <div className="bg-primary/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
                  </div>
                  <span className="text-foreground text-sm font-medium leading-tight">
                    {amenity}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
